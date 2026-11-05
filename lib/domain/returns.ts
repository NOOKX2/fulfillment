import { parseScan } from "../scan/parse";
import { resolveBin, resolveSku } from "../scan/validate";
import {
  addStock,
  binById,
  binCapacityFor,
  fail,
  findRow,
  firstBinOfZone,
  isPickableBin,
  nextId,
  ok,
  pushLedger,
  skuById,
  takeFromRow,
  type Ctx,
  type Result,
} from "./core";
import { assertTransition, orderMachine, returnMachine } from "./machines";
import { queueOutbox } from "./outbox";
import { retryAwaiting } from "./reservation";
import type {
  AppState,
  Disposition,
  Grade,
  ID,
  Order,
  ReturnLine,
  ReturnOrder,
} from "./types";

function buildReturn(s: AppState, ctx: Ctx, order: Order, reason: string): ReturnOrder {
  const lines: ReturnLine[] = s.allocations
    .filter((a) => a.orderId === order.id && a.status === "shipped")
    .map((a) => ({
      id: nextId(s, "rtl"),
      orderLineId: a.lineId,
      skuId: a.skuId,
      expectedQty: a.qty,
      receivedQty: 0,
      originBinId: a.binId,
      lotNo: a.lotNo,
      expiryDate: a.expiryDate,
      originReceivedAt: a.receivedAt,
    }));
  const id = nextId(s, "ret");
  const n = s.seq["ret"];
  const ret: ReturnOrder = {
    id,
    rmaNo: `RMA-${String(2600 + n).padStart(6, "0")}`,
    returnTrackingNo: `RT${String(710000000 + n * 13).padStart(9, "0")}`,
    orderId: order.id,
    reason,
    lines,
    status: "expected",
    createdAt: ctx.now,
  };
  s.returns.push(ret);
  assertTransition("order", orderMachine, order.status, "return_in_progress");
  order.status = "return_in_progress";
  return ret;
}

/** Demo helper: the buyer ships a handed-over order back. */
export function createDemoReturn(
  s: AppState,
  ctx: Ctx,
  input: { orderId?: ID; reason?: string } = {},
): Result<{ returnId: ID }> {
  const order = input.orderId
    ? s.orders.find((o) => o.id === input.orderId)
    : s.orders.find((o) => o.status === "handed_over");
  if (!order) return fail("ORDER_NOT_FOUND");
  if (order.status !== "handed_over") return fail("ORDER_NOT_RETURNABLE", order.status);
  const ret = buildReturn(s, ctx, order, input.reason ?? "ลูกค้าเปลี่ยนใจ / Buyer changed mind");
  return ok({ returnId: ret.id });
}

/**
 * Return barcode intake: scan the RMA, the return tracking number, or the
 * original airway bill on the returned box - the original order is pulled up.
 */
export function returnIntake(
  s: AppState,
  ctx: Ctx,
  input: { raw: string },
): Result<{ returnId: ID; created: boolean }> {
  const p = parseScan(input.raw);
  const code = (p.kind === "sku" ? p.raw : p.value).toLowerCase();
  let ret = s.returns.find(
    (r) => r.rmaNo.toLowerCase() === code || r.returnTrackingNo.toLowerCase() === code,
  );
  let created = false;
  if (!ret) {
    const sh = s.shipments.find((x) => x.trackingNo.toLowerCase() === code);
    if (sh) {
      ret = s.returns.find((r) => r.orderId === sh.orderId && r.status !== "completed");
      if (!ret) {
        const order = s.orders.find((o) => o.id === sh.orderId);
        if (!order) return fail("ORDER_NOT_FOUND");
        if (order.status !== "handed_over") return fail("ORDER_NOT_RETURNABLE", order.status);
        ret = buildReturn(s, ctx, order, "พัสดุตีกลับจากขนส่ง / Carrier return");
        created = true;
      }
    }
  }
  if (!ret) return fail("RETURN_NOT_FOUND");
  if (ret.status === "expected") {
    assertTransition("return", returnMachine, ret.status, "received");
    ret.status = "received";
    const order = s.orders.find((o) => o.id === ret!.orderId);
    if (order) queueOutbox(s, ctx, order, "return_received");
  }
  return ok({ returnId: ret.id, created });
}

