import type { CarrierCode, CarrierConfig } from "./types";

export const DEFAULT_CARRIERS: CarrierConfig[] = [
  { code: "flash", name: { th: "Flash Express", en: "Flash Express" }, cutoffLocal: "15:00", trackingPrefix: "TH", nextSeq: 1000 },
  { code: "jt", name: { th: "J&T Express", en: "J&T Express" }, cutoffLocal: "16:00", trackingPrefix: "JT", nextSeq: 2000 },
  { code: "spx", name: { th: "SPX Express", en: "SPX Express" }, cutoffLocal: "17:00", trackingPrefix: "SPXTH", nextSeq: 3000 },
  { code: "thaipost", name: { th: "ไปรษณีย์ไทย", en: "Thailand Post" }, cutoffLocal: "14:00", trackingPrefix: "EP", nextSeq: 4000 },
];

export const TRACKING_PATTERN: Record<CarrierCode, RegExp> = {
  flash: /^TH\d{9}$/,
  jt: /^JT\d{9}$/,
  spx: /^SPXTH\d{9}$/,
  thaipost: /^EP\d{9}TH$/,
};

export function formatTracking(cfg: CarrierConfig, seq: number): string {
  const n = String(seq).padStart(9, "0");
  return cfg.code === "thaipost" ? `${cfg.trackingPrefix}${n}TH` : `${cfg.trackingPrefix}${n}`;
}

export function validTracking(code: CarrierCode, tracking: string): boolean {
  return TRACKING_PATTERN[code].test(tracking);
}

export function laneId(cfg: CarrierConfig): string {
  return `${cfg.code.toUpperCase()}-${cfg.cutoffLocal}`;
}
