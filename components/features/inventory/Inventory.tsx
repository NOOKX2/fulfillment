"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, PageHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/form";
import { Tabs } from "@/components/ui/Tabs";
import { stockSummary, type StockSummary } from "@/lib/domain/core";
import { skuLabel } from "@/lib/domain/format";
import type { Sku, StockRow, StockStatus } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";
import { useToday } from "@/lib/useToday";

const LOW_STOCK = 5;

export function Inventory() {
  const { tr, lang } = useT();
  const params = useSearchParams();
  const data = useWms((s) => s.data);
  const today = useToday();
  const [tab, setTab] = useState<"sku" | "lot">("sku");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<StockStatus | "all">("all");

  const needle = q.trim().toLowerCase();
  const matches = (k: Sku | undefined) =>
    !needle ||
    (!!k &&
      (k.code.toLowerCase().includes(needle) ||
        k.name.th.toLowerCase().includes(needle) ||
        k.name.en.toLowerCase().includes(needle) ||
        k.barcodes.some((b) => b.toLowerCase().includes(needle))));

  const rows = useMemo(
    () =>
      data.skus
        .filter(matches)
        .map((k) => ({ sku: k, sum: stockSummary(data, k.id, today) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, today, needle],
  );

  const lots = useMemo(
    () =>
      data.stock
        .filter((r) => r.qty > 0)
        .filter((r) => status === "all" || r.status === status)
        .filter((r) => matches(data.skus.find((k) => k.id === r.skuId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, status, needle],
  );

  type Row = { sku: Sku; sum: StockSummary };
  const num = (n: number) => <span className={n === 0 ? "text-muted" : "font-semibold"}>{n}</span>;
  const skuCols: Column<Row>[] = [
    {
      key: "sku",
      header: tr("สินค้า", "SKU"),
      cell: ({ sku }) => (
        <div>
          <div className="font-medium">{skuLabel(sku, lang)}</div>
          <div className="font-mono text-xs text-muted">{sku.code}</div>
        </div>
      ),
    },
    { key: "onhand", header: tr("คงคลัง", "On hand"), align: "right", cell: ({ sum }) => num(sum.onHand) },
    { key: "sell", header: tr("ขายได้", "Sellable"), align: "right", cell: ({ sum }) => num(sum.sellable) },
    { key: "res", header: tr("ล็อกไว้", "Reserved"), align: "right", cell: ({ sum }) => num(sum.reserved) },
    { key: "alloc", header: tr("จัดสรรแล้ว", "Allocated"), align: "right", cell: ({ sum }) => num(sum.allocated) },
    {
      key: "atp",
      header: "ATP",
      align: "right",
      cell: ({ sum }) => (
        <span className="inline-flex items-center gap-2">
          <b className="tabular-nums">{sum.atp}</b>
          {sum.atp <= LOW_STOCK ? <Badge tone="outline" icon="!">{tr("ต่ำ", "Low")}</Badge> : null}
        </span>
      ),
    },
    { key: "qc", header: tr("รอ QC", "Pending QC"), align: "right", cell: ({ sum }) => num(sum.pendingQc) },
    { key: "hold", header: tr("พัก", "Hold"), align: "right", cell: ({ sum }) => num(sum.hold) },
    { key: "quar", header: tr("กักกัน", "Quarantine"), align: "right", cell: ({ sum }) => num(sum.quarantine) },
  ];

  const lotCols: Column<StockRow>[] = [
    {
      key: "sku",
      header: tr("สินค้า", "SKU"),
      cell: (r) => skuLabel(data.skus.find((k) => k.id === r.skuId), lang),
    },
    { key: "lot", header: tr("ล็อต", "Lot"), cell: (r) => <span className="font-mono text-xs">{r.lotNo}</span> },
    { key: "exp", header: tr("หมดอายุ", "Expiry"), cell: (r) => r.expiryDate ?? "-" },
    {
      key: "bin",
      header: tr("ช่อง", "Bin"),
      cell: (r) => <span className="font-mono text-xs">{data.bins.find((b) => b.id === r.binId)?.path ?? r.binId}</span>,
    },
    { key: "st", header: tr("สถานะ", "Status"), cell: (r) => <StatusPill status={r.status} /> },
    { key: "qty", header: tr("จำนวน", "Qty"), align: "right", cell: (r) => <b>{r.qty}</b> },
    { key: "al", header: tr("จัดสรร", "Alloc."), align: "right", cell: (r) => r.qtyAllocated },
  ];

  const statuses: StockStatus[] = [
    "sellable", "pending_qc", "hold", "quarantine", "return_pending", "repack", "rtv", "destroy",
  ];
  const { st } = useT();

  return (
    <div>
      <PageHeader
        title={tr("สต็อกคงคลัง", "Inventory")}
        subtitle={tr(
          "ATP = ยอดขายได้ในช่องหยิบ ลบยอดที่จัดสรรและล็อกไว้ ไม่นับสินค้ากักกัน/พัก/ใกล้หมดอายุ",
          "ATP = sellable stock in pickable bins minus allocations and active reservations. Quarantine, hold and near-expiry lots are excluded.",
        )}
      />
      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <Field label={tr("ค้นหาสินค้า", "Search SKU")} className="min-w-56 flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("รหัส ชื่อ หรือบาร์โค้ด", "Code, name or barcode")} />
        </Field>
        {tab === "lot" ? (
          <Field label={tr("สถานะสต็อก", "Stock status")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as StockStatus | "all")}>
              <option value="all">{tr("ทั้งหมด", "All")}</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {st(s)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </Card>
      <Tabs
        tabs={[
          { key: "sku" as const, label: tr("ตามสินค้า", "By SKU"), count: rows.length },
          { key: "lot" as const, label: tr("ตามล็อต/ช่อง", "By lot / bin"), count: lots.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "sku" ? (
        <DataTable dense columns={skuCols} rows={rows} rowKey={(r) => r.sku.id} empty={tr("ไม่พบสินค้า", "No SKUs found")} />
      ) : (
        <DataTable dense columns={lotCols} rows={lots} rowKey={(r) => r.id} empty={tr("ไม่มีสต็อก", "No stock")} />
      )}
    </div>
  );
}
