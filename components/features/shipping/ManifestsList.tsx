"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, PageHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { localDate, localHM } from "@/lib/clock";
import type { Manifest } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

export function ManifestsList() {
  const { tr, l, st } = useT();
  const router = useRouter();
  const data = useWms((s) => s.data);

  const cols: Column<Manifest>[] = [
    {
      key: "no",
      header: tr("เลขที่", "No."),
      cell: (m) => (
        <Link className="font-mono font-semibold underline" href={`/console/shipping/manifests/${m.id}`}>
          {m.manifestNo}
        </Link>
      ),
    },
    { key: "carrier", header: tr("ขนส่ง", "Carrier"), cell: (m) => st(m.carrier) },
    { key: "n", header: tr("พัสดุ", "Parcels"), cell: (m) => `${m.scannedShipmentIds.length}/${m.shipmentIds.length}`, align: "right" },
    { key: "status", header: tr("สถานะ", "Status"), cell: (m) => <StatusPill status={m.status} /> },
    { key: "created", header: tr("สร้างเมื่อ", "Created"), cell: (m) => `${localDate(m.createdAt)} ${localHM(m.createdAt)}` },
    { key: "driver", header: tr("ผู้ขับ", "Driver"), cell: (m) => m.driverName ?? "-" },
  ];

  const staged = data.settings.carriers
    .map((cfg) => ({
      cfg,
      count: data.shipments.filter((x) => x.carrier === cfg.code && x.status === "staged" && !x.manifestId).length,
    }))
    .filter((x) => x.count > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("ใบส่งมอบ (Manifest)", "Handover manifests")}
        subtitle={tr(
          "สแกนพัสดุขึ้นรถ ปิดรายการ ให้คนขับเซ็น แล้วระบบจะแจ้งสถานะ “จัดส่งแล้ว” กลับไปยังช่องทางขาย",
          "Scan parcels onto the truck, finish, get the driver's signature, and the system pushes 'shipped' back to the sales channel.",
        )}
        actions={
          <Link href="/console/shipping/staging" className="underline">
            {tr("ไปหน้าจัดเรียง →", "Go to staging →")}
          </Link>
        }
      />
      {staged.length > 0 ? (
        <Card>
          <CardTitle>{tr("พร้อมสร้างใบส่งมอบ", "Ready for a manifest")}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {staged.map(({ cfg, count }) => (
              <Button
                key={cfg.code}
                size="sm"
                onClick={() => {
                  const res = actions.createManifest({ carrier: cfg.code });
                  if (res.ok) router.push(`/console/shipping/manifests/${res.data.manifestId}`);
                }}
              >
                ✍ {l(cfg.name)} ({count})
              </Button>
            ))}
          </div>
        </Card>
      ) : null}
      <DataTable
        columns={cols}
        rows={[...data.manifests].reverse()}
        rowKey={(m) => m.id}
        empty={tr("ยังไม่มีใบส่งมอบ – วางพัสดุลงเลนในหน้าจัดเรียงก่อน", "No manifests yet - stage parcels in a lane first.")}
      />
    </div>
  );
}
