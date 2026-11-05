import { localTimeToISO } from "../clock";
import { resolveBin, resolveSku } from "../scan/validate";
import {
  allocationOrder,
  atp,
  binById,
  fail,
  nextId,
  ok,
  pushLedger,
  sellableRows,
  skuById,
  takeFromRow,
  today,
  type Ctx,
  type Result,
} from "./core";
import {
  allocateOrder,
  applyTaskPick,
  refreshOrderPicked,
  refreshWave,
  unallocateOrder,
} from "./allocation";
import { assertTransition, orderMachine, pickTaskMachine, waveMachine } from "./machines";
import { retryAwaiting } from "./reservation";
import type {
  AppState,
  ID,
  Order,
  PickTask,
  Wave,
  WaveStrategy,
} from "./types";

export function classifyOrder(s: AppState, o: Order): WaveStrategy {
  const skus = o.lines.map((l) => skuById(s, l.skuId));
  const allEnvelope = skus.every((k) => k?.packClass === "envelope");
  if (!allEnvelope) return "large_box";
  if (o.lines.length === 1 && o.lines[0].qty === 1) return "single_item_envelope";
  return "multi_item_envelope";
}

/**
 * Group allocated orders into draft waves by (strategy, carrier).
 * Single/multi-item envelopes are batch-picked by SKU; large boxes are discrete.
 */
