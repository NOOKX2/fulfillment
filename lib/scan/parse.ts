import type { ScanKind } from "../domain/types";

export const PREFIX = {
  bin: "LOC:",
  order: "ORD:",
  tote: "TOT:",
  asn: "ASN:",
  return: "RMA:",
  tracking: "TRK:",
} as const;

export interface ParsedScan {
  raw: string;
  kind: ScanKind;
  /** payload without the prefix */
  value: string;
}

/** Classify a raw scan by prefix. Bare strings are treated as SKU barcodes. */
export function parseScan(input: string): ParsedScan {
  const raw = input.trim();
  const upper = raw.toUpperCase();
  const hit = (p: string) => upper.startsWith(p);
  if (hit(PREFIX.bin)) return { raw, kind: "bin", value: raw.slice(PREFIX.bin.length) };
  if (hit(PREFIX.order)) return { raw, kind: "order", value: raw.slice(PREFIX.order.length) };
  if (hit(PREFIX.tote)) return { raw, kind: "tote", value: raw.slice(PREFIX.tote.length) };
  if (hit(PREFIX.asn)) return { raw, kind: "asn", value: raw.slice(PREFIX.asn.length) };
  if (hit(PREFIX.return)) return { raw, kind: "return", value: raw.slice(PREFIX.return.length) };
  if (hit(PREFIX.tracking)) return { raw, kind: "tracking", value: raw.slice(PREFIX.tracking.length) };
  if (raw.length === 0) return { raw, kind: "unknown", value: "" };
  return { raw, kind: "sku", value: raw };
}

export const binBarcode = (path: string) => `${PREFIX.bin}${path}`;
export const orderBarcode = (id: string) => `${PREFIX.order}${id}`;
export const toteBarcode = (id: string) => `${PREFIX.tote}${id}`;
export const asnBarcode = (asnNo: string) => `${PREFIX.asn}${asnNo}`;
export const returnBarcode = (rmaNo: string) => `${PREFIX.return}${rmaNo}`;
export const trackingBarcode = (trackingNo: string) => `${PREFIX.tracking}${trackingNo}`;
