import { localHM, localTimeToISO } from "../clock";
import { parseScan } from "../scan/parse";
import { laneId } from "./carriers";
import { fail, nextId, ok, pushLedger, type Ctx, type Result } from "./core";
import { assertTransition, manifestMachine, orderMachine, shipmentMachine } from "./machines";
import { queueOutbox } from "./outbox";
import type { AppState, CarrierCode, ID, Manifest, Shipment } from "./types";

export function shipmentByTracking(s: AppState, raw: string): Shipment | undefined {
  const p = parseScan(raw);
  const code = (p.kind === "tracking" ? p.value : p.raw).toLowerCase();
  return s.shipments.find((x) => x.trackingNo.toLowerCase() === code);
}

/** Sort scan: put the parcel in the carrier lane; flags parcels past the cut-off time. */
export function stageScan(
  s: AppState,
  ctx: Ctx,
  input: { raw: string; lateNote?: string },
): Result<{ lane: string; late: boolean; trackingNo: string; carrier: CarrierCode }> {
  const sh = shipmentByTracking(s, input.raw);
  if (!sh) return fail("TRACKING_UNKNOWN");
  if (sh.status !== "label_printed") return fail("SHIPMENT_STATE", sh.status);
  const cfg = s.settings.carriers.find((c) => c.code === sh.carrier);
  if (!cfg) return fail("INVALID_INPUT", "carrier");
  const late = localHM(ctx.now) > cfg.cutoffLocal;
  const note = input.lateNote?.trim();
  if (late && !note) return fail("LATE_NOTE_REQUIRED", laneId(cfg));

  assertTransition("shipment", shipmentMachine, sh.status, "staged");
  sh.status = "staged";
  sh.stagingLane = laneId(cfg);
  sh.late = late;
  sh.lateNote = late ? note : undefined;
  const order = s.orders.find((o) => o.id === sh.orderId);
  if (order && order.status === "packed") {
    assertTransition("order", orderMachine, order.status, "ready_to_ship");
    order.status = "ready_to_ship";
  }
  return ok({ lane: sh.stagingLane, late, trackingNo: sh.trackingNo, carrier: sh.carrier });
}

export function createManifest(
  s: AppState,
  ctx: Ctx,
  input: { carrier: CarrierCode },
): Result<{ manifestId: ID }> {
  const cfg = s.settings.carriers.find((c) => c.code === input.carrier);
  if (!cfg) return fail("INVALID_INPUT", "carrier");
  const parcels = s.shipments.filter(
    (x) => x.carrier === input.carrier && x.status === "staged" && !x.manifestId,
  );
  if (parcels.length === 0) return fail("EMPTY_MANIFEST");
  const id = nextId(s, "mnf");
  const manifest: Manifest = {
    id,
    manifestNo: `MF-${ctx.now.slice(0, 10).replaceAll("-", "")}-${String(s.seq["mnf"]).padStart(3, "0")}`,
    carrier: input.carrier,
    cutoffAt: localTimeToISO(ctx.now, cfg.cutoffLocal),
    createdAt: ctx.now,
    shipmentIds: parcels.map((p) => p.id),
    scannedShipmentIds: [],
    status: "draft",
    exceptions: [],
  };
  s.manifests.push(manifest);
  for (const p of parcels) {
    assertTransition("shipment", shipmentMachine, p.status, "manifested");
    p.status = "manifested";
    p.manifestId = id;
  }
  return ok({ manifestId: id });
}

export function manifestScan(
  s: AppState,
  _ctx: Ctx,
  input: { manifestId: ID; raw: string },
): Result<{ scanned: number; total: number }> {
  const m = s.manifests.find((x) => x.id === input.manifestId);
  if (!m) return fail("MANIFEST_NOT_FOUND");
  if (m.status !== "draft" && m.status !== "scanning") return fail("MANIFEST_STATE", m.status);
  const sh = shipmentByTracking(s, input.raw);
  if (!sh) return fail("TRACKING_UNKNOWN");
  if (!m.shipmentIds.includes(sh.id)) return fail("PARCEL_NOT_IN_MANIFEST");
  if (!m.scannedShipmentIds.includes(sh.id)) m.scannedShipmentIds.push(sh.id);
  m.exceptions = m.exceptions.filter((e) => e.shipmentId !== sh.id);
  if (m.status === "draft") {
    assertTransition("manifest", manifestMachine, m.status, "scanning");
    m.status = "scanning";
  }
  return ok({ scanned: m.scannedShipmentIds.length, total: m.shipmentIds.length });
}

