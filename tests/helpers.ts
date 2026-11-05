import { atp, type Result } from "@/lib/domain/core";
import type { AppState } from "@/lib/domain/types";
import { buildSeed } from "@/lib/store/seed";

export const NOW = "2026-11-04T03:00:00.000Z"; // 10:00 Thailand time
export const ctx = (now = NOW) => ({ now });

export function fresh(): AppState {
  return buildSeed(NOW, "th");
}

export function must<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${r.code} ${r.detail ?? ""}`);
  return r.data;
}

export const skuByCode = (s: AppState, code: string) => {
  const k = s.skus.find((x) => x.code === code);
  if (!k) throw new Error(`no sku ${code}`);
  return k;
};

export const todayOf = (now = NOW) => new Date(Date.parse(now) + 7 * 3600000).toISOString().slice(0, 10);
export const atpOf = (s: AppState, code: string) => atp(s, skuByCode(s, code).id, todayOf());
