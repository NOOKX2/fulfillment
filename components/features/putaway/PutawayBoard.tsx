"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { Tabs } from "@/components/ui/Tabs";
import { skuLabel } from "@/lib/domain/format";
import type { PutawayTask } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";
import { PutawayFlow } from "./PutawayFlow";

export function PutawayBoard() {
  const { tr, lang } = useT();
  const data = useWms((s) => s.data);
  const [tab, setTab] = useState<"open" | "done">("open");
  const [openId, setOpenId] = useState<string | null>(null);

  const isOpen = (t: PutawayTask) => t.status === "suggested" || t.status === "in_progress";
  const rows = data.putaway.filter((t) => (tab === "open" ? isOpen(t) : !isOpen(t))).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const path = (id?: string) => data.bins.find((b) => b.id === id)?.path ?? "-";

  const cols: Column<PutawayTask>[] = [
    { key: "id", header: tr("งาน", "Task"), cell: (t) => <span className="font-mono text-xs">{t.id}</span> },
    { key: "sku", header: tr("สินค้า", "SKU"), cell: (t) => skuLabel(data.skus.find((k) => k.id === t.skuId), lang) },
    { key: "lot", header: tr("ล็อต", "Lot"), cell: (t) => <span className="font-mono text-xs">{t.lotNo}</span> },
    { key: "qty", header: tr("จำนวน", "Qty"), align: "right", cell: (t) => <b>{t.qty}</b> },
    { key: "from", header: tr("จาก", "From"), cell: (t) => <span className="font-mono text-xs">{path(t.fromBinId)}</span> },
    {
      key: "to",
      header: t0(tab, tr),
      cell: (t) => (
        <span className="font-mono text-xs">
          {t.status === "completed" ? path(t.chosenBinId) : path(t.suggestions[0]?.binId)}
        </span>
      ),
    },
    { key: "st", header: tr("สถานะ", "Status"), cell: (t) => <StatusPill status={t.status} /> },
    {
      key: "do",
      header: "",
      cell: (t) => (
        <div className="flex gap-1">
          <Button size="sm" onClick={() => setOpenId(t.id)}>
            {isOpen(t) ? tr("ทำงาน", "Work") : tr("ดู", "View")}
          </Button>
          {isOpen(t) ? (
            <Button size="sm" variant="ghost" onClick={() => actions.cancelPutaway(t.id)}>
              {tr("ยกเลิก", "Cancel")}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={tr("จัดเก็บเข้าตำแหน่ง", "Putaway")}
        subtitle={tr(
          "ระบบแนะนำช่องจากความเร็วในการขาย ขนาด น้ำหนัก และการผูกช่อง พนักงานสแกนสินค้าแล้วสแกนป้ายช่องเพื่อยืนยัน – ทำได้ที่เครื่อง PDA หรือกดทำงานจากหน้านี้",
          "Bins are suggested from velocity, size, weight and bindings. Scan the item, then the bin label to confirm - on the PDA or from this screen.",
        )}
        actions={
          <Link href="/pda/putaway" className="text-sm text-gold-deep underline underline-offset-2">
            📟 {tr("เปิดบน PDA", "Open on PDA")}
          </Link>
        }
      />
      <Tabs
        tabs={[
          { key: "open" as const, label: tr("งานค้าง", "Open"), count: data.putaway.filter(isOpen).length },
          { key: "done" as const, label: tr("เสร็จ/ยกเลิก", "Done / cancelled"), count: data.putaway.filter((t) => !isOpen(t)).length },
        ]}
        value={tab}
        onChange={setTab}
      />
      <DataTable
        dense
        columns={cols}
        rows={rows}
        rowKey={(t) => t.id}
        empty={tab === "open" ? tr("ไม่มีงานจัดเก็บค้าง – ผ่าน QC เพื่อสร้างงานใหม่", "No open putaway - pass QC to create tasks") : tr("ยังไม่มี", "None yet")}
      />
      <Dialog open={!!openId} onClose={() => setOpenId(null)} title={tr("งานจัดเก็บ", "Putaway task")}>
        {openId ? <PutawayFlow taskId={openId} /> : null}
      </Dialog>
    </div>
  );
}

function t0(tab: "open" | "done", tr: (a: string, b: string) => string): string {
  return tab === "open" ? tr("ตำแหน่งแนะนำ", "Suggested") : tr("ตำแหน่งจริง", "Actual");
}
