import type { AppState } from "../domain/types";

export const SCHEMA_VERSION = 1;

export function emptyState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    seeded: false,
    seq: {},
    simCursor: 0,
    skus: [],
    suppliers: [],
    nodes: [],
    bins: [],
    bindings: [],
    pos: [],
    asns: [],
    receipts: [],
    discrepancies: [],
    qc: [],
    stock: [],
    ledger: [],
    putaway: [],
    orders: [],
    reservations: [],
    allocations: [],
    waves: [],
    pickTasks: [],
    totes: [],
    packSessions: [],
    shipments: [],
    manifests: [],
    outbox: [],
    returns: [],
    rtvClaims: [],
    scanLog: [],
    settings: {
      lang: "th",
      soundOn: true,
      vibrateOn: true,
      carriers: [],
      failOutboxNext: false,
    },
  };
}
