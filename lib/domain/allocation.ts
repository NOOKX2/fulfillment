import {
  addStock,
  allocationOrder,
  fail,
  firstBinOfZone,
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
import { assertTransition, orderMachine } from "./machines";
import { createPutawayTasks } from "./putaway";
import { releaseReservations } from "./reservation";
import type { AppState, ID, Order, PickTask } from "./types";

interface PlanItem {
  lineId: ID;
  skuId: ID;
  rowId: ID;
  qty: number;
}

/**
 * Allocate lots for an order (reservation -> allocation).
 * FEFO when the SKU tracks expiry, FIFO otherwise; near-expiry lots are skipped.
 */
export function allocateOrder(s: AppState, ctx: Ctx, orderId: ID): Result<{ allocations: number }> {
  const order = s.orders.find((o) => o.id === orderId);
  if (!order) return fail("ORDER_NOT_FOUND");
  if (order.status !== "paid_reserved") return fail("BAD_ORDER_STATE", order.status);

  const used: Record<ID, number> = {};
  const plan: PlanItem[] = [];
  let ok_ = true;
  for (const line of order.lines) {
    const sku = skuById(s, line.skuId);
    if (!sku) return fail("SKU_NOT_FOUND");
    let need = line.qty;
    const rows = allocationOrder(s, sku, sellableRows(s, sku.id, today(ctx)));
    for (const r of rows) {
      if (need <= 0) break;
      const free = r.qty - r.qtyAllocated - (used[r.id] ?? 0);
      if (free <= 0) continue;
      const take = Math.min(free, need);
      used[r.id] = (used[r.id] ?? 0) + take;
      plan.push({ lineId: line.id, skuId: sku.id, rowId: r.id, qty: take });
      need -= take;
    }
    if (need > 0) {
      ok_ = false;
      break;
    }
  }

  if (!ok_) {
    releaseReservations(s, ctx, order.id);
    assertTransition("order", orderMachine, order.status, "awaiting_stock");
    order.status = "awaiting_stock";
    return fail("ALLOCATION_FAILED", undefined, { commit: true });
  }

  for (const p of plan) {
    const row = s.stock.find((r) => r.id === p.rowId)!;
    row.qtyAllocated += p.qty;
    s.allocations.push({
      id: nextId(s, "alc"),
      orderId: order.id,
      lineId: p.lineId,
      skuId: p.skuId,
      stockRowId: row.id,
      lotNo: row.lotNo,
      binId: row.binId,
      expiryDate: row.expiryDate,
      receivedAt: row.receivedAt,
      qty: p.qty,
      picked: 0,
      status: "allocated",
    });
    pushLedger(s, ctx, {
      type: "allocate",
      skuId: p.skuId,
      lotNo: row.lotNo,
      fromBinId: row.binId,
      qty: p.qty,
      refType: "order",
      refId: order.id,
    });
  }
  for (const r of s.reservations) {
    if (r.orderId === order.id && r.status === "active") r.status = "converted";
  }
  assertTransition("order", orderMachine, order.status, "allocated");
  order.status = "allocated";
  return ok({ allocations: plan.length });
}

/** Mark all allocations of a pick task as picked and move stock into the tote (WIP). */
export function applyTaskPick(s: AppState, ctx: Ctx, task: PickTask): void {
  for (const id of task.allocationIds) {
    const alloc = s.allocations.find((a) => a.id === id);
    if (!alloc || alloc.status === "cancelled") continue;
    const n = alloc.qty - alloc.picked;
    if (n <= 0) continue;
    const row = s.stock.find((r) => r.id === alloc.stockRowId);
    if (row) {
      row.qtyAllocated = Math.max(0, row.qtyAllocated - n);
      takeFromRow(s, row, n);
    }
    alloc.picked = alloc.qty;
    alloc.status = "picked";
    pushLedger(s, ctx, {
      type: "pick",
      skuId: alloc.skuId,
      lotNo: alloc.lotNo,
      fromBinId: alloc.binId,
      qty: n,
      refType: "order",
      refId: alloc.orderId,
    });
    refreshOrderPicked(s, alloc.orderId);
  }
  task.pickedQty = task.qty;
  task.status = "picked";
}

/** Order becomes `picked` when every live allocation is picked. */
export function refreshOrderPicked(s: AppState, orderId: ID): void {
  const order = s.orders.find((o) => o.id === orderId);
  if (!order || (order.status !== "in_wave" && order.status !== "picking")) return;
  const live = s.allocations.filter((a) => a.orderId === orderId && a.status !== "cancelled");
  if (live.length > 0 && live.every((a) => a.picked >= a.qty)) {
    if (order.status === "in_wave") order.status = "picking";
    assertTransition("order", orderMachine, order.status, "picked");
    order.status = "picked";
  }
}

/** Wave is `picked` when no pick task is pending any more. */
export function refreshWave(s: AppState, waveId: ID): void {
  const wave = s.waves.find((w) => w.id === waveId);
  if (!wave || (wave.status !== "released" && wave.status !== "picking")) return;
  const tasks = s.pickTasks.filter((t) => t.waveId === waveId);
  if (tasks.length === 0 || tasks.every((t) => t.status !== "pending")) wave.status = "picked";
}

/**
 * Release every lock an order holds: allocations, reservations, pick-task
 * lines, tote and wave membership. Picked-but-unpacked units go back to a
 * receiving bin with a return-to-bin putaway task.
 */
export function unallocateOrder(
  s: AppState,
  ctx: Ctx,
  order: Order,
  toStatus: "cancelled" | "awaiting_stock",
): void {
  const recvBin = firstBinOfZone(s, "receiving");
  const touchedWaves = new Set<ID>();

  for (const alloc of s.allocations.filter(
    (a) => a.orderId === order.id && a.status !== "cancelled" && a.status !== "shipped",
  )) {
    const remaining = alloc.qty - alloc.picked;
    const row = s.stock.find((r) => r.id === alloc.stockRowId);
    if (row && remaining > 0) row.qtyAllocated = Math.max(0, row.qtyAllocated - remaining);

    for (const t of s.pickTasks.filter((x) => x.allocationIds.includes(alloc.id))) {
      touchedWaves.add(t.waveId);
      if (t.status === "pending") {
        t.allocationIds = t.allocationIds.filter((i) => i !== alloc.id);
        t.qty -= remaining;
        if (t.qty <= 0) {
          t.status = "skipped";
          t.qty = 0;
          t.pickedQty = 0;
        } else if (t.pickedQty >= t.qty) {
          applyTaskPick(s, ctx, t);
        }
      }
    }

    if (alloc.picked > 0 && recvBin) {
      addStock(s, {
        skuId: alloc.skuId,
        lotNo: alloc.lotNo,
        expiryDate: alloc.expiryDate,
        receivedAt: alloc.receivedAt,
        binId: recvBin.id,
        status: "sellable",
        qty: alloc.picked,
      });
      pushLedger(s, ctx, {
        type: "adjust",
        skuId: alloc.skuId,
        lotNo: alloc.lotNo,
        toBinId: recvBin.id,
        qty: alloc.picked,
        refType: "order",
        refId: order.id,
        note: "return-to-bin",
      });
      createPutawayTasks(s, ctx, {
        skuId: alloc.skuId,
        lotNo: alloc.lotNo,
        expiryDate: alloc.expiryDate,
        receivedAt: alloc.receivedAt,
        qty: alloc.picked,
        fromBinId: recvBin.id,
        note: "return-to-bin",
      });
    }
    alloc.status = "cancelled";
  }

  releaseReservations(s, ctx, order.id);

  for (const w of s.waves) {
    if (w.orderIds.includes(order.id)) {
      w.orderIds = w.orderIds.filter((i) => i !== order.id);
      touchedWaves.add(w.id);
    }
  }
  for (const t of s.totes) t.orderIds = t.orderIds.filter((i) => i !== order.id);
  for (const p of s.packSessions) {
    if (p.orderId === order.id && p.status !== "label_issued" && p.status !== "closed") {
      p.status = "closed"; // abandoned: order was cancelled / un-allocated
      p.redLightOn = false;
    }
  }
  for (const id of touchedWaves) refreshWave(s, id);

  assertTransition("order", orderMachine, order.status, toStatus);
  order.status = toStatus;
  order.waveId = undefined;
}
