import { addDays, localDate } from "../clock";
import { DEFAULT_CARRIERS } from "../domain/carriers";
import { addStock, binCapacityFor, nextId, pushLedger, type Ctx } from "../domain/core";
import { createOrder } from "../domain/orders";
import { ORDER_POOL } from "../domain/orderPool";
import { assignPickSeq } from "../domain/routing";
import type {
  AppState,
  Bin,
  Dims,
  Ergonomics,
  ID,
  LocationNode,
  Sku,
  Supplier,
  ZoneType,
} from "../domain/types";
import { emptyState } from "./empty";

/* ----------------------------- locations ----------------------------- */

interface ZoneSpec {
  zone: string;
  zoneType: ZoneType;
  aisles: string[];
  racks: string[];
  shelves: string[];
  bins: string[];
  maxWeightG: number;
  maxVolumeCm3: number;
  maxDimsCm: Dims;
  ergo: (shelf: string) => Ergonomics;
}

const big = { maxWeightG: 500000, maxVolumeCm3: 3000000, maxDimsCm: { l: 120, w: 100, h: 100 } };
const one = ["01"];

const ZONES: ZoneSpec[] = [
  { zone: "R", zoneType: "receiving", aisles: one, racks: one, shelves: ["1"], bins: ["01", "02", "03", "04"], ...big, ergo: () => "floor" },
  { zone: "Q", zoneType: "quarantine", aisles: one, racks: one, shelves: ["1"], bins: ["01", "02", "03", "04"], ...big, ergo: () => "floor" },
  {
    zone: "A", zoneType: "pickface", aisles: ["01", "02"], racks: ["01", "02"], shelves: ["1", "2", "3"], bins: ["01", "02"],
    maxWeightG: 12000, maxVolumeCm3: 100000, maxDimsCm: { l: 60, w: 40, h: 40 },
    ergo: (sh) => (sh === "2" ? "golden" : sh === "3" ? "high" : "normal"),
  },
  {
    zone: "B", zoneType: "storage", aisles: ["01", "02"], racks: ["01", "02"], shelves: ["1", "2"], bins: ["01", "02", "03"],
    maxWeightG: 30000, maxVolumeCm3: 250000, maxDimsCm: { l: 80, w: 60, h: 60 },
    ergo: (sh) => (sh === "1" ? "floor" : "normal"),
  },
  { zone: "P", zoneType: "pack", aisles: one, racks: one, shelves: ["1"], bins: ["01", "02"], ...big, ergo: () => "normal" },
  { zone: "S", zoneType: "staging", aisles: one, racks: one, shelves: ["1"], bins: ["01", "02", "03", "04"], ...big, ergo: () => "floor" },
  { zone: "T", zoneType: "returns", aisles: one, racks: one, shelves: ["1"], bins: ["01", "02", "03"], ...big, ergo: () => "floor" },
  { zone: "X", zoneType: "repack", aisles: one, racks: one, shelves: ["1"], bins: ["01", "02"], ...big, ergo: () => "normal" },
  { zone: "D", zoneType: "destroy", aisles: one, racks: one, shelves: ["1"], bins: ["01"], ...big, ergo: () => "floor" },
  { zone: "V", zoneType: "rtv", aisles: one, racks: one, shelves: ["1"], bins: ["01"], ...big, ergo: () => "floor" },
];

function buildLocations(s: AppState): void {
  const nodes = new Map<string, LocationNode>();
  const node = (kind: LocationNode["kind"], key: string, code: string, parentKey: string | null) => {
    let n = nodes.get(key);
    if (!n) {
      n = { id: `node:${key}`, kind, parentId: parentKey ? `node:${parentKey}` : null, code };
      nodes.set(key, n);
    }
    return n;
  };
  for (const z of ZONES) {
    for (const aisle of z.aisles)
      for (const rack of z.racks)
        for (const shelf of z.shelves)
          for (const bin of z.bins) {
            const zk = z.zone;
            const ak = `${zk}-${aisle}`;
            const rk = `${ak}-${rack}`;
            const sk = `${rk}-${shelf}`;
            const bk = `${sk}-${bin}`;
            node("zone", zk, zk, null);
            node("aisle", ak, aisle, zk);
            node("rack", rk, rack, ak);
            node("shelf", sk, shelf, rk);
            const bn = node("bin", bk, bin, sk);
            const b: Bin = {
              id: `bin:${bk}`,
              nodeId: bn.id,
              barcode: `LOC:${bk}`,
              zone: z.zone,
              aisle,
              rack,
              shelf,
              bin,
              path: bk,
              zoneType: z.zoneType,
              maxWeightG: z.maxWeightG,
              maxVolumeCm3: z.maxVolumeCm3,
              maxDimsCm: z.maxDimsCm,
              ergonomics: z.ergo(shelf),
              pickSeq: 0,
              active: true,
            };
            s.bins.push(b);
          }
  }
  s.nodes = [...nodes.values()];
  assignPickSeq(s.bins, ZONES.map((z) => z.zone));
}

