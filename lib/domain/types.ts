export type Lang = "th" | "en";
export type L10n = { th: string; en: string };
export type ID = string; // `${prefix}-${seq}` from state.seq, never random
export type ISODate = string; // yyyy-mm-dd
export type ISODateTime = string; // ISO 8601, only written inside actions
export type Channel = "shopee" | "lazada" | "tiktok" | "website";
export type CarrierCode = "flash" | "jt" | "spx" | "thaipost";

/* ---------- Master data ---------- */
export type SizeClass = "S" | "M" | "L" | "XL";
export type PackClass = "envelope" | "box";
export type Velocity = "A" | "B" | "C"; // A = fast-moving dims
export type Dims = { l: number; w: number; h: number };

export interface Sku {
  id: ID;
  code: string;
  modelCode: string;
  name: L10n;
  color?: L10n;
  size?: string;
  barcodes: string[];
  dimsCm: Dims;
  weightG: number;
  sizeClass: SizeClass;
  packClass: PackClass;
  velocity: Velocity;
  tracksLot: boolean;
  tracksExpiry: boolean;
  minShelfLifeDays?: number;
  supplierId: ID;
}
export interface Supplier {
  id: ID;
  name: L10n;
  rtvContact?: string;
}

export type LocationKind = "zone" | "aisle" | "rack" | "shelf" | "bin";
export interface LocationNode {
  id: ID;
  kind: LocationKind;
  parentId: ID | null;
  code: string;
  name?: L10n;
}
export type ZoneType =
  | "receiving"
  | "qc"
  | "quarantine"
  | "storage"
  | "pickface"
  | "pack"
  | "staging"
  | "returns"
  | "repack"
  | "destroy"
  | "rtv";
export type Ergonomics = "golden" | "normal" | "high" | "floor";
export interface Bin {
  id: ID;
  nodeId: ID;
  barcode: string;
  zone: string;
  aisle: string;
  rack: string;
  shelf: string;
  bin: string;
  path: string;
  zoneType: ZoneType;
  maxWeightG: number;
  maxVolumeCm3: number;
  maxDimsCm: Dims;
  ergonomics: Ergonomics;
  pickSeq: number;
  active: boolean;
  labelPrinted?: boolean;
}
export interface BinBinding {
  binId: ID;
  skuId: ID;
  boundAt: ISODateTime;
}

/* ---------- Inventory ---------- */
export type StockStatus =
  | "pending_qc"
  | "sellable"
  | "hold"
  | "quarantine"
  | "return_pending"
  | "repack"
  | "rtv"
  | "destroy";
export interface StockRow {
  id: ID;
  skuId: ID;
  lotNo: string;
  expiryDate?: ISODate;
  receivedAt: ISODateTime;
  binId: ID;
  status: StockStatus;
  qty: number;
  qtyAllocated: number;
}
export type LedgerType =
  | "receive"
  | "qc_move"
  | "putaway"
  | "reserve"
  | "release"
  | "allocate"
  | "pick"
  | "pack"
  | "ship"
  | "return_in"
  | "restock"
  | "dispose"
  | "rtv"
  | "adjust"
  | "status_change";
export interface LedgerEntry {
  id: ID;
  at: ISODateTime;
  type: LedgerType;
  skuId: ID;
  lotNo?: string;
  fromBinId?: ID;
  toBinId?: ID;
  fromStatus?: StockStatus;
  toStatus?: StockStatus;
  qty: number;
  refType?: string;
  refId?: ID;
  note?: string;
}

/* ---------- Inbound ---------- */
export interface PurchaseOrder {
  id: ID;
  poNo: string;
  supplierId: ID;
  lines: { skuId: ID; qty: number }[];
}
export type AsnStatus =
  | "expected"
  | "receiving"
  | "received"
  | "closed_with_discrepancy"
  | "closed";
