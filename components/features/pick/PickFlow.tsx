"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ScanInput } from "@/components/scan/ScanInput";
import { ScanSimulator, type SimChip } from "@/components/scan/ScanSimulator";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, ProgressBar } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/form";
import { PathBreadcrumb } from "@/components/ui/PathBreadcrumb";
import { skuLabel } from "@/lib/domain/format";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

/** Route-ordered pick flow: scan the bin label, then each unit. Console and PDA share it. */
export function PickFlow({ waveId, pda = false }: { waveId: string; pda?: boolean }) {
  const { tr, lang } = useT();
  const data = useWms((s) => s.data);
  const [shortOpen, setShortOpen] = useState(false);
  const [reason, setReason] = useState("");

  const wave = data.waves.find((w) => w.id === waveId);
  const tasks = useMemo(
    () => data.pickTasks.filter((t) => t.waveId === waveId).sort((a, b) => a.seq - b.seq),
    [data.pickTasks, waveId],
  );
  const pending = tasks.filter((t) => t.status === "pending");
  const task = pending[0];
  const sku = task ? data.skus.find((k) => k.id === task.skuId) : undefined;
  const bin = task ? data.bins.find((b) => b.id === task.binId) : undefined;

  const chips = ((): SimChip[] => {
    if (!task || !sku || !bin) return [];
    const list: SimChip[] = [];
    if (!task.binScanned) {
      list.push({ label: bin.path, value: bin.barcode });
      const other = tasks.find((t) => t.binId !== task.binId);
      const ob = other ? data.bins.find((b) => b.id === other.binId) : undefined;
      if (ob) list.push({ label: `${tr("ช่องผิด", "Wrong bin")}: ${ob.path}`, value: ob.barcode, wrong: true });
      list.push({ label: `${tr("สแกนสินค้าก่อน", "Item first")}: ${skuLabel(sku, lang)}`, value: sku.barcodes[0], wrong: true });
    } else {
      list.push({ label: skuLabel(sku, lang), value: sku.barcodes[0] });
      const other = data.skus.find((k) => k.id !== sku.id);
      if (other) list.push({ label: `${tr("สินค้าผิด", "Wrong item")}: ${skuLabel(other, lang)}`, value: other.barcodes[0], wrong: true });
    }
    return list;
  })();

  if (!wave) return <p>{tr("ไม่พบรอบหยิบ", "Wave not found")}</p>;
  const dark = pda;
  const done = tasks.filter((t) => t.status !== "pending").length;
  const state = wave.status;
  const active = state === "released" || state === "picking";
  const tote = task ? data.totes.find((t) => t.id === task.toteId) : undefined;

  const onScan = (raw: string) => {
    actions.pickScan({ waveId, raw });
  };

  return (
    <div className="space-y-4">
      <Card dark={dark}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-lg font-bold">{wave.name}</div>
            <div className={`text-sm ${dark ? "text-silver-metal" : "text-muted"}`}>
              {wave.pickMode === "batch_by_sku" ? tr("หยิบรวมตาม SKU", "Batch by SKU") : tr("หยิบทีละออเดอร์", "Discrete order")} · {wave.orderIds.length} {tr("ออเดอร์", "orders")}
            </div>
          </div>
          <StatusPill status={wave.status} />
        </div>
        <div className="mt-3">
          <div className="mb-1 text-sm tabular-nums">
            {done} / {tasks.length} {tr("จุดหยิบ", "stops")}
          </div>
          <ProgressBar value={done} max={tasks.length} />
        </div>
      </Card>

      {!active ? (
        <Card dark={dark}>
          {state === "picked" || state === "closed" ? (
            <div role="status" className="space-y-3">
              <div className="text-lg font-semibold">✓ {tr("หยิบครบทุกจุดแล้ว", "All stops picked")}</div>
              <p className={`text-sm ${dark ? "text-silver-metal" : "text-muted"}`}>
                {tr("นำตะกร้าไปที่โต๊ะแพ็กเพื่อตรวจและแพ็ก", "Take the totes to the pack bench to verify and pack.")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/console/pack/bench"
                  className="inline-flex min-h-11 items-center rounded-control bg-gold px-4 text-sm font-semibold text-ink"
                >
                  {tr("ไปโต๊ะแพ็ก", "Go to pack bench")}
                </Link>
                {state === "picked" && !pda ? (
                  <Button variant="secondary" onClick={() => actions.closeWave(wave.id)}>
                    {tr("ปิดรอบหยิบ", "Close wave")}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <p>{tr("รอบหยิบนี้ยังไม่ถูกปล่อย", "This wave has not been released")}</p>
          )}
        </Card>
      ) : !task || !sku || !bin ? (
        <Card dark={dark}>{tr("ไม่มีจุดหยิบค้าง", "No pending stops")}</Card>
      ) : (
        <>
          <Card dark={dark} className="border-2 !border-gold">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge tone="accent">
                {tr("จุดที่", "Stop")} {task.seq}/{tasks.length}
              </Badge>
              <Badge tone="outline" className={dark ? "!border-white !bg-transparent !text-white" : ""}>
                {tr("ตะกร้า", "Tote")} {tote?.id ?? task.toteId}
              </Badge>
            </div>
            <div className="mb-1 text-sm font-semibold">
              {task.binScanned ? tr("ขั้นที่ 2: สแกนสินค้าทีละชิ้น", "Step 2: scan each unit") : tr("ขั้นที่ 1: ไปที่ช่อง แล้วสแกนป้ายช่อง", "Step 1: go to the bin and scan its label")}
            </div>
            <div className="mb-3">
              <PathBreadcrumb bin={bin} large />
            </div>
            <div className="text-xl font-bold">{skuLabel(sku, lang)}</div>
            <div className={`text-sm ${dark ? "text-silver-metal" : "text-muted"}`}>
              {tr("ล็อต", "Lot")} <span className="font-mono">{task.lotNo}</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums">{task.pickedQty}</span>
              <span className="text-xl">/ {task.qty}</span>
              <span className={`text-sm ${dark ? "text-silver-metal" : "text-muted"}`}>{tr("ชิ้น", "units")}</span>
            </div>
          </Card>

          <Card dark={dark}>
            <ScanInput pda={pda} onScan={onScan} label={task.binScanned ? tr("สแกนสินค้า", "Scan item") : tr("สแกนป้ายช่อง", "Scan bin label")} />
            <div className="mt-3">
              {shortOpen ? (
                <div className="space-y-2 rounded-lg border-2 border-dashed border-gold p-3">
                  <Field label={tr("เหตุผลที่ของขาด", "Why is it short?")}>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} className="text-ink" />
                  </Field>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!reason.trim()}
                      onClick={() => {
                        const res = actions.shortPick({ taskId: task.id, reason });
                        if (res.ok) {
                          setShortOpen(false);
                          setReason("");
                        }
                      }}
                    >
                      {tr("ยืนยันของขาด", "Confirm short")}
                    </Button>
                    <Button size="sm" variant="secondary" onDark={dark} onClick={() => setShortOpen(false)}>
                      {tr("ยกเลิก", "Cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onDark={dark} onClick={() => setShortOpen(true)}>
                  ⚠ {tr("ของไม่พอที่ช่องนี้", "Not enough at this bin")}
                </Button>
              )}
            </div>
          </Card>

          {pending.length > 1 ? (
            <Card dark={dark}>
              <div className="mb-2 text-sm font-semibold">{tr("จุดถัดไป", "Up next")}</div>
              <ol className="space-y-1 text-sm">
                {pending.slice(1, 4).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono">{data.bins.find((b) => b.id === t.binId)?.path}</span>
                    <span>
                      {skuLabel(data.skus.find((k) => k.id === t.skuId), lang)} × {t.qty}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
          <ScanSimulator chips={chips} onScan={onScan} dark={dark} />
        </>
      )}
    </div>
  );
}