/* -------------------------------- SKUs -------------------------------- */

interface ModelSpec {
  model: string;
  nameTh: string;
  nameEn: string;
  variants: { key?: string; color?: [string, string]; size?: string }[];
  dims: Dims;
  weightG: number;
  sizeClass: Sku["sizeClass"];
  packClass: Sku["packClass"];
  velocity: Sku["velocity"];
  supplier: ID;
  expiry?: number; // min shelf life days when the SKU tracks lot + expiry
}

const BLK: [string, string] = ["ดำ", "Black"];
const WHT: [string, string] = ["ขาว", "White"];

const MODELS: ModelSpec[] = [
  { model: "TEE-001", nameTh: "เสื้อยืดคอกลม", nameEn: "Basic Crew T-Shirt", variants: ["S", "M", "L"].flatMap((size) => [{ key: "BLK", color: BLK, size }, { key: "WHT", color: WHT, size }]), dims: { l: 25, w: 20, h: 3 }, weightG: 220, sizeClass: "S", packClass: "envelope", velocity: "A", supplier: "sup-1" },
  { model: "HOO-001", nameTh: "ฮู้ดดี้ผ้าสำลี", nameEn: "Fleece Hoodie", variants: ["M", "L"].flatMap((size) => [{ key: "BLK", color: BLK, size }, { key: "GRY", color: ["เทา", "Gray"] as [string, string], size }]), dims: { l: 35, w: 28, h: 8 }, weightG: 650, sizeClass: "M", packClass: "box", velocity: "B", supplier: "sup-1" },
  { model: "CAP-001", nameTh: "หมวกแก๊ป", nameEn: "Baseball Cap", variants: [{ key: "BLK", color: BLK }, { key: "NVY", color: ["กรมท่า", "Navy"] as [string, string] }], dims: { l: 25, w: 20, h: 12 }, weightG: 120, sizeClass: "S", packClass: "envelope", velocity: "A", supplier: "sup-2" },
  { model: "SOC-001", nameTh: "ถุงเท้า 3 คู่", nameEn: "Socks 3-pack", variants: [{ key: "WHT", color: WHT }, { key: "BLK", color: BLK }], dims: { l: 20, w: 12, h: 4 }, weightG: 90, sizeClass: "S", packClass: "envelope", velocity: "A", supplier: "sup-1" },
  { model: "MUG-001", nameTh: "แก้วเซรามิก", nameEn: "Ceramic Mug", variants: [{ key: "WHT", color: WHT }, { key: "BLK", color: BLK }], dims: { l: 12, w: 12, h: 11 }, weightG: 380, sizeClass: "M", packClass: "box", velocity: "C", supplier: "sup-3" },
  { model: "BTL-001", nameTh: "กระบอกน้ำสแตนเลส", nameEn: "Steel Bottle", variants: [{ key: "SLV", color: ["เงิน", "Silver"] as [string, string] }, { key: "BLK", color: BLK }], dims: { l: 28, w: 8, h: 8 }, weightG: 420, sizeClass: "M", packClass: "box", velocity: "B", supplier: "sup-3" },
  { model: "SHO-001", nameTh: "รองเท้าผ้าใบ", nameEn: "Canvas Sneaker", variants: ["40", "42"].flatMap((size) => [{ key: "WHT", color: WHT, size }, { key: "BLK", color: BLK, size }]), dims: { l: 33, w: 22, h: 13 }, weightG: 850, sizeClass: "L", packClass: "box", velocity: "B", supplier: "sup-2" },
  { model: "SRM-001", nameTh: "เซรั่มบำรุงผิว 30 มล.", nameEn: "Face Serum 30 ml", variants: [{}], dims: { l: 12, w: 5, h: 5 }, weightG: 110, sizeClass: "S", packClass: "envelope", velocity: "A", supplier: "sup-4", expiry: 90 },
  { model: "SUN-001", nameTh: "กันแดด SPF50", nameEn: "Sunscreen SPF50", variants: [{}], dims: { l: 15, w: 5, h: 4 }, weightG: 90, sizeClass: "S", packClass: "envelope", velocity: "B", supplier: "sup-4", expiry: 90 },
  { model: "BAR-001", nameTh: "โปรตีนบาร์ (กล่อง 12)", nameEn: "Protein Bar (box of 12)", variants: [{}], dims: { l: 25, w: 15, h: 8 }, weightG: 800, sizeClass: "M", packClass: "box", velocity: "A", supplier: "sup-4", expiry: 60 },
  { model: "BAG-001", nameTh: "กระเป๋าผ้า", nameEn: "Canvas Tote Bag", variants: [{}], dims: { l: 30, w: 25, h: 4 }, weightG: 180, sizeClass: "S", packClass: "envelope", velocity: "C", supplier: "sup-2" },
  { model: "PWR-001", nameTh: "พาวเวอร์แบงค์ 10000 mAh", nameEn: "Power Bank 10000 mAh", variants: [{}], dims: { l: 15, w: 8, h: 3 }, weightG: 240, sizeClass: "M", packClass: "box", velocity: "B", supplier: "sup-3" },
];