export interface AsnLine {
  id: ID;
  skuId: ID;
  expectedQty: number;
  receivedQty: number;
  lotNo?: string;
  expiryDate?: ISODate;
}
export interface Asn {
  id: ID;
  asnNo: string;
  /** Set when the console admin approves the QC outcome. */
  qcApproved?: boolean;
  /** Set when the admin confirms putaway is complete and stock is live. */
  putawayApproved?: boolean;
  poId: ID;
  supplierId: ID;
  expectedAt: ISODate;
  dockDoor?: string;
  status: AsnStatus;
  lines: AsnLine[];
  createdAt: ISODateTime;
}
export interface ReceiptLine {
  id: ID;
  asnId: ID;
  asnLineId?: ID;
  skuId: ID;
  lotNo: string;
  expiryDate?: ISODate;
  qty: number;
  qcDone: number;
  receivedAt: ISODateTime;
  receivingBinId: ID;
  qcStatus: "pending" | "in_progress" | "done";
}
export type DiscrepancyType =
  | "short"
  | "over"
  | "wrong_item"
  | "damaged"
  | "no_asn_line";
export type DiscrepancyResolution =
  | "accept_over"
  | "return_to_supplier"
  | "claim_short"
  | "reject";
export interface Discrepancy {
  id: ID;
  asnId: ID;
  skuId?: ID;
  scannedBarcode?: string;
  type: DiscrepancyType;
  expectedQty: number;
  actualQty: number;
  status: "open" | "acknowledged" | "resolved";
  resolution?: DiscrepancyResolution;
  note?: string;
  createdAt: ISODateTime;
}
export type QcCheckKey = "packaging" | "label" | "quantity" | "damage" | "expiry";
export interface QcInspection {
  id: ID;
  receiptLineId: ID;
  skuId: ID;
  lotNo: string;
  qtyInspected: number;
  checks: { key: QcCheckKey; ok: boolean }[];
  qtyPass: number;
  qtyHold: number;
  qtyQuarantine: number;
  reasonCode?: string;
  note?: string;
  inspectedAt: ISODateTime;
}

/* ---------- Putaway ---------- */
export type PutawayStatus = "suggested" | "in_progress" | "completed" | "cancelled";
export type PutawayReason =
  | "velocity_golden"
  | "fits_dims"
  | "fits_weight"
  | "same_sku_consolidate"
  | "nearest_pickseq"
  | "bound_pickface"
  | "slow_mover_high";
export interface PutawaySuggestion {
  binId: ID;
  score: number;
  reasons: PutawayReason[];
}
export interface PutawayTask {
  id: ID;
  skuId: ID;
  lotNo: string;
  expiryDate?: ISODate;
  receivedAt: ISODateTime;
  qty: number;
  fromBinId: ID;
  suggestions: PutawaySuggestion[];
  chosenBinId?: ID;
  overrideReason?: string;
  scannedItemOk?: boolean;
  scannedBinOk?: boolean;
  status: PutawayStatus;
  createdAt: ISODateTime;
  completedAt?: ISODateTime;
  note?: string;
}

/* ---------- Orders ---------- */
export type PaymentStatus = "unpaid" | "paid" | "cod" | "refunded";
export type OrderStatus =
  | "awaiting_payment"
  | "paid_reserved"
  | "awaiting_stock"
  | "allocated"
  | "in_wave"
  | "picking"
  | "picked"
  | "packing"
  | "packed"
  | "ready_to_ship"
  | "handed_over"
  | "cancelled"
  | "return_in_progress"
  | "returned";
