import { describe, expect, it } from "vitest";
import { ctx, fresh, skuByCode, todayOf } from "./helpers";
import { atp, assertInvariants, binLoad } from "@/lib/domain/core";
import {
  TransitionError,
  assertTransition,
  asnMachine,
  canTransition,
  manifestMachine,
  orderMachine,
  outboxMachine,
  packMachine,
  pickTaskMachine,
  putawayMachine,
  returnMachine,
  shipmentMachine,
  stockMachine,
  waveMachine,
} from "@/lib/domain/machines";
import { cancelOrder, createOrder, markPaid } from "@/lib/domain/orders";
import { suggestBins } from "@/lib/domain/putaway";
import { parseScan } from "@/lib/scan/parse";
import { resolveBin, resolveSku, validateScan } from "@/lib/scan/validate";
import { buildWaves, releaseWave } from "@/lib/domain/waves";

const MACHINES: Record<string, Record<string, string[]>> = {
  asn: asnMachine,
  stock: stockMachine,
  putaway: putawayMachine,
  order: orderMachine,
  wave: waveMachine,
  pickTask: pickTaskMachine,
  pack: packMachine,
  shipment: shipmentMachine,
  manifest: manifestMachine,
  outbox: outboxMachine,
  return: returnMachine,
};

describe("state machines", () => {
  it("only reference states that exist as keys", () => {
    for (const [name, m] of Object.entries(MACHINES)) {
      for (const [from, tos] of Object.entries(m)) {
        for (const to of tos) expect(m, `${name}: ${from} -> ${to}`).toHaveProperty(to);
      }
    }
  });

  it("throw TransitionError on illegal moves and allow no-ops", () => {
    expect(() => assertTransition("order", orderMachine, "picked", "handed_over")).toThrow(TransitionError);
    expect(() => assertTransition("manifest", manifestMachine, "draft", "handed_over")).toThrow(TransitionError);
    expect(() => assertTransition("outbox", outboxMachine, "sent", "queued")).toThrow(TransitionError);
    expect(() => assertTransition("shipment", shipmentMachine, "label_printed", "handed_over")).toThrow(TransitionError);
    expect(() => assertTransition("order", orderMachine, "picked", "picked")).not.toThrow();
    expect(canTransition(orderMachine, "paid_reserved", "cancelled")).toBe(true);
    expect(canTransition(orderMachine, "handed_over", "paid_reserved")).toBe(false);
  });

  it("cancelled / completed style states are terminal", () => {
    expect(orderMachine.cancelled).toEqual([]);
    expect(returnMachine.completed).toEqual([]);
    expect(manifestMachine.handed_over).toEqual([]);
  });
});

describe("scan parsing and validation", () => {
  it("classifies by prefix, case-insensitively, and trims", () => {
    expect(parseScan(" loc:A-01-01-1-01 ").kind).toBe("bin");
    expect(parseScan("ORD:ord-1")).toMatchObject({ kind: "order", value: "ord-1" });
    expect(parseScan("tot:tot-1").kind).toBe("tote");
    expect(parseScan("ASN:ASN-1").kind).toBe("asn");
    expect(parseScan("RMA:RMA-002601").kind).toBe("return");
    expect(parseScan("TRK:TH000001000").kind).toBe("tracking");
    expect(parseScan("8850000000012").kind).toBe("sku");
    expect(parseScan("   ").kind).toBe("unknown");
  });

  it("resolves SKUs and bins and rejects the wrong kind", () => {
    const s = fresh();
    const sku = skuByCode(s, "TEE-001-BLK-M");
    expect(resolveSku(s, sku.barcodes[0]).ok).toBe(true);
    const unknown = resolveSku(s, "0000000000000");
    expect(unknown.ok).toBe(false);
    const bin = s.bins[0];
    expect(resolveBin(s, bin.barcode).ok).toBe(true);
    const skuAsBin = resolveBin(s, sku.barcodes[0]);
    expect(skuAsBin.ok).toBe(false);
    const wrongItem = validateScan(s, skuByCode(s, "TEE-001-WHT-M").barcodes[0], { kind: "sku", skuId: sku.id });
    expect(!wrongItem.ok && wrongItem.code).toBe("WRONG_ITEM");
    const wrongBin = validateScan(s, bin.barcode, { kind: "bin", binId: s.bins[1].id });
    expect(!wrongBin.ok && wrongBin.code).toBe("WRONG_BIN");
  });
});

