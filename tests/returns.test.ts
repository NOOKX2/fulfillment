import { describe, expect, it } from "vitest";
import { handedOverState } from "./flowHelpers";
import { ctx, must, skuByCode } from "./helpers";
import { assertInvariants } from "./pickHelpers";
import { atp, binCapacityFor } from "@/lib/domain/core";
import {
  closeReturn,
  completeRepack,
  createDemoReturn,
  gradeLine,
  restockLine,
  returnIntake,
  returnScanItem,
} from "@/lib/domain/returns";
import type { AppState } from "@/lib/domain/types";

const SKU = "TEE-001-BLK-M";
const today = "2026-11-04";

function receivedReturn() {
  const s: AppState = handedOverState(1);
  const { returnId } = must(createDemoReturn(s, ctx()));
  const ret = s.returns.find((r) => r.id === returnId)!;
  must(returnIntake(s, ctx(), { raw: ret.rmaNo }));
  const item = skuByCode(s, SKU).barcodes[0];
  must(returnScanItem(s, ctx(), { returnId, raw: item }));
  return { s, ret, returnId, item, line: ret.lines[0] };
}

describe("returns", () => {
  it("creates a return only for handed-over orders and rejects unknown intake codes", () => {
    const s = handedOverState(1);
    const r = returnIntake(s, ctx(), { raw: "RMA-999999" });
    expect(!r.ok && r.code).toBe("RETURN_NOT_FOUND");
    const { returnId } = must(createDemoReturn(s, ctx()));
    const again = createDemoReturn(s, ctx(), { orderId: s.returns.find((x) => x.id === returnId)!.orderId });
    expect(again.ok).toBe(false); // order is now return_in_progress
  });

  it("intake by original airway bill pulls up the order's return", () => {
    const s = handedOverState(1);
    const tracking = s.shipments[0].trackingNo;
    const res = must(returnIntake(s, ctx(), { raw: tracking }));
    expect(res.created).toBe(true);
    expect(s.returns[0].status).toBe("received");
    expect(s.outbox.some((e) => e.kind === "return_received")).toBe(true);
  });

  it("rejects wrong and over-returned items", () => {
    const { s, returnId, item } = receivedReturn();
    const wrong = returnScanItem(s, ctx(), { returnId, raw: skuByCode(s, "TEE-001-WHT-M").barcodes[0] });
    expect(!wrong.ok && wrong.code).toBe("NOT_IN_ORDER");
    const over = returnScanItem(s, ctx(), { returnId, raw: item });
    expect(!over.ok && over.code).toBe("OVER_RETURN");
  });

  it("grade A: goes to returns hold (not sellable) until restocked to the original bin", () => {
    const { s, ret, returnId, item, line } = receivedReturn();
    const before = atp(s, skuByCode(s, SKU).id, today);
    must(gradeLine(s, ctx(), { returnId, lineId: line.id, grade: "A_good" }));
    expect(atp(s, skuByCode(s, SKU).id, today)).toBe(before); // still not sellable
    expect(ret.status).toBe("restock_pending");

    const origin = s.bins.find((b) => b.id === line.originBinId)!;
    const other = s.bins.find((b) => b.id !== origin.id && (b.zoneType === "storage" || b.zoneType === "pickface"))!;
    const bad = restockLine(s, ctx(), { returnId, lineId: line.id, itemRaw: item, binRaw: other.barcode });
    expect(!bad.ok && bad.code).toBe("WRONG_BIN");
    must(restockLine(s, ctx(), { returnId, lineId: line.id, itemRaw: item, binRaw: origin.barcode }));
    expect(atp(s, skuByCode(s, SKU).id, today)).toBe(before + 1);
    expect(ret.status).toBe("completed");
    expect(s.orders.find((o) => o.id === ret.orderId)!.status).toBe("returned");
    expect(assertInvariants(s)).toEqual([]);
  });

  it("restocking to another bin needs a reason", () => {
    const { s, returnId, item, line } = receivedReturn();
    must(gradeLine(s, ctx(), { returnId, lineId: line.id, grade: "A_good" }));
    const origin = s.bins.find((b) => b.id === line.originBinId)!;
    const sku = skuByCode(s, SKU);
    const other = s.bins.find((b) => b.id !== origin.id && (b.zoneType === "storage" || b.zoneType === "pickface") && binCapacityFor(s, b, sku) >= 1)!;
    must(restockLine(s, ctx(), { returnId, lineId: line.id, itemRaw: item, binRaw: other.barcode, overrideReason: "ช่องเดิมเต็ม" }));
    expect(line.restockOverrideReason).toBe("ช่องเดิมเต็ม");
  });

  it("grade B: must be repacked before restock", () => {
    const { s, ret, returnId, item, line } = receivedReturn();
    must(gradeLine(s, ctx(), { returnId, lineId: line.id, grade: "B_box_damaged" }));
    expect(ret.status).toBe("repack_pending");
    const origin = s.bins.find((b) => b.id === line.originBinId)!;
    const early = restockLine(s, ctx(), { returnId, lineId: line.id, itemRaw: item, binRaw: origin.barcode });
    expect(!early.ok && early.code).toBe("REPACK_FIRST");
    must(completeRepack(s, ctx(), { returnId, lineId: line.id }));
    must(restockLine(s, ctx(), { returnId, lineId: line.id, itemRaw: item, binRaw: origin.barcode }));
    expect(ret.status).toBe("completed");
  });

  it("grade C: destroy never becomes sellable; RTV needs a reason and creates a claim", () => {
    const a = receivedReturn();
    const before = atp(a.s, skuByCode(a.s, SKU).id, today);
    must(gradeLine(a.s, ctx(), { returnId: a.returnId, lineId: a.line.id, grade: "C_unusable", disposition: "destroy" }));
    expect(a.ret.status).toBe("completed");
    expect(atp(a.s, skuByCode(a.s, SKU).id, today)).toBe(before);
    expect(a.s.rtvClaims).toHaveLength(0);

    const b = receivedReturn();
    const noReason = gradeLine(b.s, ctx(), { returnId: b.returnId, lineId: b.line.id, grade: "C_unusable", disposition: "rtv_claim" });
    expect(!noReason.ok && noReason.code).toBe("REASON_REQUIRED");
    must(gradeLine(b.s, ctx(), { returnId: b.returnId, lineId: b.line.id, grade: "C_unusable", disposition: "rtv_claim", reason: "ตะเข็บหลุด" }));
    expect(b.s.rtvClaims).toHaveLength(1);
    expect(b.s.rtvClaims[0].reason).toBe("ตะเข็บหลุด");
    expect(assertInvariants(b.s)).toEqual([]);
  });

  it("cannot grade twice or close with unresolved lines", () => {
    const { s, returnId, line } = receivedReturn();
    const early = closeReturn(s, ctx(), { returnId });
    expect(!early.ok && early.code).toBe("LINE_NOT_GRADED");
    must(gradeLine(s, ctx(), { returnId, lineId: line.id, grade: "A_good" }));
    const twice = gradeLine(s, ctx(), { returnId, lineId: line.id, grade: "B_box_damaged" });
    expect(!twice.ok && twice.code).toBe("LINE_ALREADY_GRADED");
  });
});
