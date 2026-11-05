"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs } from "@/components/ui/Tabs";
import { localHM } from "@/lib/clock";
import type { Order, OrderStatus } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

type TabKey = "all" | "payment" | "stock" | "ready" | "process" | "done" | "cancelled";

const GROUPS: Record<Exclude<TabKey, "all">, OrderStatus[]> = {
  payment: ["awaiting_payment"],
  stock: ["awaiting_stock"],
  ready: ["paid_reserved"],
  process: ["allocated", "in_wave", "picking", "picked", "packing", "packed", "ready_to_ship"],
  done: ["handed_over", "return_in_progress", "returned"],
  cancelled: ["cancelled"],
};

export function OrdersList() {
  const { tr, st } = useT();
  const data = useWms((s) => s.data);
  const [tab, setTab] = useState<TabKey>("all");

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: data.orders.length, payment: 0, stock: 0, ready: 0, process: 0, done: 0, cancelled: 0 };
    for (const o of data.orders) {
      for (const [k, v] of Object.entries(GROUPS)) if (v.includes(o.status)) c[k as TabKey]++;
    }
    return c;
  }, [data.orders]);

  const rows = data.orders
    .filter((o) => tab === "all" || GROUPS[tab].includes(o.status))
    .sort((a, b) => (a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : a.createdAt < b.createdAt ? 1 : -1));

  const cols: Column<Order>[] = [
    {
      key: "no",
      header: tr("ออเดอร์", "Order"),
      cell: (o) => (
        <Link href={`/console/orders/${o.id}`} className="font-mono text-xs font-semibold text-gold-deep underline underline-offset-2">
          {o.channelOrderNo}
        </Link>
      ),
    },
    { key: "ch", header: tr("ช่องทาง", "Channel"), cell: (o) => st(o.channel) },
    { key: "buyer", header: tr("ผู้ซื้อ", "Buyer"), cell: (o) => o.buyerName },
    { key: "items", header: tr("ชิ้น", "Items"), align: "right", cell: (o) => o.lines.reduce((n, l) => n + l.qty, 0) },
    { key: "car", header: tr("ขนส่ง", "Carrier"), cell: (o) => st(o.carrier) },
    { key: "by", header: tr("ส่งภายใน", "Ship by"), cell: (o) => <span className="tabular-nums">{localHM(o.shipBy)}</span> },
    {
      key: "pay",
      header: tr("ชำระเงิน", "Payment"),
      cell: (o) => <StatusPill status={o.paymentStatus} />,
    },
    { key: "st", header: tr("สถานะ", "Status"), cell: (o) => <StatusPill status={o.status} /> },
    {
      key: "do",
      header: "",
      cell: (o) => (
        <div className="flex gap-1">
          {o.status === "awaiting_payment" ? (
            <Button size="sm" onClick={() => actions.markPaid(o.id)}>
              {tr("รับชำระ", "Mark paid")}
            </Button>
          ) : null}
          {o.status === "awaiting_stock" ? (
            <Button size="sm" variant="secondary" onClick={() => actions.retryOrder(o.id)}>
              ↻ {tr("ลองใหม่", "Retry")}
            </Button>
          ) : null}
          {o.status === "paid_reserved" ? (
            <Button size="sm" onClick={() => actions.allocate(o.id)}>
              {tr("จัดสรรล็อต", "Allocate")}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: tr("ทั้งหมด", "All") },
    { key: "payment", label: tr("รอชำระ", "Awaiting payment") },
    { key: "stock", label: tr("รอสต็อก", "Awaiting stock") },
    { key: "ready", label: tr("ล็อกแล้ว", "Reserved") },
    { key: "process", label: tr("กำลังดำเนินการ", "In process") },
    { key: "done", label: tr("ส่งมอบ/คืน", "Shipped / returned") },
    { key: "cancelled", label: tr("ยกเลิก", "Cancelled") },
  ];

  return (
    <div>
      <PageHeader
        title={tr("คำสั่งซื้อ", "Orders")}
        subtitle={tr(
          "ดึงออเดอร์จาก Shopee / Lazada / TikTok / เว็บไซต์ (จำลอง) ออเดอร์ที่ชำระแล้วจะล็อกสต็อกทันทีแบบทั้งหมดหรือไม่เลย จากนั้นจัดสรรล็อตแบบ FIFO/FEFO",
          "Pull orders from Shopee / Lazada / TikTok / website (simulated). Paid orders lock stock all-or-nothing, then lots are allocated FIFO/FEFO.",
        )}
        actions={
          <>
            <Badge tone="dashed">{tr("จำลอง", "Simulated")}</Badge>
            <Button onClick={() => actions.syncOrders(3)}>⇣ {tr("ดึงออเดอร์ใหม่ 3 รายการ", "Pull 3 new orders")}</Button>
          </>
        }
      />
      <Tabs tabs={tabs.map((t) => ({ ...t, count: counts[t.key] }))} value={tab} onChange={setTab} />
      <DataTable dense columns={cols} rows={rows} rowKey={(o) => o.id} empty={tr("ไม่มีออเดอร์ในหมวดนี้", "No orders here")} />
    </div>
  );
}