export interface OrderLine {
  id: ID;
  skuId: ID;
  qty: number;
  unitPrice: number;
}
export interface Order {
  id: ID;
  channel: Channel;
  channelOrderNo: string;
  buyerName: string;
  address: string;
  phone: string;
  lines: OrderLine[];
  paymentStatus: PaymentStatus;
  paidAt?: ISODateTime;
  createdAt: ISODateTime;
  carrier: CarrierCode;
  shipBy: ISODateTime;
  codAmount?: number;
  status: OrderStatus;
  waveId?: ID;
  shipmentId?: ID;
  cancelledAt?: ISODateTime;
  shortBy?: Record<ID, number>;
}
export interface Reservation {
  id: ID;
  orderId: ID;
  lineId: ID;
  skuId: ID;
  qty: number;
  status: "active" | "converted" | "released";
}
export interface Allocation {
  id: ID;
  orderId: ID;
  lineId: ID;
  skuId: ID;
  stockRowId: ID;
  lotNo: string;
  binId: ID;
  expiryDate?: ISODate;
  receivedAt: ISODateTime;
  qty: number;
  picked: number;
  status: "allocated" | "picking" | "picked" | "packed" | "shipped" | "cancelled";
}

/* ---------- Waves / pick ---------- */
export type WaveStrategy = "single_item_envelope" | "multi_item_envelope" | "large_box";
export type WaveStatus = "draft" | "released" | "picking" | "picked" | "closed" | "cancelled";
export interface Wave {
  id: ID;
  name: string;
  strategy: WaveStrategy;
  carrier?: CarrierCode;
  cutoffAt?: ISODateTime;
  orderIds: ID[];
  pickMode: "batch_by_sku" | "discrete_order";
  status: WaveStatus;
  createdAt: ISODateTime;
  releasedAt?: ISODateTime;
}
export type PickTaskStatus = "pending" | "picked" | "short" | "skipped";
export interface PickTask {
  id: ID;
  waveId: ID;
  seq: number;
  binId: ID;
  skuId: ID;
  lotNo: string;
  qty: number;
  allocationIds: ID[];
  toteId: ID;
  pickedQty: number;
  binScanned: boolean;
  status: PickTaskStatus;
  shortReason?: string;
}
export interface Tote {
  id: ID;
  barcode: string;
  waveId?: ID;
  orderIds: ID[];
  status: "free" | "in_use" | "at_pack" | "done";
}

/* ---------- Packing / shipping ---------- */
export type PackStatus =
  | "open"
  | "verifying"
  | "verified"
  | "blocked"
  | "label_issued"
  | "closed";
export type MismatchReason =
  | "unknown_barcode"
  | "wrong_model"
  | "wrong_color"
  | "wrong_size"
  | "wrong_sku"
  | "over_qty"
  | "not_in_order";
export type BoxSize = "ENV_S" | "ENV_M" | "BOX_S" | "BOX_M" | "BOX_L";
export interface PackSession {
  id: ID;
  orderId: ID;
  toteId?: ID;
  status: PackStatus;
  startedAt: ISODateTime;
  expected: { skuId: ID; qty: number }[];
  scanned: { skuId: ID; qty: number }[];
  mismatches: {
    at: ISODateTime;
    scannedBarcode: string;
    expectedSkuId?: ID;
    scannedSkuId?: ID;
    reason: MismatchReason;
  }[];
  redLightOn: boolean;
  supervisorOverride?: { reason: string; at: ISODateTime };
  boxSize?: BoxSize;
}
export type ShipmentStatus =
  | "label_printed"
  | "staged"
  | "manifested"
  | "handed_over"
  | "exception";
