import { resolveSku } from "../scan/validate";
import {
  addStock,
  binById,
  fail,
  findRow,
  firstBinOfZone,
  nextId,
  ok,
  pushLedger,
  skuById,
  takeFromRow,
  type Ctx,
  type Result,
} from "./core";
import { asnMachine, assertTransition, stockMachine } from "./machines";
import { createPutawayTasks } from "./putaway";
import type {
  AppState,
  Asn,
  Discrepancy,
  DiscrepancyResolution,
  DiscrepancyType,
  ID,
  QcCheckKey,
  StockStatus,
} from "./types";

const CLOSED: Asn["status"][] = ["closed", "closed_with_discrepancy"];

export function receiveScan(
  s: AppState,
  ctx: Ctx,
  input: {
    asnId: ID;
    raw: string;
    qty?: number;
    lotNo?: string;
    expiryDate?: string;
    confirmOver?: boolean;
  },
): Result<{ lineId: ID; skuId: ID; receivedQty: number; expectedQty: number; over: boolean }> {
  const asn = s.asns.find((a) => a.id === input.asnId);
  if (!asn) return fail("ASN_NOT_FOUND");
  if (CLOSED.includes(asn.status)) return fail("ASN_CLOSED");

  const r = resolveSku(s, input.raw);
  if (!r.ok) return fail(r.code, r.detail);
  const sku = r.entity;

  const qty = input.qty ?? 1;
  if (!Number.isInteger(qty) || qty <= 0) return fail("BAD_QTY");

  const lotIn = input.lotNo?.trim();
  const line = asn.lines.find(
    (l) => l.skuId === sku.id && (!lotIn || !l.lotNo || l.lotNo === lotIn),
  );
  if (!line) return fail("NOT_ON_ASN", sku.id);

  const lotNo = lotIn || line.lotNo || (sku.tracksLot ? "" : "NA");
  if (sku.tracksLot && !lotNo) return fail("LOT_REQUIRED");
  const expiryDate = input.expiryDate || line.expiryDate;
  if (sku.tracksExpiry && !expiryDate) return fail("EXPIRY_REQUIRED");

  const newTotal = line.receivedQty + qty;
  const over = newTotal > line.expectedQty;
  if (over && !input.confirmOver) return fail("OVER_RECEIPT_CONFIRM", String(line.expectedQty));

  const bin = firstBinOfZone(s, "receiving");
  if (!bin) return fail("NO_RECEIVING_BIN");

  if (asn.status === "expected") {
    assertTransition("asn", asnMachine, asn.status, "receiving");
    asn.status = "receiving";
  }
  line.receivedQty = newTotal;
  if (!line.lotNo && lotNo !== "NA") line.lotNo = lotNo;
  if (!line.expiryDate && expiryDate) line.expiryDate = expiryDate;

  const receipt = s.receipts.find(
    (x) =>
      x.asnLineId === line.id &&
      x.lotNo === lotNo &&
      x.qcStatus === "pending" &&
      x.qcDone === 0,
  );
  if (receipt) receipt.qty += qty;
  else {
    s.receipts.push({
      id: nextId(s, "grn"),
      asnId: asn.id,
      asnLineId: line.id,
      skuId: sku.id,
      lotNo,
      expiryDate,
      qty,
      qcDone: 0,
      receivedAt: ctx.now,
      receivingBinId: bin.id,
      qcStatus: "pending",
    });
  }
  addStock(s, {
    skuId: sku.id,
    lotNo,
    expiryDate,
    receivedAt: ctx.now,
    binId: bin.id,
    status: "pending_qc",
    qty,
  });
  pushLedger(s, ctx, {
    type: "receive",
    skuId: sku.id,
    lotNo,
    toBinId: bin.id,
    toStatus: "pending_qc",
    qty,
    refType: "asn",
    refId: asn.id,
  });

  if (over) upsertDiscrepancy(s, ctx, asn.id, sku.id, "over", line.expectedQty, newTotal);

  return ok({
    lineId: line.id,
    skuId: sku.id,
    receivedQty: newTotal,
    expectedQty: line.expectedQty,
    over,
  });
}

function upsertDiscrepancy(
  s: AppState,
  ctx: Ctx,
  asnId: ID,
  skuId: ID,
  type: DiscrepancyType,
  expectedQty: number,
  actualQty: number,
): Discrepancy {
  const existing = s.discrepancies.find(
    (d) => d.asnId === asnId && d.skuId === skuId && d.type === type && d.status !== "resolved",
  );
  if (existing) {
    existing.expectedQty = expectedQty;
    existing.actualQty = actualQty;
    return existing;
  }
  const d: Discrepancy = {
    id: nextId(s, "dis"),
    asnId,
    skuId,
    type,
    expectedQty,
    actualQty,
    status: "open",
    createdAt: ctx.now,
  };
  s.discrepancies.push(d);
  return d;
}

