import { parseScan } from "../scan/parse";
import { compareVariant } from "../scan/validate";
import { formatTracking, validTracking } from "./carriers";
import {
  fail,
  nextId,
  ok,
  pushLedger,
  skuByBarcode,
  skuById,
  type Ctx,
  type Result,
} from "./core";
import type { MismatchDetail } from "./format";
import { assertTransition, orderMachine, packMachine } from "./machines";
import type {
  AppState,
  BoxSize,
  ID,
  MismatchReason,
  Order,
  PackSession,
  Sku,
} from "./types";

const BOX_TARE_G: Record<BoxSize, number> = {
  ENV_S: 15,
  ENV_M: 25,
  BOX_S: 120,
  BOX_M: 220,
  BOX_L: 360,
};

const activeSession = (s: AppState, orderId: ID): PackSession | undefined =>
  s.packSessions.find(
    (p) => p.orderId === orderId && p.status !== "closed" && p.status !== "label_issued",
  );

export function startPackSession(
  s: AppState,
  ctx: Ctx,
  input: { orderId: ID; toteId?: ID },
): Result<{ sessionId: ID }> {
  const o = s.orders.find((x) => x.id === input.orderId);
  if (!o) return fail("ORDER_NOT_FOUND");
  if (o.status === "cancelled") return fail("ORDER_CANCELLED");
  const existing = activeSession(s, o.id);
  if (existing) return ok({ sessionId: existing.id });
  if (o.status !== "picked") return fail("ORDER_NOT_PICKED", o.status);

  const expected: PackSession["expected"] = [];
  for (const l of o.lines) {
    const hit = expected.find((e) => e.skuId === l.skuId);
    if (hit) hit.qty += l.qty;
    else expected.push({ skuId: l.skuId, qty: l.qty });
  }
  const session: PackSession = {
    id: nextId(s, "pks"),
    orderId: o.id,
    toteId: input.toteId,
    status: "open",
    startedAt: ctx.now,
    expected,
    scanned: [],
    mismatches: [],
    redLightOn: false,
  };
  s.packSessions.push(session);
  assertTransition("order", orderMachine, o.status, "packing");
  o.status = "packing";
  return ok({ sessionId: session.id });
}

const mismatchesSinceOverride = (p: PackSession) =>
  p.mismatches.filter((m) => !p.supervisorOverride || m.at > p.supervisorOverride.at).length;

const allScanned = (p: PackSession) =>
  p.expected.every((e) => (p.scanned.find((x) => x.skuId === e.skuId)?.qty ?? 0) >= e.qty);

export type PackScanResult = {
  event: "tote" | "scanned";
  toteId?: ID;
  sessionId?: ID;
  verified?: boolean;
};

/**
 * Pack bench scan handler.
 *  - ORD:/order no starts a session; TOT: selects the working tote;
 *  - a bare item scan with no session resolves the matching picked order in
 *    the tote ("scan-to-order") and counts that scan;
 *  - inside a session every scan is verified (poka-yoke).
 */
