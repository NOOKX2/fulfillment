import { binByBarcode, skuByBarcode } from "../domain/core";
import type { ErrorCode } from "../domain/errors";
import type { AppState, Bin, ID, MismatchReason, Sku } from "../domain/types";
import { parseScan } from "./parse";

export type ScanResult<T> =
  | { ok: true; entity: T }
  | { ok: false; code: ErrorCode; detail?: string };

export type Expectation =
  | { kind: "sku"; skuId?: ID }
  | { kind: "bin"; binId?: ID };

/** Resolve a raw scan to a SKU. Bin labels / order codes are not SKU scans. */
export function resolveSku(s: AppState, raw: string): ScanResult<Sku> {
  const p = parseScan(raw);
  if (p.kind !== "sku") return { ok: false, code: "UNKNOWN_BARCODE", detail: p.kind };
  const sku = skuByBarcode(s, p.value);
  if (!sku) return { ok: false, code: "UNKNOWN_BARCODE" };
  return { ok: true, entity: sku };
}

/** Resolve a raw scan to a bin label. A SKU scan here means the wrong scan order. */
export function resolveBin(s: AppState, raw: string): ScanResult<Bin> {
  const p = parseScan(raw);
  if (p.kind !== "bin") {
    if (p.kind === "sku" && skuByBarcode(s, p.value)) return { ok: false, code: "SCAN_ORDER" };
    return { ok: false, code: "UNKNOWN_BARCODE", detail: p.kind };
  }
  const bin = binByBarcode(s, p.raw);
  if (!bin) return { ok: false, code: "BIN_NOT_FOUND" };
  return { ok: true, entity: bin };
}

/**
 * Validate a scan against what the current workflow step expects.
 * Returns the resolved entity, or a typed error code the UI maps to i18n.
 */
export function validateScan(
  s: AppState,
  raw: string,
  expect: Expectation,
): ScanResult<Sku | Bin> {
  if (expect.kind === "sku") {
    const r = resolveSku(s, raw);
    if (!r.ok) return r;
    if (expect.skuId && r.entity.id !== expect.skuId) return { ok: false, code: "WRONG_ITEM" };
    return r;
  }
  const r = resolveBin(s, raw);
  if (!r.ok) return r;
  if (expect.binId && r.entity.id !== expect.binId) return { ok: false, code: "WRONG_BIN" };
  return r;
}

/** Explain how a scanned variant differs from the expected one. */
export function compareVariant(expected: Sku, scanned: Sku): MismatchReason {
  if (expected.modelCode !== scanned.modelCode) return "wrong_model";
  if ((expected.color?.en ?? "") !== (scanned.color?.en ?? "")) return "wrong_color";
  if ((expected.size ?? "") !== (scanned.size ?? "")) return "wrong_size";
  return "wrong_sku";
}
