// Clock access is isolated here. Only call from store actions, event handlers
// and effects - never during render (cacheComponents prerender rejects it).

export function nowISO(): string {
  return new Date().toISOString();
}

/** Warehouse local timezone offset (Asia/Bangkok, UTC+7). */
export const WH_TZ_OFFSET_MIN = 420;

/** "HH:MM" in warehouse local time for an ISO timestamp. */
export function localHM(iso: string): string {
  const d = new Date(new Date(iso).getTime() + WH_TZ_OFFSET_MIN * 60000);
  return d.toISOString().slice(11, 16);
}

/** yyyy-mm-dd in warehouse local time. */
export function localDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + WH_TZ_OFFSET_MIN * 60000);
  return d.toISOString().slice(0, 10);
}

/** ISO timestamp for a local "HH:MM" on the warehouse-local date of `iso`. */
export function localTimeToISO(iso: string, hm: string): string {
  const date = localDate(iso);
  const [h, m] = hm.split(":").map(Number);
  const utc = Date.parse(`${date}T00:00:00.000Z`) + (h * 60 + m - WH_TZ_OFFSET_MIN) * 60000;
  return new Date(utc).toISOString();
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

export function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3600000).toISOString();
}