export function packScan(
  s: AppState,
  ctx: Ctx,
  input: { sessionId?: ID; toteId?: ID; raw: string },
): Result<PackScanResult> {
  let session = input.sessionId ? s.packSessions.find((p) => p.id === input.sessionId) : undefined;
  if (input.sessionId && !session) return fail("SESSION_NOT_FOUND");
  const parsed = parseScan(input.raw);

  if (!session) {
    if (parsed.kind === "tote") {
      const tote = s.totes.find((t) => t.id.toLowerCase() === parsed.value.toLowerCase());
      if (!tote) return fail("UNKNOWN_BARCODE", "tote");
      return ok({ event: "tote", toteId: tote.id });
    }
    if (parsed.kind === "order") {
      const o = s.orders.find(
        (x) =>
          x.id.toLowerCase() === parsed.value.toLowerCase() ||
          x.channelOrderNo.toLowerCase() === parsed.value.toLowerCase(),
      );
      if (!o) return fail("ORDER_NOT_FOUND");
      const r = startPackSession(s, ctx, { orderId: o.id, toteId: input.toteId });
      if (!r.ok) return r;
      return ok({ event: "scanned", sessionId: r.data.sessionId, verified: false });
    }
    // scan-to-order via item
    const sku = skuByBarcode(s, parsed.value);
    if (!sku) return fail("UNKNOWN_BARCODE");
    const toteOrders = input.toteId
      ? (s.totes.find((t) => t.id === input.toteId)?.orderIds ?? [])
      : null;
    const candidates = s.orders
      .filter(
        (o) =>
          (o.status === "picked" || o.status === "packing") &&
          (!toteOrders || toteOrders.includes(o.id)) &&
          o.lines.some((l) => l.skuId === sku.id),
      )
      .sort(
        (a, b) =>
          Number(a.lines.length > 1) - Number(b.lines.length > 1) ||
          a.shipBy.localeCompare(b.shipBy),
      );
    const target = candidates[0];
    if (!target) return fail("NOT_IN_ORDER");
    const r = startPackSession(s, ctx, { orderId: target.id, toteId: input.toteId });
    if (!r.ok) return r;
    session = s.packSessions.find((p) => p.id === r.data.sessionId)!;
  }

  const order = s.orders.find((o) => o.id === session!.orderId);
  if (!order) return fail("ORDER_NOT_FOUND");
  if (order.status === "cancelled") return fail("ORDER_CANCELLED");
  if (session.status === "label_issued" || session.status === "closed") {
    return fail("BAD_ORDER_STATE", session.status);
  }
  if (session.status === "blocked" && mismatchesSinceOverride(session) >= 3) {
    return fail("SUPERVISOR_REQUIRED");
  }

  const sku = parsed.kind === "sku" ? skuByBarcode(s, parsed.value) : undefined;
  const remaining = session.expected.filter(
    (e) => (session!.scanned.find((x) => x.skuId === e.skuId)?.qty ?? 0) < e.qty,
  );
  const match = sku ? remaining.find((e) => e.skuId === sku.id) : undefined;

  if (match && sku) {
    const sc = session.scanned.find((x) => x.skuId === sku.id);
    if (sc) sc.qty += 1;
    else session.scanned.push({ skuId: sku.id, qty: 1 });
    if (session.status === "blocked") {
      assertTransition("pack", packMachine, session.status, "verifying");
      session.status = "verifying";
    } else if (session.status === "open") {
      session.status = "verifying";
    }
    session.redLightOn = false;
    if (allScanned(session)) {
      assertTransition("pack", packMachine, session.status, "verified");
      session.status = "verified";
    }
    return ok({
      event: "scanned",
      sessionId: session.id,
      verified: session.status === "verified",
    });
  }

  // ---- mismatch ----
  let reason: MismatchReason;
  let expectedSkuId: ID | undefined;
  if (!sku) {
    reason = "unknown_barcode";
    expectedSkuId = remaining[0]?.skuId;
  } else if (session.expected.some((e) => e.skuId === sku.id)) {
    reason = "over_qty";
    expectedSkuId = remaining[0]?.skuId;
  } else if (remaining.length === 0) {
    reason = "not_in_order";
  } else {
    const same = remaining
      .map((e) => skuById(s, e.skuId))
      .find((k): k is Sku => !!k && k.modelCode === sku.modelCode);
    const exp = same ?? skuById(s, remaining[0].skuId)!;
    reason = compareVariant(exp, sku);
    expectedSkuId = exp.id;
  }
  const detail: MismatchDetail = { reason, expectedSkuId, scannedSkuId: sku?.id };
  session.mismatches.push({
    at: ctx.now,
    scannedBarcode: input.raw,
    expectedSkuId,
    scannedSkuId: sku?.id,
    reason,
  });
  if (session.status !== "blocked") {
    assertTransition("pack", packMachine, session.status, "blocked");
    session.status = "blocked";
  }
  session.redLightOn = true;
  return fail("PACK_MISMATCH", JSON.stringify(detail), { commit: true });
}

/** Operator removed an extra item (over_qty): the alarm may be cleared. */
export function packClearAlarm(s: AppState, input: { sessionId: ID }): Result<void> {
  const p = s.packSessions.find((x) => x.id === input.sessionId);
  if (!p) return fail("SESSION_NOT_FOUND");
  if (p.status !== "blocked") return ok();
  if (mismatchesSinceOverride(p) >= 3) return fail("SUPERVISOR_REQUIRED");
  const last = p.mismatches[p.mismatches.length - 1];
  if (last?.reason !== "over_qty") return fail("PACK_MISMATCH", JSON.stringify({ reason: last?.reason ?? "wrong_sku" }));
  p.redLightOn = false;
  const next = allScanned(p) ? "verified" : "verifying";
  assertTransition("pack", packMachine, p.status, next);
  p.status = next;
  return ok();
}

