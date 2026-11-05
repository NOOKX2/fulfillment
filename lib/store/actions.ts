"use client";

import { nowISO } from "../clock";
import { allocateOrder } from "../domain/allocation";
import {
  acknowledgeDiscrepancy,
  closeAsn,
  logDiscrepancy,
  receiveScan,
  releaseStock,
  resolveDiscrepancy,
  submitQc,
} from "../domain/inbound";
import {
  cancelOrder,
  markPaid,
  retryOrder,
  syncOrders,
} from "../domain/orders";
import {
  closePackSession,
  issueLabel,
  packClearAlarm,
  packScan,
  packSupervisorOverride,
  reprintLabel,
  startPackSession,
} from "../domain/pack";
import {
  bindBin,
  cancelPutaway,
  putawayScanBin,
  putawayScanItem,
  resuggest,
  unbindBin,
} from "../domain/putaway";
import {
  closeReturn,
  completeRepack,
  createDemoReturn,
  gradeLine,
  restockLine,
  returnIntake,
  returnScanItem,
} from "../domain/returns";
import {
  recoverOutbox,
  outboxBegin,
  outboxFinish,
  outboxRetry,
} from "../domain/outbox";
import {
  createManifest,
  finishManifestScan,
  manifestScan,
  markManifestException,
  signManifest,
  stageScan,
} from "../domain/shipping";
import {
  buildWaves,
  cancelWave,
  closeWave,
  pickScan,
  releaseWave,
  removeOrderFromWave,
  shortPick,
} from "../domain/waves";
import { parseScan } from "../scan/parse";
import { fail, ok } from "../domain/core";
import type { Lang } from "../domain/types";
import { replaceData, run, useWms, getData } from "./store";
import { buildSeed } from "./seed";
import { clearSignatures } from "./persist";

type Args<F> = F extends (s: never, c: never, i: infer I) => unknown
  ? I
  : never;

const kindOf = (raw: string) => parseScan(raw).kind;