describe("seed data", () => {
  it("has unique SKU codes/barcodes and bin barcodes, and consistent invariants", () => {
    const s = fresh();
    const skuBarcodes = s.skus.flatMap((k) => k.barcodes);
    expect(new Set(skuBarcodes).size).toBe(skuBarcodes.length);
    expect(new Set(s.skus.map((k) => k.code)).size).toBe(s.skus.length);
    expect(new Set(s.bins.map((b) => b.barcode)).size).toBe(s.bins.length);
    expect(assertInvariants(s)).toEqual([]);
  });

  it("never fills a bin beyond its weight or volume capacity", () => {
    const s = fresh();
    for (const b of s.bins) {
      const l = binLoad(s, b.id);
      expect(l.weightG, b.path).toBeLessThanOrEqual(b.maxWeightG);
      expect(l.volumeCm3, b.path).toBeLessThanOrEqual(b.maxVolumeCm3);
    }
  });
});

describe("directed putaway scoring", () => {
  it("returns at most 3 suggestions sorted by score; fast movers prefer the golden shelf", () => {
    const s = fresh();
    const fast = s.skus.find((k) => k.velocity === "A")!;
    const slow = s.skus.find((k) => k.velocity === "C")!;
    const a = suggestBins(s, fast, 5);
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(3);
    expect([...a].sort((x, y) => y.score - x.score)).toEqual(a);
    const top = s.bins.find((b) => b.id === a[0].binId)!;
    expect(top.ergonomics).toBe("golden");
    const c = suggestBins(s, slow, 5);
    const topC = s.bins.find((b) => b.id === c[0].binId)!;
    expect(topC.ergonomics).not.toBe("golden");
  });

  it("never suggests excluded or non-pickable bins", () => {
    const s = fresh();
    const k = s.skus[0];
    const first = suggestBins(s, k, 1)[0];
    const next = suggestBins(s, k, 1, [first.binId]);
    expect(next.every((x) => x.binId !== first.binId)).toBe(true);
    for (const x of suggestBins(s, k, 1, [], 50)) {
      const b = s.bins.find((y) => y.id === x.binId)!;
      expect(["storage", "pickface"]).toContain(b.zoneType);
    }
  });
});

describe("ATP / reservation invariants under random operations", () => {
  it("never goes negative and never oversells across mixed create/pay/cancel/wave steps", () => {
    const s = fresh();
    s.orders = [];
    s.reservations = [];
    s.allocations = [];
    s.stock.forEach((r) => (r.qtyAllocated = 0));
    let seed = 42;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const today = todayOf();
    const codes = s.skus.slice(0, 5).map((k) => k.code);
    for (let i = 0; i < 80; i++) {
      const r = rnd();
      if (r < 0.5) {
        const o = createOrder(s, ctx(), {
          channel: "shopee",
          buyerName: "x",
          address: "y",
          phone: "0",
          carrier: "flash",
          shipByHours: 24,
          paid: rnd() < 0.7,
          lines: [{ skuCode: codes[Math.floor(rnd() * codes.length)], qty: 1 + Math.floor(rnd() * 8), unitPrice: 10 }],
        });
        if (o.status === "awaiting_payment" && rnd() < 0.5) markPaid(s, ctx(), o.id);
      } else if (r < 0.75 && s.orders.length) {
        const live = s.orders.filter((o) => o.status !== "cancelled");
        if (live.length) cancelOrder(s, ctx(), live[Math.floor(rnd() * live.length)].id);
      } else if (r < 0.9) {
        const b = buildWaves(s, ctx());
        if (b.ok && s.waves.length) {
          const w = s.waves.find((x) => x.status === "draft");
          if (w) releaseWave(s, ctx(), w.id);
        }
      }
      expect(assertInvariants(s), `step ${i}`).toEqual([]);
      for (const k of s.skus) expect(atp(s, k.id, today), `${k.code} step ${i}`).toBeGreaterThanOrEqual(0);
    }
  });
});
