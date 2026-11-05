"use client";

import Link from "next/link";
import { StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, Stat } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { localDate, localHM } from "@/lib/clock";
import type { OutboxEvent } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

const KIND_LABEL: Record<OutboxEvent["kind"], [string, string]> = {
  shipped: ["แจ้งจัดส่งแล้ว", "Shipped"],
  cancel_ack: ["ยืนยันยกเลิก", "Cancel ack"],
  return_received: ["แจ้งรับของคืน", "Return received"],
  stock_sync: ["ซิงก์สต็อก", "Stock sync"],
};

export function OutboxPage() {
  const { tr, st } = useT();
  const data = useWms((s) => s.data);
  const events = [...data.outbox].reverse();
  const count = (s: OutboxEvent["status"]) => data.outbox.filter((e) => e.status === s).length;
  const failed = data.outbox.filter((e) => e.status === "failed");

  const cols: Column<OutboxEvent>[] = [
    { key: "t", header: tr("เวลา", "Time"), cell: (e) => `${localDate(e.createdAt)} ${localHM(e.createdAt)}` },
    { key: "ch", header: tr("ช่องทาง", "Channel"), cell: (e) => st(e.channel) },
    { key: "kind", header: tr("เหตุการณ์", "Event"), cell: (e) => tr(...KIND_LABEL[e.kind]) },
    {
      key: "order",
      header: tr("ออเดอร์", "Order"),
      cell: (e) => {
        const o = data.orders.find((x) => x.id === e.orderId);
        return o ? (
          <Link className="underline" href={`/console/orders/${o.id}`}>
            {o.channelOrderNo}
          </Link>
        ) : (
          "-"
        );
      },
    },
    { key: "trk", header: tr("เลขพัสดุ", "Tracking"), cell: (e) => <span className="font-mono">{e.payload.trackingNo ?? "-"}</span> },
    { key: "status", header: tr("สถานะ", "Status"), cell: (e) => <StatusPill status={e.status} /> },
    { key: "att", header: tr("ครั้ง", "Tries"), cell: (e) => e.attempts, align: "right" },
    { key: "err", header: tr("ข้อผิดพลาด", "Error"), cell: (e) => e.lastError ?? "-" },
    {
      key: "act",
      header: "",
      cell: (e) =>
        e.status === "failed" ? (
          <Button size="sm" onClick={() => actions.outboxRetry(e.id)}>
            ↻ {tr("ลองส่งใหม่", "Retry")}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("Outbox – แจ้งสถานะกลับช่องทางขาย", "Outbox - channel status pushes")}
        subtitle={tr(
          "จำลองการส่ง API ไป Shopee / Lazada / TikTok เมื่อส่งมอบพัสดุ ถ้าส่งไม่สำเร็จจะค้างที่นี่จนกว่าจะกดลองส่งใหม่ (ไม่มีการเรียก API จริงในเวอร์ชันเดโม)",
          "Simulated API pushes to Shopee / Lazada / TikTok after handover. Failed pushes wait here until retried (no real API calls in this demo).",
        )}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={tr("รอส่ง", "Queued")} value={count("queued") + count("sending")} />
        <Stat label={tr("ส่งสำเร็จ", "Sent")} value={count("sent")} />
        <Stat label={tr("ล้มเหลว", "Failed")} value={count("failed")} />
        <Stat label={tr("ทั้งหมด", "Total")} value={data.outbox.length} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-gold-deep"
              checked={data.settings.failOutboxNext}
              onChange={(e) => actions.setSetting("failOutboxNext", e.target.checked)}
            />
            <span>
              <b>{tr("ให้การส่งครั้งถัดไปล้มเหลว", "Fail the next push")}</b>
              <span className="block text-xs text-muted">{tr("ใช้ทดสอบการลองส่งซ้ำ", "For testing retry")}</span>
            </span>
          </label>
          <Button
            variant="secondary"
            disabled={failed.length === 0}
            onClick={() => failed.forEach((e) => actions.outboxRetry(e.id))}
          >
            ↻ {tr("ลองส่งใหม่ทั้งหมด", "Retry all failed")} ({failed.length})
          </Button>
        </div>
      </Card>
      <DataTable columns={cols} rows={events} rowKey={(e) => e.id} empty={tr("ยังไม่มีเหตุการณ์ – ส่งมอบพัสดุเพื่อสร้าง", "No events yet - hand over a manifest to create some.")} />
    </div>
  );
}
