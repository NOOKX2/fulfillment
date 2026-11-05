import type { CarrierCode, Channel } from "./types";

export interface OrderPayload {
  channel: Channel;
  buyerName: string;
  address: string;
  phone: string;
  lines: { skuCode: string; qty: number; unitPrice: number }[];
  paid: boolean;
  cod?: boolean;
  carrier: CarrierCode;
  shipByHours: number;
}

const A = {
  bkk: "99/1 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
  cnx: "45 ถ.นิมมานเหมินท์ ต.สุเทพ อ.เมือง เชียงใหม่ 50200",
  kkc: "12 ถ.มิตรภาพ ต.ในเมือง อ.เมือง ขอนแก่น 40000",
  hkt: "7 ถ.ภูเก็ต ต.ตลาดใหญ่ อ.เมือง ภูเก็ต 83000",
  nma: "88 ถ.มิตรภาพ ต.ในเมือง อ.เมือง นครราชสีมา 30000",
  cbi: "21 ถ.สุขุมวิท ต.เสม็ด อ.เมือง ชลบุรี 20000",
};

/** Fixed pool of simulated marketplace payloads, cycled by `simCursor`. */
export const ORDER_POOL: OrderPayload[] = [
  { channel: "shopee", buyerName: "สมชาย ใจดี", address: A.bkk, phone: "0812345678", lines: [{ skuCode: "TEE-001-BLK-M", qty: 1, unitPrice: 390 }], paid: true, carrier: "flash", shipByHours: 24 },
  { channel: "lazada", buyerName: "Naree P.", address: A.cnx, phone: "0823456789", lines: [{ skuCode: "CAP-001-BLK", qty: 1, unitPrice: 290 }], paid: true, carrier: "jt", shipByHours: 24 },
  { channel: "tiktok", buyerName: "ปริญญา ศรีสุข", address: A.kkc, phone: "0834567890", lines: [{ skuCode: "SOC-001-WHT", qty: 2, unitPrice: 149 }], paid: true, carrier: "spx", shipByHours: 24 },
  { channel: "website", buyerName: "Kittipong R.", address: A.bkk, phone: "0845678901", lines: [{ skuCode: "HOO-001-BLK-L", qty: 1, unitPrice: 1190 }], paid: false, cod: true, carrier: "thaipost", shipByHours: 48 },
  { channel: "shopee", buyerName: "วิภา แก้วมณี", address: A.hkt, phone: "0856789012", lines: [{ skuCode: "TEE-001-WHT-S", qty: 1, unitPrice: 390 }, { skuCode: "SOC-001-BLK", qty: 1, unitPrice: 149 }], paid: true, carrier: "flash", shipByHours: 24 },
  { channel: "lazada", buyerName: "Anan T.", address: A.nma, phone: "0867890123", lines: [{ skuCode: "MUG-001-WHT", qty: 2, unitPrice: 220 }], paid: false, carrier: "jt", shipByHours: 48 },
  { channel: "tiktok", buyerName: "มาลี ทองดี", address: A.cbi, phone: "0878901234", lines: [{ skuCode: "SRM-001", qty: 1, unitPrice: 890 }], paid: true, carrier: "spx", shipByHours: 24 },
  { channel: "shopee", buyerName: "Chaiwat S.", address: A.bkk, phone: "0889012345", lines: [{ skuCode: "SHO-001-WHT-42", qty: 1, unitPrice: 1890 }], paid: true, carrier: "flash", shipByHours: 24 },
  { channel: "website", buyerName: "สุดา วงศ์ไทย", address: A.cnx, phone: "0890123456", lines: [{ skuCode: "BTL-001-SLV", qty: 1, unitPrice: 450 }, { skuCode: "BAR-001", qty: 3, unitPrice: 120 }], paid: true, carrier: "thaipost", shipByHours: 48 },
  { channel: "shopee", buyerName: "Pimchanok L.", address: A.kkc, phone: "0801234567", lines: [{ skuCode: "TEE-001-BLK-L", qty: 1, unitPrice: 390 }], paid: true, carrier: "flash", shipByHours: 24 },
  { channel: "lazada", buyerName: "ธนากร มั่นคง", address: A.hkt, phone: "0812223334", lines: [{ skuCode: "PWR-001", qty: 1, unitPrice: 690 }], paid: true, carrier: "jt", shipByHours: 24 },
  { channel: "tiktok", buyerName: "Jirapat K.", address: A.bkk, phone: "0823334445", lines: [{ skuCode: "SUN-001", qty: 2, unitPrice: 420 }, { skuCode: "SRM-001", qty: 1, unitPrice: 890 }], paid: true, carrier: "spx", shipByHours: 24 },
  { channel: "shopee", buyerName: "อรทัย บุญเรือง", address: A.nma, phone: "0834445556", lines: [{ skuCode: "HOO-001-GRY-M", qty: 1, unitPrice: 1190 }], paid: false, carrier: "flash", shipByHours: 48 },
  { channel: "website", buyerName: "Natthapong W.", address: A.cbi, phone: "0845556667", lines: [{ skuCode: "CAP-001-NVY", qty: 1, unitPrice: 290 }], paid: true, carrier: "thaipost", shipByHours: 48 },
  // scarce SKU: only 1 unit of SHO-001-BLK-40 in stock -> second paid order waits for stock
  { channel: "shopee", buyerName: "Wipada M.", address: A.bkk, phone: "0856667778", lines: [{ skuCode: "SHO-001-BLK-40", qty: 1, unitPrice: 1890 }], paid: true, carrier: "flash", shipByHours: 24 },
  { channel: "tiktok", buyerName: "ศุภชัย ดีงาม", address: A.cnx, phone: "0867778889", lines: [{ skuCode: "SHO-001-BLK-40", qty: 1, unitPrice: 1890 }], paid: true, carrier: "spx", shipByHours: 24 },
  { channel: "lazada", buyerName: "Kanya S.", address: A.kkc, phone: "0878889990", lines: [{ skuCode: "TEE-001-WHT-M", qty: 2, unitPrice: 390 }], paid: true, carrier: "jt", shipByHours: 24 },
  { channel: "shopee", buyerName: "ณัฐวุฒิ ใจเย็น", address: A.hkt, phone: "0889990001", lines: [{ skuCode: "BAG-001", qty: 1, unitPrice: 250 }, { skuCode: "SOC-001-WHT", qty: 1, unitPrice: 149 }], paid: true, carrier: "flash", shipByHours: 24 },
  { channel: "website", buyerName: "Siriporn A.", address: A.bkk, phone: "0890001112", lines: [{ skuCode: "SRM-001", qty: 2, unitPrice: 890 }], paid: true, carrier: "thaipost", shipByHours: 48 },
];
