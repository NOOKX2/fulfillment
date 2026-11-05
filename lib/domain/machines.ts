import type {
  AsnStatus,
  ManifestStatus,
  OrderStatus,
  OutboxStatus,
  PackStatus,
  PickTaskStatus,
  PutawayStatus,
  ReturnStatus,
  ShipmentStatus,
  StockStatus,
  WaveStatus,
} from "./types";

export const asnMachine: Record<AsnStatus, AsnStatus[]> = {
  expected: ["receiving", "closed_with_discrepancy"],
  receiving: ["received", "closed", "closed_with_discrepancy"],
  received: ["closed", "closed_with_discrepancy"],
  closed: [],
  closed_with_discrepancy: [],
};

export const stockMachine: Record<StockStatus, StockStatus[]> = {
  pending_qc: ["sellable", "hold", "quarantine"],
  hold: ["sellable", "quarantine"],
  quarantine: ["sellable", "rtv", "destroy"],
  return_pending: ["sellable", "repack", "destroy", "rtv"],
  repack: ["sellable"],
  sellable: ["hold", "quarantine"],
  rtv: [],
  destroy: [],
};

export const putawayMachine: Record<PutawayStatus, PutawayStatus[]> = {
  suggested: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const orderMachine: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ["paid_reserved", "awaiting_stock", "cancelled"],
  paid_reserved: ["allocated", "awaiting_stock", "cancelled"],
  awaiting_stock: ["paid_reserved", "cancelled"],
  allocated: ["in_wave", "paid_reserved", "awaiting_stock", "cancelled"],
  in_wave: ["picking", "allocated", "awaiting_stock", "cancelled"],
  picking: ["picked", "awaiting_stock", "cancelled"],
  picked: ["packing", "awaiting_stock", "cancelled"],
  packing: ["packed", "picked", "cancelled"],
  packed: ["ready_to_ship"],
  ready_to_ship: ["handed_over"],
  handed_over: ["return_in_progress"],
  return_in_progress: ["returned", "handed_over"],
  returned: [],
  cancelled: [],
};

export const waveMachine: Record<WaveStatus, WaveStatus[]> = {
  draft: ["released", "cancelled"],
  released: ["picking", "picked", "cancelled"],
  picking: ["picked"],
  picked: ["closed"],
  closed: [],
  cancelled: [],
};

export const pickTaskMachine: Record<PickTaskStatus, PickTaskStatus[]> = {
  pending: ["picked", "short", "skipped"],
  picked: [],
  short: [],
  skipped: [],
};

export const packMachine: Record<PackStatus, PackStatus[]> = {
  open: ["verifying", "blocked"],
  verifying: ["verified", "blocked"],
  verified: ["label_issued", "blocked"],
  blocked: ["verifying", "verified"],
  label_issued: ["closed"],
  closed: [],
};

export const shipmentMachine: Record<ShipmentStatus, ShipmentStatus[]> = {
  label_printed: ["staged", "exception"],
  staged: ["manifested", "exception"],
  manifested: ["handed_over", "staged", "exception"],
  handed_over: [],
  exception: ["staged"],
};

export const manifestMachine: Record<ManifestStatus, ManifestStatus[]> = {
  draft: ["scanning", "awaiting_signature"],
  scanning: ["awaiting_signature"],
  awaiting_signature: ["handed_over"],
  handed_over: [],
};

export const outboxMachine: Record<OutboxStatus, OutboxStatus[]> = {
  queued: ["sending"],
  sending: ["sent", "failed"],
  sent: [],
  failed: ["queued"],
};

export const returnMachine: Record<ReturnStatus, ReturnStatus[]> = {
  expected: ["received", "rejected"],
  received: ["grading", "restock_pending", "repack_pending", "disposition_pending", "completed", "rejected"],
  grading: ["restock_pending", "repack_pending", "disposition_pending", "completed", "grading", "received"],
  restock_pending: ["completed", "grading", "repack_pending", "disposition_pending", "received"],
  repack_pending: ["completed", "grading", "restock_pending", "disposition_pending", "received"],
  disposition_pending: ["completed", "grading", "restock_pending", "repack_pending", "received"],
  completed: [],
  rejected: [],
};

export class TransitionError extends Error {
  constructor(
    public machine: string,
    public from: string,
    public to: string,
  ) {
    super(`Illegal ${machine} transition: ${from} -> ${to}`);
    this.name = "TransitionError";
  }
}

export function canTransition<S extends string>(
  table: Record<S, S[]>,
  from: S,
  to: S,
): boolean {
  return from === to || table[from]?.includes(to) === true;
}

export function assertTransition<S extends string>(
  name: string,
  table: Record<S, S[]>,
  from: S,
  to: S,
): void {
  if (from === to) return;
  if (!table[from]?.includes(to)) throw new TransitionError(name, from, to);
}
