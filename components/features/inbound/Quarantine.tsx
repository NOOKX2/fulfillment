"use client";

import { useState } from "react";
import { StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, PageHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Stepper } from "@/components/ui/Stepper";
import { skuLabel } from "@/lib/domain/format";
import type { StockRow } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

type Target = "sellable" | "quarantine" | "rtv" | "destroy";

export function Quarantine() {
  const { tr, lang, st } = useT();
  const data = useWms((s) => s.data);
  const [rowId, setRowId] = useState<string | null>(null);
  const [to, setTo] = useState<Target>("sellable");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");

  const held = data.stock.filter((r) => (r.status === "hold" || r.status === "quarantine") && r.qty > 0);
  const out = data.stock.filter((r) => (r.status === "rtv" || r.status === "destroy") && r.qty > 0);
  const row = data.stock.find((r) => r.id === rowId) ?? null;

  const options = (r: StockRow): Target[] =>
    r.status === "hold" ? ["sellable", "quarantine", "rtv", "destroy"] : ["rtv", "destroy"];

  const open = (r: StockRow) => {
    setRowId(r.id);
    setTo(options(r)[0]);
    setQty(r.qty);
    setReason("");
  };

  const cols = (withAction: boolean): Column<StockRow>[] => [
    { key: "sku", header: tr("สินค้า", "SKU"), cell: (r) => skuLabel(data.skus.find((k) => k.id === r.skuId), lang) },
    { key: "lot", header: tr("ล็อต", "Lot"), cell: (r) => <span className="font-mono text-xs">{r.lotNo}</span> },
    { key: "bin", header: tr("ช่อง", "Bin"), cell: (r) => <span className="font-mono text-xs">{data.bins.find((b) => b.id === r.binId)?.path}</span> },
    { key: "st", header: tr("สถานะ", "Status"), cell: (r) => <StatusPill status={r.status} /> },
    { key: "qty", header: tr("จำนวน", "Qty"), align: "right", cell: (r) => <b>{r.qty}</b> },
    ...(withAction
      ? [
          {
            key: "do",
            header: "",
            cell: (r: StockRow) => (
              <Button size="sm" onClick={() => open(r)}>
                {tr("จัดการ", "Disposition")}
              </Button>
            ),
          } satisfies Column<StockRow>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("กักกัน / พักสินค้า", "Quarantine / hold")}
        subtitle={tr(
          "สินค้าในหน้านี้ไม่ถูกนับเป็นสต็อกขาย การปล่อยหรือส่งคืน/ทำลายต้องระบุเหตุผลและถูกบันทึกในสมุดบัญชีสต็อก",
          "Stock here is never sellable. Releasing, returning or destroying needs a reason and is written to the stock ledger.",
        )}
      />
      <DataTable columns={cols(true)} rows={held} rowKey={(r) => r.id} empty={tr("ไม่มีสินค้ากักกัน/พัก", "Nothing in hold or quarantine")} />

      <Card>
        <CardTitle>{tr("รอส่งคืนซัพพลายเออร์ / ทำลาย", "Awaiting RTV / destruction")}</CardTitle>
        <DataTable dense columns={cols(false)} rows={out} rowKey={(r) => r.id} empty={tr("ไม่มี", "None")} />
      </Card>

      <Dialog
        open={!!row}
        onClose={() => setRowId(null)}
        title={row ? skuLabel(data.skus.find((k) => k.id === row.skuId), lang) : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRowId(null)}>
              {tr("ยกเลิก", "Cancel")}
            </Button>
            <Button
              disabled={!reason.trim() || qty < 1}
              onClick={() => {
                if (!row) return;
                const res = actions.releaseStock({ rowId: row.id, qty, to, reason: reason.trim() });
                if (res.ok) setRowId(null);
              }}
            >
              {tr("ยืนยัน", "Confirm")}
            </Button>
          </>
        }
      >
        {row ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              <StatusPill status={row.status} /> · {tr("จำนวนในแถว", "qty in row")} {row.qty}
            </p>
            <Field label={tr("ดำเนินการ", "Action")}>
              <Select value={to} onChange={(e) => setTo(e.target.value as Target)}>
                {options(row).map((o) => (
                  <option key={o} value={o}>
                    {o === "sellable" ? tr("ปล่อยเป็นสต็อกขาย (ต้องจัดเก็บใหม่)", "Release to sellable (needs putaway)") : st(o)}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <div className="mb-1 text-sm font-medium">{tr("จำนวน", "Quantity")}</div>
              <Stepper label={tr("จำนวน", "Quantity")} value={qty} min={1} max={row.qty} onChange={setQty} />
            </div>
            <Field label={tr("เหตุผล (จำเป็น)", "Reason (required)")}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
