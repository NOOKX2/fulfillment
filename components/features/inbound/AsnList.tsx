"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusPill } from "@/components/ui/Badge";
import { PageHeader, ProgressBar } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs } from "@/components/ui/Tabs";
import type { Asn } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";

export function AsnList() {
  const { tr, l } = useT();
  const router = useRouter();
  const data = useWms((s) => s.data);
  const [tab, setTab] = useState<"open" | "all">("open");

  const isOpen = (a: Asn) => a.status === "expected" || a.status === "receiving" || a.status === "received";
  const rows = data.asns.filter((a) => tab === "all" || isOpen(a));

  const cols: Column<Asn>[] = [
    {
      key: "no",
      header: "ASN",
      cell: (a) => (
        <Link href={`/console/inbound/asn/${a.id}`} className="font-mono font-semibold text-gold-deep underline underline-offset-2">
          {a.asnNo}
        </Link>
      ),
    },
    {
      key: "sup",
      header: tr("ซัพพลายเออร์", "Supplier"),
      cell: (a) => {
        const s = data.suppliers.find((x) => x.id === a.supplierId);
        return s ? l(s.name) : "-";
      },
    },
    { key: "po", header: "PO", cell: (a) => <span className="font-mono text-xs">{data.pos.find((p) => p.id === a.poId)?.poNo ?? "-"}</span> },
    { key: "date", header: tr("วันที่คาดว่าจะถึง", "Expected"), cell: (a) => a.expectedAt },
    { key: "dock", header: tr("ประตูรับ", "Dock"), cell: (a) => a.dockDoor ?? "-" },
    { key: "lines", header: tr("รายการ", "Lines"), align: "right", cell: (a) => a.lines.length },
    {
      key: "prog",
      header: tr("รับแล้ว", "Received"),
      cell: (a) => {
        const exp = a.lines.reduce((n, x) => n + x.expectedQty, 0);
        const rec = a.lines.reduce((n, x) => n + x.receivedQty, 0);
        return (
          <div className="w-36">
            <div className="mb-1 text-xs tabular-nums">
              {rec} / {exp}
            </div>
            <ProgressBar value={rec} max={exp} />
          </div>
        );
      },
    },
    { key: "st", header: tr("สถานะ", "Status"), cell: (a) => <StatusPill status={a.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title={tr("รับสินค้าเข้า (ASN)", "Inbound receiving (ASN)")}
        subtitle={tr(
          "จับคู่ ASN กับ PO แล้วสแกนรับสินค้าทีละชิ้น ส่วนต่างจะถูกบันทึกอัตโนมัติ สินค้าที่รับเข้ามาจะอยู่ในสถานะ “รอ QC” ยังขายไม่ได้",
          "Match the ASN to its PO and scan items in. Differences are logged automatically. Received stock is Pending QC and cannot be sold yet.",
        )}
      />
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
        onRowClick={(a) => router.push(`/console/inbound/asn/${a.id}`)}
        empty={tr("ไม่มี ASN", "No ASNs")}
      />
    </div>
  );
}
