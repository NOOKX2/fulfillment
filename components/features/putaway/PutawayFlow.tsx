"use client";

import { useMemo, useState } from "react";
import { ScanInput } from "@/components/scan/ScanInput";
import { ScanSimulator, type SimChip } from "@/components/scan/ScanSimulator";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/form";
import { PathBreadcrumb } from "@/components/ui/PathBreadcrumb";
import { binCapacityFor, binLoad } from "@/lib/domain/core";
import { skuLabel } from "@/lib/domain/format";
import type { AppState, Bin, PutawayReason, Sku } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

/** Capacity/fit tags are already shown as numbers - keep only why the bin was ranked. */
const REASON_SKIP = new Set<PutawayReason>(["fits_dims", "fits_weight"]);

function fmtKg(g: number): string {
  return `${(g / 1000).toFixed(g >= 1000 ? 1 : 2)} kg`;
}

function binFill(data: AppState, bin: Bin, sku: Sku, needQty: number) {
  const load = binLoad(data, bin.id);
  const freeQty = binCapacityFor(data, bin, sku);
  const onHand = data.stock.filter((r) => r.binId === bin.id && r.qty > 0).reduce((n, r) => n + r.qty, 0);
  return {
    freeQty,
    onHand,
    weightG: load.weightG,
    maxWeightG: bin.maxWeightG,
    fits: freeQty >= needQty,
  };
}

