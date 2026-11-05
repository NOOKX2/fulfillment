import { currentTaskOf } from "./pickHelpers";
import { createOrder } from "@/lib/domain/orders";
import { issueLabel, packScan, startPackSession } from "@/lib/domain/pack";
import { createManifest, finishManifestScan, manifestScan, signManifest, stageScan } from "@/lib/domain/shipping";
import { buildWaves, pickScan, releaseWave } from "@/lib/domain/waves";
import { ctx, fresh, must, skuByCode } from "./helpers";

/** Fresh seed with `n` single-item orders picked, packed and labelled (shipments are label_printed). */
export function packedState(n = 3) {
  const s = fresh();
  s.orders = [];
  s.reservations = [];
  s.allocations = [];
  s.stock.forEach((r) => (r.qtyAllocated = 0));
  for (let i = 0; i < n; i++) {
    createOrder(s, ctx(), {
      channel: "shopee",
      buyerName: `ผู้ซื้อ ${i}`,
      address: "1 กรุงเทพ",
      phone: "0800000000",
      carrier: "flash",
      shipByHours: 24,
      paid: true,
      lines: [{ skuCode: "TEE-001-BLK-M", qty: 1, unitPrice: 100 }],
    });
  }
  must(buildWaves(s, ctx()));
  const wave = s.waves[0];
  must(releaseWave(s, ctx(), wave.id));
  let guard = 0;
  while (currentTaskOf(s, wave.id) && guard++ < 100) {
    const t = currentTaskOf(s, wave.id)!;
    if (!t.binScanned) must(pickScan(s, ctx(), { waveId: wave.id, raw: s.bins.find((b) => b.id === t.binId)!.barcode }));
    while (t.status === "pending") {
      must(pickScan(s, ctx(), { waveId: wave.id, raw: skuByCode(s, "TEE-001-BLK-M").barcodes[0] }));
    }
  }
  for (const o of s.orders) {
    const { sessionId } = must(startPackSession(s, ctx(), { orderId: o.id }));
    must(packScan(s, ctx(), { sessionId, raw: skuByCode(s, "TEE-001-BLK-M").barcodes[0] }));
    must(issueLabel(s, ctx(), { sessionId, boxSize: "ENV_S" }));
  }
  return s;
}


/** Same, then staged, manifested, signed: orders are handed_over. */
export function handedOverState(n = 2) {
  const s = packedState(n);
  for (const sh of s.shipments) must(stageScan(s, ctx(), { raw: sh.trackingNo }));
  const { manifestId } = must(createManifest(s, ctx(), { carrier: "flash" }));
  for (const sh of s.shipments) must(manifestScan(s, ctx(), { manifestId, raw: sh.trackingNo }));
  must(finishManifestScan(s, ctx(), { manifestId }));
  must(signManifest(s, ctx(), { manifestId, driverName: "ก", vehiclePlate: "ข", signatureKey: "k" }));
  return s;
}
