"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BarcodeSvg } from "@/components/scan/BarcodeSvg";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, ProgressBar } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { binCapacityFor } from "@/lib/domain/core";
import { skuLabel } from "@/lib/domain/format";
import type { Bin, ZoneType } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

const ZONE_LABEL: Record<ZoneType, { th: string; en: string }> = {
  receiving: { th: "รับสินค้า", en: "Receiving" },
  qc: { th: "QC", en: "QC" },
  quarantine: { th: "กักกัน", en: "Quarantine" },
  storage: { th: "จัดเก็บ", en: "Storage" },
  pickface: { th: "หน้าหยิบ", en: "Pick face" },
  pack: { th: "แพ็ก", en: "Pack" },
  staging: { th: "พักรอส่ง", en: "Staging" },
  returns: { th: "ตีกลับ", en: "Returns" },
  repack: { th: "แพ็กใหม่", en: "Repack" },
  destroy: { th: "ทำลาย", en: "Destroy" },
  rtv: { th: "RTV", en: "RTV" },
};

/** Small tag beside the level number; ordinary shelves ("normal") get none. */
const ERGO_TAG: Partial<Record<Bin["ergonomics"], { th: string; en: string; tone: "accent" | "neutral" | "dashed" }>> = {
  golden: { th: "หยิบง่าย", en: "Golden", tone: "accent" },
  high: { th: "ชั้นสูง", en: "High", tone: "neutral" },
  floor: { th: "ระดับพื้น", en: "Floor", tone: "dashed" },
};

