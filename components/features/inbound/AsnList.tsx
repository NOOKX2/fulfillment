"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PageHeader, ProgressBar } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input, Select } from "@/components/ui/form";
import { Tabs } from "@/components/ui/Tabs";
import { asnTotals as totals, stageOf, type InboundStage } from "@/lib/domain/inboundStage";
import type { Asn } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";

type Stage = InboundStage;

const STAGE_ORDER: Stage[] = ["not_started", "counting", "qc", "putaway", "done"];

const STAGE_LABEL: Record<Stage, { th: string; en: string }> = {
  not_started: { th: "รอดำเนินการ", en: "Not started" },
  counting: { th: "1. กำลังตรวจนับ", en: "1. Counting" },
  qc: { th: "2. รอตรวจ QC", en: "2. Awaiting QC" },
  putaway: { th: "3. ผ่าน QC แล้ว / รอจัดเก็บ", en: "3. QC passed / ready to put away" },
  done: { th: "เสร็จสิ้น", en: "Done" },
};

const STAGE_BADGE: Record<Stage, { tone: "dashed" | "accent" | "outline" | "solid" | "neutral"; icon: string }> = {
  not_started: { tone: "dashed", icon: "○" },
  counting: { tone: "accent", icon: "▶" },
  qc: { tone: "outline", icon: "●" },
  putaway: { tone: "solid", icon: "✓" },
  done: { tone: "neutral", icon: "■" },
};

const actionBase =
  "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-control px-3 text-sm font-semibold transition-colors";

