import { fail, nextId, ok, type Ctx, type Result } from "./core";
import { assertTransition, outboxMachine } from "./machines";
import type { AppState, ID, Order, OutboxEvent } from "./types";

export function queueOutbox(
  s: AppState,
  ctx: Ctx,
  order: Order,
  kind: OutboxEvent["kind"],
  payload: OutboxEvent["payload"] = {},
): OutboxEvent {
  const e: OutboxEvent = {
    id: nextId(s, "obx"),
    channel: order.channel,
    orderId: order.id,
    kind,
    payload,
    status: "queued",
    attempts: 0,
    createdAt: ctx.now,
  };
  s.outbox.push(e);
  return e;
}

export function outboxBegin(s: AppState, _ctx: Ctx, id: ID): Result<void> {
  const e = s.outbox.find((x) => x.id === id);
  if (!e) return fail("INVALID_INPUT");
  if (e.status !== "queued") return ok();
  assertTransition("outbox", outboxMachine, e.status, "sending");
  e.status = "sending";
  e.attempts += 1;
  return ok();
}

/** Complete a simulated push. Honors the "fail next push" demo switch. */
export function outboxFinish(s: AppState, ctx: Ctx, id: ID): Result<{ sent: boolean }> {
  const e = s.outbox.find((x) => x.id === id);
  if (!e) return fail("INVALID_INPUT");
  if (e.status !== "sending") return ok({ sent: e.status === "sent" });
  if (s.settings.failOutboxNext) {
    s.settings.failOutboxNext = false;
    assertTransition("outbox", outboxMachine, e.status, "failed");
    e.status = "failed";
    e.lastError = "HTTP 503 (simulated)";
    return ok({ sent: false });
  }
  assertTransition("outbox", outboxMachine, e.status, "sent");
  e.status = "sent";
  e.sentAt = ctx.now;
  e.lastError = undefined;
  return ok({ sent: true });
}

export function outboxRetry(s: AppState, _ctx: Ctx, id: ID): Result<void> {
  const e = s.outbox.find((x) => x.id === id);
  if (!e) return fail("INVALID_INPUT");
  if (e.status !== "failed") return ok();
  assertTransition("outbox", outboxMachine, e.status, "queued");
  e.status = "queued";
  return ok();
}

/** After a page reload, events stuck in `sending` go back to the queue. */
export function recoverOutbox(s: AppState): void {
  for (const e of s.outbox) if (e.status === "sending") e.status = "queued";
}
