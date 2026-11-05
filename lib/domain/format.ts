import { ERROR_MESSAGES, type ErrorCode } from "./errors";
import type { AppState, Lang, MismatchReason, Sku } from "./types";

export function skuVariant(k: Sku, lang: Lang): string {
  return [k.color?.[lang], k.size].filter(Boolean).join(" / ");
}

export function skuLabel(k: Sku | undefined, lang: Lang): string {
  if (!k) return "?";
  const v = skuVariant(k, lang);
  return v ? `${k.name[lang]} (${v})` : k.name[lang];
}

export const MISMATCH_LABELS: Record<MismatchReason, { th: string; en: string }> = {
  unknown_barcode: { th: "ไม่รู้จักบาร์โค้ด", en: "Unknown barcode" },
  wrong_model: { th: "ผิดรุ่น", en: "Wrong model" },
  wrong_color: { th: "ผิดสี", en: "Wrong color" },
  wrong_size: { th: "ผิดไซส์", en: "Wrong size" },
  wrong_sku: { th: "ผิดสินค้า", en: "Wrong item" },
  over_qty: { th: "สแกนเกินจำนวน", en: "Scanned more than ordered" },
  not_in_order: { th: "ไม่อยู่ในออเดอร์นี้", en: "Not in this order" },
};

export interface MismatchDetail {
  reason: MismatchReason;
  expectedSkuId?: string;
  scannedSkuId?: string;
}

export function mismatchText(s: AppState, d: MismatchDetail, lang: Lang): string {
  const label = MISMATCH_LABELS[d.reason][lang];
  const exp = s.skus.find((k) => k.id === d.expectedSkuId);
  const got = s.skus.find((k) => k.id === d.scannedSkuId);
  if (exp && got) {
    return lang === "th"
      ? `${label} (คาดว่า ${skuVariant(exp, lang) || exp.name.th} สแกนได้ ${skuVariant(got, lang) || got.name.th})`
      : `${label} (expected ${skuVariant(exp, lang) || exp.name.en}, scanned ${skuVariant(got, lang) || got.name.en})`;
  }
  return label;
}

export function errorText(
  s: AppState,
  code: ErrorCode,
  detail: string | undefined,
  lang: Lang,
): string {
  if (code === "PACK_MISMATCH" && detail) {
    try {
      return mismatchText(s, JSON.parse(detail) as MismatchDetail, lang);
    } catch {
      /* fall through */
    }
  }
  const base = ERROR_MESSAGES[code][lang];
  if (detail && !detail.startsWith("{") && detail.length < 80) return `${base} (${detail})`;
  return base;
}
