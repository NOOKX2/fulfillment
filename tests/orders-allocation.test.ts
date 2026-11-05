import { describe, expect, it } from "vitest";
import { addStock, assertInvariants, binById } from "@/lib/domain/core";
import { allocateOrder } from "@/lib/domain/allocation";
import { cancelOrder, createOrder, markPaid, syncOrders } from "@/lib/domain/orders";
import { ORDER_POOL } from "@/lib/domain/orderPool";
import { atpOf, ctx, fresh, must, skuByCode } from "./helpers";

const payload = (code: string, qty: number, extra: Partial<(typeof ORDER_POOL)[number]> = {}) => ({
  channel: "shopee" as const,
  buyerName: "ทดสอบ",
  address: "1 กรุงเทพ",
  phone: "0800000000",
  carrier: "flash" as const,
  shipByHours: 24,
  paid: true,
  lines: [{ skuCode: code, qty, unitPrice: 100 }],
  ...extra,
});

describe("reserve / allocate", () => {
  it("never oversells the last unit: second paid order waits for stock", () => {
    const s = fresh();
    const code = "SHO-001-BLK-40";
    const avail = atpOf(s, code);
    expect(avail).toBeGreaterThan(0);
    const a = createOrder(s, ctx(), payload(code, avail));
    const b = createOrder(s, ctx(), payload(code, 1));
    expect(a.status).toBe("paid_reserved");
    expect(b.status).toBe("awaiting_stock");
    expect(b.shortBy?.[skuByCode(s, code).id]).toBe(1);
    expect(atpOf(s, code)).toBe(0);
    expect(assertInvariants(s)).toEqual([]);
  });

  it("cancelling releases the reservation and the waiting order takes the unit", () => {
    const s = fresh();
    const code = "SHO-001-BLK-40";
    const avail = atpOf(s, code);
    const a = createOrder(s, ctx(), payload(code, avail));
    const b = createOrder(s, ctx(), payload(code, 1));
    must(cancelOrder(s, ctx(), a.id));
    expect(a.status).toBe("cancelled");
    expect(b.status).toBe("paid_reserved");
  });

  it("unpaid orders do not lock stock until paid", () => {
    const s = fresh();
    const code = "MUG-001-WHT";
    const before = atpOf(s, code);
    const o = createOrder(s, ctx(), payload(code, 2, { paid: false }));
    expect(o.status).toBe("awaiting_payment");
    expect(atpOf(s, code)).toBe(before);
    must(markPaid(s, ctx(), o.id));
    expect(o.status).toBe("paid_reserved");
    expect(atpOf(s, code)).toBe(before - 2);
  });

  it("allocates FIFO for plain SKUs (oldest receipt first)", () => {
    const s = fresh();
    const k = skuByCode(s, "TEE-001-BLK-M");
    const bin = s.bins.find((b) => b.zoneType === "pickface" || b.zoneType === "storage")!;
    const total = s.stock.filter((r) => r.skuId === k.id && r.status === "sellable").reduce((n, r) => n + r.qty, 0);
    addStock(s, { skuId: k.id, lotNo: "OLD", receivedAt: "2020-01-01T00:00:00.000Z", binId: bin.id, status: "sellable", qty: 3 });
    const o = createOrder(s, ctx(), payload("TEE-001-BLK-M", 2));
    must(allocateOrder(s, ctx(), o.id));
    const alloc = s.allocations.filter((a) => a.orderId === o.id);
    expect(alloc[0].lotNo).toBe("OLD");
    expect(total).toBeGreaterThan(0);
  });

  it("allocates FEFO for expiry-tracked SKUs and skips near-expiry lots", () => {
    const s = fresh();
    const k = skuByCode(s, "SRM-001");
    const bin = s.bins.find((b) => b.zoneType === "pickface" || b.zoneType === "storage")!;
    // wipe existing sellable stock so only our lots exist
    s.stock = s.stock.filter((r) => !(r.skuId === k.id));
    addStock(s, { skuId: k.id, lotNo: "LATE", expiryDate: "2027-12-01", receivedAt: "2026-01-01T00:00:00.000Z", binId: bin.id, status: "sellable", qty: 5 });
    addStock(s, { skuId: k.id, lotNo: "SOON", expiryDate: "2027-03-01", receivedAt: "2026-06-01T00:00:00.000Z", binId: bin.id, status: "sellable", qty: 5 });
    addStock(s, { skuId: k.id, lotNo: "NEAR", expiryDate: "2026-11-10", receivedAt: "2025-01-01T00:00:00.000Z", binId: bin.id, status: "sellable", qty: 5 });
    const o = createOrder(s, ctx(), payload("SRM-001", 6));
    expect(o.status).toBe("paid_reserved");
    must(allocateOrder(s, ctx(), o.id));
    const lots = s.allocations.filter((a) => a.orderId === o.id).map((a) => [a.lotNo, a.qty]);
    expect(lots).toEqual([["SOON", 5], ["LATE", 1]]);
  });

  it("order sync is deterministic and cycles through the pool", () => {
    const s = fresh();
    const n = s.orders.length;
    must(syncOrders(s, ctx(), { count: 3 }));
    expect(s.orders.length).toBe(n + 3);
    expect(s.simCursor).toBeGreaterThan(0);
    expect(ORDER_POOL.length).toBeGreaterThan(10);
    expect(binById(s, s.bins[0].id)).toBeTruthy();
  });
});