export function returnScanItem(
  s: AppState,
  _ctx: Ctx,
  input: { returnId: ID; raw: string },
): Result<{ lineId: ID; receivedQty: number; expectedQty: number }> {
  const ret = s.returns.find((r) => r.id === input.returnId);
  if (!ret) return fail("RETURN_NOT_FOUND");
  if (ret.status === "expected") return fail("INVALID_INPUT", "intake first");
  if (ret.status === "completed" || ret.status === "rejected") return fail("BAD_ORDER_STATE", ret.status);
  const r = resolveSku(s, input.raw);
  if (!r.ok) return fail(r.code, r.detail);
  const lines = ret.lines.filter((l) => l.skuId === r.entity.id);
  if (lines.length === 0) return fail("NOT_IN_ORDER");
  const line = lines.find((l) => l.receivedQty < l.expectedQty && !l.grade);
  if (!line) return fail(lines.some((l) => l.grade) ? "LINE_ALREADY_GRADED" : "OVER_RETURN");
  line.receivedQty += 1;
  if (ret.status === "received") ret.status = "grading";
  return ok({ lineId: line.id, receivedQty: line.receivedQty, expectedQty: line.expectedQty });
}

function refreshReturn(s: AppState, ctx: Ctx, ret: ReturnOrder): void {
  const full = ret.lines.every((l) => l.receivedQty >= l.expectedQty && l.resolved);
  if (full) {
    assertTransition("return", returnMachine, ret.status, "completed");
    ret.status = "completed";
    ret.completedAt = ctx.now;
    const order = s.orders.find((o) => o.id === ret.orderId);
    if (order && order.status === "return_in_progress") {
      assertTransition("order", orderMachine, order.status, "returned");
      order.status = "returned";
    }
    return;
  }
  const pending = ret.lines.find((l) => l.grade && !l.resolved);
  if (pending) {
    const next =
      pending.disposition === "repack_restock" && !pending.repacked
        ? "repack_pending"
        : "restock_pending";
    assertTransition("return", returnMachine, ret.status, next);
    ret.status = next;
  } else if (ret.status !== "received") {
    ret.status = "grading";
  }
}

/** Condition grading. A -> restock, B -> repack then restock, C -> destroy or RTV claim. */
export function gradeLine(
  s: AppState,
  ctx: Ctx,
  input: {
    returnId: ID;
    lineId: ID;
    grade: Grade;
    disposition?: Extract<Disposition, "destroy" | "rtv_claim">;
    reason?: string;
  },
): Result<void> {
  const ret = s.returns.find((r) => r.id === input.returnId);
  if (!ret) return fail("RETURN_NOT_FOUND");
  const line = ret.lines.find((l) => l.id === input.lineId);
  if (!line) return fail("LINE_NOT_FOUND");
  if (line.receivedQty <= 0) return fail("NOTHING_RECEIVED");
  if (line.grade) return fail("LINE_ALREADY_GRADED");
  const sku = skuById(s, line.skuId);
  if (!sku) return fail("SKU_NOT_FOUND");

  const base = {
    skuId: line.skuId,
    lotNo: line.lotNo ?? "NA",
    expiryDate: line.expiryDate,
    receivedAt: line.originReceivedAt ?? ctx.now,
    qty: line.receivedQty,
  };
  const park = (zone: "returns" | "repack" | "destroy" | "rtv", status: "return_pending" | "repack" | "destroy" | "rtv") => {
    const bin = firstBinOfZone(s, zone) ?? firstBinOfZone(s, "quarantine");
    if (!bin) return false;
    addStock(s, { ...base, binId: bin.id, status });
    line.holdBinId = bin.id;
    pushLedger(s, ctx, {
      type: status === "destroy" ? "dispose" : status === "rtv" ? "rtv" : "return_in",
      skuId: base.skuId,
      lotNo: base.lotNo,
      toBinId: bin.id,
      toStatus: status,
      qty: base.qty,
      refType: "return",
      refId: ret.id,
    });
    return true;
  };

  if (input.grade === "A_good") {
    if (!park("returns", "return_pending")) return fail("NO_RECEIVING_BIN");
    line.disposition = "restock";
  } else if (input.grade === "B_box_damaged") {
    if (!park("repack", "repack")) return fail("NO_RECEIVING_BIN");
    line.disposition = "repack_restock";
  } else {
    const disp = input.disposition ?? "destroy";
    if (disp === "rtv_claim" && !input.reason?.trim()) return fail("REASON_REQUIRED");
    if (!park(disp === "rtv_claim" ? "rtv" : "destroy", disp === "rtv_claim" ? "rtv" : "destroy")) {
      return fail("NO_RECEIVING_BIN");
    }
    line.disposition = disp;
    line.resolved = true;
    if (disp === "rtv_claim") {
      s.rtvClaims.push({
        id: nextId(s, "rtv"),
        returnLineId: line.id,
        supplierId: sku.supplierId,
        skuId: sku.id,
        qty: line.receivedQty,
        reason: input.reason!.trim(),
        status: "draft",
        createdAt: ctx.now,
      });
    }
  }
  line.grade = input.grade;
  refreshReturn(s, ctx, ret);
  return ok();
}

