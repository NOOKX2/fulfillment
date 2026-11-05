"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, PageHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Stepper } from "@/components/ui/Stepper";
import { skuLabel } from "@/lib/domain/format";
import type { QcCheckKey, QcInspection, ReceiptLine } from "@/lib/domain/types";
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

export function QcQueue() {
  const { tr, lang } = useT();
  const data = useWms((s) => s.data);
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

  const queue = data.receipts.filter((r) => r.qty - r.qcDone > 0);
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
    setChecks({ packaging: true, label: true, quantity: true, damage: true, expiry: true });
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

  const cols: Column<ReceiptLine>[] = [
    { key: "grn", header: "GRN", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
    {
      key: "asn",
      header: "ASN",
      cell: (r) => <span className="font-mono text-xs">{data.asns.find((a) => a.id === r.asnId)?.asnNo ?? "-"}</span>,
    },
    { key: "sku", header: tr("สินค้า", "SKU"), cell: (r) => skuLabel(data.skus.find((k) => k.id === r.skuId), lang) },
    { key: "lot", header: tr("ล็อต", "Lot"), cell: (r) => <span className="font-mono text-xs">{r.lotNo}</span> },
    { key: "exp", header: tr("หมดอายุ", "Expiry"), cell: (r) => r.expiryDate ?? "-" },
    { key: "rem", header: tr("รอตรวจ", "To inspect"), align: "right", cell: (r) => <b>{r.qty - r.qcDone}</b> },
    {
      key: "do",
      header: "",
      cell: (r) => (
        <Button size="sm" onClick={() => openDialog(r)}>
          {tr("ตรวจ QC", "Inspect")}
        </Button>
      ),
    },
  ];

  const histCols: Column<QcInspection>[] = [
    { key: "at", header: tr("เวลา", "Time"), cell: (q) => <span className="text-xs">{q.inspectedAt.slice(0, 16).replace("T", " ")}</span> },
    { key: "sku", header: tr("สินค้า", "SKU"), cell: (q) => skuLabel(data.skus.find((k) => k.id === q.skuId), lang) },
    { key: "pass", header: tr("ผ่าน", "Pass"), align: "right", cell: (q) => q.qtyPass },
    { key: "hold", header: tr("พัก", "Hold"), align: "right", cell: (q) => q.qtyHold },
    { key: "q", header: tr("กักกัน", "Quarantine"), align: "right", cell: (q) => q.qtyQuarantine },
    { key: "r", header: tr("เหตุผล", "Reason"), cell: (q) => q.reasonCode ?? "-" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("ตรวจคุณภาพ (QC)", "Quality control (QC)")}
        subtitle={tr(
          "สินค้าจะขายไม่ได้จนกว่าจะผ่าน QC: ที่ผ่านจะสร้างงานจัดเก็บ ที่ไม่ผ่านจะถูกพักหรือกักกันและไม่นับเป็นสต็อกขาย",
          "Stock cannot be sold until it passes QC. Passed units create putaway tasks; failed units go to hold or quarantine and never count as sellable.",
        )}
      />
      <DataTable columns={cols} rows={queue} rowKey={(r) => r.id} empty={tr("ไม่มีสินค้ารอ QC", "Nothing waiting for QC")} />

      <Card>
        <CardTitle>{tr("ประวัติการตรวจ", "Inspection history")}</CardTitle>
        <DataTable
          dense
          columns={histCols}
          rows={[...data.qc].reverse().slice(0, 15)}
          rowKey={(q) => q.id}
          empty={tr("ยังไม่มีประวัติ", "No history yet")}
        />
      </Card>

      <Dialog
        open={!!receipt}
        onClose={() => setOpenId(null)}
        title={receipt ? `QC · ${skuLabel(data.skus.find((k) => k.id === receipt.skuId), lang)}` : ""}
        footer={
          done !== null ? (
            <>
              <Link
                href="/console/putaway"
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
              <p className="font-semibold">{tr("บันทึกผล QC แล้ว", "QC saved")}</p>
              <p>
                {done > 0
                  ? tr(`สร้างงานจัดเก็บ ${done} งาน`, `${done} putaway task(s) created`)
                  : tr("ไม่มีสินค้าผ่าน จึงไม่มีงานจัดเก็บ", "Nothing passed - no putaway task created")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                {tr(`ค้างตรวจ ${remaining} ชิ้น · ล็อต ${receipt.lotNo}`, `${remaining} pending · lot ${receipt.lotNo}`)}
              </p>
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">{tr("รายการตรวจ", "Checklist")}</legend>
                {CHECKS.map((c) => (
                  <label key={c.key} className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5 accent-gold-deep"
                      checked={checks[c.key]}
                      onChange={(e) => setChecks({ ...checks, [c.key]: e.target.checked })}
                    />
                    {tr(c.th, c.en)}
                  </label>
                ))}
              </fieldset>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-sm font-medium">{tr("จำนวนที่ตรวจ", "Quantity inspected")}</div>
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
                  <div className="mb-1 text-sm font-medium">{tr("ผ่าน (คำนวณ)", "Pass (calculated)")}</div>
                  <Badge tone={pass > 0 ? "solid" : "neutral"}>{pass}</Badge>
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium">{tr("พัก (Hold)", "Hold")}</div>
                  <Stepper label={tr("พัก", "Hold")} value={hold} min={0} max={inspect - quarantine} onChange={setHold} />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium">{tr("กักกัน", "Quarantine")}</div>
                  <Stepper label={tr("กักกัน", "Quarantine")} value={quarantine} min={0} max={inspect - hold} onChange={setQuarantine} />
                </div>
              </div>

              {bad ? (
                <Field label={tr("เหตุผล (จำเป็น)", "Reason (required)")}>
                  <Select value={reason} onChange={(e) => setReason(e.target.value)}>
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
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
          )
        ) : null}
      </Dialog>
    </div>
  );
}
