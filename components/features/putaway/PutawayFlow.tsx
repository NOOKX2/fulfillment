"use client";

import { useMemo, useState } from "react";
import { ScanInput } from "@/components/scan/ScanInput";
import { ScanSimulator, type SimChip } from "@/components/scan/ScanSimulator";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/form";
import { PathBreadcrumb } from "@/components/ui/PathBreadcrumb";
import { skuLabel } from "@/lib/domain/format";
import type { PutawayReason } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

export const REASON_LABEL: Record<PutawayReason, { th: string; en: string }> = {
  velocity_golden: { th: "ขายเร็ว → ชั้นทอง", en: "Fast mover → golden shelf" },
  fits_dims: { th: "ขนาดพอดี", en: "Fits dimensions" },
  fits_weight: { th: "รับน้ำหนักได้", en: "Fits weight" },
  same_sku_consolidate: { th: "รวมกับสินค้าเดิม", en: "Consolidates same SKU" },
  nearest_pickseq: { th: "ใกล้จุดเริ่มหยิบ", en: "Near pick start" },
  bound_pickface: { th: "ช่องหน้าหยิบที่ผูกไว้", en: "Bound pick face" },
  slow_mover_high: { th: "ขายช้า → ชั้นสูง/พื้น", en: "Slow mover → high/floor" },
};