export function AsnList() {
  const { tr, l, lang } = useT();
  const router = useRouter();
  const data = useWms((s) => s.data);
  const [tab, setTab] = useState<"open" | "all">("open");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage | "all">("all");

  const isOpen = (a: Asn) => a.status === "expected" || a.status === "receiving" || a.status === "received";
  const supplierName = (a: Asn) => {
    const s = data.suppliers.find((x) => x.id === a.supplierId);
    return s ? l(s.name) : "-";
  };
  const poNo = (a: Asn) => data.pos.find((p) => p.id === a.poId)?.poNo ?? "";

  const needle = q.trim().toLowerCase();
  const rows = data.asns
    .filter((a) => tab === "all" || isOpen(a))
    .filter((a) => stage === "all" || stageOf(a, data) === stage)
    .filter(
      (a) =>
        !needle ||
        a.asnNo.toLowerCase().includes(needle) ||
        poNo(a).toLowerCase().includes(needle) ||
        supplierName(a).toLowerCase().includes(needle),
    );

  const detail = (a: Asn) => `/console/inbound/asn/${a.id}`;
  const stop = (e: React.MouseEvent) => e.stopPropagation(); // keep the row click from also firing

  const action = (a: Asn) => {
    switch (stageOf(a, data)) {
      case "not_started":
        return (
          <Link href={detail(a)} onClick={stop} className={`${actionBase} border border-ink text-ink hover:bg-silver`}>
            {tr("เริ่มรับสินค้า", "Start receiving")}
          </Link>
        );
      case "counting":
        return (
          <Link href={detail(a)} onClick={stop} className={`${actionBase} border border-ink bg-silver text-ink hover:bg-silver-metal/50`}>
            {tr("ตรวจนับสินค้าต่อ →", "Continue counting →")}
          </Link>
        );
      case "qc":
        if (a.status !== "closed" && a.status !== "closed_with_discrepancy")
          return (
            <Link href={detail(a)} onClick={stop} className={`${actionBase} bg-amber-700 text-white hover:bg-amber-800`}>
              {tr("อนุมัติรับเข้า →", "Approve receipt →")}
            </Link>
          );
        return (
          <Link
            href={`/pda/qc?asn=${a.id}`}
            onClick={stop}
            className={`${actionBase} bg-amber-700 text-white hover:bg-amber-800`}
          >
            {tr("ตรวจ QC (PDA) →", "QC on PDA →")}
          </Link>
        );
      case "putaway":
        return (
          <Link href="/console/putaway" onClick={stop} className={`${actionBase} bg-success text-white hover:brightness-95`}>
            {tr("ส่งต่องานจัดเก็บ →", "Go to putaway →")}
          </Link>
        );
      default:
        return (
          <Link href={detail(a)} onClick={stop} className={`${actionBase} text-ink underline underline-offset-2 hover:bg-silver`}>
            {tr("ดูรายละเอียด", "View")}
          </Link>
        );
    }
  };

  const cols: Column<Asn>[] = [
    {
      key: "no",
      header: tr("รหัส ASN", "ASN"),
      cell: (a) => (
        <div>
          <Link href={detail(a)} onClick={stop} className="font-mono font-semibold text-gold-deep underline underline-offset-2">
            {a.asnNo}
          </Link>
          {poNo(a) ? <div className="font-mono text-[11px] text-muted">{poNo(a)}</div> : null}
        </div>
      ),
    },
    { key: "sup", header: tr("ซัพพลายเออร์", "Supplier"), cell: supplierName },
    { key: "dock", header: tr("ประตูรับ", "Dock door"), cell: (a) => <span className="font-mono">{a.dockDoor ?? "-"}</span> },
    {
      key: "prog",
      header: tr("ความคืบหน้า", "Progress"),
      cell: (a) => {
        const { exp, rec } = totals(a);
        return (
          <div className="flex w-40 items-center gap-2">
            <div className="flex-1">
              <ProgressBar value={rec} max={exp} />
            </div>
            <span className="w-14 text-right text-xs font-semibold tabular-nums">
              {rec}/{exp}
            </span>
          </div>
        );
      },
    },
    {
      key: "stage",
      header: tr("ขั้นตอนปัจจุบัน", "Current stage"),
      cell: (a) => {
        const s = stageOf(a, data);
        return (
          <Badge tone={STAGE_BADGE[s].tone} icon={STAGE_BADGE[s].icon}>
            {STAGE_LABEL[s][lang]}
          </Badge>
        );
      },
    },
    { key: "act", header: tr("การดำเนินการ", "Action"), align: "right", cell: action },
  ];

  return (
    <div>
      <PageHeader
        title={tr("รับสินค้าเข้าคลัง (Inbound / ASN)", "Inbound receiving (ASN)")}
        subtitle={tr(
          "จัดการเที่ยวรถส่งของและติดตามสถานะการตรวจรับ สินค้าที่รับเข้ามาจะอยู่ในสถานะ “รอ QC” ยังขายไม่ได้จนกว่าจะผ่านการตรวจ",
          "Manage inbound trucks and track receiving progress. Received stock is Pending QC and cannot be sold until it passes inspection.",
        )}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="min-w-64 flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr("ค้นหาเลขที่ ASN, ซัพพลายเออร์ หรือ PO...", "Search ASN, supplier or PO...")}
          aria-label={tr("ค้นหา", "Search")}
        />
        <Select value={stage} onChange={(e) => setStage(e.target.value as Stage | "all")} aria-label={tr("กรองขั้นตอน", "Filter by stage")}>
          <option value="all">{tr("ทุกขั้นตอน", "All stages")}</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s][lang]}
            </option>
          ))}
        </Select>
      </div>
      <Tabs
        tabs={[
          { key: "open" as const, label: tr("ที่ยังเปิดอยู่", "Open"), count: data.asns.filter(isOpen).length },
          { key: "all" as const, label: tr("ทั้งหมด", "All"), count: data.asns.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      <DataTable
        columns={cols}
        rows={rows}
        rowKey={(a) => a.id}
        onRowClick={(a) => router.push(detail(a))}
        empty={tr("ไม่พบ ASN ที่ตรงเงื่อนไข", "No matching ASNs")}
      />
    </div>
  );
}
