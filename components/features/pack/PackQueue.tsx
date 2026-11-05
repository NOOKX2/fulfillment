"use client";

import Link from "next/link";
import { useState } from "react";
import { PrintSheet } from "@/components/print/PrintSheet";
import { StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, PageHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { localHM } from "@/lib/clock";
import type { Order, Shipment } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";
import { AirwayBill } from "./AirwayBill";

export function PackQueue() {
  const { tr, st } = useT();
  const data = useWms((s) => s.data);
  const [viewId, setViewId] = useState<string | null>(null);

  const ready = data.orders.filter((o) => o.status === "picked" || o.status === "packing");
  const shipments = [...data.shipments].reverse().slice(0, 30);

  const orderCols: Column<Order>[] = [
    { key: "no", header: tr("ออเดอร์", "Order"), cell: (o) => <span className="font-mono text-xs font-semibold">{o.channelOrderNo}</span> },
    { key: "buyer", header: tr("ผู้ซื้อ", "Buyer"), cell: (o) => o.buyerName },
    { key: "items", header: tr("ชิ้น", "Items"), align: "right", cell: (o) => o.lines.reduce((n, l) => n + l.qty, 0) },
    { key: "car", header: tr("ขนส่ง", "Carrier"), cell: (o) => st(o.carrier) },
    { key: "by", header: tr("ส่งภายใน", "Ship by"), cell: (o) => localHM(o.shipBy) },
    { key: "st", header: tr("สถานะ", "Status"), cell: (o) => <StatusPill status={o.status} /> },
  ];

  const shipCols: Column<Shipment>[] = [
    { key: "trk", header: tr("เลขพัสดุ", "Tracking"), cell: (x) => <span className="font-mono text-xs font-semibold">{x.trackingNo}</span> },
    { key: "ord", header: tr("ออเดอร์", "Order"), cell: (x) => data.orders.find((o) => o.id === x.orderId)?.channelOrderNo ?? "-" },
    { key: "car", header: tr("ขนส่ง", "Carrier"), cell: (x) => st(x.carrier) },
    { key: "w", header: "kg", align: "right", cell: (x) => (x.weightG / 1000).toFixed(2) },
    { key: "re", header: tr("พิมพ์ซ้ำ", "Reprints"), align: "right", cell: (x) => x.reprintCount },
    { key: "st", header: tr("สถานะ", "Status"), cell: (x) => <StatusPill status={x.status} /> },
    {
      key: "do",
      header: "",
      cell: (x) => (
        <Button size="sm" variant="secondary" onClick={() => setViewId(x.id)}>
          {tr("ดูใบปะหน้า", "View label")}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("คิวแพ็ก", "Pack queue")}
        subtitle={tr("ออเดอร์ที่หยิบเสร็จและรอแพ็ก และใบปะหน้าที่ออกแล้ว", "Picked orders waiting to be packed, and labels already issued.")}
        actions={
          <Link
            href="/console/pack/bench"
            className="inline-flex min-h-11 items-center rounded-control bg-gold px-4 text-sm font-semibold text-ink"
          >
            ⚑ {tr("ไปโต๊ะแพ็ก", "Open pack bench")}
          </Link>
        }
      />
      <DataTable columns={orderCols} rows={ready} rowKey={(o) => o.id} empty={tr("ไม่มีออเดอร์รอแพ็ก", "Nothing waiting to pack")} />
      <Card>
        <CardTitle>{tr("ใบปะหน้าที่ออกแล้ว", "Issued labels")}</CardTitle>
        <DataTable dense columns={shipCols} rows={shipments} rowKey={(x) => x.id} empty={tr("ยังไม่มี", "None yet")} />
      </Card>

      <Dialog
        open={!!viewId}
        onClose={() => setViewId(null)}
        title={tr("ใบปะหน้า", "Airway bill")}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (viewId) actions.reprint(viewId);
                window.print();
              }}
            >
              🖨 {tr("พิมพ์ซ้ำ", "Reprint")}
            </Button>
            <Button onClick={() => setViewId(null)}>{tr("ปิด", "Close")}</Button>
          </>
        }
      >
        {viewId ? (
          <div className="overflow-x-auto">
            <AirwayBill shipmentId={viewId} />
          </div>
        ) : null}
      </Dialog>
      {viewId ? (
        <PrintSheet page="awb">
          <AirwayBill shipmentId={viewId} />
        </PrintSheet>
      ) : null}
    </div>
  );
}