/** Explicitly log an exception (item not on ASN, damaged, wrong item). */
export function logDiscrepancy(
  s: AppState,
  ctx: Ctx,
  input: {
    asnId: ID;
    type: DiscrepancyType;
    skuId?: ID;
    scannedBarcode?: string;
    qty?: number;
    note?: string;
  },
): Result<{ id: ID }> {
  const asn = s.asns.find((a) => a.id === input.asnId);
  if (!asn) return fail("ASN_NOT_FOUND");
  if (CLOSED.includes(asn.status)) return fail("ASN_CLOSED");
  const d: Discrepancy = {
    id: nextId(s, "dis"),
    asnId: asn.id,
    skuId: input.skuId,
    scannedBarcode: input.scannedBarcode,
    type: input.type,
    expectedQty: 0,
    actualQty: input.qty ?? 1,
    status: "open",
    note: input.note,
    createdAt: ctx.now,
  };
  s.discrepancies.push(d);
  return ok({ id: d.id });
}

/**
 * Close an ASN. Logs `short` discrepancies for under-received lines; open
 * discrepancies must be acknowledged first (the shorts stay logged either way).
 */
export function closeAsn(
  s: AppState,
  ctx: Ctx,
  input: { asnId: ID; acknowledge?: boolean },
): Result<{ status: Asn["status"] }> {
  const asn = s.asns.find((a) => a.id === input.asnId);
  if (!asn) return fail("ASN_NOT_FOUND");
  if (CLOSED.includes(asn.status)) return fail("ASN_CLOSED");

  for (const l of asn.lines) {
    if (l.receivedQty < l.expectedQty) {
      upsertDiscrepancy(s, ctx, asn.id, l.skuId, "short", l.expectedQty, l.receivedQty);
    }
  }
  const mine = s.discrepancies.filter((d) => d.asnId === asn.id);
  const open = mine.filter((d) => d.status === "open");
  if (open.length > 0 && !input.acknowledge) {
    return fail("DISCREPANCY_UNACK", String(open.length), { commit: true });
  }
  for (const d of open) d.status = "acknowledged";

  const hasUnresolved = mine.some((d) => d.status !== "resolved");
  const target: Asn["status"] = hasUnresolved ? "closed_with_discrepancy" : "closed";
  assertTransition("asn", asnMachine, asn.status, target);
  asn.status = target;
  return ok({ status: target });
}

export function resolveDiscrepancy(
  s: AppState,
  _ctx: Ctx,
  input: { id: ID; resolution: DiscrepancyResolution; note?: string },
): Result<void> {
  const d = s.discrepancies.find((x) => x.id === input.id);
  if (!d) return fail("INVALID_INPUT");
  d.status = "resolved";
  d.resolution = input.resolution;
  d.note = input.note ?? d.note;
  return ok();
}

export function acknowledgeDiscrepancy(s: AppState, id: ID): Result<void> {
  const d = s.discrepancies.find((x) => x.id === id);
  if (!d) return fail("INVALID_INPUT");
  if (d.status === "open") d.status = "acknowledged";
  return ok();
}

/* ------------------------------ QC ------------------------------ */

