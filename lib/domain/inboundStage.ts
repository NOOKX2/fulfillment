import type { AppState, Asn } from "./types";

export type InboundStage = "not_started" | "counting" | "qc" | "putaway" | "done";

const COUNTED_STATUSES: Asn["status"][] = ["received", "closed", "closed_with_discrepancy"];

export function asnTotals(a: Asn): { exp: number; rec: number } {
  return {
    exp: a.lines.reduce((n, x) => n + x.expectedQty, 0),
    rec: a.lines.reduce((n, x) => n + x.receivedQty, 0),
  };
}

export function isCounted(a: Asn): boolean {
  const { exp, rec } = asnTotals(a);
  return rec >= exp || COUNTED_STATUSES.includes(a.status);
}

/** Receipt lots of this ASN that still wait for QC. */
export function pendingQcLots(a: Asn, d: AppState) {
  return d.receipts.filter((r) => r.asnId === a.id && r.qty - r.qcDone > 0);
}

/** Open putaway tasks that belong to this ASN's receipts (matched by SKU + lot). */
export function openPutawayTasks(a: Asn, d: AppState) {
  const receipts = d.receipts.filter((r) => r.asnId === a.id);
  return d.putaway.filter(
    (t) =>
      (t.status === "suggested" || t.status === "in_progress") &&
      receipts.some((r) => r.skuId === t.skuId && r.lotNo === t.lotNo),
  );
}

/** Where a truck is in the inbound workflow: count -> QC -> putaway. */
export function stageOf(a: Asn, d: AppState): InboundStage {
  const { rec } = asnTotals(a);
  if (rec === 0 && a.status === "expected") return "not_started";
  if (!isCounted(a)) return "counting";
  if (pendingQcLots(a, d).length > 0) return "qc";
  return openPutawayTasks(a, d).length > 0 ? "putaway" : "done";
}
