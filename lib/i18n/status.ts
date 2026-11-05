import type { L10n } from "../domain/types";

/** Flat label map for every status/enum value used by the status machines. */
export const STATUS_LABELS: Record<string, L10n> = {
  // asn
  expected: { th: "รอรับ", en: "Expected" },
  receiving: { th: "กำลังรับ", en: "Receiving" },
  received: { th: "รับแล้ว", en: "Received" },
  closed: { th: "ปิดแล้ว", en: "Closed" },
  closed_with_discrepancy: { th: "ปิด (มีส่วนต่าง)", en: "Closed (discrepancy)" },
  // stock
  pending_qc: { th: "รอ QC", en: "Pending QC" },
  sellable: { th: "ขายได้", en: "Sellable" },
  hold: { th: "พัก (Hold)", en: "Hold" },
  quarantine: { th: "กักกัน", en: "Quarantine" },
  return_pending: { th: "รอตรวจคืน", en: "Return pending" },
  repack: { th: "รอแพ็กใหม่", en: "Repack" },
  rtv: { th: "ส่งคืนซัพพลายเออร์", en: "RTV" },
  destroy: { th: "รอทำลาย", en: "Destroy" },
  // putaway / generic
  suggested: { th: "รอจัดเก็บ", en: "Suggested" },
  in_progress: { th: "กำลังทำ", en: "In progress" },
  completed: { th: "เสร็จสิ้น", en: "Completed" },
  cancelled: { th: "ยกเลิก", en: "Cancelled" },
  // orders
  awaiting_payment: { th: "รอชำระเงิน", en: "Awaiting payment" },
  paid_reserved: { th: "ชำระแล้ว/ล็อกสต็อก", en: "Paid / reserved" },
  awaiting_stock: { th: "รอสต็อก", en: "Awaiting stock" },
  allocated: { th: "จัดสรรล็อตแล้ว", en: "Allocated" },
  in_wave: { th: "อยู่ในรอบหยิบ", en: "In wave" },
  picking: { th: "กำลังหยิบ", en: "Picking" },
  picked: { th: "หยิบแล้ว", en: "Picked" },
  packing: { th: "กำลังแพ็ก", en: "Packing" },
  packed: { th: "แพ็กแล้ว", en: "Packed" },
  ready_to_ship: { th: "พร้อมส่ง", en: "Ready to ship" },
  handed_over: { th: "ส่งมอบแล้ว", en: "Handed over" },
  return_in_progress: { th: "กำลังตีกลับ", en: "Return in progress" },
  returned: { th: "ตีกลับแล้ว", en: "Returned" },
  // waves / tasks
  draft: { th: "ร่าง", en: "Draft" },
  released: { th: "ปล่อยแล้ว", en: "Released" },
  pending: { th: "รอทำ", en: "Pending" },
  short: { th: "ของขาด", en: "Short" },
  skipped: { th: "ข้าม", en: "Skipped" },
  // pack
  open: { th: "เปิด", en: "Open" },
  verifying: { th: "กำลังตรวจ", en: "Verifying" },
  verified: { th: "ตรวจผ่าน", en: "Verified" },
  blocked: { th: "ถูกบล็อก", en: "Blocked" },
  label_issued: { th: "ออกใบปะหน้าแล้ว", en: "Label issued" },
  // shipping
  label_printed: { th: "พิมพ์ใบปะหน้าแล้ว", en: "Label printed" },
  staged: { th: "วางในเลนแล้ว", en: "Staged" },
  manifested: { th: "อยู่ในใบส่งมอบ", en: "Manifested" },
  exception: { th: "ข้อยกเว้น", en: "Exception" },
  scanning: { th: "กำลังสแกน", en: "Scanning" },
  awaiting_signature: { th: "รอเซ็นรับ", en: "Awaiting signature" },
  // outbox
  queued: { th: "รอส่ง", en: "Queued" },
  sending: { th: "กำลังส่ง", en: "Sending" },
  sent: { th: "ส่งแล้ว", en: "Sent" },
  failed: { th: "ล้มเหลว", en: "Failed" },
  // returns
  grading: { th: "ประเมินสภาพ", en: "Grading" },
  restock_pending: { th: "รอคืนเข้าสต็อก", en: "Restock pending" },
  repack_pending: { th: "รอแพ็กใหม่", en: "Repack pending" },
  disposition_pending: { th: "รอจัดการของเสีย", en: "Disposition pending" },
  rejected: { th: "ปฏิเสธ", en: "Rejected" },
  // payment
  unpaid: { th: "ยังไม่ชำระ", en: "Unpaid" },
  paid: { th: "ชำระแล้ว", en: "Paid" },
  cod: { th: "เก็บเงินปลายทาง", en: "COD" },
  refunded: { th: "คืนเงิน", en: "Refunded" },
  // discrepancy
  over: { th: "เกิน", en: "Over" },
  wrong_item: { th: "สินค้าผิด", en: "Wrong item" },
  damaged: { th: "ชำรุด", en: "Damaged" },
  no_asn_line: { th: "ไม่อยู่ใน ASN", en: "Not on ASN" },
  open_: { th: "ค้าง", en: "Open" },
  acknowledged: { th: "รับทราบแล้ว", en: "Acknowledged" },
  resolved: { th: "แก้ไขแล้ว", en: "Resolved" },
  accept_over: { th: "รับส่วนเกิน", en: "Accept over" },
  return_to_supplier: { th: "ส่งคืนซัพพลายเออร์", en: "Return to supplier" },
  claim_short: { th: "เคลมของขาด", en: "Claim short" },
  reject: { th: "ปฏิเสธ", en: "Reject" },
  // grades
  A_good: { th: "A · สมบูรณ์ 100%", en: "A · 100% good" },
  B_box_damaged: { th: "B · กล่องพัง ต้องแพ็กใหม่", en: "B · Box damaged, repack" },
  C_unusable: { th: "C · เสียหาย ใช้งานไม่ได้", en: "C · Damaged, unusable" },
  restock: { th: "คืนเข้าสต็อก", en: "Restock" },
  repack_restock: { th: "แพ็กใหม่แล้วคืนสต็อก", en: "Repack, then restock" },
  rtv_claim: { th: "เคลมซัพพลายเออร์ (RTV)", en: "RTV claim" },
  // channels
  shopee: { th: "Shopee", en: "Shopee" },
  lazada: { th: "Lazada", en: "Lazada" },
  tiktok: { th: "TikTok Shop", en: "TikTok Shop" },
  website: { th: "เว็บไซต์", en: "Website" },
  // carriers
  flash: { th: "Flash Express", en: "Flash Express" },
  jt: { th: "J&T Express", en: "J&T Express" },
  spx: { th: "SPX Express", en: "SPX Express" },
  thaipost: { th: "ไปรษณีย์ไทย", en: "Thailand Post" },
  // wave strategies
  single_item_envelope: { th: "ซองเล็ก ชิ้นเดียว", en: "Single-item envelope" },
  multi_item_envelope: { th: "ซองหลายชิ้น", en: "Multi-item envelope" },
  large_box: { th: "กล่องใหญ่", en: "Large box" },
  // zone types
  receiving_zone: { th: "รับสินค้า", en: "Receiving" },
  qc_zone: { th: "QC", en: "QC" },
  quarantine_zone: { th: "กักกัน", en: "Quarantine" },
  storage: { th: "จัดเก็บ", en: "Storage" },
  pickface: { th: "หน้าหยิบ", en: "Pick face" },
  pack: { th: "แพ็ก", en: "Pack" },
  staging: { th: "พักรอส่ง", en: "Staging" },
  returns: { th: "ตีกลับ", en: "Returns" },
  destroy_zone: { th: "ทำลาย", en: "Destroy" },
  rtv_zone: { th: "RTV", en: "RTV" },
  // misc
  golden: { th: "ชั้นทอง (หยิบง่าย)", en: "Golden (easy pick)" },
  normal: { th: "ปกติ", en: "Normal" },
  high: { th: "ชั้นสูง", en: "High" },
  floor: { th: "พื้น", en: "Floor" },
};

export function statusLabel(value: string, lang: "th" | "en"): string {
  const hit = STATUS_LABELS[value];
  return hit ? hit[lang] : value;
}
