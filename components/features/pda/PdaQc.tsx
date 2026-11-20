"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Stepper } from "@/components/ui/Stepper";
import { fmtDate, QcStatusBadge } from "@/components/features/inbound/qcCells";
import { skuLabel } from "@/lib/domain/format";
import type { QcCheckKey, ReceiptLine } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

const CHECKS: { key: QcCheckKey; th: string; en: string }[] = [
  { key: "packaging", th: "บรรจุภัณฑ์สมบูรณ์", en: "Packaging intact" },
  { key: "label", th: "ฉลาก/บาร์โค้ดถูกต้อง", en: "Label / barcode correct" },
  { key: "quantity", th: "จำนวนตรงตามที่นับ", en: "Quantity matches count" },
  { key: "damage", th: "ไม่มีรอยชำรุด", en: "No visible damage" },
  { key: "expiry", th: "วันหมดอายุเพียงพอ", en: "Enough shelf life" },
];

const REASONS = [
  { code: "damaged", th: "ชำรุด/เสียหาย", en: "Damaged" },
  { code: "label_wrong", th: "ฉลากผิด", en: "Wrong label" },
  { code: "short_shelf_life", th: "อายุสินค้าสั้น", en: "Short shelf life" },
  { code: "suspect_fake", th: "สงสัยของไม่แท้", en: "Suspected counterfeit" },
  { code: "other", th: "อื่น ๆ", en: "Other" },
];