export interface Shipment {
  id: ID;
  orderId: ID;
  carrier: CarrierCode;
  trackingNo: string;
  labelPrintedAt: ISODateTime;
  reprintCount: number;
  weightG: number;
  boxSize?: BoxSize;
  status: ShipmentStatus;
  stagingLane?: string;
  late?: boolean;
  lateNote?: string;
  manifestId?: ID;
  handedOverAt?: ISODateTime;
}
export interface CarrierConfig {
  code: CarrierCode;
  name: L10n;
  cutoffLocal: string; // "15:00"
  trackingPrefix: string;
  nextSeq: number;
}
export type ManifestStatus = "draft" | "scanning" | "awaiting_signature" | "handed_over";
export interface Manifest {
  id: ID;
  manifestNo: string;
  carrier: CarrierCode;
  cutoffAt: ISODateTime;
  createdAt: ISODateTime;
  shipmentIds: ID[];
  scannedShipmentIds: ID[];
  driverName?: string;
  vehiclePlate?: string;
  signatureKey?: string;
  status: ManifestStatus;
  signedAt?: ISODateTime;
  exceptions: { shipmentId: ID; reason: "missing" | "damaged" }[];
}
export type OutboxStatus = "queued" | "sending" | "sent" | "failed";
export interface OutboxEvent {
  id: ID;
  channel: Channel;
  orderId: ID;
  kind: "shipped" | "cancel_ack" | "return_received" | "stock_sync";
  payload: { trackingNo?: string; carrier?: CarrierCode };
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: ISODateTime;
  sentAt?: ISODateTime;
}

/* ---------- Returns ---------- */
export type ReturnStatus =
  | "expected"
  | "received"
  | "grading"
  | "restock_pending"
  | "repack_pending"
  | "disposition_pending"
  | "completed"
  | "rejected";
export type Grade = "A_good" | "B_box_damaged" | "C_unusable";
export type Disposition = "restock" | "repack_restock" | "destroy" | "rtv_claim";
export interface ReturnLine {
  id: ID;
  orderLineId: ID;
  skuId: ID;
  expectedQty: number;
  receivedQty: number;
  grade?: Grade;
  disposition?: Disposition;
  originBinId?: ID;
  lotNo?: string;
  expiryDate?: ISODate;
  originReceivedAt?: ISODateTime;
  repacked?: boolean;
  resolved?: boolean;
  restockedBinId?: ID;
  restockOverrideReason?: string;
  holdBinId?: ID;
}
export interface RtvClaim {
  id: ID;
  returnLineId: ID;
  supplierId: ID;
  skuId: ID;
  qty: number;
  reason: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  createdAt: ISODateTime;
}
export interface ReturnOrder {
  id: ID;
  rmaNo: string;
  returnTrackingNo: string;
  orderId: ID;
  reason: string;
  lines: ReturnLine[];
  status: ReturnStatus;
  createdAt: ISODateTime;
  completedAt?: ISODateTime;
}

/* ---------- Scan & app ---------- */
export type ScanKind =
  | "sku"
  | "bin"
  | "order"
  | "tote"
  | "tracking"
  | "return"
  | "asn"
  | "unknown";
export interface ScanEvent {
  id: ID;
  at: ISODateTime;
  context: string;
  raw: string;
  kind: ScanKind;
  ok: boolean;
  code?: string;
}
export interface Settings {
  lang: Lang;
  soundOn: boolean;
  vibrateOn: boolean;
  carriers: CarrierConfig[];
  failOutboxNext: boolean;
}
export interface AppState {
  schemaVersion: number;
  seeded: boolean;
  seq: Record<string, number>;
  simCursor: number;
  skus: Sku[];
  suppliers: Supplier[];
  nodes: LocationNode[];
  bins: Bin[];
  bindings: BinBinding[];
  pos: PurchaseOrder[];
  asns: Asn[];
  receipts: ReceiptLine[];
  discrepancies: Discrepancy[];
  qc: QcInspection[];
  stock: StockRow[];
  ledger: LedgerEntry[];
  putaway: PutawayTask[];
  orders: Order[];
  reservations: Reservation[];
  allocations: Allocation[];
  waves: Wave[];
  pickTasks: PickTask[];
  totes: Tote[];
  packSessions: PackSession[];
  shipments: Shipment[];
  manifests: Manifest[];
  outbox: OutboxEvent[];
  returns: ReturnOrder[];
  rtvClaims: RtvClaim[];
  scanLog: ScanEvent[];
  settings: Settings;
}