function buildSkus(s: AppState): void {
  let i = 0;
  for (const m of MODELS) {
    for (const v of m.variants) {
      i += 1;
      const code = [m.model, v.key, v.size].filter(Boolean).join("-");
      s.skus.push({
        id: `sku-${String(i).padStart(3, "0")}`,
        code,
        modelCode: m.model,
        name: { th: m.nameTh, en: m.nameEn },
        color: v.color ? { th: v.color[0], en: v.color[1] } : undefined,
        size: v.size,
        barcodes: [`88500010${String(i).padStart(5, "0")}`],
        dimsCm: m.dims,
        weightG: m.weightG,
        sizeClass: m.sizeClass,
        packClass: m.packClass,
        velocity: m.velocity,
        tracksLot: !!m.expiry,
        tracksExpiry: !!m.expiry,
        minShelfLifeDays: m.expiry,
        supplierId: m.supplier,
      });
    }
  }
}

const SUPPLIERS: Supplier[] = [
  { id: "sup-1", name: { th: "บจก. สยามการ์เมนต์", en: "Siam Garment Co." }, rtvContact: "claims@siamgarment.example" },
  { id: "sup-2", name: { th: "หจก. ไทยฟุตแวร์", en: "Thai Footwear Ltd." }, rtvContact: "rtv@thaifootwear.example" },
  { id: "sup-3", name: { th: "บจก. โฮมแวร์ เอเชีย", en: "Homeware Asia" }, rtvContact: "rtv@homeware.example" },
  { id: "sup-4", name: { th: "บจก. บิวตี้เฮลท์ ซัพพลาย", en: "Beauty & Health Supply" }, rtvContact: "claims@bhs.example" },
];

/* ------------------------------- stock ------------------------------- */

