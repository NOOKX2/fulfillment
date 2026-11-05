"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { atp } from "@/lib/domain/core";
import { skuLabel } from "@/lib/domain/format";
import type { Allocation, OrderLine } from "@/lib/domain/types";
import { localDate, localHM } from "@/lib/clock";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";
import { useToday } from "@/lib/useToday";

export function OrderDetail({ orderId }: { orderId: string }) {
  const { tr, lang, st } = useT();
  const data = useWms((s) => s.data);
  const today = useToday();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const order = data.orders.find((o) => o.id === orderId);

  if (!order) {
    return (
      <EmptyState>
        {tr("ไม่พบออเดอร์", "Order not found")}{" "}
        <Link href="/console/orders" className="text-gold-deep underline">
          {tr("กลับรายการ", "Back to list")}
        </Link>
      </EmptyState>
    );
  }

  const allocs = data.allocations.filter((a) => a.orderId === order.id && a.status !== "cancelled");
  const shipment = data.shipments.find((x) => x.orderId === order.id);
  const outbox = data.outbox.filter((o) => o.orderId === order.id);
  const ledger = data.ledger.filter((l) => l.refId === order.id).slice(-20).reverse();
  const total = order.lines.reduce((n, l) => n + l.qty * l.unitPrice, 0);
  const canCancel = !["cancelled", "packed", "ready_to_ship", "handed_over", "return_in_progress", "returned"].includes(order.status);

  const lineCols: Column<OrderLine>[] = [
    { key: "sku", header: tr("สินค้า", "SKU"), cell: (l) => skuLabel(data.skus.find((k) => k.id === l.skuId), lang) },
    { key: "qty", header: tr("จำนวน", "Qty"), align: "right", cell: (l) => <b>{l.qty}</b> },
    { key: "price", header: tr("ราคา/หน่วย", "Unit price"), align: "right", cell: (l) => `฿${l.unitPrice.toLocaleString()}` },
    {
      key: "short",
      header: tr("สต็อกพร้อมขาย (ATP)", "Available (ATP)"),
      align: "right",
      cell: (l) => {
        const a = atp(data, l.skuId, today);
        const need = order.shortBy?.[l.skuId];
        return (
          <span className="inline-flex items-center gap-2">
            <span className="tabular-nums">{a}</span>
            {need ? <Badge tone="outline" icon="!">{tr(`ขาด ${need}`, `short ${need}`)}</Badge> : null}
          </span>
        );
      },
    },
  ];

  const allocCols: Column<Allocation>[] = [
    { key: "sku", header: tr("สินค้า", "SKU"), cell: (a) => skuLabel(data.skus.find((k) => k.id === a.skuId), lang) },
    { key: "lot", header: tr("ล็อต", "Lot"), cell: (a) => <span className="font-mono text-xs">{a.lotNo}</span> },
    { key: "exp", header: tr("หมดอายุ", "Expiry"), cell: (a) => a.expiryDate ?? "-" },
    { key: "recv", header: tr("รับเข้า", "Received"), cell: (a) => <span className="text-xs">{localDate(a.receivedAt)}</span> },
    { key: "bin", header: tr("ช่อง", "Bin"), cell: (a) => <span className="font-mono text-xs">{data.bins.find((b) => b.id === a.binId)?.path}</span> },
    { key: "qty", header: tr("จำนวน", "Qty"), align: "right", cell: (a) => a.qty },
    { key: "picked", header: tr("หยิบแล้ว", "Picked"), align: "right", cell: (a) => a.picked },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.channelOrderNo}
        subtitle={`${st(order.channel)} · ${order.buyerName} · ${order.phone} · ${st(order.carrier)} · ${tr("ส่งภายใน", "ship by")} ${localHM(order.shipBy)}`}
        actions={
          <>
            <StatusPill status={order.status} />
            <StatusPill status={order.paymentStatus} />
            {order.status === "awaiting_payment" ? <Button onClick={() => actions.markPaid(order.id)}>{tr("รับชำระ", "Mark paid")}</Button> : null}
            {order.status === "awaiting_stock" ? <Button variant="secondary" onClick={() => actions.retryOrder(order.id)}>↻ {tr("ลองจองใหม่", "Retry reserve")}</Button> : null}
            {order.status === "paid_reserved" ? <Button onClick={() => actions.allocate(order.id)}>{tr("จัดสรรล็อต", "Allocate lots")}</Button> : null}
            {canCancel ? (
              confirmCancel ? (
                <>
                  <Button
                    variant="danger"
                    onClick={() => {
                      actions.cancelOrder(order.id);
                      setConfirmCancel(false);
                    }}
                  >
                    {tr("ยืนยันยกเลิก", "Confirm cancel")}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                    {tr("ไม่", "No")}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
                  {tr("ยกเลิกออเดอร์", "Cancel order")}
                </Button>
              )
            ) : null}
          </>
        }
      />

      {order.status === "awaiting_stock" ? (
        <div role="status" className="rounded-lg border-2 border-dashed border-ink bg-silver p-4 text-sm">
          <b>{tr("สต็อกขายได้ไม่พอ", "Not enough sellable stock")}</b> -{" "}
          {tr(
            "ออเดอร์จะถูกล็อกอัตโนมัติเมื่อสินค้าผ่าน QC และจัดเก็บเข้าตำแหน่งแล้ว หรือกดลองจองใหม่",
            "The order is reserved automatically once stock passes QC and is put away, or retry manually.",
          )}
        </div>
      ) : null}

      <Card>
        <CardTitle>{tr("รายการสินค้า", "Lines")}</CardTitle>
        <DataTable dense columns={lineCols} rows={order.lines} rowKey={(l) => l.id} />
        <div className="mt-2 text-right text-sm">
          {tr("รวม", "Total")} <b>฿{total.toLocaleString()}</b>
          {order.codAmount ? <span className="ml-2 text-muted">({tr("เก็บปลายทาง", "COD")} ฿{order.codAmount.toLocaleString()})</span> : null}
        </div>
        <div className="mt-2 text-sm text-muted">{order.address}</div>
      </Card>

      <Card>
        <CardTitle>{tr("ล็อตที่จัดสรร (FIFO/FEFO)", "Allocated lots (FIFO/FEFO)")}</CardTitle>
        <DataTable dense columns={allocCols} rows={allocs} rowKey={(a) => a.id} empty={tr("ยังไม่ได้จัดสรรล็อต", "No lots allocated yet")} />
      </Card>

      {shipment ? (
        <Card>
          <CardTitle>{tr("พัสดุ", "Shipment")}</CardTitle>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-mono font-semibold">{shipment.trackingNo}</span>
            <StatusPill status={shipment.status} />
            {shipment.stagingLane ? <Badge tone="outline">{tr("เลน", "Lane")} {shipment.stagingLane}</Badge> : null}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{tr("การแจ้งแพลตฟอร์ม", "Platform notifications")}</CardTitle>
          {outbox.length === 0 ? (
            <p className="text-sm text-muted">{tr("ยังไม่มี", "None yet")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {outbox.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span>
                    {e.kind === "shipped" ? tr("แจ้งส่งแล้ว + เลขพัสดุ", "Shipped + tracking") : e.kind === "cancel_ack" ? tr("ยืนยันยกเลิก", "Cancel acknowledged") : e.kind}
                  </span>
                  <StatusPill status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>{tr("ความเคลื่อนไหวสต็อกของออเดอร์นี้", "Stock movements for this order")}</CardTitle>
          {ledger.length === 0 ? (
            <p className="text-sm text-muted">{tr("ยังไม่มี", "None yet")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {ledger.map((l) => (
                <li key={l.id} className="flex flex-wrap gap-2">
                  <span className="rounded bg-silver px-2 font-mono text-xs">{l.type}</span>
                  <span>{skuLabel(data.skus.find((k) => k.id === l.skuId), lang)}</span>
                  <span className="tabular-nums">× {l.qty}</span>
                  {l.lotNo ? <span className="font-mono text-xs text-muted">{l.lotNo}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