export function buildWaves(s: AppState, ctx: Ctx): Result<{ waves: number; orders: number }> {
  const ready = s.orders.filter(
    (o) => (o.status === "paid_reserved" || o.status === "allocated") && !o.waveId,
  );
  if (ready.length === 0) return fail("NO_ORDERS");

  for (const o of ready) if (o.status === "paid_reserved") allocateOrder(s, ctx, o.id);

  const groups = new Map<string, Order[]>();
  for (const o of s.orders) {
    if (o.status !== "allocated" || o.waveId) continue;
    const key = `${classifyOrder(s, o)}|${o.carrier}`;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  if (groups.size === 0) return fail("NO_ORDERS");

  let orders = 0;
  for (const [key, list] of groups) {
    const [strategy, carrier] = key.split("|") as [WaveStrategy, Order["carrier"]];
    const cfg = s.settings.carriers.find((c) => c.code === carrier);
    const wave: Wave = {
      id: nextId(s, "wav"),
      name: `WAVE-${String(s.seq["wav"]).padStart(3, "0")}`,
      strategy,
      carrier,
      cutoffAt: cfg ? localTimeToISO(ctx.now, cfg.cutoffLocal) : undefined,
      orderIds: list.sort((a, b) => a.shipBy.localeCompare(b.shipBy)).map((o) => o.id),
      pickMode: strategy === "large_box" ? "discrete_order" : "batch_by_sku",
      status: "draft",
      createdAt: ctx.now,
    };
    s.waves.push(wave);
    for (const o of list) o.waveId = wave.id;
    orders += list.length;
  }
  return ok({ waves: groups.size, orders });
}

export function removeOrderFromWave(s: AppState, waveId: ID, orderId: ID): Result<void> {
  const wave = s.waves.find((w) => w.id === waveId);
  if (!wave) return fail("WAVE_NOT_FOUND");
  if (wave.status !== "draft") return fail("WAVE_STATE", wave.status);
  wave.orderIds = wave.orderIds.filter((i) => i !== orderId);
  const o = s.orders.find((x) => x.id === orderId);
  if (o) o.waveId = undefined;
  if (wave.orderIds.length === 0) wave.status = "cancelled";
  return ok();
}

export function cancelWave(s: AppState, waveId: ID): Result<void> {
  const wave = s.waves.find((w) => w.id === waveId);
  if (!wave) return fail("WAVE_NOT_FOUND");
  if (wave.status !== "draft") return fail("WAVE_STATE", wave.status);
  for (const id of wave.orderIds) {
    const o = s.orders.find((x) => x.id === id);
    if (o) o.waveId = undefined;
  }
  wave.orderIds = [];
  assertTransition("wave", waveMachine, wave.status, "cancelled");
  wave.status = "cancelled";
  return ok();
}

function renumberPending(s: AppState, waveId: ID): void {
  const tasks = s.pickTasks.filter((t) => t.waveId === waveId);
  const done = tasks.filter((t) => t.status !== "pending");
  const pending = tasks
    .filter((t) => t.status === "pending")
    .sort((a, b) => (binById(s, a.binId)?.pickSeq ?? 0) - (binById(s, b.binId)?.pickSeq ?? 0));
  let n = done.reduce((m, t) => Math.max(m, t.seq), 0);
  for (const t of pending) t.seq = ++n;
}

/** Release a draft wave: create totes and pick tasks sorted along the walking route. */
export function releaseWave(s: AppState, ctx: Ctx, waveId: ID): Result<{ tasks: number }> {
  const wave = s.waves.find((w) => w.id === waveId);
  if (!wave) return fail("WAVE_NOT_FOUND");
  if (wave.status !== "draft") return fail("WAVE_STATE", wave.status);
  const orders = wave.orderIds
    .map((id) => s.orders.find((o) => o.id === id))
    .filter((o): o is Order => !!o && o.status === "allocated");
  if (orders.length === 0) return fail("NO_ORDERS");
  wave.orderIds = orders.map((o) => o.id);

  const toteFor = new Map<ID, ID>();
  const mkTote = (orderIds: ID[]) => {
    const id = nextId(s, "tot");
    s.totes.push({ id, barcode: `TOT:${id}`, waveId: wave.id, orderIds, status: "in_use" });
    return id;
  };
  if (wave.pickMode === "batch_by_sku") {
    const t = mkTote(orders.map((o) => o.id));
    for (const o of orders) toteFor.set(o.id, t);
  } else {
    for (const o of orders) toteFor.set(o.id, mkTote([o.id]));
  }

  const tasks = new Map<string, PickTask>();
  for (const o of orders) {
    for (const a of s.allocations.filter((x) => x.orderId === o.id && x.status === "allocated")) {
      const key = wave.pickMode === "batch_by_sku" ? a.stockRowId : a.id;
      const existing = tasks.get(key);
      if (existing) {
        existing.qty += a.qty;
        existing.allocationIds.push(a.id);
      } else {
        tasks.set(key, {
          id: nextId(s, "pck"),
          waveId: wave.id,
          seq: 0,
          binId: a.binId,
          skuId: a.skuId,
          lotNo: a.lotNo,
          qty: a.qty,
          allocationIds: [a.id],
          toteId: toteFor.get(o.id)!,
          pickedQty: 0,
          binScanned: false,
          status: "pending",
        });
      }
    }
  }
  const list = [...tasks.values()].sort(
    (a, b) => (binById(s, a.binId)?.pickSeq ?? 0) - (binById(s, b.binId)?.pickSeq ?? 0),
  );
  list.forEach((t, i) => {
    t.seq = i + 1;
    s.pickTasks.push(t);
  });

  for (const o of orders) {
    assertTransition("order", orderMachine, o.status, "in_wave");
    o.status = "in_wave";
  }
  assertTransition("wave", waveMachine, wave.status, "released");
  wave.status = "released";
  wave.releasedAt = ctx.now;
  return ok({ tasks: list.length });
}

function startWave(s: AppState, wave: Wave): void {
  if (wave.status !== "released") return;
  assertTransition("wave", waveMachine, wave.status, "picking");
  wave.status = "picking";
  for (const id of wave.orderIds) {
    const o = s.orders.find((x) => x.id === id);
    if (o && o.status === "in_wave") o.status = "picking";
  }
}

export const currentTask = (s: AppState, waveId: ID): PickTask | undefined =>
  s.pickTasks
    .filter((t) => t.waveId === waveId && t.status === "pending")
    .sort((a, b) => a.seq - b.seq)[0];

/** PDA pick: scan the bin label first, then the item (once per unit). */
export function pickScan(
  s: AppState,
  ctx: Ctx,
  input: { waveId: ID; raw: string },
): Result<{ step: "bin" | "item"; taskDone: boolean; waveDone: boolean }> {
  const wave = s.waves.find((w) => w.id === input.waveId);
  if (!wave) return fail("WAVE_NOT_FOUND");
  if (wave.status !== "released" && wave.status !== "picking") return fail("WAVE_STATE", wave.status);
  const task = currentTask(s, wave.id);
  if (!task) return fail("PICK_TASK_NONE");

  if (!task.binScanned) {
    const r = resolveBin(s, input.raw);
    if (!r.ok) return fail(r.code === "SCAN_ORDER" ? "SCAN_BIN_FIRST" : r.code, r.detail);
    if (r.entity.id !== task.binId) return fail("WRONG_BIN", r.entity.path);
    startWave(s, wave);
    task.binScanned = true;
    return ok({ step: "bin", taskDone: false, waveDone: false });
  }

  const r = resolveSku(s, input.raw);
  if (!r.ok) return fail(r.code, r.detail);
  if (r.entity.id !== task.skuId) return fail("WRONG_ITEM");
  startWave(s, wave);
  task.pickedQty += 1;
  if (task.pickedQty >= task.qty) {
    applyTaskPick(s, ctx, task);
    refreshWave(s, wave.id);
    return ok({ step: "item", taskDone: true, waveDone: (s.waves.find((w) => w.id === wave.id)?.status as string) === "picked" });
  }
  return ok({ step: "item", taskDone: false, waveDone: false });
}

/**
 * Short pick: stock is missing at the bin. Picked units are kept, the missing
 * quantity is written off the bin and re-allocated from the next lot/bin; if no
 * other stock exists the order goes back to `awaiting_stock`.
 */
export function shortPick(
  s: AppState,
  ctx: Ctx,
  input: { taskId: ID; reason: string },
): Result<{ reallocated: number; orderBounced: number }> {
  const task = s.pickTasks.find((t) => t.id === input.taskId);
  if (!task) return fail("TASK_NOT_FOUND");
  if (task.status !== "pending") return fail("TASK_DONE");
  if (!input.reason.trim()) return fail("REASON_REQUIRED");
  const wave = s.waves.find((w) => w.id === task.waveId);
  if (!wave) return fail("WAVE_NOT_FOUND");
  startWave(s, wave);

  let remainingPicked = task.pickedQty;
  const shortfalls: { order: Order; lineId: ID; skuId: ID; qty: number }[] = [];
  for (const id of task.allocationIds) {
    const alloc = s.allocations.find((a) => a.id === id);
    if (!alloc || alloc.status === "cancelled") continue;
    const pick = Math.min(alloc.qty, remainingPicked);
    remainingPicked -= pick;
    const short = alloc.qty - pick;
    const row = s.stock.find((r) => r.id === alloc.stockRowId);
    if (row) {
      row.qtyAllocated = Math.max(0, row.qtyAllocated - alloc.qty);
      takeFromRow(s, row, alloc.qty); // picked units leave the bin, missing ones are written off
    }
    if (pick > 0) {
      pushLedger(s, ctx, {
        type: "pick",
        skuId: alloc.skuId,
        lotNo: alloc.lotNo,
        fromBinId: alloc.binId,
        qty: pick,
        refType: "order",
        refId: alloc.orderId,
      });
    }
    if (short > 0) {
      pushLedger(s, ctx, {
        type: "adjust",
        skuId: alloc.skuId,
        lotNo: alloc.lotNo,
        fromBinId: alloc.binId,
        qty: short,
        refType: "pick",
        refId: task.id,
        note: `short pick: ${input.reason}`,
      });
      const order = s.orders.find((o) => o.id === alloc.orderId)!;
      shortfalls.push({ order, lineId: alloc.lineId, skuId: alloc.skuId, qty: short });
    }
    alloc.qty = pick;
    alloc.picked = pick;
    alloc.status = pick > 0 ? "picked" : "cancelled";
  }
  assertTransition("pickTask", pickTaskMachine, task.status, "short");
  task.status = "short";
  task.shortReason = input.reason.trim();

  let reallocated = 0;
  let orderBounced = 0;
  const bounced = new Set<ID>();
  for (const f of shortfalls) {
    if (bounced.has(f.order.id)) continue;
    const sku = skuById(s, f.skuId)!;
    if (atp(s, f.skuId, today(ctx)) >= f.qty) {
      let need = f.qty;
      for (const r of allocationOrder(s, sku, sellableRows(s, sku.id, today(ctx)))) {
        if (need <= 0) break;
        const free = r.qty - r.qtyAllocated;
        if (free <= 0) continue;
        const take = Math.min(free, need);
        r.qtyAllocated += take;
        const alloc = {
          id: nextId(s, "alc"),
          orderId: f.order.id,
          lineId: f.lineId,
          skuId: f.skuId,
          stockRowId: r.id,
          lotNo: r.lotNo,
          binId: r.binId,
          expiryDate: r.expiryDate,
          receivedAt: r.receivedAt,
          qty: take,
          picked: 0,
          status: "allocated" as const,
        };
        s.allocations.push(alloc);
        s.pickTasks.push({
          id: nextId(s, "pck"),
          waveId: wave.id,
          seq: 9999,
          binId: r.binId,
          skuId: f.skuId,
          lotNo: r.lotNo,
          qty: take,
          allocationIds: [alloc.id],
          toteId: task.toteId,
          pickedQty: 0,
          binScanned: false,
          status: "pending",
        });
        pushLedger(s, ctx, {
          type: "allocate",
          skuId: f.skuId,
          lotNo: r.lotNo,
          fromBinId: r.binId,
          qty: take,
          refType: "order",
          refId: f.order.id,
          note: "re-allocation after short pick",
        });
        need -= take;
        reallocated++;
      }
    } else {
      bounced.add(f.order.id);
      unallocateOrder(s, ctx, f.order, "awaiting_stock");
      orderBounced++;
    }
  }
  renumberPending(s, wave.id);
  for (const o of s.orders) if (wave.orderIds.includes(o.id)) refreshOrderPicked(s, o.id);
  refreshWave(s, wave.id);
  retryAwaiting(s, ctx);
  return ok({ reallocated, orderBounced });
}

/** Close a fully picked wave and hand the totes to the pack bench. */
export function closeWave(s: AppState, waveId: ID): Result<void> {
  const wave = s.waves.find((w) => w.id === waveId);
  if (!wave) return fail("WAVE_NOT_FOUND");
  if (wave.status !== "picked") return fail("WAVE_STATE", wave.status);
  assertTransition("wave", waveMachine, wave.status, "closed");
  wave.status = "closed";
  for (const t of s.totes) if (t.waveId === wave.id && t.status === "in_use") t.status = "at_pack";
  return ok();
}
