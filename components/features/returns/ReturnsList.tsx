"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScanInput } from "@/components/scan/ScanInput";
import { ScanSimulator, type SimChip } from "@/components/scan/ScanSimulator";
import { StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, PageHeader, Stat } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { localDate, localHM } from "@/lib/clock";
import { skuLabel } from "@/lib/domain/format";
import type { ReturnOrder, RtvClaim } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

export function ReturnsList() {
  const { tr, lang, st } = useT();
  const router = useRouter();
  const data = useWms((s) => s.data);
  const open = data.returns.filter((r) => r.status !== "completed" && r.status !== "rejected");

  const intake = (raw: string) => {
    const res = actions.returnIntake({ raw });
    if (res.ok) router.push(`/console/returns/${res.data.returnId}`);
  };

  const chips: SimChip[] = [
    ...data.returns
      .filter((r) => r.status === "expected")
      .slice(0, 4)
      .map((r) => ({ label: `RMA ${r.rmaNo}`, value: r.rmaNo })),
    ...data.shipments
      .filter((x) => x.status === "handed_over")
      .slice(0, 2)
      .map((x) => ({ label: `${tr("ใบปะหน้าเดิม", "Original AWB")} ${x.trackingNo}`, value: x.trackingNo })),
    { label: tr("RMA ที่ไม่มีในระบบ", "Unknown RMA"), value: "RMA-999999", wrong: true },
  ];

  const cols: Column<ReturnOrder>[] = [
    {
      key: "rma",
      header: "RMA",
      cell: (r) => (
        <Link className="font-mono font-semibold underline" href={`/console/returns/${r.id}`}>
          {r.rmaNo}
        </Link>
      ),
    },
    { key: "order", header: tr("ออเดอร์", "Order"), cell: (r) => data.orders.find((o) => o.id === r.orderId)?.channelOrderNo ?? "-" },
    { key: "reason", header: tr("เหตุผล", "Reason"), cell: (r) => r.reason },
    {
      key: "qty",
      header: tr("รับ/คาดว่า", "Recv/Exp"),
      cell: (r) => `${r.lines.reduce((n, l) => n + l.receivedQty, 0)}/${r.lines.reduce((n, l) => n + l.expectedQty, 0)}`,
      align: "right",
    },
    { key: "status", header: tr("สถานะ", "Status"), cell: (r) => <StatusPill status={r.status} /> },
    { key: "at", header: tr("สร้างเมื่อ", "Created"), cell: (r) => `${localDate(r.createdAt)} ${localHM(r.createdAt)}` },
  ];

  const claimCols: Column<RtvClaim>[] = [
    { key: "sku", header: "SKU", cell: (c) => skuLabel(data.skus.find((k) => k.id === c.skuId), lang) },
    { key: "sup", header: tr("ซัพพลายเออร์", "Supplier"), cell: (c) => data.suppliers.find((x) => x.id === c.supplierId)?.name[lang] ?? "-" },
    { key: "qty", header: tr("จำนวน", "Qty"), cell: (c) => c.qty, align: "right" },
    { key: "reason", header: tr("เหตุผล", "Reason"), cell: (c) => c.reason },
    { key: "status", header: tr("สถานะ", "Status"), cell: (c) => st(c.status) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("รับคืนและโลจิสติกส์ย้อนกลับ", "Returns & reverse logistics")}
        subtitle={tr(
          "สแกน RMA หรือใบปะหน้าเดิมเพื่อรับของคืน ประเมินสภาพ A/B/C แล้วคืนสต็อก แพ็กใหม่ ทำลาย หรือเคลมซัพพลายเออร์",
          "Scan an RMA or the original airway bill, grade A/B/C, then restock, repack, destroy or claim from the supplier.",
        )}
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              const res = actions.demoReturn();
              if (res.ok) router.push(`/console/returns/${res.data.returnId}`);
            }}
          >
            + {tr("สร้างรายการคืนจำลอง", "Create demo return")}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={tr("รอรับเข้า", "Expected")} value={data.returns.filter((r) => r.status === "expected").length} />
        <Stat label={tr("กำลังดำเนินการ", "In progress")} value={open.filter((r) => r.status !== "expected").length} />
        <Stat label={tr("เสร็จแล้ว", "Completed")} value={data.returns.filter((r) => r.status === "completed").length} />
        <Stat label={tr("เคลม RTV", "RTV claims")} value={data.rtvClaims.length} />
      </div>
      <Card>
        <CardTitle>{tr("รับของคืนเข้าคลัง", "Return intake")}</CardTitle>
        <ScanInput onScan={intake} label={tr("สแกน RMA / เลขพัสดุตีกลับ / ใบปะหน้าเดิม", "Scan RMA / return tracking / original AWB")} />
        <div className="mt-3">
          <ScanSimulator chips={chips} onScan={intake} />
        </div>
      </Card>
      <DataTable
        columns={cols}
        rows={[...data.returns].reverse()}
        rowKey={(r) => r.id}
        empty={tr("ยังไม่มีรายการคืน – กด “สร้างรายการคืนจำลอง” (ต้องมีออเดอร์ที่ส่งมอบแล้ว)", "No returns yet - use “Create demo return” (needs a handed-over order).")}
      />
      {data.rtvClaims.length > 0 ? (
        <div>
          <h2 className="mb-2 text-lg font-bold">{tr("เคลมซัพพลายเออร์ (RTV)", "Supplier claims (RTV)")}</h2>
          <DataTable columns={claimCols} rows={data.rtvClaims} rowKey={(c) => c.id} />
        </div>
      ) : null}
    </div>
  );
}