function reasonSummary(reasons: PutawayReason[], lang: "th" | "en"): string {
  const picks = reasons.filter((r) => !REASON_SKIP.has(r)).slice(0, 2);
  if (picks.length === 0) return "";
  return picks.map((r) => REASON_LABEL[r][lang]).join(" · ");
}

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
  const data = useWms((s) => s.data);
  const task = data.putaway.find((t) => t.id === taskId);
  const bins = data.bins;
  const skus = data.skus;
  const [override, setOverride] = useState<{ raw: string; reason: string } | null>(null);
  const [confirmBinId, setConfirmBinId] = useState<string | null>(null);

  const sku = skus.find((k) => k.id === task?.skuId);
  const finished = task?.status === "completed" || task?.status === "cancelled";
  const step = task?.scannedItemOk ? 2 : 1;
  const confirmBin = confirmBinId ? bins.find((b) => b.id === confirmBinId) : undefined;
  const confirmFill =
    confirmBin && sku && task ? binFill(data, confirmBin, sku, task.qty) : null;

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
      // Suggested bins are chosen from the cards above - only keep a wrong-bin chip for demo.
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

  const sectionGap = pda ? "space-y-2" : "space-y-4";
  const cardPad = pda ? "!p-3" : "";

  return (
    <div className={sectionGap}>
      <Card dark={dark} className={cardPad}>
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
        <Card dark={dark} className={cardPad}>
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
          <Card dark={dark} className={cardPad}>
            <CardTitle className={pda ? "mb-2" : ""}>
              {step === 1
                ? tr("ขั้นที่ 1: สแกนสินค้า", "Step 1: scan the item")
                : tr("ขั้นที่ 2: เลือกช่องเก็บ", "Step 2: choose a bin")}
            </CardTitle>
            <div className={`flex gap-2 text-sm ${step === 1 ? "mb-3" : "mb-1"}`}>
              <Badge tone={task.scannedItemOk ? "solid" : "accent"} icon={task.scannedItemOk ? "✓" : "1"}>
                {tr("สินค้า", "Item")}
              </Badge>
              <Badge tone={step === 2 ? "accent" : "dashed"} icon="2">
                {tr("ช่องเก็บ", "Bin")}
              </Badge>
            </div>
            {step === 1 ? (
              <>
                <p className={`mb-3 text-sm ${dark ? "text-silver-metal" : "text-muted"}`}>
                  {tr("สแกนสินค้าก่อน ระบบจะแสดงตำแหน่งที่แนะนำให้เลือก", "Scan the item first - then suggested bins appear for you to choose.")}
                </p>
                <ScanInput pda={pda} onScan={onScan} label={tr("สแกนสินค้า", "Scan item")} />
              </>
            ) : (
              <p className={`text-sm ${dark ? "text-silver-metal" : "text-muted"}`}>
                {tr("กดช่องด้านล่างเพื่อเลือก หรือสแกนป้ายช่องด้วยเครื่องสแกน", "Tap a bin below, or scan its label with a scanner.")}
              </p>
            )}

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

          {step === 2 ? (
            <Card dark={dark} className={cardPad}>
              <CardTitle className={pda ? "mb-2" : ""}>
                {tr("ตำแหน่งที่ระบบแนะนำ – กดเพื่อเลือก", "Suggested locations - tap to choose")}
              </CardTitle>
              <ol className="space-y-1">
                {task.suggestions.map((x, i) => {
                  const b = bins.find((y) => y.id === x.binId);
                  if (!b) return null;
                  const fill = binFill(data, b, sku, task.qty);
                  const muted = dark ? "text-silver-metal" : "text-muted";
                  const why = reasonSummary(x.reasons, lang);
                  return (
                    <li key={x.binId}>
                      <button
                        type="button"
                        disabled={!fill.fits}
                        onClick={() => {
                          if (!fill.fits) return;
                          setConfirmBinId(b.id);
                        }}
                        className={`w-full rounded-lg border-2 px-3 py-2 text-left transition ${
                          !fill.fits
                            ? dark
                              ? "cursor-not-allowed border-danger/60 opacity-80"
                              : "cursor-not-allowed border-danger/50 opacity-80"
                            : i === 0
                              ? "border-gold hover:bg-gold/10"
                              : dark
                                ? "border-silver-metal/50 hover:border-gold hover:bg-white/5"
                                : "border-silver-metal hover:border-gold hover:bg-silver"
                        }`}
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="font-mono text-xl font-bold tracking-wide">{b.path}</div>
                            <div className="space-y-0.5">
                              <div className={`text-base font-bold ${fill.fits ? "" : "text-danger"}`}>
                                <span className={fill.fits ? muted : undefined}>{tr("วางได้", "Fits")}</span>{" "}
                                <span className={`tabular-nums ${fill.fits ? "text-gold" : "text-danger"}`}>
                                  {fill.freeQty}
                                </span>
                                <span className={fill.fits ? muted : undefined}> / {tr("มี", "have")} </span>
                                <span className={`tabular-nums ${fill.fits ? "text-gold" : "text-danger"}`}>
                                  {task.qty}
                                </span>
                                <span className={fill.fits ? muted : undefined}> → </span>
                                <span className={fill.fits ? "text-gold" : "text-danger"}>
                                  {fill.fits ? tr("พอ", "enough") : tr("ไม่พอ", "not enough")}
                                </span>
                              </div>
                              <div className={`text-sm font-semibold ${muted}`}>
                                {tr("น้ำหนัก", "Weight")}{" "}
                                <span className={`tabular-nums ${dark ? "text-gold" : "text-gold-deep"}`}>
                                  {fmtKg(fill.weightG)}
                                </span>
                                <span className="text-silver-metal"> / </span>
                                <span className={`tabular-nums ${dark ? "text-gold" : "text-gold-deep"}`}>
                                  {fmtKg(fill.maxWeightG)}
                                </span>
                              </div>
                            </div>
                            <div className={`space-y-0.5 text-xs ${muted}`}>
                              <div>
                                {tr("โซน", "Zone")} {b.zone}
                                <span className="mx-1 text-silver-metal">·</span>
                                {tr("ทางเดิน", "Aisle")} {b.aisle}
                                <span className="mx-1 text-silver-metal">·</span>
                                {tr("ชั้น", "Shelf")} {b.shelf}
                                <span className="mx-1 text-silver-metal">·</span>
                                {tr("ช่อง", "Bin")} {b.bin}
                              </div>
                              <div>
                                {tr("ในช่อง", "In bin")} {fill.onHand}
                                {fill.fits && why ? (
                                  <>
                                    <span className="mx-1.5 text-silver-metal">·</span>
                                    {why}
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
                {task.suggestions.length === 0 ? <li>{tr("ไม่มีช่องที่เหมาะสม", "No suitable bin")}</li> : null}
              </ol>
              {task.suggestions.length > 0 &&
              task.suggestions.every((x) => {
                const b = bins.find((y) => y.id === x.binId);
                return !b || !binFill(data, b, sku, task.qty).fits;
              }) ? (
                <p role="status" className={`mt-3 text-sm font-semibold ${dark ? "text-gold" : "text-gold-deep"}`}>
                  {tr(
                    "ช่องที่แนะนำว่างไม่พอทั้งหมด – กดคำนวณใหม่เพื่อหาช่องอื่น",
                    "None of the suggested bins fit - tap Re-suggest to find others.",
                  )}
                </p>
              ) : null}
              <div className="mt-3 space-y-3">
                <ScanInput pda={pda} onScan={onScan} label={tr("หรือสแกนป้ายช่อง", "Or scan bin label")} />
                <Button size="sm" variant="secondary" onDark={dark} onClick={() => actions.resuggest(taskId)}>
                  ↻ {tr("คำนวณใหม่", "Re-suggest")}
                </Button>
              </div>
            </Card>
          ) : null}

          <ScanSimulator chips={chips} onScan={onScan} dark={dark} />

          <Dialog
            open={!!confirmBin}
            onClose={() => setConfirmBinId(null)}
            title={tr("ยืนยันเลือกช่อง", "Confirm this bin")}
            footer={
              <>
                <Button variant="secondary" onClick={() => setConfirmBinId(null)}>
                  {tr("ยกเลิก", "Cancel")}
                </Button>
                <Button
                  onClick={() => {
                    if (!confirmBin) return;
                    onScan(confirmBin.barcode);
                    setConfirmBinId(null);
                  }}
                >
                  {tr("ยืนยันเลือกช่องนี้", "Confirm bin")}
                </Button>
              </>
            }
          >
            {confirmBin && task && sku ? (
              <div className="space-y-3">
                <p className="text-sm">
                  {tr(
                    `ต้องการจัดเก็บ ${skuLabel(sku, lang)} จำนวน ${task.qty} ชิ้น เข้าช่องนี้หรือไม่?`,
                    `Put away ${skuLabel(sku, lang)} × ${task.qty} into this bin?`,
                  )}
                </p>
                <PathBreadcrumb bin={confirmBin} large />
                {confirmFill ? (
                  <p className="text-sm text-muted">
                    {tr("น้ำหนัก", "Weight")} {fmtKg(confirmFill.weightG)} / {fmtKg(confirmFill.maxWeightG)}
                    <span className="mx-1.5">·</span>
                    {tr("ว่าง", "Room")} {confirmFill.freeQty} {tr("ชิ้น", "pcs")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Dialog>
        </>
      )}
    </div>
  );
}