function seedStock(s: AppState, ctx: Ctx, date: string): void {
  const at = (daysAgo: number) => `${addDays(date, -daysAgo)}T03:00:00.000Z`;
  const bins = (pred: (b: Bin) => boolean) => s.bins.filter((b) => b.active && pred(b));
  const pools = {
    A: bins((b) => b.zone === "A" && b.ergonomics === "golden"),
    B: [
      ...bins((b) => b.zone === "A" && b.ergonomics === "normal"),
      ...bins((b) => b.zone === "B" && b.ergonomics === "normal"),
    ],
    C: bins((b) => b.zone === "B" && b.ergonomics === "floor"),
  };
  const cursor = { A: 0, B: 0, C: 0 };
  const allStorable = bins((b) => b.zone === "A" || b.zone === "B");
  /**
   * Pick a bin that really has room (used never exceeds capacity). Prefer the velocity pool,
   * then any storable bin; if nothing fits the full quantity, use the roomiest bin and
   * shrink the quantity to what fits. Returns undefined when the SKU fits nowhere.
   */
  const place = (v: "A" | "B" | "C", sku: Sku, qty: number): { bin: Bin; qty: number } | undefined => {
    const pool = pools[v];
    for (let tries = 0; tries < pool.length; tries++) {
      const b = pool[cursor[v] % pool.length];
      cursor[v] += 1;
      if (binCapacityFor(s, b, sku) >= qty) return { bin: b, qty };
    }
    const anyFit = allStorable.find((b) => binCapacityFor(s, b, sku) >= qty);
    if (anyFit) return { bin: anyFit, qty };
    let best: Bin | undefined;
    let bestCap = 0;
    for (const b of allStorable) {
      const c = binCapacityFor(s, b, sku);
      if (c > bestCap) {
        best = b;
        bestCap = c;
      }
    }
    return best ? { bin: best, qty: bestCap } : undefined;
  };
  const override: Record<string, number> = {
    "SHO-001-BLK-40": 1,
    "SHO-001-BLK-42": 3,
    "MUG-001-BLK": 4,
  };

  s.skus.forEach((sku, idx) => {
    if (sku.tracksExpiry) {
      const lots =
        sku.modelCode === "BAR-001"
          ? [
              { lot: "BR-2606A", exp: addDays(date, 30), qty: 10, ago: 120 }, // too close to expiry (<60d)
              { lot: "BR-2611B", exp: addDays(date, 150), qty: 36, ago: 60 },
              { lot: "BR-2704C", exp: addDays(date, 300), qty: 36, ago: 20 },
            ]
          : [
              { lot: `${sku.modelCode.slice(0, 2)}-2606A`, exp: addDays(date, 45), qty: 12, ago: 150 }, // too close (<90d)
              { lot: `${sku.modelCode.slice(0, 2)}-2701B`, exp: addDays(date, 200), qty: 30, ago: 70 },
              { lot: `${sku.modelCode.slice(0, 2)}-2705C`, exp: addDays(date, 400), qty: 25, ago: 15 },
            ];
      for (const l of lots) {
        const spot = place(sku.velocity, sku, l.qty);
        if (!spot) continue;
        addStock(s, { skuId: sku.id, lotNo: l.lot, expiryDate: l.exp, receivedAt: at(l.ago), binId: spot.bin.id, status: "sellable", qty: spot.qty });
      }
      return;
    }
    const base = sku.velocity === "A" ? 40 : sku.velocity === "B" ? 18 : 10;
    const spread = sku.velocity === "A" ? 40 : sku.velocity === "B" ? 22 : 15;
    const spot = place(sku.velocity, sku, override[sku.code] ?? base + ((idx * 7) % spread));
    if (!spot) return;
    const b = spot.bin;
    const qty = spot.qty;
    // Older FIFO lot first, then a newer lot, in the same bin.
    const half = Math.floor(qty / 2);
    if (qty >= 4 && !(sku.code in override)) {
      addStock(s, { skuId: sku.id, lotNo: "LOT-2609", receivedAt: at(45), binId: b.id, status: "sellable", qty: half });
      addStock(s, { skuId: sku.id, lotNo: "LOT-2610", receivedAt: at(12), binId: b.id, status: "sellable", qty: qty - half });
    } else {
      addStock(s, { skuId: sku.id, lotNo: "LOT-2610", receivedAt: at(12), binId: b.id, status: "sellable", qty });
    }
  });

  // Held / quarantined stock from earlier inspections.
  const qBins = bins((b) => b.zoneType === "quarantine");
  const tee = s.skus.find((k) => k.code === "TEE-001-WHT-M")!;
  const mug = s.skus.find((k) => k.code === "MUG-001-WHT")!;
  addStock(s, { skuId: tee.id, lotNo: "LOT-2608", receivedAt: at(30), binId: qBins[0].id, status: "quarantine", qty: 6 });
  addStock(s, { skuId: mug.id, lotNo: "LOT-2610", receivedAt: at(9), binId: qBins[1].id, status: "hold", qty: 4 });

  for (const r of s.stock.filter((x) => x.status === "sellable")) {
    pushLedger(s, ctx, { type: "putaway", skuId: r.skuId, lotNo: r.lotNo, toBinId: r.binId, qty: r.qty, note: "seed" });
  }
}