export function packSupervisorOverride(
  s: AppState,
  ctx: Ctx,
  input: { sessionId: ID; reason: string },
): Result<void> {
  const p = s.packSessions.find((x) => x.id === input.sessionId);
  if (!p) return fail("SESSION_NOT_FOUND");
  if (!input.reason.trim()) return fail("REASON_REQUIRED");
  if (p.status !== "blocked") return ok();
  p.supervisorOverride = { reason: input.reason.trim(), at: ctx.now };
  p.redLightOn = false;
  const next = allScanned(p) ? "verified" : "verifying";
  assertTransition("pack", packMachine, p.status, next);
  p.status = next;
  return ok();
}

/**
 * Issue the airway bill. Guarded in the domain (not just the UI): only a
 * verified session with the red light off may produce a tracking number.
 */
export function issueLabel(
  s: AppState,
  ctx: Ctx,
  input: { sessionId: ID; boxSize: BoxSize },
): Result<{ shipmentId: ID; trackingNo: string }> {
  const p = s.packSessions.find((x) => x.id === input.sessionId);
  if (!p) return fail("SESSION_NOT_FOUND");
  if (p.status !== "verified" || p.redLightOn) return fail("LABEL_BLOCKED");
  const order = s.orders.find((o) => o.id === p.orderId) as Order | undefined;
  if (!order) return fail("ORDER_NOT_FOUND");
  if (order.status === "cancelled") return fail("ORDER_CANCELLED");
  const cfg = s.settings.carriers.find((c) => c.code === order.carrier);
  if (!cfg) return fail("INVALID_INPUT", "carrier");

  const trackingNo = formatTracking(cfg, cfg.nextSeq);
  if (!validTracking(cfg.code, trackingNo)) return fail("INVALID_INPUT", "tracking");
  cfg.nextSeq += 1;

  const weightG =
    order.lines.reduce((n, l) => n + (skuById(s, l.skuId)?.weightG ?? 0) * l.qty, 0) +
    BOX_TARE_G[input.boxSize];
  const shipment = {
    id: nextId(s, "shp"),
    orderId: order.id,
    carrier: cfg.code,
    trackingNo,
    labelPrintedAt: ctx.now,
    reprintCount: 0,
    weightG,
    boxSize: input.boxSize,
    status: "label_printed" as const,
  };
  s.shipments.push(shipment);
  order.shipmentId = shipment.id;
  assertTransition("order", orderMachine, order.status, "packed");
  order.status = "packed";
  for (const a of s.allocations.filter((x) => x.orderId === order.id && x.status === "picked")) {
    a.status = "packed";
    pushLedger(s, ctx, {
      type: "pack",
      skuId: a.skuId,
      lotNo: a.lotNo,
      qty: a.qty,
      refType: "order",
      refId: order.id,
    });
  }
  assertTransition("pack", packMachine, p.status, "label_issued");
  p.status = "label_issued";
  p.boxSize = input.boxSize;

  for (const t of s.totes) {
    if (!t.orderIds.includes(order.id)) continue;
    const pending = t.orderIds.some((id) => {
      const o = s.orders.find((x) => x.id === id);
      return o && o.status !== "packed" && o.status !== "cancelled" && o.status !== "ready_to_ship" && o.status !== "handed_over";
    });
    if (!pending) t.status = "done";
  }
  return ok({ shipmentId: shipment.id, trackingNo });
}

export function closePackSession(s: AppState, input: { sessionId: ID }): Result<void> {
  const p = s.packSessions.find((x) => x.id === input.sessionId);
  if (!p) return fail("SESSION_NOT_FOUND");
  if (p.status === "closed") return ok();
  assertTransition("pack", packMachine, p.status, "closed");
  p.status = "closed";
  return ok();
}

export function reprintLabel(s: AppState, shipmentId: ID): Result<void> {
  const sh = s.shipments.find((x) => x.id === shipmentId);
  if (!sh) return fail("SHIPMENT_NOT_FOUND");
  if (sh.status === "handed_over") return fail("SHIPMENT_STATE", sh.status);
  sh.reprintCount += 1;
  return ok();
}
