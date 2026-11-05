"use client";

import { useMemo, useState } from "react";
import { ScanInput } from "@/components/scan/ScanInput";
import { ScanSimulator, type SimChip } from "@/components/scan/ScanSimulator";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, ProgressBar } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/form";
import { skuLabel } from "@/lib/domain/format";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

interface Pending {
  raw: string;
  qty: number;
  needInfo: boolean;
  needOver: boolean;
  lot: string;
  expiry: string;
}

/** Barcode receiving against an ASN. Used by the console detail page and the PDA. */
export function ReceivePanel({ asnId, pda = false }: { asnId: string; pda?: boolean }) {
  const { tr, lang } = useT();
  const asn = useWms((s) => s.data.asns.find((a) => a.id === asnId));
  const skus = useWms((s) => s.data.skus);
  const [qtyText, setQtyText] = useState("1");
  const [last, setLast] = useState<{ label: string; received: number; expected: number; over: boolean } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const qty = Math.max(1, Math.floor(Number(qtyText) || 1));
  const closed = !asn || asn.status === "closed" || asn.status === "closed_with_discrepancy";

  const submit = (raw: string, q: number, extra?: { lotNo?: string; expiryDate?: string; confirmOver?: boolean }) => {
    const res = actions.receive({ asnId, raw, qty: q, ...extra });
    if (res.ok) {
      setPending(null);
      const k = skus.find((x) => x.id === res.data.skuId);
      setLast({
        label: skuLabel(k, lang),
        received: res.data.receivedQty,
        expected: res.data.expectedQty,
        over: res.data.over,
      });
      return;
    }
    if (res.code === "OVER_RECEIPT_CONFIRM") {
      setPending((p) => ({ raw, qty: q, needInfo: false, needOver: true, lot: p?.lot ?? "", expiry: p?.expiry ?? "" }));
    } else if (res.code === "LOT_REQUIRED" || res.code === "EXPIRY_REQUIRED") {
      setPending({ raw, qty: q, needInfo: true, needOver: false, lot: "", expiry: "" });
    } else {
      setPending(null);
    }
  };

  const chips = useMemo<SimChip[]>(() => {
    if (!asn) return [];
    const onAsn = new Set(asn.lines.map((l) => l.skuId));
    const list: SimChip[] = asn.lines.map((l) => {
      const k = skus.find((x) => x.id === l.skuId);
      return { label: skuLabel(k, lang), value: k?.barcodes[0] ?? "" };
    });
    const stranger = skus.find((k) => !onAsn.has(k.id));
    if (stranger) {
      list.push({
        label: `${tr("ไม่อยู่ใน ASN", "Not on ASN")}: ${skuLabel(stranger, lang)}`,
        value: stranger.barcodes[0],
        wrong: true,
      });
    }
    return list.filter((c) => c.value);
  }, [asn, skus, lang, tr]);

  if (!asn) return null;
  const dark = pda;

  return (
    <div className="space-y-4">
      <Card dark={dark}>
        <CardTitle>{tr("สแกนรับสินค้า", "Scan to receive")}</CardTitle>
        {closed ? (
          <p className="text-sm">{tr("ASN นี้ปิดแล้ว ไม่สามารถรับเพิ่มได้", "This ASN is closed - no more receiving.")}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <ScanInput pda={pda} onScan={(raw) => submit(raw, qty)} label={tr("สแกนบาร์โค้ดสินค้า", "Scan item barcode")} />
              </div>
              <Field label={tr("จำนวนต่อการสแกน", "Qty per scan")} className="w-32">
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={qtyText}
                  onChange={(e) => setQtyText(e.target.value)}
                  className="text-ink"
                />
              </Field>
            </div>

            {pending?.needInfo ? (
              <div className="rounded-lg border-2 border-gold p-3">
                <div className="mb-2 text-sm font-semibold">
                  {tr("สินค้านี้ต้องระบุล็อต/วันหมดอายุ", "This item needs a lot / expiry")}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label={tr("เลขล็อต", "Lot no.")}>
                    <Input value={pending.lot} onChange={(e) => setPending({ ...pending, lot: e.target.value })} />
                  </Field>
                  <Field label={tr("วันหมดอายุ", "Expiry date")}>
                    <Input type="date" value={pending.expiry} onChange={(e) => setPending({ ...pending, expiry: e.target.value })} />
                  </Field>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => submit(pending.raw, pending.qty, { lotNo: pending.lot, expiryDate: pending.expiry || undefined })}
                  >
                    {tr("บันทึกและรับ", "Save and receive")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setPending(null)}>
                    {tr("ยกเลิก", "Cancel")}
                  </Button>
                </div>
              </div>
            ) : null}

            {pending?.needOver ? (
              <div role="alert" className="rounded-lg border-2 border-dashed border-gold p-3">
                <p className="mb-2 text-sm font-semibold">
                  {tr("รับเกินยอด ASN – ยืนยันเพื่อบันทึกส่วนเกินเป็นส่วนต่าง", "Over the ASN quantity - confirm to log the excess as a discrepancy.")}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      submit(pending.raw, pending.qty, {
                        confirmOver: true,
                        lotNo: pending.lot || undefined,
                        expiryDate: pending.expiry || undefined,
                      })
                    }
                  >
                    {tr("ยืนยันรับเกิน", "Confirm over-receipt")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setPending(null)} onDark={dark}>
                    {tr("ยกเลิก", "Cancel")}
                  </Button>
                </div>
              </div>
            ) : null}

            <div aria-live="polite" className="min-h-6 text-sm">
              {last ? (
                <span>
                  ✓ {last.label}: <b className="tabular-nums">{last.received}</b> / {last.expected}
                  {last.over ? <b> · {tr("เกินยอด", "over")}</b> : null}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      <Card dark={dark}>
        <CardTitle>{tr("ความคืบหน้ารายการ", "Line progress")}</CardTitle>
        <ul className="space-y-3">
          {asn.lines.map((l) => {
            const k = skus.find((x) => x.id === l.skuId);
            return (
              <li key={l.id}>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{skuLabel(k, lang)}</span>
                  <span className="tabular-nums">
                    <b>{l.receivedQty}</b> / {l.expectedQty}
                    {l.lotNo ? <span className={`ml-2 font-mono text-xs ${dark ? "text-silver-metal" : "text-muted"}`}>{l.lotNo}</span> : null}
                  </span>
                </div>
                <ProgressBar value={l.receivedQty} max={l.expectedQty} />
              </li>
            );
          })}
        </ul>
      </Card>

      {!closed ? <ScanSimulator chips={chips} onScan={(raw) => submit(raw, qty)} dark={dark} /> : null}
    </div>
  );
}