export function markManifestException(
  s: AppState,
  input: { manifestId: ID; shipmentId: ID; reason: "missing" | "damaged" },
): Result<void> {
  const m = s.manifests.find((x) => x.id === input.manifestId);
  if (!m) return fail("MANIFEST_NOT_FOUND");
  if (m.status !== "draft" && m.status !== "scanning") return fail("MANIFEST_STATE", m.status);
  if (!m.shipmentIds.includes(input.shipmentId)) return fail("PARCEL_NOT_IN_MANIFEST");
  m.scannedShipmentIds = m.scannedShipmentIds.filter((i) => i !== input.shipmentId);
  m.exceptions = m.exceptions.filter((e) => e.shipmentId !== input.shipmentId);
  m.exceptions.push({ shipmentId: input.shipmentId, reason: input.reason });
  return ok();
}

/** Finish loading: unscanned parcels must be scanned or logged as exceptions. */
export function finishManifestScan(
  s: AppState,
  _ctx: Ctx,
  input: { manifestId: ID },
): Result<{ parcels: number }> {
  const m = s.manifests.find((x) => x.id === input.manifestId);
  if (!m) return fail("MANIFEST_NOT_FOUND");
  if (m.status !== "draft" && m.status !== "scanning") return fail("MANIFEST_STATE", m.status);
  const excepted = new Set(m.exceptions.map((e) => e.shipmentId));
  const unscanned = m.shipmentIds.filter(
    (id) => !m.scannedShipmentIds.includes(id) && !excepted.has(id),
  );
  if (unscanned.length > 0) return fail("UNSCANNED_PARCELS", String(unscanned.length));
  const keep = m.shipmentIds.filter((id) => !excepted.has(id));
  if (keep.length === 0) return fail("EMPTY_MANIFEST");

  // Exception parcels stay staged for the next manifest.
  for (const id of excepted) {
    const sh = s.shipments.find((x) => x.id === id);
    if (sh) {
      assertTransition("shipment", shipmentMachine, sh.status, "staged");
      sh.status = "staged";
      sh.manifestId = undefined;
    }
  }
  m.shipmentIds = keep;
  assertTransition("manifest", manifestMachine, m.status, "awaiting_signature");
  m.status = "awaiting_signature";
  return ok({ parcels: keep.length });
}

/** Driver signs: shipments + orders are handed over and one `shipped` event per order is queued. */
export function signManifest(
  s: AppState,
  ctx: Ctx,
  input: { manifestId: ID; driverName: string; vehiclePlate: string; signatureKey?: string },
): Result<{ handedOver: number }> {
  const m = s.manifests.find((x) => x.id === input.manifestId);
  if (!m) return fail("MANIFEST_NOT_FOUND");
  if (m.status !== "awaiting_signature") return fail("MANIFEST_STATE", m.status);
  if (!input.driverName.trim() || !input.vehiclePlate.trim()) return fail("DRIVER_REQUIRED");
  if (!input.signatureKey) return fail("SIGNATURE_REQUIRED");

  for (const id of m.shipmentIds) {
    const sh = s.shipments.find((x) => x.id === id);
    if (!sh) continue;
    assertTransition("shipment", shipmentMachine, sh.status, "handed_over");
    sh.status = "handed_over";
    sh.handedOverAt = ctx.now;
    const order = s.orders.find((o) => o.id === sh.orderId);
    if (order) {
      assertTransition("order", orderMachine, order.status, "handed_over");
      order.status = "handed_over";
      for (const a of s.allocations.filter((x) => x.orderId === order.id && x.status === "packed")) {
        a.status = "shipped";
        pushLedger(s, ctx, {
          type: "ship",
          skuId: a.skuId,
          lotNo: a.lotNo,
          qty: a.qty,
          refType: "shipment",
          refId: sh.id,
        });
      }
      queueOutbox(s, ctx, order, "shipped", { trackingNo: sh.trackingNo, carrier: sh.carrier });
    }
  }
  m.driverName = input.driverName.trim();
  m.vehiclePlate = input.vehiclePlate.trim();
  m.signatureKey = input.signatureKey;
  m.signedAt = ctx.now;
  assertTransition("manifest", manifestMachine, m.status, "handed_over");
  m.status = "handed_over";
  return ok({ handedOver: m.shipmentIds.length });
}
