"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { skuLabel } from "@/lib/domain/format";
import type { DiscrepancyType, ReceiptLine } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";
import { DiscrepancyList } from "./DiscrepancyList";
import { ReceivePanel } from "./ReceivePanel";

export function AsnDetail({ asnId }: { asnId: string }) {
  const { tr, l, lang, st } = useT();
  const data = useWms((s) => s.data);
  const asn = data.asns.find((a) => a.id === asnId);
  const [confirmClose, setConfirmClose] = useState<number | null>(null);
  const [excOpen, setExcOpen] = useState(false);
  const [excType, setExcType] = useState<DiscrepancyType>("damaged");
  const [excSku, setExcSku] = useState("");
  const [excBarcode, setExcBarcode] = useState("");
  const [excNote, setExcNote] = useState("");

  if (!asn) {
    return (
      <EmptyState>
        {tr("ไม่พบ ASN นี้", "ASN not found")}{" "}
        <Link href="/console/inbound" className="text-gold-deep underline">
          {tr("กลับรายการ", "Back to list")}
        </Link>
      </EmptyState>
    );
  }

  const supplier = data.suppliers.find((x) => x.id === asn.supplierId);
  const po = data.pos.find((p) => p.id === asn.poId);
  const closed = asn.status === "closed" || asn.status === "closed_with_discrepancy";
  const receipts = data.receipts.filter((r) => r.asnId === asn.id);

  const close = (acknowledge: boolean) => {
    const res = actions.closeAsn({ asnId: asn.id, acknowledge });
    if (res.ok) setConfirmClose(null);
    else if (res.code === "DISCREPANCY_UNACK") setConfirmClose(Number(res.detail) || 1);
  };

  const receiptCols: Column<ReceiptLine>[] = [
    { key: "grn", header: "GRN", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: "sku", header: tr("สินค้า", "SKU"), cell: (r) => skuLabel(data.skus.find((k) => k.id === r.skuId), lang) },
    { key: "lot", header: tr("ล็อต", "Lot"), cell: (r) => <span className="font-mono text-xs">{r.lotNo}</span> },
    { key: "exp", header: tr("หมดอายุ", "Expiry"), cell: (r) => r.expiryDate ?? "-" },
    { key: "qty", header: tr("รับ", "Received"), align: "right", cell: (r) => r.qty },
    { key: "qc", header: tr("ตรวจแล้ว", "Inspected"), align: "right", cell: (r) => r.qcDone },
    {
      key: "st",
      header: "QC",
      cell: (r) => (
        <span className="text-sm">
          {r.qcStatus === "done" ? tr("เสร็จ", "Done") : r.qcStatus === "in_progress" ? tr("กำลังตรวจ", "In progress") : tr("รอตรวจ", "Pending")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`ASN ${asn.asnNo}`}
        subtitle={`${supplier ? l(supplier.name) : ""} · PO ${po?.poNo ?? "-"} · ${tr("คาดว่าจะถึง", "expected")} ${asn.expectedAt}${asn.dockDoor ? ` · ${tr("ประตู", "dock")} ${asn.dockDoor}` : ""}`}
        actions={
          <>
            <StatusPill status={asn.status} />
            <Button variant="secondary" onClick={() => setExcOpen(true)} disabled={closed}>
              {tr("บันทึกข้อยกเว้น", "Log exception")}
            </Button>
            <Button onClick={() => close(false)} disabled={closed}>
              {tr("ปิด ASN", "Close ASN")}
            </Button>
          </>
        }
      />

      {confirmClose !== null ? (
        <div role="alert" className="rounded-lg border-2 border-dashed border-ink bg-silver p-4">
          <p className="mb-3 text-sm font-semibold">
            {tr(
              `ยังมีส่วนต่าง ${confirmClose} รายการที่ยังไม่ได้รับทราบ – ปิด ASN พร้อมรับทราบทั้งหมด?`,
              `${confirmClose} discrepancies are still open - close the ASN and acknowledge them all?`,
            )}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => close(true)}>{tr("รับทราบและปิด", "Acknowledge and close")}</Button>
            <Button variant="secondary" onClick={() => setConfirmClose(null)}>
              {tr("ยกเลิก", "Cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      <ReceivePanel asnId={asn.id} />

      <Card>
        <CardTitle>{tr("ส่วนต่างของ ASN นี้", "Discrepancies on this ASN")}</CardTitle>
        <DiscrepancyList asnId={asn.id} />
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{tr("ใบรับสินค้า (GRN)", "Goods receipts (GRN)")}</h2>
          <Link href="/console/inbound/qc" className="text-sm text-gold-deep underline underline-offset-2">
            {tr("ไปหน้า QC →", "Go to QC →")}
          </Link>
        </div>
        <DataTable dense columns={receiptCols} rows={receipts} rowKey={(r) => r.id} empty={tr("ยังไม่มีการรับ", "Nothing received yet")} />
      </Card>

      <Dialog
        open={excOpen}
        onClose={() => setExcOpen(false)}
        title={tr("บันทึกข้อยกเว้นการรับ", "Log receiving exception")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setExcOpen(false)}>
              {tr("ยกเลิก", "Cancel")}
            </Button>
            <Button
              onClick={() => {
                const res = actions.logDiscrepancy({
                  asnId: asn.id,
                  type: excType,
                  skuId: excSku || undefined,
                  scannedBarcode: excBarcode.trim() || undefined,
                  note: excNote.trim() || undefined,
                });
                if (res.ok) {
                  setExcOpen(false);
                  setExcNote("");
                  setExcBarcode("");
                  setExcSku("");
                }
              }}
            >
              {tr("บันทึก", "Save")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={tr("ประเภท", "Type")}>
            <Select value={excType} onChange={(e) => setExcType(e.target.value as DiscrepancyType)}>
              {(["damaged", "wrong_item", "no_asn_line"] as const).map((t) => (
                <option key={t} value={t}>
                  {st(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tr("สินค้า (ถ้าระบุได้)", "SKU (if known)")}>
            <Select value={excSku} onChange={(e) => setExcSku(e.target.value)}>
              <option value="">{tr("ไม่ระบุ", "Unknown")}</option>
              {data.skus.map((k) => (
                <option key={k.id} value={k.id}>
                  {skuLabel(k, lang)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tr("บาร์โค้ดที่สแกน", "Scanned barcode")}>
            <Input value={excBarcode} onChange={(e) => setExcBarcode(e.target.value)} />
          </Field>
          <Field label={tr("หมายเหตุ", "Note")}>
            <Textarea value={excNote} onChange={(e) => setExcNote(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
