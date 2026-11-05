"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/form";
import { Tabs } from "@/components/ui/Tabs";
import { skuLabel } from "@/lib/domain/format";
import type { PutawayTask } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";
import { PutawayFlow } from "./PutawayFlow";

export function PutawayBoard() {
  const { tr, lang, st } = useT();
  const data = useWms((s) => s.data);
  const [tab, setTab] = useState<"open" | "done">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [zone, setZone] = useState("all");
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveResult, setApproveResult] = useState<{ ok: number; failed: number } | null>(null);

  const isOpen = (t: PutawayTask) => t.status === "suggested" || t.status === "in_progress";
  const path = (id?: string) => data.bins.find((b) => b.id === id)?.path ?? "-";
  const targetBin = (t: PutawayTask) =>
    data.bins.find((b) => b.id === (t.status === "completed" ? t.chosenBinId : t.suggestions[0]?.binId));
  const needle = q.trim().toLowerCase();
  const rows = data.putaway
    .filter((t) => (tab === "open" ? isOpen(t) : !isOpen(t)))
    .filter((t) => status === "all" || t.status === status)
    .filter((t) => zone === "all" || targetBin(t)?.zone === zone)
    .filter((t) => {
      if (!needle) return true;
      const sku = data.skus.find((k) => k.id === t.skuId);
      return [t.id, t.lotNo, sku?.code ?? "", skuLabel(sku, lang), path(t.fromBinId), targetBin(t)?.path ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const zones = [...new Set(data.putaway.map((t) => targetBin(t)?.zone).filter((z): z is string => !!z))].sort();
  const statuses = tab === "open" ? ["suggested", "in_progress"] : ["completed", "cancelled"];
  const approvable = rows.filter(isOpen);

  /** Approve = accept the suggested bin for every listed open task (item scan + bin scan, no override). */
  const approveAll = () => {
    let ok = 0;
    let failed = 0;
    for (const t of approvable) {
      const sku = data.skus.find((k) => k.id === t.skuId);
      const bin = data.bins.find((b) => b.id === t.suggestions[0]?.binId);
      if (!sku || !bin) {
        failed++;
        continue;
      }
      const first = t.scannedItemOk ? { ok: true } : actions.putawayItem({ taskId: t.id, raw: sku.barcodes[0] });
      const second = first.ok ? actions.putawayBin({ taskId: t.id, raw: bin.barcode }) : first;
      if (second.ok) ok++;
      else failed++;
    }
    setApproveResult({ ok, failed });
    setApproveOpen(false);
  };

  const cols: Column<PutawayTask>[] = [
    { key: "id", header: tr("งาน", "Task"), cell: (t) => <span className="font-mono text-xs">{t.id}</span> },
    { key: "sku", header: tr("สินค้า", "SKU"), cell: (t) => skuLabel(data.skus.find((k) => k.id === t.skuId), lang) },
    { key: "lot", header: tr("ล็อต", "Lot"), cell: (t) => <span className="font-mono text-xs">{t.lotNo}</span> },
    { key: "qty", header: tr("จำนวน", "Qty"), align: "right", cell: (t) => <b>{t.qty}</b> },
    { key: "from", header: tr("จุดรับของ", "Pickup"), cell: (t) => <span className="font-mono text-xs">{path(t.fromBinId)}</span> },
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
      <nav aria-label={tr("นำทาง", "Navigation")} className="mb-4">
        <Link
          href="/console/inbound"
          className="inline-flex min-h-10 items-center gap-2 rounded-control border border-ink px-4 text-sm font-semibold text-ink hover:bg-silver"
        >
          <span aria-hidden>←</span> {tr("ย้อนกลับ", "Back")}
        </Link>
      </nav>
      <PageHeader
        title={tr("จัดเก็บเข้าตำแหน่ง", "Putaway")}
        subtitle={tr(
          "ระบบแนะนำช่องจากความเร็วในการขาย ขนาด น้ำหนัก และการผูกช่อง พนักงานสแกนสินค้าแล้วสแกนป้ายช่องเพื่อยืนยัน – ทำได้ที่เครื่อง PDA หรือกดทำงานจากหน้านี้",
          "Bins are suggested from velocity, size, weight and bindings. Scan the item, then the bin label to confirm - on the PDA or from this screen.",
        )}
        actions={
          <>
            <Link href="/pda/putaway" className="text-sm text-gold-deep underline underline-offset-2">
              📟 {tr("เปิดบน PDA", "Open on PDA")}
            </Link>
            <Button disabled={tab !== "open" || approvable.length === 0} onClick={() => setApproveOpen(true)}>
              ✓ {tr("อนุมัติเข้าสู่คลัง", "Approve into warehouse")} ({approvable.length})
            </Button>
          </>
        }
      />
      <Tabs
        tabs={[
          { key: "open" as const, label: tr("งานค้าง", "Open"), count: data.putaway.filter(isOpen).length },
          { key: "done" as const, label: tr("เสร็จ/ยกเลิก", "Done / cancelled"), count: data.putaway.filter((t) => !isOpen(t)).length },
        ]}
        value={tab}
        onChange={(k) => {
          setTab(k);
          setStatus("all");
        }}
      />
      {approveResult ? (
        <p role="status" className="mb-3 rounded-lg border-2 border-dashed border-ink bg-silver p-3 text-sm font-semibold">
          {tr(
            `อนุมัติแล้ว ${approveResult.ok} งาน${approveResult.failed ? ` · ไม่สำเร็จ ${approveResult.failed} งาน (ช่องเต็มหรือข้อมูลไม่ครบ ตรวจที่ปุ่ม “ทำงาน”)` : ""}`,
            `Approved ${approveResult.ok} task(s)${approveResult.failed ? ` · ${approveResult.failed} failed (bin full or missing data - use "Work")` : ""}`,
          )}
        </p>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="min-w-64 flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr("ค้นหาสินค้า, ล็อต, ช่องเก็บ...", "Search SKU, lot, bin...")}
          aria-label={tr("ค้นหา", "Search")}
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={tr("กรองสถานะ", "Filter by status")}>
          <option value="all">{tr("สถานะ: ทั้งหมด", "Status: all")}</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {st(s)}
            </option>
          ))}
        </Select>
        <Select value={zone} onChange={(e) => setZone(e.target.value)} aria-label={tr("กรองโซน", "Filter by zone")}>
          <option value="all">{tr("โซน: ทุกโซน", "Zone: all")}</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {tr("โซน", "Zone")} {z}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        dense
        columns={cols}
        rows={rows}
        rowKey={(t) => t.id}
        empty={tab === "open" ? tr("ไม่มีงานจัดเก็บค้าง – ผ่าน QC เพื่อสร้างงานใหม่", "No open putaway - pass QC to create tasks") : tr("ยังไม่มี", "None yet")}
      />
      <Dialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title={tr("อนุมัติเข้าสู่คลัง", "Approve into warehouse")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproveOpen(false)}>
              {tr("ยกเลิก", "Cancel")}
            </Button>
            <Button onClick={approveAll}>{tr("ยืนยันอนุมัติ", "Confirm")}</Button>
          </>
        }
      >
        <p className="text-sm">
          {tr(
            `นำสินค้า ${approvable.length} งานที่แสดงอยู่เข้าช่องที่ระบบแนะนำ (อันดับ 1) สต็อกจะย้ายจากพื้นที่รับของเข้าช่องเก็บและพร้อมขายทันที`,
            `Put the ${approvable.length} listed task(s) into their top suggested bins. Stock moves from the receiving area to the bins and becomes available to sell.`,
          )}
        </p>
      </Dialog>
      <Dialog open={!!openId} onClose={() => setOpenId(null)} title={tr("งานจัดเก็บ", "Putaway task")}>
        {openId ? <PutawayFlow taskId={openId} /> : null}
      </Dialog>
    </div>
  );
}

function t0(tab: "open" | "done", tr: (a: string, b: string) => string): string {
  return tab === "open" ? tr("ตำแหน่งแนะนำ", "Suggested") : tr("ตำแหน่งจริง", "Actual");
}