export function completeRepack(
  s: AppState,
  ctx: Ctx,
  input: { returnId: ID; lineId: ID },
): Result<void> {
  const ret = s.returns.find((r) => r.id === input.returnId);
  if (!ret) return fail("RETURN_NOT_FOUND");
  const line = ret.lines.find((l) => l.id === input.lineId);
  if (!line) return fail("LINE_NOT_FOUND");
  if (line.disposition !== "repack_restock") return fail("INVALID_INPUT");
  line.repacked = true;
  refreshReturn(s, ctx, ret);
  return ok();
}

/** Scan the item, then the bin label. Good stock goes back to the original bin and becomes sellable. */
export function restockLine(
  s: AppState,
  ctx: Ctx,
  input: {
    returnId: ID;
    lineId: ID;
    itemRaw: string;
    binRaw: string;
    overrideReason?: string;
  },
): Result<{ binId: ID }> {
  const ret = s.returns.find((r) => r.id === input.returnId);
  if (!ret) return fail("RETURN_NOT_FOUND");
  const line = ret.lines.find((l) => l.id === input.lineId);
  if (!line) return fail("LINE_NOT_FOUND");
  if (!line.grade) return fail("LINE_NOT_GRADED");
  if (line.resolved) return fail("INVALID_INPUT", "already resolved");
  if (line.disposition !== "restock" && line.disposition !== "repack_restock") {
    return fail("INVALID_INPUT");
  }
  if (line.disposition === "repack_restock" && !line.repacked) return fail("REPACK_FIRST");
  const sku = skuById(s, line.skuId);
  if (!sku) return fail("SKU_NOT_FOUND");

  const item = resolveSku(s, input.itemRaw);
  if (!item.ok) return fail(item.code, item.detail);
  if (item.entity.id !== line.skuId) return fail("WRONG_ITEM");

  const b = resolveBin(s, input.binRaw);
  if (!b.ok) return fail(b.code === "SCAN_ORDER" ? "SCAN_ORDER" : b.code, b.detail);
  const bin = b.entity;
  const isOrigin = bin.id === line.originBinId;
  if (!isPickableBin(bin)) return fail(isOrigin ? "ORIGIN_BIN_UNAVAILABLE" : "BIN_NOT_ALLOWED");
  const reason = input.overrideReason?.trim();
  if (!isOrigin && !reason) return fail("WRONG_BIN", binById(s, line.originBinId ?? "")?.path);
  if (binCapacityFor(s, bin, sku) < line.receivedQty) {
    return fail(isOrigin ? "ORIGIN_BIN_UNAVAILABLE" : "BIN_FULL", bin.path);
  }

  const fromStatus = line.disposition === "repack_restock" ? "repack" : "return_pending";
  const row = findRow(s, {
    skuId: line.skuId,
    lotNo: line.lotNo ?? "NA",
    binId: line.holdBinId ?? "",
    status: fromStatus,
  });
  if (!row || row.qty < line.receivedQty) return fail("ROW_NOT_FOUND");
  takeFromRow(s, row, line.receivedQty);
  addStock(s, {
    skuId: line.skuId,
    lotNo: line.lotNo ?? "NA",
    expiryDate: line.expiryDate,
    receivedAt: line.originReceivedAt ?? ctx.now,
    binId: bin.id,
    status: "sellable",
    qty: line.receivedQty,
  });
  pushLedger(s, ctx, {
    type: "restock",
    skuId: line.skuId,
    lotNo: line.lotNo,
    fromBinId: line.holdBinId,
    toBinId: bin.id,
    fromStatus,
    toStatus: "sellable",
    qty: line.receivedQty,
    refType: "return",
    refId: ret.id,
    note: isOrigin ? undefined : reason,
  });
  line.resolved = true;
  line.restockedBinId = bin.id;
  line.restockOverrideReason = isOrigin ? undefined : reason;
  refreshReturn(s, ctx, ret);
  retryAwaiting(s, ctx);
  return ok({ binId: bin.id });
}

/** Close a return whose received lines are all resolved (partial receipts allowed). */
export function closeReturn(s: AppState, ctx: Ctx, input: { returnId: ID }): Result<void> {
  const ret = s.returns.find((r) => r.id === input.returnId);
  if (!ret) return fail("RETURN_NOT_FOUND");
  const received = ret.lines.filter((l) => l.receivedQty > 0);
  if (received.length === 0) return fail("NOTHING_RECEIVED");
  if (received.some((l) => !l.resolved)) return fail("LINE_NOT_GRADED");
  assertTransition("return", returnMachine, ret.status, "completed");
  ret.status = "completed";
  ret.completedAt = ctx.now;
  const order = s.orders.find((o) => o.id === ret.orderId);
  if (order && order.status === "return_in_progress") {
    assertTransition("order", orderMachine, order.status, "returned");
    order.status = "returned";
  }
  return ok();
}
