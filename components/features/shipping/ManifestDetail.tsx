"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PrintSheet } from "@/components/print/PrintSheet";
import { ScanInput } from "@/components/scan/ScanInput";
import { ScanSimulator, type SimChip } from "@/components/scan/ScanSimulator";
import { SignaturePad } from "@/components/scan/SignaturePad";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, EmptyState, PageHeader, ProgressBar } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/form";
import { FlowSteps } from "@/components/ui/FlowSteps";
import { localDate, localHM } from "@/lib/clock";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { saveSignature } from "@/lib/store/persist";
import { useWms } from "@/lib/store/store";
import { ManifestSheet } from "./ManifestSheet";

export function ManifestDetail({ manifestId }: { manifestId: string }) {
  const { tr, l, st } = useT();
  const data = useWms((s) => s.data);
  const m = data.manifests.find((x) => x.id === manifestId);
  const [driver, setDriver] = useState("");
  const [plate, setPlate] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [sigError, setSigError] = useState(false);

  const rows = useMemo(
    () =>
      (m?.shipmentIds ?? [])
        .map((id) => data.shipments.find((x) => x.id === id))
        .filter((x): x is NonNullable<typeof x> => Boolean(x)),
    [m, data.shipments],
  );

  if (!m) {
    return (
      <EmptyState>
        {tr("ไม่พบใบส่งมอบ", "Manifest not found")}{" "}
        <Link className="underline" href="/console/shipping/manifests">
          {tr("กลับ", "Back")}
        </Link>
      </EmptyState>
    );
  }

  const cfg = data.settings.carriers.find((c) => c.code === m.carrier);
  const scanning = m.status === "draft" || m.status === "scanning";
  const exceptionOf = (id: string) => m.exceptions.find((e) => e.shipmentId === id)?.reason;
  const unresolved = rows.filter((x) => !m.scannedShipmentIds.includes(x.id) && !exceptionOf(x.id)).length;
  const step = m.status === "handed_over" ? 3 : m.status === "awaiting_signature" ? 2 : 1;

  const chips: SimChip[] = [
    ...rows
      .filter((x) => !m.scannedShipmentIds.includes(x.id))
      .slice(0, 5)
      .map((x) => ({ label: x.trackingNo, value: x.trackingNo })),
    { label: tr("พัสดุที่ไม่อยู่ในใบนี้", "Parcel not on this manifest"), value: "TH999999999", wrong: true },
  ];

  const sign = () => {
    if (!sig) return;
    const key = `manifest-${m.id}`;
    if (!saveSignature(key, sig)) {
      setSigError(true);
      return;
    }
    setSigError(false);
    actions.signManifest({ manifestId: m.id, driverName: driver, vehiclePlate: plate, signatureKey: key });
  };

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        <PageHeader
          title={`${tr("ใบส่งมอบ", "Manifest")} ${m.manifestNo}`}
          subtitle={`${cfg ? l(cfg.name) : st(m.carrier)} · cut-off ${cfg?.cutoffLocal ?? "-"} · ${localDate(m.createdAt)} ${localHM(m.createdAt)}`}
          actions={
            <>
              <StatusPill status={m.status} />
              <Link href="/console/shipping/manifests" className="underline">
                {tr("← ทั้งหมด", "← All")}
              </Link>
            </>
          }
        />

        <FlowSteps
          steps={[
            { label: tr("สแกนพัสดุ", "Scan parcels") },
            { label: tr("ปิดรายการ", "Finish") },
            { label: tr("ลายเซ็นคนขับ", "Driver signature") },
            { label: tr("ส่งมอบแล้ว", "Handed over") },
          ]}
          current={step}
        />

        {scanning ? (
          <Card>
            <ScanInput
              onScan={(raw) => actions.manifestScan({ manifestId: m.id, raw })}
              label={tr("สแกนพัสดุขึ้นรถ", "Scan parcel onto the truck")}
              placeholder={tr("สแกนเลขพัสดุ", "Scan tracking number")}
            />
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <ProgressBar value={m.scannedShipmentIds.length} max={rows.length} />
              </div>
              <span className="text-sm font-semibold">
                {m.scannedShipmentIds.length}/{rows.length}
              </span>
            </div>
          </Card>
        ) : null}

        <Card>
          <CardTitle>{tr("พัสดุในใบส่งมอบ", "Parcels")}</CardTitle>
          <ul className="divide-y divide-silver text-sm">
            {rows.map((x) => {
              const done = m.scannedShipmentIds.includes(x.id);
              const ex = exceptionOf(x.id);
              const order = data.orders.find((o) => o.id === x.orderId);
              return (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <b className="font-mono">{x.trackingNo}</b>
                    <span className="ml-2 text-muted">
                      {order?.channelOrderNo} · {order?.buyerName}
                    </span>
                    {x.late ? (
                      <span className="ml-2">
                        <Badge tone="outline" icon="!">
                          {tr("ล่าช้า", "Late")}
                        </Badge>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {done ? (
                      <Badge tone="solid" icon="✓">
                        {tr("สแกนแล้ว", "Scanned")}
                      </Badge>
                    ) : ex ? (
                      <Badge tone="outline" icon="!">
                        {ex === "missing" ? tr("หาย", "Missing") : tr("เสียหาย", "Damaged")}
                      </Badge>
                    ) : (
                      <Badge tone="dashed" icon="○">
                        {tr("รอสแกน", "Pending")}
                      </Badge>
                    )}
                    {scanning && !done ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => actions.manifestException({ manifestId: m.id, shipmentId: x.id, reason: "missing" })}
                        >
                          {tr("หาย", "Missing")}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => actions.manifestException({ manifestId: m.id, shipmentId: x.id, reason: "damaged" })}
                        >
                          {tr("เสียหาย", "Damaged")}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {scanning ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => actions.finishManifest({ manifestId: m.id })}>
                {tr("ปิดรายการสแกน", "Finish scanning")}
              </Button>
              {unresolved > 0 ? (
                <span className="text-sm text-muted">
                  {tr(`เหลือ ${unresolved} ชิ้นที่ยังไม่สแกนหรือบันทึกความผิดปกติ`, `${unresolved} parcel(s) still unscanned or without an exception`)}
                </span>
              ) : null}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-muted">
            {tr(
              "พัสดุที่หายหรือเสียหายจะถูกถอดออกจากใบนี้และกลับไปรออยู่ในเลน",
              "Missing or damaged parcels are removed from this manifest and return to the lane.",
            )}
          </p>
        </Card>

        {m.status === "awaiting_signature" ? (
          <Card>
            <CardTitle>{tr("คนขับเซ็นรับพัสดุ", "Driver signs for the parcels")}</CardTitle>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={tr("ชื่อคนขับ", "Driver name")}>
                <Input value={driver} onChange={(e) => setDriver(e.target.value)} />
              </Field>
              <Field label={tr("ทะเบียนรถ", "Vehicle plate")}>
                <Input value={plate} onChange={(e) => setPlate(e.target.value)} />
              </Field>
            </div>
            <div className="mt-3">
              <SignaturePad onChange={setSig} />
            </div>
            {sigError ? (
              <p role="alert" className="mt-2 text-sm font-semibold text-danger">
                {tr("พื้นที่เก็บข้อมูลเต็ม – บันทึกลายเซ็นไม่ได้ ลบข้อมูลเดโมเก่าในหน้าตั้งค่า", "Storage is full - signature not saved. Clear old demo data in Settings.")}
              </p>
            ) : null}
            <div className="mt-4">
              <Button disabled={!sig || !driver.trim() || !plate.trim()} onClick={sign}>
                ✓ {tr("ยืนยันส่งมอบ", "Confirm handover")} ({rows.length})
              </Button>
            </div>
          </Card>
        ) : null}

        {m.status === "handed_over" ? (
          <Card>
            <CardTitle>{tr("ส่งมอบแล้ว", "Handed over")}</CardTitle>
            <p className="mb-3 text-sm">
              {m.driverName} · {m.vehiclePlate} · {m.signedAt ? `${localDate(m.signedAt)} ${localHM(m.signedAt)}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => window.print()}>🖨 {tr("พิมพ์ใบส่งมอบ A4", "Print A4 manifest")}</Button>
              <Link href="/console/integrations/outbox" className="inline-flex items-center underline">
                {tr("ดูการแจ้งสถานะกลับช่องทางขาย →", "See channel status pushes →")}
              </Link>
            </div>
          </Card>
        ) : null}

        {scanning ? <ScanSimulator chips={chips} onScan={(raw) => actions.manifestScan({ manifestId: m.id, raw })} /> : null}
      </div>
      <PrintSheet page="a4">
        <ManifestSheet manifestId={m.id} />
      </PrintSheet>
    </div>
  );
}
