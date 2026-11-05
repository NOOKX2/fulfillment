import type { L10n } from "./types";

export const ERROR_MESSAGES = {
  INVALID_INPUT: { th: "ข้อมูลไม่ถูกต้อง", en: "Invalid input" },
  INVALID_TRANSITION: { th: "เปลี่ยนสถานะไม่ได้", en: "Illegal status change" },
  BAD_QTY: { th: "จำนวนไม่ถูกต้อง", en: "Invalid quantity" },
  REASON_REQUIRED: { th: "ต้องระบุเหตุผล", en: "A reason is required" },
  SKU_NOT_FOUND: { th: "ไม่พบสินค้า", en: "SKU not found" },
  UNKNOWN_BARCODE: { th: "ไม่รู้จักบาร์โค้ดนี้", en: "Unknown barcode" },

  ASN_NOT_FOUND: { th: "ไม่พบ ASN", en: "ASN not found" },
  ASN_CLOSED: { th: "ASN นี้ปิดแล้ว", en: "This ASN is already closed" },
  NOT_ON_ASN: { th: "สินค้านี้ไม่อยู่ใน ASN", en: "Item is not on this ASN" },
  LOT_REQUIRED: { th: "ต้องระบุเลขล็อต", en: "Lot number is required" },
  EXPIRY_REQUIRED: { th: "ต้องระบุวันหมดอายุ", en: "Expiry date is required" },
  OVER_RECEIPT_CONFIRM: {
    th: "รับเกินยอด ASN – ต้องยืนยันเพื่อบันทึกส่วนเกิน",
    en: "Over ASN quantity – confirm to log the excess",
  },
  DISCREPANCY_UNACK: {
    th: "ต้องรับทราบส่วนต่างก่อนปิด ASN",
    en: "Acknowledge discrepancies before closing the ASN",
  },
  RECEIPT_NOT_FOUND: { th: "ไม่พบรายการรับ", en: "Receipt line not found" },
  QC_QTY_INVALID: {
    th: "จำนวน QC ต้องมากกว่า 0 และไม่เกินยอดที่ยังไม่ตรวจ",
    en: "QC quantity must be > 0 and not exceed the uninspected quantity",
  },
  NO_RECEIVING_BIN: { th: "ไม่มีช่องรับสินค้า", en: "No receiving bin available" },
  NO_QUARANTINE_BIN: { th: "ไม่มีช่องกักกัน", en: "No quarantine bin available" },
  ROW_NOT_FOUND: { th: "ไม่พบแถวสต็อก", en: "Stock row not found" },

  TASK_NOT_FOUND: { th: "ไม่พบงาน", en: "Task not found" },
  TASK_DONE: { th: "งานนี้เสร็จหรือยกเลิกแล้ว", en: "Task already completed or cancelled" },
  WRONG_ITEM: { th: "สินค้าไม่ตรงกับงาน", en: "Item does not match the task" },
  WRONG_BIN: { th: "ช่องเก็บไม่ตรง", en: "Wrong bin" },
  SCAN_BIN_FIRST: {
    th: "ลำดับสแกนผิด – สแกนป้ายช่องก่อน แล้วค่อยสแกนสินค้า",
    en: "Wrong scan order – scan the bin label first, then the item",
  },
  SCAN_ORDER: {
    th: "ลำดับสแกนผิด – สแกนสินค้าก่อน แล้วค่อยสแกนป้ายช่อง",
    en: "Wrong scan order – scan the item first, then the bin label",
  },
  BIN_NOT_FOUND: { th: "ไม่พบช่องเก็บ", en: "Bin not found" },
  BIN_NOT_ALLOWED: {
    th: "ช่องนี้ไม่ใช่โซนจัดเก็บ/หยิบ หรือถูกปิดใช้งาน",
    en: "Bin is not a storage/pick zone or is inactive",
  },
  NOT_SUGGESTED_BIN: {
    th: "ไม่ใช่ตำแหน่งที่ระบบแนะนำ – ต้องระบุเหตุผลเพื่อเปลี่ยน",
    en: "Not a suggested bin – an override reason is required",
  },
  BIN_FULL: {
    th: "ช่องเต็ม (น้ำหนัก/ปริมาตร/ขนาด)",
    en: "Bin is full (weight / volume / dimensions)",
  },

  ORDER_NOT_FOUND: { th: "ไม่พบคำสั่งซื้อ", en: "Order not found" },
  BAD_ORDER_STATE: {
    th: "สถานะคำสั่งซื้อไม่เหมาะกับการกระทำนี้",
    en: "Order status does not allow this action",
  },
  NO_STOCK: { th: "สต็อกขายได้ไม่พอ", en: "Not enough sellable stock" },
  ALLOCATION_FAILED: {
    th: "จัดสรรล็อตไม่สำเร็จ",
    en: "Could not allocate lots",
  },
  CANCEL_BLOCKED: {
    th: "แพ็กแล้ว ยกเลิกไม่ได้จนกว่าจะแกะกล่อง",
    en: "Already packed – cannot cancel until unpacked",
  },

  WAVE_NOT_FOUND: { th: "ไม่พบรอบหยิบ", en: "Wave not found" },
  WAVE_STATE: { th: "สถานะรอบหยิบไม่ถูกต้อง", en: "Wave status does not allow this" },
  NO_ORDERS: { th: "ไม่มีออเดอร์พร้อมจัดรอบ", en: "No orders ready for waves" },
  PICK_TASK_NONE: { th: "ไม่มีจุดหยิบที่ค้างอยู่", en: "No pending pick stops" },

  SESSION_NOT_FOUND: { th: "ไม่พบเซสชันแพ็ก", en: "Pack session not found" },
  ORDER_NOT_PICKED: {
    th: "ออเดอร์นี้ยังหยิบไม่เสร็จ",
    en: "This order has not been picked yet",
  },
  ORDER_CANCELLED: { th: "ออเดอร์ถูกยกเลิกแล้ว", en: "Order was cancelled" },
  PACK_MISMATCH: { th: "สินค้าที่สแกนไม่ตรง", en: "Scanned item does not match" },
  SUPERVISOR_REQUIRED: {
    th: "ผิดซ้ำ 3 ครั้ง – ต้องให้หัวหน้างานอนุมัติ",
    en: "3 mismatches – supervisor override required",
  },
  LABEL_BLOCKED: {
    th: "ออกใบปะหน้าไม่ได้ – ยังตรวจสอบไม่ผ่านหรือไฟแดงยังติดอยู่",
    en: "Label blocked – verification incomplete or red light still on",
  },

  LATE_NOTE_REQUIRED: {
    th: "เลยเวลา cut-off แล้ว – ต้องระบุหมายเหตุส่งล่าช้า",
    en: "Past the carrier cut-off – a late note is required",
  },
  TRACKING_UNKNOWN: { th: "ไม่พบเลขพัสดุ", en: "Tracking number not found" },
  SHIPMENT_NOT_FOUND: { th: "ไม่พบพัสดุ", en: "Shipment not found" },
  SHIPMENT_STATE: { th: "สถานะพัสดุไม่ถูกต้อง", en: "Shipment status does not allow this" },
  MANIFEST_NOT_FOUND: { th: "ไม่พบใบส่งมอบ", en: "Manifest not found" },
  MANIFEST_STATE: { th: "สถานะใบส่งมอบไม่ถูกต้อง", en: "Manifest status does not allow this" },
  EMPTY_MANIFEST: { th: "ไม่มีพัสดุสำหรับใบส่งมอบ", en: "No parcels for the manifest" },
  UNSCANNED_PARCELS: {
    th: "ยังมีพัสดุที่ไม่ได้สแกน – สแกนหรือระบุเป็นข้อยกเว้น (หาย/เสียหาย)",
    en: "Unscanned parcels remain – scan or mark as exception (missing/damaged)",
  },
  PARCEL_NOT_IN_MANIFEST: {
    th: "พัสดุนี้ไม่อยู่ในใบส่งมอบนี้",
    en: "Parcel is not on this manifest",
  },
  SIGNATURE_REQUIRED: { th: "ต้องเซ็นรับก่อน", en: "Signature is required" },
  DRIVER_REQUIRED: { th: "ต้องระบุชื่อคนขับและทะเบียนรถ", en: "Driver name and plate are required" },

  RETURN_NOT_FOUND: { th: "ไม่พบรายการคืน", en: "Return not found" },
  ORDER_NOT_RETURNABLE: {
    th: "ออเดอร์นี้ยังไม่ได้ส่งมอบ จึงรับคืนไม่ได้",
    en: "Order was not handed over – cannot be returned",
  },
  NOT_IN_ORDER: { th: "สินค้านี้ไม่อยู่ในออเดอร์เดิม", en: "Item is not in the original order" },
  OVER_RETURN: {
    th: "จำนวนรับคืนเกินที่ส่งไป",
    en: "Returned quantity exceeds shipped quantity",
  },
  LINE_NOT_FOUND: { th: "ไม่พบบรรทัดรายการ", en: "Line not found" },
  LINE_NOT_GRADED: { th: "ยังไม่ได้ประเมินสภาพ", en: "Line has not been graded yet" },
  LINE_ALREADY_GRADED: { th: "ประเมินสภาพแล้ว", en: "Line already graded" },
  NOTHING_RECEIVED: { th: "ยังไม่ได้สแกนรับสินค้า", en: "Nothing scanned yet" },
  ORIGIN_BIN_UNAVAILABLE: {
    th: "ช่องเดิมเต็มหรือปิดใช้งาน – เลือกช่องอื่นพร้อมเหตุผล",
    en: "Original bin is full or inactive – choose another with a reason",
  },
  REPACK_FIRST: { th: "ต้องแพ็กใหม่ให้เสร็จก่อน", en: "Complete the repack first" },
} satisfies Record<string, L10n>;

export type ErrorCode = keyof typeof ERROR_MESSAGES;
