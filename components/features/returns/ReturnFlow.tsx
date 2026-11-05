"use client";

import { useMemo, useState } from "react";
import { ScanInput } from "@/components/scan/ScanInput";
import { ScanSimulator, type SimChip } from "@/components/scan/ScanSimulator";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, ProgressBar } from "@/components/ui/Card";
import { FlowSteps } from "@/components/ui/FlowSteps";
import { Field, Input } from "@/components/ui/form";
import { PathBreadcrumb } from "@/components/ui/PathBreadcrumb";
import { BarcodeSvg } from "@/components/scan/BarcodeSvg";
import { skuLabel } from "@/lib/domain/format";
import type { Grade, ReturnLine } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

const GRADES: Grade[] = ["A_good", "B_box_damaged", "C_unusable"];
const GRADE_HELP: Record<Grade, { th: string; en: string }> = {
  A_good: { th: "สินค้าและกล่องสมบูรณ์ → คืนเข้าสต็อกพร้อมขาย", en: "Item and box intact → back to sellable stock" },
  B_box_damaged: { th: "กล่องพัง สินค้าดี → แพ็กใหม่ก่อน แล้วคืนสต็อก", en: "Box damaged, item fine → repack, then restock" },
  C_unusable: { th: "เสียหายใช้ไม่ได้ → ทำลาย หรือเคลมซัพพลายเออร์", en: "Unusable → destroy or claim from the supplier" },
};

