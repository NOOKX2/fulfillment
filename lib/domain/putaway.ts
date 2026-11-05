import { resolveBin, resolveSku } from "../scan/validate";
import {
  addStock,
  binById,
  binCapacityFor,
  fail,
  findRow,
  isPickableBin,
  nextId,
  ok,
  pushLedger,
  skuById,
  takeFromRow,
  type Ctx,
  type Result,
} from "./core";
import { assertTransition, putawayMachine } from "./machines";
import { retryAwaiting } from "./reservation";
import type {
  AppState,
  Bin,
  ID,
  PutawayReason,
  PutawaySuggestion,
  PutawayTask,
  Sku,
} from "./types";

/**
 * Directed putaway scoring.
 *  - velocity A: golden shelf +50, normal +20, bound pick face +40
 *  - velocity B: normal shelf +25
 *  - velocity C: high/floor +30, golden -20
 *  - same SKU already in bin +25
 *  - velocity A: nearer pickSeq up to +15
 */
export function suggestBins(
  s: AppState,
  sku: Sku,
  qty: number,
  exclude: ID[] = [],
  limit = 3,
): PutawaySuggestion[] {
  const candidates = s.bins.filter(
    (b) => isPickableBin(b) && !exclude.includes(b.id) && binCapacityFor(s, b, sku) >= 1,
  );
  const seqs = s.bins.filter((b) => isPickableBin(b)).map((b) => b.pickSeq);
  const minSeq = Math.min(...seqs);
  const maxSeq = Math.max(...seqs);

  const scored = candidates.map((b) => {
    let score = 0;
    const reasons: PutawayReason[] = ["fits_dims", "fits_weight"];
    const cap = binCapacityFor(s, b, sku);
    if (cap >= qty) score += 5;
    if (sku.velocity === "A") {
      if (b.ergonomics === "golden") {
        score += 50;
        reasons.push("velocity_golden");
      } else if (b.ergonomics === "normal") score += 20;
      const frac = maxSeq === minSeq ? 0 : (b.pickSeq - minSeq) / (maxSeq - minSeq);
      score += Math.round(15 * (1 - frac));
      reasons.push("nearest_pickseq");
    } else if (sku.velocity === "B") {
      if (b.ergonomics === "normal") score += 25;
      else if (b.ergonomics === "golden") score += 10;
    } else {
      if (b.ergonomics === "high" || b.ergonomics === "floor") {
        score += 30;
        reasons.push("slow_mover_high");
      } else if (b.ergonomics === "golden") score -= 20;
    }
    if (s.stock.some((r) => r.binId === b.id && r.skuId === sku.id && r.qty > 0)) {
      score += 25;
      reasons.push("same_sku_consolidate");
    }
    if (s.bindings.some((x) => x.binId === b.id && x.skuId === sku.id)) {
      score += 40;
      reasons.push("bound_pickface");
    }
    return { binId: b.id, score, reasons, pickSeq: b.pickSeq };
  });
  scored.sort((a, b) => b.score - a.score || a.pickSeq - b.pickSeq);
  return scored.slice(0, limit).map(({ binId, score, reasons }) => ({ binId, score, reasons }));
}

/** Create putaway task(s) for sellable stock sitting outside a storage bin. Splits by capacity. */
export function createPutawayTasks(
  s: AppState,
  ctx: Ctx,
  input: {
    skuId: ID;
    lotNo: string;
    expiryDate?: string;
    receivedAt: string;
    qty: number;
    fromBinId: ID;
    note?: string;
  },
): PutawayTask[] {
  const sku = skuById(s, input.skuId);
  if (!sku) return [];
  const created: PutawayTask[] = [];
  let remaining = input.qty;
  const used: ID[] = [];
  let guard = 0;
  while (remaining > 0 && guard++ < 20) {
    const suggestions = suggestBins(s, sku, remaining, used);
    const top = suggestions[0];
    const cap = top ? binCapacityFor(s, binById(s, top.binId)!, sku) : 0;
    const take = top && cap > 0 && cap < remaining ? cap : remaining;
    const task: PutawayTask = {
      id: nextId(s, "put"),
      skuId: input.skuId,
      lotNo: input.lotNo,
      expiryDate: input.expiryDate,
      receivedAt: input.receivedAt,
      qty: take,
      fromBinId: input.fromBinId,
      suggestions,
      status: "suggested",
      createdAt: ctx.now,
      note: input.note,
    };
    s.putaway.push(task);
    created.push(task);
    remaining -= take;
    if (top) used.push(top.binId);
    if (!top) break;
  }
  if (remaining > 0 && created.length) created[created.length - 1].qty += remaining;
  return created;
}

