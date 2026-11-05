"use client";

import { useState } from "react";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { localHM } from "@/lib/clock";
import { skuLabel } from "@/lib/domain/format";
import { routeDistance } from "@/lib/domain/routing";
import type { PickTask, Wave } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";
import { PickFlow } from "./PickFlow";

export function WavesBoard() {
  const { tr, lang, st } = useT();
  const data = useWms((s) => s.data);
  const [pickId, setPickId] = useState<string | null>(null);

  const readyCount = data.orders.filter((o) => (o.status === "paid_reserved" || o.status === "allocated") && !o.waveId).length;
  const waves = [...data.waves].filter((w) => w.status !== "cancelled").sort((a, b) => b.id.localeCompare(a.id));
  const seqOf = (binId: string) => data.bins.find((b) => b.id === binId)?.pickSeq ?? 0;

  const taskCols: Column<PickTask>[] = [
    { key: "seq", header: "#", align: "right", cell: (t) => t.seq },
    { key: "bin", header: tr("ช่อง", "Bin"), cell: (t) => <span className="font-mono text-xs">{data.bins.find((b) => b.id === t.binId)?.path}</span> },
    { key: "sku", header: tr("สินค้า", "SKU"), cell: (t) => skuLabel(data.skus.find((k) => k.id === t.skuId), lang) },
    { key: "lot", header: tr("ล็อต", "Lot"), cell: (t) => <span className="font-mono text-xs">{t.lotNo}</span> },
    { key: "qty", header: tr("หยิบ/ต้องหยิบ", "Picked / need"), align: "right", cell: (t) => `${t.pickedQty} / ${t.qty}` },
    { key: "tote", header: tr("ตะกร้า", "Tote"), cell: (t) => <span className="font-mono text-xs">{t.toteId}</span> },
    { key: "st", header: tr("สถานะ", "Status"), cell: (t) => <StatusPill status={t.status} /> },
  ];

  const renderWave = (w: Wave) => {
    const tasks = data.pickTasks.filter((t) => t.waveId === w.id).sort((a, b) => a.seq - b.seq);
    const routed = routeDistance(tasks.map((t) => seqOf(t.binId)));
    const naive = routeDistance(
      data.allocations
        .filter((a) => w.orderIds.includes(a.orderId) && a.status !== "cancelled")
        .map((a) => seqOf(a.binId)),
    );
    return (
      <Card key={w.id} className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{w.name}</h2>
              <StatusPill status={w.status} />
            </div>
            <div className="text-sm text-muted">
              {st(w.strategy)} · {w.carrier ? st(w.carrier) : ""} · {w.orderIds.length} {tr("ออเดอร์", "orders")}
              {w.cutoffAt ? ` · cut-off ${localHM(w.cutoffAt)}` : ""} ·{" "}
              {w.pickMode === "batch_by_sku" ? tr("หยิบรวมตาม SKU", "Batch by SKU") : tr("หยิบทีละออเดอร์", "Discrete order")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {w.status === "draft" ? (
              <>
                <Button onClick={() => actions.releaseWave(w.id)}>{tr("ปล่อยรอบหยิบ", "Release wave")}</Button>
                <Button variant="secondary" onClick={() => actions.cancelWave(w.id)}>
                  {tr("ยกเลิกรอบ", "Cancel wave")}
                </Button>
              </>
            ) : null}
            {w.status === "released" || w.status === "picking" ? (
              <Button onClick={() => setPickId(w.id)}>{tr("หยิบบนหน้านี้", "Pick on screen")}</Button>
            ) : null}
            {w.status === "picked" ? <Button variant="secondary" onClick={() => actions.closeWave(w.id)}>{tr("ปิดรอบ", "Close wave")}</Button> : null}
          </div>
        </div>

        {w.status === "draft" ? (
          <ul className="flex flex-wrap gap-2 text-sm">
            {w.orderIds.map((id) => {
              const o = data.orders.find((x) => x.id === id);
              return (
                <li key={id} className="flex items-center gap-1 rounded-full border border-silver-metal px-3 py-1">
                  <span className="font-mono text-xs">{o?.channelOrderNo}</span>
                  <button
                    type="button"
                    aria-label={tr("เอาออกจากรอบ", "Remove from wave")}
                    className="px-1 text-muted hover:text-ink"
                    onClick={() => actions.removeFromWave(w.id, id)}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="neutral">
                {tr("ระยะเดินตามเส้นทาง", "Route distance")} {routed}
              </Badge>
              <Badge tone="dashed">
                {tr("ถ้าหยิบตามลำดับออเดอร์", "if picked in order sequence")} {naive}
              </Badge>
            </div>
            <DataTable dense columns={taskCols} rows={tasks} rowKey={(t) => t.id} />
          </>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={tr("รอบหยิบ (Wave)", "Wave picking")}
        subtitle={tr(
          "จัดกลุ่มออเดอร์ตามประเภทบรรจุและขนส่ง: ซองชิ้นเดียวหยิบรวมตาม SKU, ซองหลายชิ้นหยิบรวม, กล่องใหญ่หยิบทีละออเดอร์ จุดหยิบเรียงตามเส้นทางเดินแบบงู ไม่ย้อนทาง",
          "Orders are grouped by pack type and carrier: single-item envelopes batch by SKU, multi-item envelopes batch, large boxes are picked per order. Stops follow a serpentine walking route with no back-tracking.",
        )}
        actions={
          <Button onClick={() => actions.buildWaves()} disabled={readyCount === 0}>
            ≋ {tr(`สร้างรอบหยิบ (${readyCount} ออเดอร์พร้อม)`, `Build waves (${readyCount} orders ready)`)}
          </Button>
        }
      />
      {waves.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-silver-metal p-8 text-center text-sm text-muted">
          {tr("ยังไม่มีรอบหยิบ – กดสร้างรอบหยิบจากออเดอร์ที่ล็อกสต็อกแล้ว", "No waves yet - build them from reserved orders.")}
        </div>
      ) : null}
      {waves.map((w) => renderWave(w))}
      <Dialog open={!!pickId} onClose={() => setPickId(null)} title={tr("หยิบสินค้า", "Pick")}>
        {pickId ? <PickFlow waveId={pickId} /> : null}
      </Dialog>
    </div>
  );
}
