import { describe, expect, it } from "vitest";
import { assertInvariants, currentTaskOf } from "./pickHelpers";
import { buildWaves, currentTask, pickScan, releaseWave, shortPick } from "@/lib/domain/waves";
import { issueLabel, packClearAlarm, packScan, packSupervisorOverride, startPackSession } from "@/lib/domain/pack";
import { createOrder } from "@/lib/domain/orders";
import type { AppState } from "@/lib/domain/types";
import { ctx, fresh, must, skuByCode } from "./helpers";

const payload = (lines: { skuCode: string; qty: number }[], carrier: "flash" | "jt" = "flash") => ({
  channel: "shopee" as const,
  buyerName: "ทดสอบ",
  address: "1 กรุงเทพ",
  phone: "0800000000",
  carrier,
  shipByHours: 24,
  paid: true,
  lines: lines.map((l) => ({ ...l, unitPrice: 100 })),
});

/** Pick every stop of a wave with the correct scans. */
function pickAll(s: AppState, waveId: string) {
  let guard = 0;
  while (currentTask(s, waveId) && guard++ < 200) {
    const t = currentTask(s, waveId)!;
    const bin = s.bins.find((b) => b.id === t.binId)!;
    const sku = s.skus.find((k) => k.id === t.skuId)!;
    if (!t.binScanned) must(pickScan(s, ctx(), { waveId, raw: bin.barcode }));
    while (t.status === "pending") must(pickScan(s, ctx(), { waveId, raw: sku.barcodes[0] }));
  }
}

function setup() {
  const s = fresh();
  // keep only our own orders to make the test independent of seed orders
  s.orders = [];
  s.reservations = [];
  s.allocations = [];
  s.stock.forEach((r) => (r.qtyAllocated = 0));
  const a = createOrder(s, ctx(), payload([{ skuCode: "TEE-001-BLK-M", qty: 1 }]));
  const b = createOrder(s, ctx(), payload([{ skuCode: "TEE-001-BLK-M", qty: 1 }]));
  return { s, a, b };
}

describe("waves and picking", () => {
  it("batches identical single-item orders into one pick stop sorted along the route", () => {
    const { s, a, b } = setup();
    must(buildWaves(s, ctx()));
    expect(s.waves).toHaveLength(1);
    expect(s.waves[0].strategy).toBe("single_item_envelope");
    expect(s.waves[0].pickMode).toBe("batch_by_sku");
    must(releaseWave(s, ctx(), s.waves[0].id));
    const tasks = s.pickTasks.filter((t) => t.waveId === s.waves[0].id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].qty).toBe(2);
    expect(a.status).toBe("in_wave");
    expect(b.status).toBe("in_wave");
  });

  it("requires bin scan before item scan and rejects wrong bins/items", () => {
    const { s } = setup();
    must(buildWaves(s, ctx()));
    const wave = s.waves[0];
    must(releaseWave(s, ctx(), wave.id));
    const t = currentTask(s, wave.id)!;
    const sku = s.skus.find((k) => k.id === t.skuId)!;
    const r1 = pickScan(s, ctx(), { waveId: wave.id, raw: sku.barcodes[0] });
    expect(!r1.ok && r1.code).toBe("SCAN_BIN_FIRST");
    const wrongBin = s.bins.find((b) => b.id !== t.binId && (b.zoneType === "storage" || b.zoneType === "pickface"))!;
    const r2 = pickScan(s, ctx(), { waveId: wave.id, raw: wrongBin.barcode });
    expect(!r2.ok && r2.code).toBe("WRONG_BIN");
    must(pickScan(s, ctx(), { waveId: wave.id, raw: s.bins.find((b) => b.id === t.binId)!.barcode }));
    const other = s.skus.find((k) => k.id !== sku.id)!;
    const r3 = pickScan(s, ctx(), { waveId: wave.id, raw: other.barcodes[0] });
    expect(!r3.ok && r3.code).toBe("WRONG_ITEM");
  });

  it("a short pick re-allocates from other stock and keeps invariants", () => {
    const { s } = setup();
    must(buildWaves(s, ctx()));
    const wave = s.waves[0];
    must(releaseWave(s, ctx(), wave.id));
    const t = currentTask(s, wave.id)!;
    must(pickScan(s, ctx(), { waveId: wave.id, raw: s.bins.find((b) => b.id === t.binId)!.barcode }));
    must(shortPick(s, ctx(), { taskId: t.id, reason: "ไม่มีของที่ช่อง" }));
    expect(assertInvariants(s)).toEqual([]);
    expect(currentTaskOf(s, wave.id)).toBeDefined();
  });
});

describe("pack poka-yoke", () => {
  function packReady() {
    const { s, a } = setup();
    must(buildWaves(s, ctx()));
    const wave = s.waves[0];
    must(releaseWave(s, ctx(), wave.id));
    pickAll(s, wave.id);
    expect(a.status).toBe("picked");
    const session = must(startPackSession(s, ctx(), { orderId: a.id }));
    return { s, a, sessionId: session.sessionId };
  }

  it("blocks the label on a wrong item, latches the red light, and releases on the right item", () => {
    const { s, sessionId } = packReady();
    const wrong = skuByCode(s, "TEE-001-WHT-M");
    const r = packScan(s, ctx(), { sessionId, raw: wrong.barcodes[0] });
    expect(!r.ok && r.code).toBe("PACK_MISMATCH");
    const session = s.packSessions[0];
    expect(session.redLightOn).toBe(true);
    expect(session.status).toBe("blocked");
    const early = issueLabel(s, ctx(), { sessionId, boxSize: "ENV_S" });
    expect(!early.ok && early.code).toBe("LABEL_BLOCKED");
    must(packScan(s, ctx(), { sessionId, raw: skuByCode(s, "TEE-001-BLK-M").barcodes[0] }));
    expect(session.redLightOn).toBe(false);
    expect(session.status).toBe("verified");
    const label = must(issueLabel(s, ctx(), { sessionId, boxSize: "ENV_S" }));
    expect(label.trackingNo).toMatch(/^TH\d{9}$/);
  });

  it("needs a supervisor after three mismatches and the guard lives in the domain", () => {
    const { s, sessionId } = packReady();
    const wrong = skuByCode(s, "TEE-001-WHT-M").barcodes[0];
    for (let i = 0; i < 3; i++) packScan(s, ctx(), { sessionId, raw: wrong });
    const r = packScan(s, ctx(), { sessionId, raw: skuByCode(s, "TEE-001-BLK-M").barcodes[0] });
    expect(!r.ok && r.code).toBe("SUPERVISOR_REQUIRED");
    const clear = packClearAlarm(s, { sessionId });
    expect(clear.ok).toBe(false);
    must(packSupervisorOverride(s, ctx("2026-11-04T03:05:00.000Z"), { sessionId, reason: "ป้ายบาร์โค้ดซีด" }));
    must(packScan(s, ctx("2026-11-04T03:06:00.000Z"), { sessionId, raw: skuByCode(s, "TEE-001-BLK-M").barcodes[0] }));
    expect(s.packSessions[0].status).toBe("verified");
  });

  it("reports the over-quantity reason when a finished item is scanned again", () => {
    const { s, sessionId } = packReady();
    const right = skuByCode(s, "TEE-001-BLK-M").barcodes[0];
    must(packScan(s, ctx(), { sessionId, raw: right }));
    const r = packScan(s, ctx(), { sessionId, raw: right });
    expect(!r.ok && r.code).toBe("PACK_MISMATCH");
    expect(s.packSessions[0].mismatches.at(-1)?.reason).toBe("over_qty");
  });
});