/** Return handling: intake → count → grade → repack/restock/destroy/RTV. Console and PDA share this. */
export function ReturnFlow({ returnId, pda = false }: { returnId: string; pda?: boolean }) {
  const { tr, lang, st } = useT();
  const ret = useWms((s) => s.data.returns.find((r) => r.id === returnId));
  const order = useWms((s) => s.data.orders.find((o) => o.id === ret?.orderId));
  const skus = useWms((s) => s.data.skus);
  const bins = useWms((s) => s.data.bins);
  const claims = useWms((s) => s.data.rtvClaims);

  const [gradeC, setGradeC] = useState<{ lineId: string; disp: "destroy" | "rtv_claim"; reason: string } | null>(null);
  const [rs, setRs] = useState<{ lineId: string; itemRaw?: string; binRaw?: string; reason?: string } | null>(null);

  const dark = pda;
  const sub = dark ? "text-silver-metal" : "text-muted";
  const rule = dark ? "border-silver-metal/50" : "border-silver-metal";

  const countable = useMemo(
    () => (ret ? ret.lines.filter((l) => !l.grade && l.receivedQty < l.expectedQty) : []),
    [ret],
  );
  const restockLine = useMemo(
    () =>
      ret?.lines.find(
        (l) =>
          l.grade &&
          !l.resolved &&
          (l.disposition === "restock" || (l.disposition === "repack_restock" && l.repacked)),
      ),
    [ret],
  );

  const receiveChips = useMemo<SimChip[]>(() => {
    if (!ret) return [];
    const list: SimChip[] = countable.map((l) => {
      const k = skus.find((x) => x.id === l.skuId);
      return { label: skuLabel(k, lang), value: k?.barcodes[0] ?? "" };
    });
    const other = skus.find((k) => !ret.lines.some((l) => l.skuId === k.id));
    if (other) list.push({ label: `${tr("สินค้าที่ไม่อยู่ในออเดอร์", "Not in order")}: ${skuLabel(other, lang)}`, value: other.barcodes[0], wrong: true });
    return list;
  }, [ret, countable, skus, lang, tr]);

  const restockChips = useMemo<SimChip[]>(() => {
    if (!restockLine) return [];
    const k = skus.find((x) => x.id === restockLine.skuId);
    if (!k) return [];
    if (!rs || rs.lineId !== restockLine.id || !rs.itemRaw) {
      return [{ label: skuLabel(k, lang), value: k.barcodes[0] }];
    }
    const origin = bins.find((b) => b.id === restockLine.originBinId);
    const list: SimChip[] = [];
    if (origin) list.push({ label: `${tr("ช่องเดิม", "Original bin")}: ${origin.path}`, value: origin.barcode });
    const off = bins.find((b) => b.id !== origin?.id && (b.zoneType === "storage" || b.zoneType === "pickface"));
    if (off) list.push({ label: `${tr("ช่องอื่น (ต้องระบุเหตุผล)", "Other bin (reason needed)")}: ${off.path}`, value: off.barcode, wrong: true });
    return list;
  }, [restockLine, rs, skus, bins, lang, tr]);

  if (!ret || !order) return null;

  const anyGraded = ret.lines.some((l) => l.grade);
  const step =
    ret.status === "completed"
      ? 5
      : ret.status === "expected"
        ? 1
        : ret.status === "restock_pending" || ret.status === "repack_pending"
          ? 4
          : anyGraded
            ? 3
            : 2;
  const received = ret.lines.filter((l) => l.receivedQty > 0);
  const canClose = ret.status !== "completed" && received.length > 0 && received.every((l) => l.resolved);
  const totalExp = ret.lines.reduce((n, l) => n + l.expectedQty, 0);
  const totalRec = ret.lines.reduce((n, l) => n + l.receivedQty, 0);

  const onRestockScan = (line: ReturnLine, raw: string) => {
    if (!rs || rs.lineId !== line.id || !rs.itemRaw) {
      const k = skus.find((x) => x.id === line.skuId);
      if (k?.barcodes.some((b) => b.toLowerCase() === raw.trim().toLowerCase())) {
        setRs({ lineId: line.id, itemRaw: raw });
      } else {
        // let the domain report WRONG_ITEM / unknown barcode so the scan is logged and buzzed
        actions.restock({ returnId, lineId: line.id, itemRaw: raw, binRaw: "" });
      }
      return;
    }
    const res = actions.restock({ returnId, lineId: line.id, itemRaw: rs.itemRaw, binRaw: raw, overrideReason: rs.reason });
    if (res.ok) setRs(null);
    else if (res.code === "WRONG_BIN") setRs({ ...rs, binRaw: raw, reason: "" });
  };

  return (
    <div className="space-y-4">
      <Card dark={dark}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xl font-bold">{ret.rmaNo}</div>
            <div className={`text-sm ${sub}`}>
              {order.channelOrderNo} · {order.buyerName} · {st(order.channel)}
            </div>
            <div className={`mt-1 text-sm ${sub}`}>{ret.reason}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill status={ret.status} />
            <div className="rounded bg-white p-1 text-ink">
              <BarcodeSvg value={ret.rmaNo} height={32} moduleWidth={1.2} />
            </div>
          </div>
        </div>
        <div className="mt-3">
          <FlowSteps
            steps={[
              { label: tr("รับเข้า", "Intake") },
              { label: tr("นับสินค้า", "Count") },
              { label: tr("ประเมินสภาพ", "Grade") },
              { label: tr("คืนสต็อก/จัดการ", "Restock / dispose") },
            ]}
            current={step}
          />
        </div>
      </Card>

      {ret.status === "expected" ? (
        <Card dark={dark}>
          <CardTitle>{tr("รับของคืนเข้าคลัง", "Receive the returned parcel")}</CardTitle>
          <p className={`mb-2 text-sm ${sub}`}>
            {tr("สแกน RMA เลขพัสดุตีกลับ หรือใบปะหน้าเดิมบนกล่อง", "Scan the RMA, return tracking number, or the original airway bill on the box.")}
          </p>
          <ScanInput pda={pda} onScan={(raw) => actions.returnIntake({ raw })} label={tr("สแกนรับของคืน", "Scan to receive")} />
          <div className="mt-3">
            <ScanSimulator
              dark={dark}
              chips={[
                { label: `RMA ${ret.rmaNo}`, value: ret.rmaNo },
                { label: `${tr("เลขพัสดุตีกลับ", "Return tracking")} ${ret.returnTrackingNo}`, value: ret.returnTrackingNo },
                { label: tr("RMA ที่ไม่มีในระบบ", "Unknown RMA"), value: "RMA-999999", wrong: true },
              ]}
              onScan={(raw) => actions.returnIntake({ raw })}
            />
          </div>
        </Card>
      ) : null}

      {ret.status !== "expected" && ret.status !== "completed" && countable.length > 0 ? (
        <Card dark={dark}>
          <CardTitle>{tr("สแกนสินค้าที่รับคืนทีละชิ้น", "Scan each returned item")}</CardTitle>
          <ScanInput
            pda={pda}
            onScan={(raw) => actions.returnItem({ returnId, raw })}
            label={tr("สแกนสินค้า", "Scan item")}
            autoFocus={!pda}
          />
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar value={totalRec} max={totalExp} />
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {totalRec}/{totalExp}
            </span>
          </div>
          <div className="mt-3">
            <ScanSimulator
              dark={dark}
              chips={receiveChips}
              onScan={(raw) => actions.returnItem({ returnId, raw })}
            />
          </div>
        </Card>
      ) : null}

      {ret.status !== "expected" ? (
        <Card dark={dark}>
          <CardTitle>{tr("รายการสินค้า", "Items")}</CardTitle>
          <ul className="space-y-3">
            {ret.lines.map((line) => {
              const k = skus.find((x) => x.id === line.skuId);
              const origin = bins.find((b) => b.id === line.originBinId);
              const claim = claims.find((c) => c.returnLineId === line.id);
              const needsGrade = !line.grade && line.receivedQty > 0;
              const needsRepack = line.disposition === "repack_restock" && !line.repacked && !line.resolved;
              const needsRestock = restockLine?.id === line.id;
              const gc = gradeC?.lineId === line.id ? gradeC : null;
              const state = rs?.lineId === line.id ? rs : null;
              return (
                <li key={line.id} className={`rounded-lg border p-3 ${rule}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{skuLabel(k, lang)}</div>
                      <div className={`text-sm tabular-nums ${sub}`}>
                        {tr("รับแล้ว", "Received")} {line.receivedQty}/{line.expectedQty}
                        {line.lotNo ? ` · ${tr("ล็อต", "lot")} ${line.lotNo}` : ""}
                      </div>
                      {origin ? (
                        <div className="mt-1 text-sm">
                          <span className={sub}>{tr("ช่องเดิม", "Original bin")}: </span>
                          <PathBreadcrumb bin={origin} />
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {line.grade ? <Badge tone="outline">{st(line.grade)}</Badge> : null}
                      {line.disposition ? <Badge tone="neutral">{st(line.disposition)}</Badge> : null}
                      {line.resolved ? (
                        <Badge tone="solid" icon="✓">
                          {tr("เสร็จแล้ว", "Done")}
                        </Badge>
                      ) : null}
                      {claim ? <Badge tone="dashed" icon="⇄">{`RTV · ${st(claim.status)}`}</Badge> : null}
                    </div>
                  </div>

                  {needsGrade ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-sm font-semibold">{tr("ประเมินสภาพสินค้า", "Grade the condition")}</div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {GRADES.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => {
                              if (g === "C_unusable") setGradeC({ lineId: line.id, disp: "destroy", reason: "" });
                              else {
                                setGradeC(null);
                                actions.grade({ returnId, lineId: line.id, grade: g });
                              }
                            }}
                            className={`min-h-14 rounded-lg border-2 p-2 text-left text-sm hover:border-gold ${
                              gc && g === "C_unusable" ? "border-gold" : rule
                            }`}
                          >
                            <b className="block">{st(g)}</b>
                            <span className={`text-xs ${sub}`}>{GRADE_HELP[g][lang]}</span>
                          </button>
                        ))}
                      </div>
                      {line.receivedQty < line.expectedQty ? (
                        <p className={`text-xs ${sub}`}>
                          {tr("ยังรับไม่ครบ – ประเมินตอนนี้จะนับเฉพาะที่รับแล้ว", "Not fully counted - grading now covers only what was received.")}
                        </p>
                      ) : null}
                      {gc ? (
                        <div className={`space-y-2 rounded-lg border-2 border-dashed p-3 ${rule}`}>
                          <div className="flex flex-wrap gap-4 text-sm">
                            {(["destroy", "rtv_claim"] as const).map((d) => (
                              <label key={d} className="flex min-h-11 cursor-pointer items-center gap-2">
                                <input
                                  type="radio"
                                  name={`disp-${line.id}`}
                                  className="size-5 accent-gold"
                                  checked={gc.disp === d}
                                  onChange={() => setGradeC({ ...gc, disp: d })}
                                />
                                {d === "destroy" ? tr("ทำลาย", "Destroy") : tr("เคลมซัพพลายเออร์ (RTV)", "RTV claim")}
                              </label>
                            ))}
                          </div>
                          <div className={dark ? "text-ink" : ""}>
                            <Field label={gc.disp === "rtv_claim" ? tr("เหตุผลเคลม (จำเป็น)", "Claim reason (required)") : tr("หมายเหตุ", "Note")}>
                              <Input value={gc.reason} onChange={(e) => setGradeC({ ...gc, reason: e.target.value })} />
                            </Field>
                          </div>
                          <Button
                            size="sm"
                            disabled={gc.disp === "rtv_claim" && !gc.reason.trim()}
                            onClick={() => {
                              const res = actions.grade({
                                returnId,
                                lineId: line.id,
                                grade: "C_unusable",
                                disposition: gc.disp,
                                reason: gc.reason,
                              });
                              if (res.ok) setGradeC(null);
                            }}
                          >
                            {tr("ยืนยันผลประเมิน", "Confirm grade")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {needsRepack ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="text-sm">{tr("แพ็กกล่องใหม่ที่โซนแพ็กซ้ำ แล้วกดยืนยัน", "Repack at the repack zone, then confirm.")}</span>
                      <Button size="sm" onClick={() => actions.completeRepack({ returnId, lineId: line.id })}>
                        ▣ {tr("แพ็กใหม่เสร็จแล้ว", "Repack done")}
                      </Button>
                    </div>
                  ) : null}

                  {needsRestock ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-sm font-semibold">
                        {state?.itemRaw
                          ? tr("ขั้นที่ 2: สแกนป้ายช่องเก็บ", "Step 2: scan the bin label")
                          : tr("ขั้นที่ 1: สแกนสินค้า", "Step 1: scan the item")}
                      </div>
                      <ScanInput
                        pda={pda}
                        autoFocus={false}
                        onScan={(raw) => onRestockScan(line, raw)}
                        label={state?.itemRaw ? tr("สแกนป้ายช่อง", "Scan bin label") : tr("สแกนสินค้า", "Scan item")}
                      />
                      {state?.binRaw ? (
                        <div role="alert" className={`space-y-2 rounded-lg border-2 border-dashed p-3 ${rule}`}>
                          <p className="text-sm font-semibold">
                            {tr("ไม่ใช่ช่องเดิมของสินค้านี้ – ระบุเหตุผลที่เปลี่ยนช่อง", "Not the original bin - give a reason for the change.")}
                          </p>
                          <div className={dark ? "text-ink" : ""}>
                            <Field label={tr("เหตุผล", "Reason")}>
                              <Input value={state.reason ?? ""} onChange={(e) => setRs({ ...state, reason: e.target.value })} />
                            </Field>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={!state.reason?.trim()}
                              onClick={() => {
                                const res = actions.restock({
                                  returnId,
                                  lineId: line.id,
                                  itemRaw: state.itemRaw!,
                                  binRaw: state.binRaw!,
                                  overrideReason: state.reason,
                                });
                                if (res.ok) setRs(null);
                              }}
                            >
                              {tr("ยืนยันเปลี่ยนช่อง", "Confirm other bin")}
                            </Button>
                            <Button size="sm" variant="secondary" onDark={dark} onClick={() => setRs({ lineId: line.id, itemRaw: state.itemRaw })}>
                              {tr("ยกเลิก", "Cancel")}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      <ScanSimulator dark={dark} chips={restockChips} onScan={(raw) => onRestockScan(line, raw)} />
                    </div>
                  ) : null}

                  {line.resolved && line.restockedBinId ? (
                    <div className="mt-2 text-sm">
                      {tr("คืนเข้าช่อง", "Restocked to")}: <PathBreadcrumb bin={bins.find((b) => b.id === line.restockedBinId)} />
                      {line.restockOverrideReason ? (
                        <span className={sub}> · {tr("เหตุผล", "reason")}: {line.restockOverrideReason}</span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {ret.status !== "completed" ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button disabled={!canClose} onClick={() => actions.closeReturn({ returnId })}>
                ■ {tr("ปิดรายการคืน", "Close return")}
              </Button>
              {!canClose ? (
                <span className={`text-xs ${sub}`}>
                  {tr("ต้องประเมินและจัดการสินค้าที่รับแล้วทุกรายการก่อน (รับคืนบางส่วนได้)", "Grade and resolve every received item first (partial returns are allowed).")}
                </span>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
