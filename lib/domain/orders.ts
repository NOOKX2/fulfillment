import { addHours } from "../clock";
import { unallocateOrder } from "./allocation";
import { fail, nextId, ok, type Ctx, type Result } from "./core";
import { assertTransition, orderMachine } from "./machines";
import { ORDER_POOL, type OrderPayload } from "./orderPool";
import { queueOutbox } from "./outbox";
import { retryAwaiting, tryReserve } from "./reservation";
import type { AppState, ID, Order, OrderStatus } from "./types";

const PREFIX: Record<Order["channel"], string> = {
  shopee: "SPE",
  lazada: "LZD",
  tiktok: "TTS",
  website: "WEB",
};

export function createOrder(s: AppState, ctx: Ctx, p: OrderPayload): Order {
  const id = nextId(s, "ord");
  const n = s.seq["ord"];
  const lines = p.lines.map((l, i) => {
    const sku = s.skus.find((k) => k.code === l.skuCode);
    if (!sku) throw new Error(`Unknown SKU code ${l.skuCode}`);
    return { id: `${id}-L${i + 1}`, skuId: sku.id, qty: l.qty, unitPrice: l.unitPrice };
  });
  const total = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const order: Order = {
    id,
    channel: p.channel,
    channelOrderNo: `${PREFIX[p.channel]}${2611000000 + n * 37}`,
    buyerName: p.buyerName,
    address: p.address,
    phone: p.phone,
    lines,
    paymentStatus: p.cod ? "cod" : p.paid ? "paid" : "unpaid",
    paidAt: p.paid && !p.cod ? ctx.now : undefined,
    createdAt: ctx.now,
    carrier: p.carrier,
    shipBy: addHours(ctx.now, p.shipByHours),
    codAmount: p.cod ? total : undefined,
    status: "awaiting_payment",
  };
  s.orders.push(order);
  // Paid and COD orders lock stock immediately.
  if (p.paid || p.cod) tryReserve(s, ctx, order);
  return order;
}

/** Simulated omnichannel pull: adds the next `count` payloads from the fixed pool. */
export function syncOrders(
  s: AppState,
  ctx: Ctx,
  input: { count?: number } = {},
): Result<{ created: number; reserved: number; waiting: number }> {
  const count = input.count ?? 3;
  let reserved = 0;
  let waiting = 0;
  for (let i = 0; i < count; i++) {
    const payload = ORDER_POOL[s.simCursor % ORDER_POOL.length];
    s.simCursor += 1;
    const o = createOrder(s, ctx, payload);
    if (o.status === "paid_reserved") reserved++;
    if (o.status === "awaiting_stock") waiting++;
  }
  return ok({ created: count, reserved, waiting });
}

export function markPaid(s: AppState, ctx: Ctx, orderId: ID): Result<{ reserved: boolean }> {
  const o = s.orders.find((x) => x.id === orderId);
  if (!o) return fail("ORDER_NOT_FOUND");
  if (o.status !== "awaiting_payment") return fail("BAD_ORDER_STATE", o.status);
  o.paymentStatus = "paid";
  o.paidAt = ctx.now;
  return ok({ reserved: tryReserve(s, ctx, o) });
}

const CANCELLABLE: OrderStatus[] = [
  "awaiting_payment",
  "paid_reserved",
  "awaiting_stock",
  "allocated",
  "in_wave",
  "picking",
  "picked",
  "packing",
];

export function cancelOrder(s: AppState, ctx: Ctx, orderId: ID): Result<void> {
  const o = s.orders.find((x) => x.id === orderId);
  if (!o) return fail("ORDER_NOT_FOUND");
  if (o.status === "cancelled") return fail("BAD_ORDER_STATE", o.status);
  if (!CANCELLABLE.includes(o.status)) {
    if (o.status === "packed" || o.status === "ready_to_ship") return fail("CANCEL_BLOCKED");
    return fail("BAD_ORDER_STATE", o.status);
  }
  unallocateOrder(s, ctx, o, "cancelled");
  o.cancelledAt = ctx.now;
  o.shortBy = undefined;
  if (o.paymentStatus === "paid") o.paymentStatus = "refunded";
  queueOutbox(s, ctx, o, "cancel_ack");
  retryAwaiting(s, ctx);
  return ok();
}

/** Re-run reservation for an order stuck on awaiting_stock (also automatic on stock arrival). */
export function retryOrder(s: AppState, ctx: Ctx, orderId: ID): Result<{ reserved: boolean }> {
  const o = s.orders.find((x) => x.id === orderId);
  if (!o) return fail("ORDER_NOT_FOUND");
  if (o.status !== "awaiting_stock") return fail("BAD_ORDER_STATE", o.status);
  assertTransition("order", orderMachine, o.status, "awaiting_stock");
  return ok({ reserved: tryReserve(s, ctx, o) });
}
