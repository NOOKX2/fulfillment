import { describe, expect, it } from "vitest";
import { assertInvariants, binCapacityFor } from "@/lib/domain/core";
import { closeAsn, receiveScan, submitQc } from "@/lib/domain/inbound";
import { putawayScanBin, putawayScanItem } from "@/lib/domain/putaway";
import { atpOf, ctx, fresh, must, skuByCode } from "./helpers";

describe("inbound → QC → putaway", () => {
  it("received stock is pending QC and not sellable", () => {
    const s = fresh();
    const before = atpOf(s, "TEE-001-BLK-S");
    const asn = s.asns[0];
    must(receiveScan(s, ctx(), { asnId: asn.id, raw: skuByCode(s, "TEE-001-BLK-S").barcodes[0], qty: 10 }));
    expect(atpOf(s, "TEE-001-BLK-S")).toBe(before);
    expect(s.stock.some((r) => r.status === "pending_qc" && r.qty === 10)).toBe(true);
    expect(asn.status).toBe("receiving");
  });

  it("rejects items not on the ASN and requires confirmation for over-receipt", () => {
    const s = fresh();
    const asn = s.asns[0];
    const stranger = s.skus.find((k) => !asn.lines.some((l) => l.skuId === k.id))!;
    const r = receiveScan(s, ctx(), { asnId: asn.id, raw: stranger.barcodes[0] });
    expect(r.ok).toBe(false);
    const k = skuByCode(s, "TEE-001-BLK-S");
    const over = receiveScan(s, ctx(), { asnId: asn.id, raw: k.barcodes[0], qty: 41 });
    expect(!over.ok && over.code).toBe("OVER_RECEIPT_CONFIRM");
    must(receiveScan(s, ctx(), { asnId: asn.id, raw: k.barcodes[0], qty: 41, confirmOver: true }));
    expect(s.discrepancies.some((d) => d.type === "over")).toBe(true);
  });

  it("QC split must add up and failed units never become sellable", () => {
    const s = fresh();
    const asn = s.asns[0];
    const k = skuByCode(s, "TEE-001-BLK-S");
    must(receiveScan(s, ctx(), { asnId: asn.id, raw: k.barcodes[0], qty: 10 }));
    const receipt = s.receipts[0];
    const bad = submitQc(s, ctx(), { receiptLineId: receipt.id, qtyPass: 9, qtyHold: 2, qtyQuarantine: 0, checks: [], reasonCode: "damaged" });
    expect(bad.ok).toBe(false); // 11 > 10
    const noReason = submitQc(s, ctx(), { receiptLineId: receipt.id, qtyPass: 8, qtyHold: 2, qtyQuarantine: 0, checks: [] });
    expect(!noReason.ok && noReason.code).toBe("REASON_REQUIRED");
    const before = atpOf(s, "TEE-001-BLK-S");
    const res = must(submitQc(s, ctx(), { receiptLineId: receipt.id, qtyPass: 7, qtyHold: 2, qtyQuarantine: 1, checks: [], reasonCode: "damaged" }));
    expect(res.putawayTasks).toBeGreaterThan(0);
    // passed units still sit in receiving → not pickable until putaway
    expect(atpOf(s, "TEE-001-BLK-S")).toBe(before);
    expect(s.stock.filter((r) => r.skuId === k.id && r.status === "hold").reduce((n, r) => n + r.qty, 0)).toBe(2);
    expect(s.stock.filter((r) => r.skuId === k.id && r.status === "quarantine").reduce((n, r) => n + r.qty, 0)).toBe(1);
  });

  it("putaway needs item scan before bin scan and increases ATP when done", () => {
    const s = fresh();
    const asn = s.asns[0];
    const k = skuByCode(s, "TEE-001-BLK-S");
    must(receiveScan(s, ctx(), { asnId: asn.id, raw: k.barcodes[0], qty: 10 }));
    must(submitQc(s, ctx(), { receiptLineId: s.receipts[0].id, qtyPass: 10, qtyHold: 0, qtyQuarantine: 0, checks: [] }));
    const task = s.putaway.find((t) => t.skuId === k.id)!;
    const topBin = s.bins.find((b) => b.id === task.suggestions[0].binId)!;
    const early = putawayScanBin(s, ctx(), { taskId: task.id, raw: topBin.barcode });
    expect(!early.ok && early.code).toBe("SCAN_ORDER");
    const binFirst = putawayScanItem(s, ctx(), { taskId: task.id, raw: topBin.barcode });
    expect(!binFirst.ok && binFirst.code).toBe("SCAN_ORDER");
    const before = atpOf(s, "TEE-001-BLK-S");
    must(putawayScanItem(s, ctx(), { taskId: task.id, raw: k.barcodes[0] }));
    must(putawayScanBin(s, ctx(), { taskId: task.id, raw: topBin.barcode }));
    expect(atpOf(s, "TEE-001-BLK-S")).toBe(before + 10);
    expect(assertInvariants(s)).toEqual([]);
  });

  it("overriding to a non-suggested bin requires a reason", () => {
    const s = fresh();
    const asn = s.asns[0];
    const k = skuByCode(s, "TEE-001-BLK-S");
    must(receiveScan(s, ctx(), { asnId: asn.id, raw: k.barcodes[0], qty: 2 }));
    must(submitQc(s, ctx(), { receiptLineId: s.receipts[0].id, qtyPass: 2, qtyHold: 0, qtyQuarantine: 0, checks: [] }));
    const task = s.putaway[0];
    const off = s.bins.find((b) => (b.zoneType === "storage" || b.zoneType === "pickface") && !task.suggestions.some((x) => x.binId === b.id) && binCapacityFor(s, b, k) >= 2)!;
    must(putawayScanItem(s, ctx(), { taskId: task.id, raw: k.barcodes[0] }));
    const r = putawayScanBin(s, ctx(), { taskId: task.id, raw: off.barcode });
    expect(!r.ok && r.code).toBe("NOT_SUGGESTED_BIN");
    must(putawayScanBin(s, ctx(), { taskId: task.id, raw: off.barcode, overrideReason: "ชั้นเดิมเต็ม" }));
    expect(task.overrideReason).toBeTruthy();
  });

  it("closing an ASN with shorts logs discrepancies and needs acknowledgement", () => {
    const s = fresh();
    const asn = s.asns[0];
    const r = closeAsn(s, ctx(), { asnId: asn.id });
    expect(!r.ok && r.code).toBe("DISCREPANCY_UNACK");
    must(closeAsn(s, ctx(), { asnId: asn.id, acknowledge: true }));
    expect(asn.status).toBe("closed_with_discrepancy");
  });
});