export const actions = {
  /* --- system --- */
  seedIfEmpty() {
    const d = getData();
    if (d.seeded && d.schemaVersion === 1) {
      run(
        (s) => {
          recoverOutbox(s);
          return { ok: true, data: undefined };
        },
        { notifyError: false },
      );
      return;
    }
    replaceData(buildSeed(nowISO(), d.settings.lang));
  },
  resetDemo() {
    const lang = getData().settings.lang;
    clearSignatures();
    replaceData(buildSeed(nowISO(), lang));
  },
  setLang(lang: Lang) {
    run(
      (s) => {
        s.settings.lang = lang;
        return { ok: true, data: undefined };
      },
      { notifyError: false },
    );
  },
  setSetting<K extends "soundOn" | "vibrateOn" | "failOutboxNext">(
    key: K,
    value: boolean,
  ) {
    run(
      (s) => {
        s.settings[key] = value;
        return { ok: true, data: undefined };
      },
      { notifyError: false },
    );
  },
  setCutoff(code: string, hm: string) {
    run(
      (s) => {
        const c = s.settings.carriers.find((x) => x.code === code);
        if (c) c.cutoffLocal = hm;
        return { ok: true, data: undefined };
      },
      { notifyError: false },
    );
  },

  /* --- inbound --- */
  receive(input: Args<typeof receiveScan>) {
    return run((s, c) => receiveScan(s, c, input), {
      scan: { context: "receive", raw: input.raw, kind: kindOf(input.raw) },
      silentCodes: ["OVER_RECEIPT_CONFIRM", "LOT_REQUIRED", "EXPIRY_REQUIRED"],
    });
  },
  logDiscrepancy(input: Args<typeof logDiscrepancy>) {
    return run((s, c) => logDiscrepancy(s, c, input), {
      successText: { th: "บันทึกส่วนต่างแล้ว", en: "Discrepancy logged" },
    });
  },
  /** Admin confirms the QC outcome. The QC step stays in progress until this is pressed. */
  approveQc(asnId: string) {
    return run(
      (s) => {
        const a = s.asns.find((x) => x.id === asnId);
        if (!a) return fail("ASN_NOT_FOUND");
        const waiting = s.receipts.some(
          (r) => r.asnId === asnId && r.qty - r.qcDone > 0,
        );
        if (waiting) return fail("QC_NOT_DONE");
        a.qcApproved = true;
        return ok(undefined);
      },
      { successText: { th: "อนุมัติผล QC แล้ว", en: "QC result approved" } },
    );
  },
  /** Admin confirms every putaway task of the ASN is done: stock is live. */
  completeAsnPutaway(asnId: string) {
    return run(
      (s) => {
        const a = s.asns.find((x) => x.id === asnId);
        if (!a) return fail("ASN_NOT_FOUND");
        const lots = s.receipts.filter((r) => r.asnId === asnId);
        const tasks = s.putaway.filter(
          (t) =>
            t.status !== "cancelled" &&
            lots.some((r) => r.skuId === t.skuId && r.lotNo === t.lotNo),
        );
        if (tasks.length === 0 || tasks.some((t) => t.status !== "completed"))
          return fail("PUTAWAY_NOT_DONE");
        a.putawayApproved = true;
        return ok(undefined);
      },
      { successText: { th: "ปิดงานรับสินค้าแล้ว", en: "Inbound completed" } },
    );
  },
  closeAsn(input: Args<typeof closeAsn>) {
    return run((s, c) => closeAsn(s, c, input), {
      successText: { th: "ปิด ASN แล้ว", en: "ASN closed" },
      silentCodes: ["DISCREPANCY_UNACK"],
    });
  },
  acknowledgeDiscrepancy(id: string) {
    return run((s) => acknowledgeDiscrepancy(s, id));
  },
  resolveDiscrepancy(input: Args<typeof resolveDiscrepancy>) {
    return run((s, c) => resolveDiscrepancy(s, c, input), {
      successText: { th: "แก้ไขส่วนต่างแล้ว", en: "Discrepancy resolved" },
    });
  },
  submitQc(input: Args<typeof submitQc>) {
    return run((s, c) => submitQc(s, c, input), {
      successText: { th: "บันทึกผล QC แล้ว", en: "QC saved" },
    });
  },
  releaseStock(input: Args<typeof releaseStock>) {
    return run((s, c) => releaseStock(s, c, input), {
      successText: { th: "ดำเนินการแล้ว", en: "Done" },
    });
  },

  /* --- putaway --- */
  putawayItem(input: Args<typeof putawayScanItem>) {
    return run((s, c) => putawayScanItem(s, c, input), {
      scan: {
        context: "putaway-item",
        raw: input.raw,
        kind: kindOf(input.raw),
      },
    });
  },
  putawayBin(input: Args<typeof putawayScanBin>) {
    return run((s, c) => putawayScanBin(s, c, input), {
      scan: { context: "putaway-bin", raw: input.raw, kind: kindOf(input.raw) },
      successText: { th: "บันทึกพิกัดแล้ว", en: "Location saved" },
      silentCodes: ["NOT_SUGGESTED_BIN"],
    });
  },
  resuggest(taskId: string) {
    return run((s) => resuggest(s, taskId));
  },
  cancelPutaway(taskId: string) {
    return run((s) => cancelPutaway(s, taskId));
  },
  bindBin(input: Args<typeof bindBin>) {
    return run((s, c) => bindBin(s, c, input), {
      successText: { th: "ผูกช่องกับสินค้าแล้ว", en: "Bin bound to SKU" },
    });
  },
  unbindBin(binId: string) {
    return run((s) => unbindBin(s, binId));
  },
  setBinFlag(
    binId: string,
    patch: { active?: boolean; labelPrinted?: boolean },
  ) {
    return run(
      (s) => {
        const b = s.bins.find((x) => x.id === binId);
        if (b) Object.assign(b, patch);
        return { ok: true, data: undefined };
      },
      { notifyError: false },
    );
  },

  /* --- orders --- */
  syncOrders(count = 3) {
    return run((s, c) => syncOrders(s, c, { count }), {
      successText: {
        th: "นำเข้าคำสั่งซื้อจากทุกช่องทางแล้ว",
        en: "Orders synced from all channels",
      },
    });
  },
  markPaid(orderId: string) {
    return run((s, c) => markPaid(s, c, orderId));
  },
  cancelOrder(orderId: string) {
    return run((s, c) => cancelOrder(s, c, orderId), {
      successText: { th: "ยกเลิกออเดอร์แล้ว", en: "Order cancelled" },
    });
  },
  retryOrder(orderId: string) {
    return run((s, c) => retryOrder(s, c, orderId));
  },
  allocate(orderId: string) {
    return run((s, c) => allocateOrder(s, c, orderId), {
      successText: { th: "จัดสรรล็อตแล้ว", en: "Lots allocated" },
    });
  },

  /* --- waves / pick --- */
  buildWaves() {
    return run((s, c) => buildWaves(s, c), {
      successText: { th: "สร้างรอบหยิบแล้ว", en: "Waves built" },
    });
  },
  releaseWave(waveId: string) {
    return run((s, c) => releaseWave(s, c, waveId), {
      successText: { th: "ปล่อยรอบหยิบแล้ว", en: "Wave released" },
    });
  },
  cancelWave(waveId: string) {
    return run((s) => cancelWave(s, waveId));
  },
  removeFromWave(waveId: string, orderId: string) {
    return run((s) => removeOrderFromWave(s, waveId, orderId));
  },
  closeWave(waveId: string) {
    return run((s) => closeWave(s, waveId), {
      successText: { th: "ส่งต่อไปโต๊ะแพ็กแล้ว", en: "Sent to pack" },
    });
  },
  pickScan(input: Args<typeof pickScan>) {
    return run((s, c) => pickScan(s, c, input), {
      scan: { context: "pick", raw: input.raw, kind: kindOf(input.raw) },
    });
  },
  shortPick(input: Args<typeof shortPick>) {
    return run((s, c) => shortPick(s, c, input), {
      successText: { th: "บันทึกของขาดแล้ว", en: "Short pick recorded" },
    });
  },

  /* --- pack --- */
  startPack(input: Args<typeof startPackSession>) {
    return run((s, c) => startPackSession(s, c, input));
  },
  packScan(input: Args<typeof packScan>) {
    return run((s, c) => packScan(s, c, input), {
      scan: { context: "pack", raw: input.raw, kind: kindOf(input.raw) },
    });
  },
  packClearAlarm(sessionId: string) {
    return run((s) => packClearAlarm(s, { sessionId }));
  },
  packOverride(input: Args<typeof packSupervisorOverride>) {
    return run((s, c) => packSupervisorOverride(s, c, input), {
      successText: {
        th: "หัวหน้างานอนุมัติแล้ว",
        en: "Supervisor override recorded",
      },
    });
  },
  issueLabel(input: Args<typeof issueLabel>) {
    return run((s, c) => issueLabel(s, c, input), {
      successText: { th: "ออกใบปะหน้าแล้ว", en: "Airway bill issued" },
    });
  },
  closePack(sessionId: string) {
    return run((s) => closePackSession(s, { sessionId }), {
      notifyError: false,
    });
  },
  reprint(shipmentId: string) {
    return run((s) => reprintLabel(s, shipmentId));
  },

  /* --- shipping --- */
  stageScan(input: Args<typeof stageScan>) {
    return run((s, c) => stageScan(s, c, input), {
      scan: { context: "stage", raw: input.raw, kind: kindOf(input.raw) },
      silentCodes: ["LATE_NOTE_REQUIRED"],
    });
  },
  createManifest(input: Args<typeof createManifest>) {
    return run((s, c) => createManifest(s, c, input), {
      successText: { th: "สร้างใบส่งมอบแล้ว", en: "Manifest created" },
    });
  },
  manifestScan(input: Args<typeof manifestScan>) {
    return run((s, c) => manifestScan(s, c, input), {
      scan: { context: "manifest", raw: input.raw, kind: kindOf(input.raw) },
    });
  },
  manifestException(input: Parameters<typeof markManifestException>[1]) {
    return run((s) => markManifestException(s, input));
  },
  finishManifest(input: Args<typeof finishManifestScan>) {
    return run((s, c) => finishManifestScan(s, c, input), {
      successText: { th: "พร้อมเซ็นรับ", en: "Ready for signature" },
    });
  },
  signManifest(input: Args<typeof signManifest>) {
    return run((s, c) => signManifest(s, c, input), {
      successText: {
        th: "ส่งมอบพัสดุแล้ว – แจ้งแพลตฟอร์มแล้ว",
        en: "Handed over - platforms notified",
      },
    });
  },

  /* --- outbox --- */
  outboxBegin(id: string) {
    return run((s, c) => outboxBegin(s, c, id), { notifyError: false });
  },
  outboxFinish(id: string) {
    return run((s, c) => outboxFinish(s, c, id), { notifyError: false });
  },
  outboxRetry(id: string) {
    return run((s, c) => outboxRetry(s, c, id), { notifyError: false });
  },

  /* --- returns --- */
  demoReturn(input: Args<typeof createDemoReturn> = {}) {
    return run((s, c) => createDemoReturn(s, c, input), {
      successText: { th: "สร้างรายการคืนจำลองแล้ว", en: "Demo return created" },
    });
  },
  returnIntake(input: Args<typeof returnIntake>) {
    return run((s, c) => returnIntake(s, c, input), {
      scan: {
        context: "return-intake",
        raw: input.raw,
        kind: kindOf(input.raw),
      },
    });
  },
  returnItem(input: Args<typeof returnScanItem>) {
    return run((s, c) => returnScanItem(s, c, input), {
      scan: { context: "return-item", raw: input.raw, kind: kindOf(input.raw) },
    });
  },
  grade(input: Args<typeof gradeLine>) {
    return run((s, c) => gradeLine(s, c, input), {
      successText: { th: "บันทึกผลประเมินแล้ว", en: "Grade saved" },
    });
  },
  completeRepack(input: Args<typeof completeRepack>) {
    return run((s, c) => completeRepack(s, c, input), {
      successText: { th: "แพ็กใหม่เสร็จแล้ว", en: "Repack done" },
    });
  },
  restock(input: Args<typeof restockLine>) {
    return run((s, c) => restockLine(s, c, input), {
      scan: {
        context: "restock",
        raw: input.binRaw,
        kind: kindOf(input.binRaw),
      },
      silentCodes: ["WRONG_BIN"],
      successText: { th: "คืนสต็อกพร้อมขายแล้ว", en: "Restocked as sellable" },
    });
  },
  closeReturn(input: Args<typeof closeReturn>) {
    return run((s, c) => closeReturn(s, c, input), {
      successText: { th: "ปิดรายการคืนแล้ว", en: "Return closed" },
    });
  },
};

export { useWms };