export function resuggest(s: AppState, taskId: ID): Result<void> {
  const task = s.putaway.find((t) => t.id === taskId);
  if (!task) return fail("TASK_NOT_FOUND");
  if (task.status === "completed" || task.status === "cancelled") return fail("TASK_DONE");
  const sku = skuById(s, task.skuId);
  if (!sku) return fail("SKU_NOT_FOUND");
  task.suggestions = suggestBins(s, sku, task.qty);
  return ok();
}

/** Step 1 of the two-scan putaway: scan the item barcode. */
export function putawayScanItem(
  s: AppState,
  _ctx: Ctx,
  input: { taskId: ID; raw: string },
): Result<void> {
  const task = s.putaway.find((t) => t.id === input.taskId);
  if (!task) return fail("TASK_NOT_FOUND");
  if (task.status === "completed" || task.status === "cancelled") return fail("TASK_DONE");
  // A bin label scanned first is a scan-order error.
  const bin = resolveBin(s, input.raw);
  if (bin.ok) return fail("SCAN_ORDER");
  const sku = resolveSku(s, input.raw);
  if (!sku.ok) return fail(sku.code, sku.detail);
  if (sku.entity.id !== task.skuId) return fail("WRONG_ITEM");
  assertTransition("putaway", putawayMachine, task.status, "in_progress");
  task.status = "in_progress";
  task.scannedItemOk = true;
  return ok();
}

/** Step 2: scan the bin label. Completes the task and writes the real location. */
export function putawayScanBin(
  s: AppState,
  ctx: Ctx,
  input: { taskId: ID; raw: string; overrideReason?: string },
): Result<{ binId: ID }> {
  const task = s.putaway.find((t) => t.id === input.taskId);
  if (!task) return fail("TASK_NOT_FOUND");
  if (task.status === "completed" || task.status === "cancelled") return fail("TASK_DONE");
  if (!task.scannedItemOk) return fail("SCAN_ORDER");
  const sku = skuById(s, task.skuId);
  if (!sku) return fail("SKU_NOT_FOUND");

  const r = resolveBin(s, input.raw);
  if (!r.ok) return fail(r.code, r.detail);
  const bin: Bin = r.entity;
  if (!isPickableBin(bin)) return fail("BIN_NOT_ALLOWED");

  const suggested = task.suggestions.some((x) => x.binId === bin.id);
  const reason = input.overrideReason?.trim();
  if (!suggested && !reason) return fail("NOT_SUGGESTED_BIN", bin.id);
  if (binCapacityFor(s, bin, sku) < task.qty) return fail("BIN_FULL", bin.id);

  const src = findRow(s, {
    skuId: task.skuId,
    lotNo: task.lotNo,
    binId: task.fromBinId,
    status: "sellable",
  });
  if (!src || src.qty < task.qty) return fail("ROW_NOT_FOUND");
  takeFromRow(s, src, task.qty);
  addStock(s, {
    skuId: task.skuId,
    lotNo: task.lotNo,
    expiryDate: task.expiryDate,
    receivedAt: task.receivedAt,
    binId: bin.id,
    status: "sellable",
    qty: task.qty,
  });
  pushLedger(s, ctx, {
    type: "putaway",
    skuId: task.skuId,
    lotNo: task.lotNo,
    fromBinId: task.fromBinId,
    toBinId: bin.id,
    qty: task.qty,
    refType: "putaway",
    refId: task.id,
    note: suggested ? undefined : reason,
  });
  assertTransition("putaway", putawayMachine, task.status, "completed");
  task.status = "completed";
  task.scannedBinOk = true;
  task.chosenBinId = bin.id;
  task.overrideReason = suggested ? undefined : reason;
  task.completedAt = ctx.now;
  retryAwaiting(s, ctx);
  return ok({ binId: bin.id });
}

export function cancelPutaway(s: AppState, taskId: ID): Result<void> {
  const task = s.putaway.find((t) => t.id === taskId);
  if (!task) return fail("TASK_NOT_FOUND");
  if (task.status === "completed" || task.status === "cancelled") return fail("TASK_DONE");
  assertTransition("putaway", putawayMachine, task.status, "cancelled");
  task.status = "cancelled";
  return ok();
}

/** Bin binding (fixed pick face for a SKU). */
export function bindBin(s: AppState, ctx: Ctx, input: { binId: ID; skuId: ID }): Result<void> {
  const bin = binById(s, input.binId);
  if (!bin) return fail("BIN_NOT_FOUND");
  if (!skuById(s, input.skuId)) return fail("SKU_NOT_FOUND");
  s.bindings = s.bindings.filter((b) => b.binId !== input.binId);
  s.bindings.push({ binId: input.binId, skuId: input.skuId, boundAt: ctx.now });
  return ok();
}

export function unbindBin(s: AppState, binId: ID): Result<void> {
  s.bindings = s.bindings.filter((b) => b.binId !== binId);
  return ok();
}