export function PdaQc() {
  const { tr, lang } = useT();
  const data = useWms((s) => s.data);
  const asnFilter = useSearchParams().get("asn");
  const [openId, setOpenId] = useState<string | null>(null);
  const [inspect, setInspect] = useState(0);
  const [hold, setHold] = useState(0);
  const [quarantine, setQuarantine] = useState(0);
  const [checks, setChecks] = useState<Record<QcCheckKey, boolean>>({
    packaging: true,
    label: true,
    quantity: true,
    damage: true,
    expiry: true,
  });
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<number | null>(null);

  // QC only opens once the console has approved the receipt (ASN closed).
  const approved = (asnId: string) => {
    const st = data.asns.find((a) => a.id === asnId)?.status;
    return st === "closed" || st === "closed_with_discrepancy";
  };
  const waitingApproval = data.receipts.filter(
    (r) =>
      r.qty - r.qcDone > 0 &&
      !approved(r.asnId) &&
      (!asnFilter || r.asnId === asnFilter),
  ).length;
  const queue = data.receipts.filter(
    (r) =>
      r.qty - r.qcDone > 0 &&
      approved(r.asnId) &&
      (!asnFilter || r.asnId === asnFilter),
  );
  // Lots fully inspected after console approval — show at the bottom like receive-done.
  const finished = data.receipts.filter(
    (r) =>
      r.qty > 0 &&
      r.qcDone >= r.qty &&
      approved(r.asnId) &&
      (!asnFilter || r.asnId === asnFilter),
  );
  const filterAsn = asnFilter
    ? data.asns.find((a) => a.id === asnFilter)
    : undefined;
  const receipt = data.receipts.find((r) => r.id === openId) ?? null;
  const remaining = receipt ? receipt.qty - receipt.qcDone : 0;
  const pass = inspect - hold - quarantine;
  const bad = hold + quarantine > 0;
  const valid = !!receipt && inspect > 0 && pass >= 0 && (!bad || !!reason);

  const openDialog = (r: ReceiptLine) => {
    setOpenId(r.id);
    setInspect(r.qty - r.qcDone);
    setHold(0);
    setQuarantine(0);
    setChecks({
      packaging: true,
      label: true,
      quantity: true,
      damage: true,
      expiry: true,
    });
    setReason("");
    setNote("");
    setDone(null);
  };

  const submit = () => {
    if (!receipt) return;
    const res = actions.submitQc({
      receiptLineId: receipt.id,
      qtyPass: pass,
      qtyHold: hold,
      qtyQuarantine: quarantine,
      checks: CHECKS.map((c) => ({ key: c.key, ok: checks[c.key] })),
      reasonCode: bad ? reason : undefined,
      note: note.trim() || undefined,
    });
    if (res.ok) setDone(res.data.putawayTasks);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">
        {tr("ตรวจคุณภาพ (QC)", "Quality control (QC)")}
      </h1>
      <p className="text-sm text-silver-metal">
        {tr(
          "สินค้าขายไม่ได้จนกว่าจะผ่าน QC: ที่ผ่านจะสร้างงานจัดเก็บ ที่ไม่ผ่านจะถูกพักหรือกักกัน",
          "Stock cannot be sold until it passes QC. Passed units create putaway tasks; failed units go to hold or quarantine.",
        )}
      </p>
      {filterAsn ? (
        <p className="text-sm">
          {tr("กรองเฉพาะ", "Filtered to")}{" "}
          <b className="font-mono">{filterAsn.asnNo}</b> ·{" "}
          <Link
            href="/pda/qc"
            className="text-gold underline underline-offset-2"
          >
            {tr("ดูทั้งหมด", "Show all")}
          </Link>
        </p>
      ) : null}
      {waitingApproval > 0 ? (
        <p
          role="status"
          className="rounded-lg border border-dashed border-gold p-3 text-sm text-gold"
        >
          {tr(
            `มี ${waitingApproval} ล็อตรอการอนุมัติรับเข้าจาก console ก่อน จึงจะตรวจ QC ได้`,
            `${waitingApproval} lot(s) wait for receipt approval in the console before QC.`,
          )}
        </p>
      ) : null}
      {queue.length === 0 ? (
        <p className="text-silver-metal">
          {tr("ไม่มีสินค้ารอ QC", "Nothing waiting for QC")} ·{" "}
          <Link
            href="/pda/putaway"
            className="text-gold underline underline-offset-2"
          >
            {tr("ไปงานจัดเก็บ", "Go to putaway")}
          </Link>
        </p>
      ) : null}
      <ul className="space-y-3">
        {queue.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => openDialog(r)}
              className="block w-full rounded-lg border border-silver-metal/50 p-4 text-left hover:border-gold"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-bold">
                  {skuLabel(data.skus.find((k) => k.id === r.skuId), lang)}
                </span>
                <QcStatusBadge r={r} data={data} tr={tr} />
              </div>
              <div className="mb-2 text-sm text-silver-metal">
                {data.asns.find((a) => a.id === r.asnId)?.asnNo ?? "-"} ·{" "}
                {tr("ล็อต", "Lot")} {r.lotNo} · {fmtDate(r.expiryDate)} · {r.qty}{" "}
                {tr("ชิ้น", "pcs")}
              </div>
              <div className="mb-1 text-sm tabular-nums">
                {r.qcDone} / {r.qty}
              </div>
              <ProgressBar value={r.qcDone} max={r.qty} />
            </button>
          </li>
        ))}
      </ul>

      {finished.length > 0 ? (
        <section className="mt-8" aria-labelledby="pda-qc-done">
          <h2 id="pda-qc-done" className="mb-3 text-base font-semibold text-silver-metal">
            {tr("ตรวจ QC สำเร็จแล้ว", "QC complete")}
          </h2>
          <ul className="space-y-3">
            {finished.map((r) => {
              const asnNo = data.asns.find((a) => a.id === r.asnId)?.asnNo ?? "-";
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-success/40 bg-success/10 p-4"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-bold">
                      {skuLabel(data.skus.find((k) => k.id === r.skuId), lang)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                      <span aria-hidden className="text-base">
                        ✓
                      </span>
                      {tr("ตรวจสำเร็จ", "Inspected")}
                    </span>
                  </div>
                  <div className="mb-1 text-sm text-silver-metal">
                    {asnNo} · {tr("ล็อต", "Lot")} {r.lotNo} · {fmtDate(r.expiryDate)}
                  </div>
                  <div className="text-sm tabular-nums text-silver-metal">
                    {r.qcDone} / {r.qty} {tr("ชิ้น", "pcs")}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Dialog
        open={!!receipt}
        onClose={() => setOpenId(null)}
        title={
          receipt
            ? `QC · ${skuLabel(
                data.skus.find((k) => k.id === receipt.skuId),
                lang,
              )}`
            : ""
        }
        footer={
          done !== null ? (
            <>
              <Link
                href="/pda/putaway"
                className="inline-flex min-h-11 items-center rounded-control bg-gold px-4 text-sm font-semibold text-ink"
              >
                {tr("ไปหน้าจัดเก็บ", "Go to putaway")}
              </Link>
              <Button variant="secondary" onClick={() => setOpenId(null)}>
                {tr("ปิด", "Close")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpenId(null)}>
                {tr("ยกเลิก", "Cancel")}
              </Button>
              <Button disabled={!valid} onClick={submit}>
                {tr("บันทึกผล QC", "Save QC result")}
              </Button>
            </>
          )
        }
      >
        {receipt ? (
          done !== null ? (
            <div role="status" className="space-y-1 text-sm">
              <p className="font-semibold">
                {tr("บันทึกผล QC แล้ว", "QC saved")}
              </p>
              <p>
                {done > 0
                  ? tr(
                      `สร้างงานจัดเก็บ ${done} งาน`,
                      `${done} putaway task(s) created`,
                    )
                  : tr(
                      "ไม่มีสินค้าผ่าน จึงไม่มีงานจัดเก็บ",
                      "Nothing passed - no putaway task created",
                    )}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                {tr(
                  `ค้างตรวจ ${remaining} ชิ้น · ล็อต ${receipt.lotNo}`,
                  `${remaining} pending · lot ${receipt.lotNo}`,
                )}
              </p>
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">
                  {tr("รายการตรวจ", "Checklist")}
                </legend>
                {CHECKS.map((c) => (
                  <label
                    key={c.key}
                    className="flex min-h-11 items-center gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-5 accent-gold-deep"
                      checked={checks[c.key]}
                      onChange={(e) =>
                        setChecks({ ...checks, [c.key]: e.target.checked })
                      }
                    />
                    {tr(c.th, c.en)}
                  </label>
                ))}
              </fieldset>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-sm font-medium">
                    {tr("จำนวนที่ตรวจ", "Quantity inspected")}
                  </div>
                  <Stepper
                    label={tr("จำนวนที่ตรวจ", "Quantity inspected")}
                    value={inspect}
                    min={1}
                    max={remaining}
                    onChange={(n) => {
                      setInspect(n);
                      if (hold + quarantine > n) {
                        setHold(0);
                        setQuarantine(0);
                      }
                    }}
                  />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium">
                    {tr("ผ่าน (คำนวณ)", "Pass (calculated)")}
                  </div>
                  <Badge tone={pass > 0 ? "solid" : "neutral"}>{pass}</Badge>
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium">
                    {tr("พัก (Hold)", "Hold")}
                  </div>
                  <Stepper
                    label={tr("พัก", "Hold")}
                    value={hold}
                    min={0}
                    max={inspect - quarantine}
                    onChange={setHold}
                  />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium">
                    {tr("กักกัน", "Quarantine")}
                  </div>
                  <Stepper
                    label={tr("กักกัน", "Quarantine")}
                    value={quarantine}
                    min={0}
                    max={inspect - hold}
                    onChange={setQuarantine}
                  />
                </div>
              </div>

              {bad ? (
                <Field label={tr("เหตุผล (จำเป็น)", "Reason (required)")}>
                  <Select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    <option value="">{tr("เลือก…", "Select…")}</option>
                    {REASONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {tr(r.th, r.en)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <Field label={tr("หมายเหตุ", "Note")}>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            </div>
          )
        ) : null}
      </Dialog>
    </div>
  );
}
