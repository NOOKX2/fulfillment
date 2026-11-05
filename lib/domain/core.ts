import { localDate } from "../clock";
import type { ErrorCode } from "./errors";
import type {
  AppState,
  Bin,
  ID,
  ISODate,
  ISODateTime,
  LedgerEntry,
  Order,
  Sku,
  StockRow,
  StockStatus,
} from "./types";

export interface Ctx {
  now: ISODateTime;
}

export type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; detail?: string; commit?: boolean };

export function ok(): Result<void>;
export function ok<T>(data: T): Result<T>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ok(data?: unknown): Result<any> {
  return { ok: true, data };
}
export function fail(
  code: ErrorCode,
  detail?: string,
  opts?: { commit?: boolean },
): { ok: false; code: ErrorCode; detail?: string; commit?: boolean } {
  return { ok: false, code, detail, commit: opts?.commit };
}

export const LEDGER_CAP = 1500;
export const SCANLOG_CAP = 500;

export function nextId(s: AppState, prefix: string): ID {
  const n = (s.seq[prefix] ?? 0) + 1;
  s.seq[prefix] = n;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

export function today(ctx: Ctx): ISODate {
  return localDate(ctx.now);
}

export function pushLedger(
  s: AppState,
  ctx: Ctx,
  e: Omit<LedgerEntry, "id" | "at">,
): void {
  s.ledger.push({ id: nextId(s, "led"), at: ctx.now, ...e });
  if (s.ledger.length > LEDGER_CAP) s.ledger.splice(0, s.ledger.length - LEDGER_CAP);
}

/* ---------- lookups ---------- */
export const skuById = (s: AppState, id: ID): Sku | undefined =>
  s.skus.find((k) => k.id === id);
export const binById = (s: AppState, id: ID): Bin | undefined =>
  s.bins.find((b) => b.id === id);
export const orderById = (s: AppState, id: ID): Order | undefined =>
  s.orders.find((o) => o.id === id);

export function skuByBarcode(s: AppState, raw: string): Sku | undefined {
  const code = raw.trim();
  return s.skus.find((k) => k.barcodes.includes(code) || k.code === code);
}

export function binByBarcode(s: AppState, raw: string): Bin | undefined {
  const code = raw.trim().toUpperCase();
  return s.bins.find((b) => b.barcode.toUpperCase() === code);
}

export function firstBinOfZone(
  s: AppState,
  zoneType: Bin["zoneType"],
  preferEmpty = false,
): Bin | undefined {
  const bins = s.bins.filter((b) => b.zoneType === zoneType && b.active);
  if (!preferEmpty) return bins[0];
  return (
    bins.find((b) => !s.stock.some((r) => r.binId === b.id && r.qty > 0)) ?? bins[0]
  );
}

/* ---------- stock ---------- */
export const PICKABLE_ZONES: Bin["zoneType"][] = ["storage", "pickface"];
export const isPickableBin = (b: Bin | undefined): boolean =>
  !!b && b.active && PICKABLE_ZONES.includes(b.zoneType);

export function addStock(
  s: AppState,
  row: {
    skuId: ID;
    lotNo: string;
    expiryDate?: ISODate;
    receivedAt: ISODateTime;
    binId: ID;
    status: StockStatus;
    qty: number;
  },
): StockRow {
  const existing = s.stock.find(
    (r) =>
      r.skuId === row.skuId &&
      r.lotNo === row.lotNo &&
      r.binId === row.binId &&
      r.status === row.status &&
      r.expiryDate === row.expiryDate,
  );
  if (existing) {
    existing.qty += row.qty;
    if (row.receivedAt < existing.receivedAt) existing.receivedAt = row.receivedAt;
    return existing;
  }
  const created: StockRow = {
    id: nextId(s, "stk"),
    skuId: row.skuId,
    lotNo: row.lotNo,
    expiryDate: row.expiryDate,
    receivedAt: row.receivedAt,
    binId: row.binId,
    status: row.status,
    qty: row.qty,
    qtyAllocated: 0,
  };
  s.stock.push(created);
  return created;
}

/** Reduce a row's qty; removes the row when empty. */
export function takeFromRow(s: AppState, row: StockRow, qty: number): void {
  row.qty -= qty;
  if (row.qty <= 0 && row.qtyAllocated <= 0) {
    s.stock.splice(s.stock.indexOf(row), 1);
  }
}

export function findRow(
  s: AppState,
  q: { skuId: ID; lotNo: string; binId: ID; status: StockStatus; expiryDate?: ISODate },
): StockRow | undefined {
  return s.stock.find(
    (r) =>
      r.skuId === q.skuId &&
      r.lotNo === q.lotNo &&
      r.binId === q.binId &&
      r.status === q.status &&
      (q.expiryDate === undefined || r.expiryDate === q.expiryDate),
  );
}

const volume = (d: { l: number; w: number; h: number }) => d.l * d.w * d.h;

export function binLoad(s: AppState, binId: ID): { weightG: number; volumeCm3: number } {
  let weightG = 0;
  let volumeCm3 = 0;
  for (const r of s.stock) {
    if (r.binId !== binId) continue;
    const k = skuById(s, r.skuId);
    if (!k) continue;
    weightG += r.qty * k.weightG;
    volumeCm3 += r.qty * volume(k.dimsCm);
  }
  return { weightG, volumeCm3 };
}

/** Max units of a SKU that can still be put in a bin (0 if it does not fit). */
export function binCapacityFor(s: AppState, bin: Bin, sku: Sku): number {
  const a = [sku.dimsCm.l, sku.dimsCm.w, sku.dimsCm.h].sort((x, y) => y - x);
  const b = [bin.maxDimsCm.l, bin.maxDimsCm.w, bin.maxDimsCm.h].sort((x, y) => y - x);
  if (a[0] > b[0] || a[1] > b[1] || a[2] > b[2]) return 0;
  const load = binLoad(s, bin.id);
  const byWeight = Math.floor((bin.maxWeightG - load.weightG) / sku.weightG);
  const byVolume = Math.floor((bin.maxVolumeCm3 - load.volumeCm3) / volume(sku.dimsCm));
  return Math.max(0, Math.min(byWeight, byVolume));
}

/** A lot is excluded from sale/allocation when it is too close to expiry. */
export function lotEligible(sku: Sku, expiryDate: ISODate | undefined, todayDate: ISODate): boolean {
  if (!sku.tracksExpiry || !expiryDate) return true;
  const minDays = sku.minShelfLifeDays ?? 0;
  const limit = new Date(Date.parse(`${todayDate}T00:00:00Z`) + minDays * 86400000)
    .toISOString()
    .slice(0, 10);
  return expiryDate >= limit;
}

export function sellableRows(s: AppState, skuId: ID, todayDate: ISODate): StockRow[] {
  const sku = skuById(s, skuId);
  if (!sku) return [];
  return s.stock.filter(
    (r) =>
      r.skuId === skuId &&
      r.status === "sellable" &&
      isPickableBin(binById(s, r.binId)) &&
      lotEligible(sku, r.expiryDate, todayDate),
  );
}

/** Available-to-promise: sellable pickable stock minus allocations minus active reservations. */
export function atp(s: AppState, skuId: ID, todayDate: ISODate): number {
  const rows = sellableRows(s, skuId, todayDate);
  const free = rows.reduce((n, r) => n + (r.qty - r.qtyAllocated), 0);
  const reserved = s.reservations
    .filter((x) => x.skuId === skuId && x.status === "active")
    .reduce((n, x) => n + x.qty, 0);
  return free - reserved;
}

export interface StockSummary {
  onHand: number;
  sellable: number;
  reserved: number;
  allocated: number;
  atp: number;
  pendingQc: number;
  hold: number;
  quarantine: number;
}

export function stockSummary(s: AppState, skuId: ID, todayDate: ISODate): StockSummary {
  let onHand = 0;
  let sellable = 0;
  let allocated = 0;
  let pendingQc = 0;
  let hold = 0;
  let quarantine = 0;
  for (const r of s.stock) {
    if (r.skuId !== skuId) continue;
    onHand += r.qty;
    allocated += r.qtyAllocated;
    if (r.status === "sellable") sellable += r.qty;
    else if (r.status === "pending_qc") pendingQc += r.qty;
    else if (r.status === "hold") hold += r.qty;
    else if (r.status === "quarantine") quarantine += r.qty;
  }
  const reserved = s.reservations
    .filter((x) => x.skuId === skuId && x.status === "active")
    .reduce((n, x) => n + x.qty, 0);
  return {
    onHand,
    sellable,
    reserved,
    allocated,
    atp: atp(s, skuId, todayDate),
    pendingQc,
    hold,
    quarantine,
  };
}

/** FEFO when the SKU tracks expiry, otherwise FIFO. Ties broken by lowest pickSeq. */
export function allocationOrder(s: AppState, sku: Sku, rows: StockRow[]): StockRow[] {
  const seq = (r: StockRow) => binById(s, r.binId)?.pickSeq ?? 0;
  return [...rows].sort((a, b) => {
    if (sku.tracksExpiry) {
      const ea = a.expiryDate ?? "9999-12-31";
      const eb = b.expiryDate ?? "9999-12-31";
      if (ea !== eb) return ea < eb ? -1 : 1;
    }
    if (a.receivedAt !== b.receivedAt) return a.receivedAt < b.receivedAt ? -1 : 1;
    if (a.lotNo !== b.lotNo) return a.lotNo < b.lotNo ? -1 : 1;
    return seq(a) - seq(b);
  });
}

/** Debug invariants - used by tests and (in development) after every action. */
export function assertInvariants(s: AppState): string[] {
  const errs: string[] = [];
  for (const r of s.stock) {
    if (r.qty < 0) errs.push(`stock ${r.id} negative qty`);
    if (r.qtyAllocated < 0) errs.push(`stock ${r.id} negative allocated`);
    if (r.qtyAllocated > r.qty) errs.push(`stock ${r.id} allocated ${r.qtyAllocated} > qty ${r.qty}`);
  }
  return errs;
}