export function Locations() {
  const { tr, lang } = useT();
  const params = useSearchParams();
  const data = useWms((s) => s.data);
  const [zone, setZone] = useState<ZoneType | "all">("all");
  const [q, setQ] = useState(params.get("bin") ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  const [bindSku, setBindSku] = useState("");

  const bins = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.bins
      .filter((b) => zone === "all" || b.zoneType === zone)
      .filter(
        (b) =>
          !needle || b.path.toLowerCase().includes(needle) || b.barcode.toLowerCase().includes(needle),
      )
      .sort((a, b) => a.pickSeq - b.pickSeq);
  }, [data.bins, zone, q]);

  const open = data.bins.find((b) => b.id === openId) ?? null;
  const zones = [...new Set(data.bins.map((b) => b.zoneType))];
  const boundOf = (b: Bin) => {
    const x = data.bindings.find((y) => y.binId === b.id);
    return x ? data.skus.find((k) => k.id === x.skuId) : undefined;
  };

  const cols: Column<Bin>[] = [
    { key: "path", header: tr("ตำแหน่ง", "Location"), cell: (b) => <span className="font-mono">{b.path}</span> },
    { key: "zone", header: tr("โซน", "Zone"), cell: (b) => ZONE_LABEL[b.zoneType][lang] },
    {
      key: "ergo",
      header: tr("ระดับชั้น", "Level"),
      cell: (b) => {
        // Level number comes from the location code (zone-aisle-rack-LEVEL-bin).
        const level = b.path.split("-")[3] ?? b.shelf;
        const tag = ERGO_TAG[b.ergonomics];
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5 whitespace-nowrap">
            <span className="font-semibold">
              {tr("ชั้น", "Level")} {level}
            </span>
            {tag ? (
              <Badge tone={tag.tone} className="!px-2 !py-0 !text-[11px]">
                {tag[lang]}
              </Badge>
            ) : null}
          </span>
        );
      },
    },
    { key: "seq", header: tr("ลำดับหยิบ", "Pick seq"), align: "right", cell: (b) => b.pickSeq },
    {
      key: "load",
      header: tr("ความจุที่ใช้", "Capacity used"),
      cell: (b) => {
        // used / capacity are both in units of the bin's main SKU (bound SKU, else the biggest stock line).
        const rows = data.stock.filter((r) => r.binId === b.id && r.qty > 0);
        const used = rows.reduce((n, r) => n + r.qty, 0);
        const main =
          boundOf(b) ??
          data.skus.find((k) => k.id === [...rows].sort((x, y) => y.qty - x.qty)[0]?.skuId);
        if (!main) {
          return (
            <div className="flex w-36 items-center gap-2">
              <div className="flex-1">
                <ProgressBar value={0} max={100} />
              </div>
              <span className="w-12 text-right text-xs tabular-nums text-muted">0 / –</span>
            </div>
          );
        }
        const capacity = Math.max(used + binCapacityFor(data, b, main), 1);
        const shown = Math.min(used, capacity);
        const pct = Math.min(100, Math.max(0, (shown / capacity) * 100));
        return (
          <div className="flex w-36 items-center gap-2" title={`${Math.round(pct)}%`}>
            <div className="flex-1">
              <ProgressBar value={pct} max={100} />
            </div>
            <span className="w-14 text-right text-xs tabular-nums">
              {shown} / {capacity}
            </span>
          </div>
        );
      },
    },
    {
      key: "bound",
      header: tr("ผูกกับสินค้า", "Bound SKU"),
      cell: (b) => {
        const k = boundOf(b);
        return k ? <Badge tone="accent">{skuLabel(k, lang)}</Badge> : <span className="text-muted">-</span>;
      },
    },
    {
      key: "flags",
      header: tr("ป้ายบาร์โค้ด", "Label"),
      cell: (b) => (b.labelPrinted ? <Badge tone="solid" icon="✓">{tr("พิมพ์แล้ว", "Printed")}</Badge> : <Badge tone="dashed">{tr("ยังไม่พิมพ์", "Not printed")}</Badge>),
    },
    {
      key: "act",
      header: "",
      cell: (b) => (
        <Button size="sm" variant="secondary" onClick={() => setOpenId(b.id)}>
          {tr("ดู", "View")}
        </Button>
      ),
    },
  ];

  const contents = open ? data.stock.filter((r) => r.binId === open.id && r.qty > 0) : [];

  return (
    <div>
      <PageHeader
        title={tr("ผังตำแหน่งจัดเก็บ", "Location map")}
        subtitle={tr(
          "โซน → ทางเดิน → แร็ค → ชั้น → ช่อง (Bin) พร้อมระดับชั้นสำหรับการหยิบและการผูกช่องกับสินค้า",
          "Zone → aisle → rack → shelf → bin, with ergonomic level for picking and SKU bindings.",
        )}
      />
      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <Field label={tr("โซน", "Zone")}>
          <Select value={zone} onChange={(e) => setZone(e.target.value as ZoneType | "all")}>
            <option value="all">{tr("ทั้งหมด", "All")}</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {ZONE_LABEL[z][lang]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr("ค้นหาตำแหน่ง", "Search location")} className="min-w-56 flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="A-01-02…" />
        </Field>
        <div className="pb-2 text-sm text-muted">
          {bins.length} / {data.bins.length} {tr("ช่อง", "bins")}
        </div>
      </Card>
      <DataTable
        dense
        columns={cols}
        rows={bins}
        rowKey={(b) => b.id}
        empty={tr("ไม่พบตำแหน่ง", "No locations found")}
      />

      <Dialog
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open ? open.path : ""}
        footer={
          open ? (
            <>
              <Button
                variant="secondary"
                onClick={() => actions.setBinFlag(open.id, { labelPrinted: !open.labelPrinted })}
              >
                {open.labelPrinted ? tr("ยกเลิกสถานะพิมพ์ป้าย", "Unmark label") : tr("ทำเครื่องหมายว่าพิมพ์ป้ายแล้ว", "Mark label printed")}
              </Button>
              <Button variant="secondary" onClick={() => actions.setBinFlag(open.id, { active: !open.active })}>
                {open.active ? tr("ปิดใช้ช่องนี้", "Deactivate bin") : tr("เปิดใช้ช่องนี้", "Activate bin")}
              </Button>
            </>
          ) : null
        }
      >
        {open ? (
          <div className="space-y-4">
            <div className="flex justify-center rounded border border-silver-metal p-2">
              <BarcodeSvg value={open.barcode} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted">{tr("โซน", "Zone")}</dt>
              <dd>{ZONE_LABEL[open.zoneType][lang]}</dd>
              <dt className="text-muted">{tr("น้ำหนักสูงสุด", "Max weight")}</dt>
              <dd>{open.maxWeightG / 1000} kg</dd>
              <dt className="text-muted">{tr("ปริมาตรสูงสุด", "Max volume")}</dt>
              <dd>{(open.maxVolumeCm3 / 1000).toLocaleString()} L</dd>
              <dt className="text-muted">{tr("ขนาดสูงสุด", "Max dims")}</dt>
              <dd>
                {open.maxDimsCm.l}×{open.maxDimsCm.w}×{open.maxDimsCm.h} cm
              </dd>
              <dt className="text-muted">{tr("สถานะ", "Status")}</dt>
              <dd>{open.active ? tr("ใช้งาน", "Active") : tr("ปิดใช้", "Inactive")}</dd>
            </dl>

            <div>
              <h3 className="mb-1 font-semibold">{tr("สินค้าในช่อง", "Contents")}</h3>
              {contents.length === 0 ? (
                <p className="text-sm text-muted">{tr("ว่าง", "Empty")}</p>
              ) : (
                <ul className="divide-y divide-silver text-sm">
                  {contents.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span>
                        {skuLabel(data.skus.find((k) => k.id === r.skuId), lang)}{" "}
                        <span className="font-mono text-xs text-muted">{r.lotNo}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusPill status={r.status} />
                        <b className="tabular-nums">{r.qty}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {open.zoneType === "pickface" || open.zoneType === "storage" ? (
              <div>
                <h3 className="mb-1 font-semibold">{tr("ผูกช่องกับสินค้า (Bin binding)", "Bin binding")}</h3>
                <p className="mb-2 text-xs text-muted">
                  {tr(
                    "ช่องที่ผูกแล้วจะได้คะแนนสูงเมื่อระบบแนะนำตำแหน่งจัดเก็บของสินค้านั้น",
                    "A bound bin scores higher when putaway is suggested for that SKU.",
                  )}
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label={tr("สินค้า", "SKU")} className="min-w-52 flex-1">
                    <Select value={bindSku} onChange={(e) => setBindSku(e.target.value)}>
                      <option value="">{tr("เลือก…", "Select…")}</option>
                      {data.skus.map((k) => (
                        <option key={k.id} value={k.id}>
                          {skuLabel(k, lang)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button disabled={!bindSku} onClick={() => actions.bindBin({ binId: open.id, skuId: bindSku })}>
                    {tr("ผูก", "Bind")}
                  </Button>
                  <Button variant="secondary" onClick={() => actions.unbindBin(open.id)}>
                    {tr("ปลดผูก", "Unbind")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