export function submitQc(
  s: AppState,
  ctx: Ctx,
  input: {
    receiptLineId: ID;
    qtyPass: number;
    qtyHold: number;
    qtyQuarantine: number;
    checks: { key: QcCheckKey; ok: boolean }[];
    reasonCode?: string;
    note?: string;
  },
): Result<{ putawayTasks: number }> {
  const receipt = s.receipts.find((r) => r.id === input.receiptLineId);
  if (!receipt) return fail("RECEIPT_NOT_FOUND");
  const { qtyPass, qtyHold, qtyQuarantine } = input;
  const nums = [qtyPass, qtyHold, qtyQuarantine];
  if (nums.some((n) => !Number.isInteger(n) || n < 0)) return fail("BAD_QTY");
  const total = qtyPass + qtyHold + qtyQuarantine;
  const remaining = receipt.qty - receipt.qcDone;
  if (total <= 0 || total > remaining) return fail("QC_QTY_INVALID");
  if ((qtyHold > 0 || qtyQuarantine > 0) && !input.reasonCode?.trim()) {
    return fail("REASON_REQUIRED");
  }
  const qBin = firstBinOfZone(s, "quarantine");
  if ((qtyHold > 0 || qtyQuarantine > 0) && !qBin) return fail("NO_QUARANTINE_BIN");

  const src = findRow(s, {
    skuId: receipt.skuId,
    lotNo: receipt.lotNo,
    binId: receipt.receivingBinId,
    status: "pending_qc",
  });
  if (!src || src.qty < total) return fail("ROW_NOT_FOUND");
  takeFromRow(s, src, total);

  const move = (to: StockStatus, qty: number, binId: ID) => {
    if (qty <= 0) return;
    assertTransition("stock", stockMachine, "pending_qc", to);
    addStock(s, {
      skuId: receipt.skuId,
      lotNo: receipt.lotNo,
      expiryDate: receipt.expiryDate,
      receivedAt: receipt.receivedAt,
      binId,
      status: to,
      qty,
    });
    pushLedger(s, ctx, {
      type: "qc_move",
      skuId: receipt.skuId,
      lotNo: receipt.lotNo,
      fromBinId: receipt.receivingBinId,
      toBinId: binId,
      fromStatus: "pending_qc",
      toStatus: to,
      qty,
      refType: "receipt",
      refId: receipt.id,
      note: input.reasonCode,
    });
  };
  move("sellable", qtyPass, receipt.receivingBinId);
  move("hold", qtyHold, qBin?.id ?? receipt.receivingBinId);
  move("quarantine", qtyQuarantine, qBin?.id ?? receipt.receivingBinId);

  receipt.qcDone += total;
  receipt.qcStatus = receipt.qcDone >= receipt.qty ? "done" : "in_progress";

  s.qc.push({
    id: nextId(s, "qc"),
    receiptLineId: receipt.id,
    skuId: receipt.skuId,
    lotNo: receipt.lotNo,
    qtyInspected: total,
    checks: input.checks,
    qtyPass,
    qtyHold,
    qtyQuarantine,
    reasonCode: input.reasonCode,
    note: input.note,
    inspectedAt: ctx.now,
  });

  let tasks = 0;
  if (qtyPass > 0) {
    tasks = createPutawayTasks(s, ctx, {
      skuId: receipt.skuId,
      lotNo: receipt.lotNo,
      expiryDate: receipt.expiryDate,
      receivedAt: receipt.receivedAt,
      qty: qtyPass,
      fromBinId: receipt.receivingBinId,
    }).length;
  }
  return ok({ putawayTasks: tasks });
}

/** Release / dispose held or quarantined stock. A reason is mandatory and is ledgered. */
export function releaseStock(
  s: AppState,
  ctx: Ctx,
  input: {
    rowId: ID;
    qty: number;
    to: "sellable" | "quarantine" | "rtv" | "destroy";
    reason: string;
  },
): Result<void> {
  const row = s.stock.find((r) => r.id === input.rowId);
  if (!row) return fail("ROW_NOT_FOUND");
  if (!input.reason.trim()) return fail("REASON_REQUIRED");
  const qty = input.qty;
  if (!Number.isInteger(qty) || qty <= 0 || qty > row.qty - row.qtyAllocated) return fail("BAD_QTY");
  assertTransition("stock", stockMachine, row.status, input.to);
  if (row.status === input.to) return ok();

  const sku = skuById(s, row.skuId);
  if (!sku) return fail("SKU_NOT_FOUND");
  const fromBin = row.binId;
  const from = row.status;
  const snapshot = {
    skuId: row.skuId,
    lotNo: row.lotNo,
    expiryDate: row.expiryDate,
    receivedAt: row.receivedAt,
  };

  let toBin: ID | undefined;
  if (input.to === "sellable") toBin = firstBinOfZone(s, "receiving")?.id;
  else if (input.to === "rtv") toBin = (firstBinOfZone(s, "rtv") ?? firstBinOfZone(s, "quarantine"))?.id;
  else if (input.to === "destroy")
    toBin = (firstBinOfZone(s, "destroy") ?? firstBinOfZone(s, "quarantine"))?.id;
  else toBin = row.binId;
  if (!toBin) return fail("NO_RECEIVING_BIN");

  takeFromRow(s, row, qty);
  addStock(s, { ...snapshot, binId: toBin, status: input.to, qty });
  pushLedger(s, ctx, {
    type: input.to === "rtv" ? "rtv" : input.to === "destroy" ? "dispose" : "status_change",
    skuId: snapshot.skuId,
    lotNo: snapshot.lotNo,
    fromBinId: fromBin,
    toBinId: toBin,
    fromStatus: from,
    toStatus: input.to,
    qty,
    note: input.reason,
  });
  if (input.to === "sellable") {
    createPutawayTasks(s, ctx, { ...snapshot, qty, fromBinId: toBin, note: input.reason });
  }
  return ok();
}

/** Where a binId lives, for display helpers. */
export const binPath = (s: AppState, id: ID | undefined) =>
  (id && binById(s, id)?.path) || "-";
