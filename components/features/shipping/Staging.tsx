"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ScanInput } from "@/components/scan/ScanInput";
import { ScanSimulator, type SimChip } from "@/components/scan/ScanSimulator";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, PageHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/form";
import { laneId } from "@/lib/domain/carriers";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";
import { minutesBetween, useNowHM } from "@/lib/useNowHM";

export function Staging() {
  const { tr, l, st } = useT();
  const router = useRouter();
  const data = useWms((s) => s.data);
  const nowHM = useNowHM();
  const [late, setLate] = useState<{ raw: string; note: string } | null>(null);

  const waiting = data.shipments.filter((x) => x.status === "label_printed");

  const onScan = (raw: string) => {
    const res = actions.stageScan({ raw });
    if (!res.ok && res.code === "LATE_NOTE_REQUIRED") setLate({ raw, note: "" });
    else setLate(null);
  };

  const chips = useMemo<SimChip[]>(() => {
    const list: SimChip[] = waiting.slice(0, 5).map((x) => ({
      label: `${st(x.carrier)} · ${x.trackingNo}`,
      value: x.trackingNo,
    }));
    list.push({ label: `${tr("เลขพัสดุที่ไม่มีในระบบ", "Unknown tracking")}: TH999999999`, value: "TH999999999", wrong: true });
    return list;
  }, [waiting, st, tr]);

  const create = (carrier: string) => {
    const res = actions.createManifest({ carrier: carrier as "flash" });
    if (res.ok) router.push(`/console/shipping/manifests/${res.data.manifestId}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("จัดเรียงตามขนส่ง", "Courier staging & sorting")}
        subtitle={tr(
          "สแกนเลขพัสดุเพื่อวางลงเลนของขนส่ง ระบบเทียบกับเวลา cut-off ถ้าเลยเวลาต้องระบุหมายเหตุ จากนั้นสร้างใบส่งมอบ",
          "Scan each tracking number into its carrier lane. Parcels staged after the cut-off need a note. Then create the handover manifest.",
        )}
      />

      <Card>
        <ScanInput onScan={onScan} label={tr("สแกนเลขพัสดุ", "Scan tracking number")} placeholder={tr("สแกนบาร์โค้ดบนใบปะหน้า", "Scan the barcode on the airway bill")} />
        {late ? (
          <div role="alert" className="mt-3 rounded-lg border-2 border-dashed border-ink bg-silver p-3">
            <p className="mb-2 text-sm font-semibold">
              {tr("เลยเวลา cut-off ของขนส่งนี้แล้ว – ระบุหมายเหตุส่งล่าช้า", "Past this carrier's cut-off - add a late-handover note")}
            </p>
            <Field label={tr("หมายเหตุ", "Note")}>
              <Input value={late.note} onChange={(e) => setLate({ ...late, note: e.target.value })} />
            </Field>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                disabled={!late.note.trim()}
                onClick={() => {
                  const res = actions.stageScan({ raw: late.raw, lateNote: late.note });
                  if (res.ok) setLate(null);
                }}
              >
                {tr("ยืนยันวางในเลน", "Confirm staging")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setLate(null)}>
                {tr("ยกเลิก", "Cancel")}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="mt-3 text-sm text-muted">
          {tr("รอจัดเรียง", "Waiting to be sorted")}: <b>{waiting.length}</b>
          {nowHM ? ` · ${tr("เวลาคลัง", "warehouse time")} ${nowHM}` : ""}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {data.settings.carriers.map((cfg) => {
          const lane = data.shipments.filter((x) => x.carrier === cfg.code && x.status === "staged");
          const open = lane.filter((x) => !x.manifestId);
          const lateCount = lane.filter((x) => x.late).length;
          const left = nowHM ? minutesBetween(nowHM, cfg.cutoffLocal) : null;
          return (
            <Card key={cfg.code}>
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-bold">{l(cfg.name)}</div>
                  <div className="font-mono text-xs text-muted">{laneId(cfg)}</div>
                </div>
                <div className="text-right text-sm">
                  <div>
                    cut-off <b>{cfg.cutoffLocal}</b>
                  </div>
                  {left !== null ? (
                    left >= 0 ? (
                      <Badge tone="neutral">{tr(`เหลือ ${Math.floor(left / 60)} ชม. ${left % 60} นาที`, `${Math.floor(left / 60)} h ${left % 60} min left`)}</Badge>
                    ) : (
                      <Badge tone="outline" icon="!">{tr("เลยเวลา cut-off", "Past cut-off")}</Badge>
                    )
                  ) : null}
                </div>
              </div>
              <div className="mb-3 flex gap-4 text-sm">
                <span>
                  {tr("ในเลน", "In lane")} <b>{open.length}</b>
                </span>
                {lateCount > 0 ? (
                  <span>
                    {tr("ส่งล่าช้า", "Late")} <b>{lateCount}</b>
                  </span>
                ) : null}
              </div>
              {lane.length > 0 ? (
                <ul className="mb-3 max-h-40 space-y-1 overflow-y-auto text-xs">
                  {lane.map((x) => (
                    <li key={x.id} className="flex items-center justify-between gap-2">
                      <span className="font-mono">{x.trackingNo}</span>
                      <span className="flex items-center gap-1">
                        {x.late ? <Badge tone="outline" icon="!">{tr("ล่าช้า", "Late")}</Badge> : null}
                        {x.manifestId ? <StatusPill status="manifested" /> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 text-sm text-muted">{tr("ยังไม่มีพัสดุในเลน", "Lane is empty")}</p>
              )}
              <Button size="sm" disabled={open.length === 0} onClick={() => create(cfg.code)}>
                ✍ {tr("สร้างใบส่งมอบ", "Create manifest")} ({open.length})
              </Button>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardTitle>{tr("พัสดุที่ยังไม่ได้จัดเรียง", "Parcels not sorted yet")}</CardTitle>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted">{tr("ไม่มี – แพ็กและออกใบปะหน้าที่โต๊ะแพ็กเพื่อสร้างพัสดุ", "None - pack and label orders at the bench to create parcels.")}</p>
        ) : (
          <ul className="divide-y divide-silver text-sm">
            {waiting.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <b className="font-mono">{x.trackingNo}</b> · {st(x.carrier)} ·{" "}
                  {data.orders.find((o) => o.id === x.orderId)?.channelOrderNo}
                </span>
                <Button size="sm" variant="secondary" onClick={() => onScan(x.trackingNo)}>
                  {tr("วางในเลน", "Stage")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ScanSimulator chips={chips} onScan={onScan} />
    </div>
  );
}