/* -------------------------------- ASNs -------------------------------- */

function seedInbound(s: AppState, ctx: Ctx, date: string): void {
  const sku = (code: string) => s.skus.find((k) => k.code === code)!.id;
  const defs: {
    asnNo: string;
    supplier: ID;
    day: number;
    dock: string;
    lines: { code: string; qty: number; lot?: string; exp?: number }[];
  }[] = [
    { asnNo: "ASN-2611-001", supplier: "sup-1", day: 0, dock: "D1", lines: [{ code: "TEE-001-BLK-S", qty: 40 }, { code: "TEE-001-BLK-M", qty: 60 }, { code: "TEE-001-WHT-L", qty: 50 }] },
    { asnNo: "ASN-2611-002", supplier: "sup-2", day: 0, dock: "D2", lines: [{ code: "CAP-001-BLK", qty: 60 }, { code: "SHO-001-WHT-40", qty: 24 }, { code: "SHO-001-BLK-40", qty: 12 }] },
    { asnNo: "ASN-2611-003", supplier: "sup-4", day: 0, dock: "D1", lines: [{ code: "SRM-001", qty: 48, lot: "SR-2712A", exp: 420 }, { code: "SUN-001", qty: 36, lot: "SU-2712B", exp: 400 }] },
    { asnNo: "ASN-2611-004", supplier: "sup-3", day: 0, dock: "D3", lines: [{ code: "MUG-001-WHT", qty: 30 }, { code: "BTL-001-SLV", qty: 24 }, { code: "PWR-001", qty: 20 }] },
    { asnNo: "ASN-2611-005", supplier: "sup-1", day: 1, dock: "D2", lines: [{ code: "HOO-001-BLK-M", qty: 20 }, { code: "HOO-001-GRY-L", qty: 20 }, { code: "SOC-001-WHT", qty: 100 }] },
    { asnNo: "ASN-2611-006", supplier: "sup-4", day: 1, dock: "D3", lines: [{ code: "BAR-001", qty: 60, lot: "BR-2808A", exp: 300 }] },
  ];
  for (const d of defs) {
    const poId = nextId(s, "po");
    s.pos.push({
      id: poId,
      poNo: `PO-${d.asnNo.slice(-3)}-${date.slice(2, 4)}`,
      supplierId: d.supplier,
      lines: d.lines.map((l) => ({ skuId: sku(l.code), qty: l.qty })),
    });
    const asnId = nextId(s, "asn");
    s.asns.push({
      id: asnId,
      asnNo: d.asnNo,
      poId,
      supplierId: d.supplier,
      expectedAt: addDays(date, d.day),
      dockDoor: d.dock,
      status: "expected",
      createdAt: ctx.now,
      lines: d.lines.map((l, i) => ({
        id: `${asnId}-L${i + 1}`,
        skuId: sku(l.code),
        expectedQty: l.qty,
        receivedQty: 0,
        lotNo: l.lot,
        expiryDate: l.exp ? addDays(date, l.exp) : undefined,
      })),
    });
  }
}

/* ------------------------------- public ------------------------------- */

/** Build the complete demo dataset. `now` comes from an effect/handler, never render. */
export function buildSeed(now: string, lang: AppState["settings"]["lang"] = "th"): AppState {
  const s = emptyState();
  const ctx: Ctx = { now };
  const date = localDate(now);
  s.seeded = true;
  s.settings.lang = lang;
  s.settings.carriers = structuredClone(DEFAULT_CARRIERS);
  s.suppliers = structuredClone(SUPPLIERS);
  buildLocations(s);
  buildSkus(s);
  seedStock(s, ctx, date);
  seedInbound(s, ctx, date);
  for (let i = 0; i < 14; i++) createOrder(s, ctx, ORDER_POOL[i]);
  s.simCursor = 14;
  return s;
}
