import { assertTransition, orderMachine } from "./machines";
import { atp, nextId, pushLedger, today, type Ctx } from "./core";
import type { AppState, ID, Order } from "./types";

function needBySku(order: Order): Record<ID, number> {
  const need: Record<ID, number> = {};
  for (const l of order.lines) need[l.skuId] = (need[l.skuId] ?? 0) + l.qty;
  return need;
}

/**
 * All-or-nothing soft lock. Checks ATP and reserves in one synchronous action,
 * so two paid orders can never both claim the last unit (no overselling).
 * Returns true when the order is now `paid_reserved`.
 */
export function tryReserve(s: AppState, ctx: Ctx, order: Order): boolean {
  const need = needBySku(order);
  const short: Record<ID, number> = {};
  for (const [skuId, qty] of Object.entries(need)) {
    const avail = atp(s, skuId, today(ctx));
    if (avail < qty) short[skuId] = qty - Math.max(0, avail);
  }
  if (Object.keys(short).length > 0) {
    assertTransition("order", orderMachine, order.status, "awaiting_stock");
    order.status = "awaiting_stock";
    order.shortBy = short;
    return false;
  }
  assertTransition("order", orderMachine, order.status, "paid_reserved");
  for (const line of order.lines) {
    s.reservations.push({
      id: nextId(s, "rsv"),
      orderId: order.id,
      lineId: line.id,
      skuId: line.skuId,
      qty: line.qty,
      status: "active",
    });
    pushLedger(s, ctx, {
      type: "reserve",
      skuId: line.skuId,
      qty: line.qty,
      refType: "order",
      refId: order.id,
    });
  }
  order.status = "paid_reserved";
  order.shortBy = undefined;
  return true;
}

/** Re-check orders waiting for stock, oldest payment first. */
export function retryAwaiting(s: AppState, ctx: Ctx): number {
  const waiting = s.orders
    .filter((o) => o.status === "awaiting_stock")
    .sort((a, b) => (a.paidAt ?? a.createdAt).localeCompare(b.paidAt ?? b.createdAt));
  let reserved = 0;
  for (const o of waiting) {
    if (tryReserve(s, ctx, o)) reserved++;
  }
  return reserved;
}

export function releaseReservations(s: AppState, ctx: Ctx, orderId: ID): void {
  for (const r of s.reservations) {
    if (r.orderId === orderId && r.status === "active") {
      r.status = "released";
      pushLedger(s, ctx, {
        type: "release",
        skuId: r.skuId,
        qty: r.qty,
        refType: "order",
        refId: orderId,
      });
    }
  }
}