/** Two-scan directed putaway: item first, then the bin label. Console and PDA share this. */
export function PutawayFlow({ taskId, pda = false }: { taskId: string; pda?: boolean }) {
  const { tr, lang } = useT();
  const task = useWms((s) => s.data.putaway.find((t) => t.id === taskId));
  const bins = useWms((s) => s.data.bins);
  const skus = useWms((s) => s.data.skus);
  const [override, setOverride] = useState<{ raw: string; reason: string } | null>(null);

  const sku = skus.find((k) => k.id === task?.skuId);
  const finished = task?.status === "completed" || task?.status === "cancelled";
  const step = task?.scannedItemOk ? 2 : 1;

  const chips = useMemo<SimChip[]>(() => {
    if (!task || !sku) return [];
    const list: SimChip[] = [];
    const sugg = new Set(task.suggestions.map((x) => x.binId));
    if (step === 1) {
      list.push({ label: skuLabel(sku, lang), value: sku.barcodes[0] });
      const other = skus.find((k) => k.id !== sku.id);
      if (other) list.push({ label: `${tr("สินค้าผิด", "Wrong item")}: ${skuLabel(other, lang)}`, value: other.barcodes[0], wrong: true });
      const b = bins.find((x) => sugg.has(x.id));
      if (b) list.push({ label: `${tr("สแกนช่องก่อน", "Bin first")}: ${b.path}`, value: b.barcode, wrong: true });
    } else {
      task.suggestions.forEach((x, i) => {
        const b = bins.find((y) => y.id === x.binId);
        if (b) list.push({ label: `#${i + 1} ${b.path}`, value: b.barcode });
      });
      const off = bins.find((b) => !sugg.has(b.id) && (b.zoneType === "storage" || b.zoneType === "pickface"));
      if (off) list.push({ label: `${tr("ไม่ใช่ที่แนะนำ", "Not suggested")}: ${off.path}`, value: off.barcode, wrong: true });
    }
    return list;
  }, [task, sku, skus, bins, step, lang, tr]);

  if (!task || !sku) return null;
  const dark = pda;

  const onScan = (raw: string) => {
    if (step === 1) {
      actions.putawayItem({ taskId, raw });
      return;
    }
    const res = actions.putawayBin({ taskId, raw });
    if (!res.ok && res.code === "NOT_SUGGESTED_BIN") setOverride({ raw, reason: "" });
    else setOverride(null);
  };

  const chosen = bins.find((b) => b.id === task.chosenBinId);

  return (
    <div className="space-y-4">
      <Card dark={dark}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-lg font-bold">{skuLabel(sku, lang)}</div>
            <div className={`text-sm ${dark ? "text-silver-metal" : "text-muted"}`}>
              {tr("ล็อต", "Lot")} <span className="font-mono">{task.lotNo}</span>
              {task.expiryDate ? ` · ${tr("หมดอายุ", "exp")} ${task.expiryDate}` : ""} · {tr("จาก", "from")}{" "}
              <span className="font-mono">{bins.find((b) => b.id === task.fromBinId)?.path}</span>
            </div>
          </div>
          <Badge tone="accent">
            {tr("จำนวน", "Qty")} {task.qty}
          </Badge>
        </div>
      </Card>

      {finished ? (
        <Card dark={dark}>
          {task.status === "completed" ? (
            <div role="status" className="space-y-1">
              <div className="font-semibold">✓ {tr("จัดเก็บเรียบร้อย", "Put away")}</div>
              <PathBreadcrumb bin={chosen} large />
              {task.overrideReason ? (
                <div className="text-sm">
                  {tr("เหตุผลที่เปลี่ยนตำแหน่ง", "Override reason")}: {task.overrideReason}
                </div>
              ) : null}
            </div>
          ) : (
            <div>{tr("งานนี้ถูกยกเลิก", "This task was cancelled")}</div>
          )}
        </Card>
      ) : (
        <>
          <Card dark={dark}>
            <CardTitle>{tr("ตำแหน่งที่ระบบแนะนำ", "Suggested locations")}</CardTitle>
            <ol className="space-y-2">
              {task.suggestions.map((x, i) => {
                const b = bins.find((y) => y.id === x.binId);
                return (
                  <li
                    key={x.binId}
                    className={`rounded-lg border-2 p-3 ${i === 0 ? "border-gold" : dark ? "border-silver-metal/50" : "border-silver-metal"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">{i + 1}</span>
                        <PathBreadcrumb bin={b} large />
                      </span>
                      <span className="text-sm tabular-nums">
                        {tr("คะแนน", "score")} {x.score}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {x.reasons.map((r) => (
                        <Badge key={r} tone={dark ? "outline" : "neutral"} className={dark ? "!border-silver-metal !bg-transparent !text-white" : ""}>
                          {REASON_LABEL[r][lang]}
                        </Badge>
                      ))}
                    </div>
                  </li>
                );
              })}
              {task.suggestions.length === 0 ? <li>{tr("ไม่มีช่องที่เหมาะสม", "No suitable bin")}</li> : null}
            </ol>
            <div className="mt-3">
              <Button size="sm" variant="secondary" onDark={dark} onClick={() => actions.resuggest(taskId)}>
                ↻ {tr("คำนวณใหม่", "Re-suggest")}
              </Button>
            </div>
          </Card>

          <Card dark={dark}>
            <CardTitle>
              {step === 1
                ? tr("ขั้นที่ 1: สแกนสินค้า", "Step 1: scan the item")
                : tr("ขั้นที่ 2: สแกนป้ายช่องเก็บ", "Step 2: scan the bin label")}
            </CardTitle>
            <div className="mb-3 flex gap-2 text-sm">
              <Badge tone={task.scannedItemOk ? "solid" : "accent"} icon={task.scannedItemOk ? "✓" : "1"}>
                {tr("สินค้า", "Item")}
              </Badge>
              <Badge tone={step === 2 ? "accent" : "dashed"} icon="2">
                {tr("ช่องเก็บ", "Bin")}
              </Badge>
            </div>
            <ScanInput pda={pda} onScan={onScan} label={step === 1 ? tr("สแกนสินค้า", "Scan item") : tr("สแกนป้ายช่อง", "Scan bin label")} />

            {override ? (
              <div role="alert" className="mt-3 rounded-lg border-2 border-dashed border-gold p-3">
                <p className="mb-2 text-sm font-semibold">
                  {tr("ไม่ใช่ตำแหน่งที่แนะนำ – ระบุเหตุผลเพื่อยืนยัน", "Not a suggested bin - give a reason to confirm")}
                </p>
                <Field label={tr("เหตุผล", "Reason")}>
                  <Input value={override.reason} onChange={(e) => setOverride({ ...override, reason: e.target.value })} className="text-ink" />
                </Field>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    disabled={!override.reason.trim()}
                    onClick={() => {
                      const res = actions.putawayBin({ taskId, raw: override.raw, overrideReason: override.reason });
                      if (res.ok || res.code !== "NOT_SUGGESTED_BIN") setOverride(null);
                    }}
                  >
                    {tr("ยืนยันตำแหน่งนี้", "Confirm this bin")}
                  </Button>
                  <Button size="sm" variant="secondary" onDark={dark} onClick={() => setOverride(null)}>
                    {tr("ยกเลิก", "Cancel")}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
          <ScanSimulator chips={chips} onScan={onScan} dark={dark} />
        </>
      )}
    </div>
  );
}
