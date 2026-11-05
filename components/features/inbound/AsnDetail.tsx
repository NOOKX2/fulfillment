"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import {
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
  ProgressBar,
} from "@/components/ui/Card";
import {
  fmtDate,
  ProductCell,
  QcProgress,
  QcResult,
  QcStatusBadge,
} from "./qcCells";
import { skuLabel } from "@/lib/domain/format";
import {
  asnTotals,
  isCounted,
  pendingQcLots,
  stageOf,
} from "@/lib/domain/inboundStage";
import type { AsnLine } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

type StepState = "done" | "active" | "todo";

const navBtn =
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 text-sm font-semibold transition-colors";

export function AsnDetail({ asnId }: { asnId: string }) {
  const { tr, l, lang } = useT();
  const data = useWms((s) => s.data);
  const asn = data.asns.find((a) => a.id === asnId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!asn) {
    return (
      <EmptyState>
        {tr("ไม่พบ ASN นี้", "ASN not found")}{" "}
        <Link href="/console/inbound" className="text-gold-deep underline">
          {tr("กลับรายการ", "Back to list")}
        </Link>
      </EmptyState>
    );
  }

  const supplier = data.suppliers.find((x) => x.id === asn.supplierId);
  const po = data.pos.find((p) => p.id === asn.poId);
  const receipts = data.receipts.filter((r) => r.asnId === asn.id);
  const { exp, rec } = asnTotals(asn);

  // Workflow: count -> QC -> putaway
  const stage = stageOf(asn, data);
  const qcLots = pendingQcLots(asn, data).length;
  const lotsAll = receipts.length;
  const qcTotal = receipts.reduce((n, x) => n + x.qty, 0);
  const qcDoneQty = receipts.reduce((n, x) => n + x.qcDone, 0);
  const counted = isCounted(asn);
  const closed =
    asn.status === "closed" || asn.status === "closed_with_discrepancy";
  const mismatches = asn.lines.filter(
    (ln) => ln.receivedQty !== ln.expectedQty,
  );
  // Putaway (step 3): tasks of this ASN's lots, grouped per SKU + lot.
  const ptasks = data.putaway.filter(
    (pt) =>
      pt.status !== "cancelled" &&
      receipts.some((r) => r.skuId === pt.skuId && r.lotNo === pt.lotNo),
  );
  const totalCount = ptasks.length;
  const scannedCount = ptasks.filter((pt) => pt.status === "completed").length;
  const putAllDone = totalCount > 0 && scannedCount === totalCount;
  const putRows = receipts
    .map((r) => {
      const ts = ptasks.filter(
        (pt) => pt.skuId === r.skuId && pt.lotNo === r.lotNo,
      );
      const qty = ts.reduce((n, pt) => n + pt.qty, 0);
      const done = ts
        .filter((pt) => pt.status === "completed")
        .reduce((n, pt) => n + pt.qty, 0);
      const started = ts.some(
        (pt) => pt.status === "in_progress" || pt.scannedItemOk,
      );
      const bins = ts
        .map((pt) =>
          data.bins.find(
            (b) => b.id === (pt.chosenBinId ?? pt.suggestions[0]?.binId),
          ),
        )
        .filter((b): b is NonNullable<typeof b> => !!b);
      return { r, qty, done, started, bin: bins[0], more: bins.length - 1 };
    })
    .filter((x) => x.qty > 0);
  const putQty = putRows.reduce((n, x) => n + x.qty, 0);
  const putDoneQty = putRows.reduce((n, x) => n + x.done, 0);
  const zones = [
    ...new Set(putRows.map((x) => x.bin?.zone).filter(Boolean)),
  ].join(", ");
  const p3 = !!asn.qcApproved;
  const qcAllDone = receipts.length > 0 && qcLots === 0;
  const qcHref = `/pda/qc?asn=${asn.id}`; // QC is done on the PDA, not in the console

  /** Approve = close the receiving (logging any over/short as acknowledged discrepancies) (the QC columns then take over the table). */
  const approve = () => {
    if (closed || !counted) return;
    const res = actions.closeAsn({ asnId: asn.id, acknowledge: true });
    if (res.ok) {
      setConfirmOpen(false);
    }
  };
  const onApprove = () =>
    mismatches.length > 0 && !closed ? setConfirmOpen(true) : approve();
  const steps: { title: string; sub: string; state: StepState }[] = [
    {
      title: tr("1. ตรวจนับท้ายรถ", "1. Count at the truck"),
      sub: closed
        ? tr(
            `นับครบ ${rec} ชิ้น · อนุมัติแล้ว`,
            `Counted ${rec} units · approved`,
          )
        : counted
          ? tr(
              `สแกนครบ ${rec} ชิ้น · รออนุมัติรับเข้า`,
              `Scanned ${rec} units · awaiting approval`,
            )
          : tr(`นับแล้ว ${rec}/${exp} ชิ้น`, `Counted ${rec}/${exp} units`),
      state: closed ? "done" : "active",
    },
    {
      title: tr("2. ตรวจสอบคุณภาพ (QC)", "2. Quality check (QC)"),
      sub: p3
        ? tr(`ผ่าน QC ครบ ${qcDoneQty} ชิ้น`, `QC passed ${qcDoneQty} units`)
        : stage === "putaway" || stage === "done"
          ? tr("ตรวจครบแล้ว", "All inspected")
          : !closed
            ? tr("รออนุมัติรับเข้าก่อน", "Approve receipt first")
            : qcAllDone
              ? tr(
                  "ตรวจครบแล้ว · รออนุมัติผล QC",
                  "Inspection complete · awaiting QC approval",
                )
              : lotsAll > 0
                ? tr(
                    `ตรวจแล้ว ${qcDoneQty}/${qcTotal} ชิ้น · รอ ${qcLots} ล็อต`,
                    `Inspected ${qcDoneQty}/${qcTotal} units · ${qcLots} lot(s) waiting`,
                  )
                : tr("ยังไม่เริ่ม", "Not started"),
      state: asn.qcApproved ? "done" : closed ? "active" : "todo",
    },
    {
      title: tr("3. ส่งต่องานจัดเก็บ", "3. Hand over to putaway"),
      sub: !p3
        ? tr("รออนุมัติผล QC ก่อน", "Approve the QC result first")
        : asn.putawayApproved
          ? tr("เสร็จสิ้น", "Done")
          : tr(
              `รอนำขึ้นชั้นวาง ${totalCount - scannedCount} งาน`,
              `${totalCount - scannedCount} task(s) to shelve`,
            ),
      state: !p3 ? "todo" : asn.putawayApproved ? "done" : "active",
    },
  ];

  const statusOf = (ln: AsnLine) => {
    const diff = ln.receivedQty - ln.expectedQty;
    if (diff > 0)
      return (
        <Badge tone="outline" icon="⚠">
          {tr("เกินยอด", "Over")} (+{diff})
        </Badge>
      );
    if (diff < 0 && counted)
      return (
        <Badge tone="outline" icon="⚠">
          {tr("ของขาด", "Short")} (−{-diff})
        </Badge>
      );
    if (ln.receivedQty === 0)
      return (
        <Badge tone="dashed" icon="○">
          {tr("ยังไม่เริ่ม", "Not started")}
        </Badge>
      );
    if (diff < 0)
      return (
        <Badge tone="accent" icon="▶">
          {tr("กำลังนับ", "Counting")}
        </Badge>
      );
    return (
      <Badge tone="solid" icon="✓">
        {tr("ครบ", "Complete")}
      </Badge>
    );
  };

  const th =
    "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`ASN ${asn.asnNo}`}
        subtitle={`${supplier ? l(supplier.name) : ""} · PO ${po?.poNo ?? "-"} · ${tr("คาดว่าจะถึง", "expected")} ${asn.expectedAt}${asn.dockDoor ? ` · ${tr("ประตู", "dock")} ${asn.dockDoor}` : ""}`}
        actions={
          p3 && !asn.putawayApproved ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              {putAllDone
                ? `✓ ${tr("จัดเก็บครบแล้ว", "Putaway complete")} (${scannedCount}/${totalCount} ${tr("งาน", "tasks")})`
                : `⏳ ${tr("กำลังจัดเก็บ", "Putting away")} (${tr("สแกนแล้ว", "scanned")} ${scannedCount}/${totalCount} ${tr("งาน", "tasks")})`}
            </span>
          ) : (
            <StatusPill status={asn.status} />
          )
        }
      />

      <nav
        aria-label={tr("นำทาง", "Navigation")}
        className="flex flex-wrap items-center justify-between gap-2"
      >
        <Link
          href="/console/inbound"
          className={`${navBtn} border border-ink text-ink hover:bg-silver`}
        >
          <span aria-hidden>←</span> {tr("ย้อนกลับ", "Back")}
        </Link>
        {asn.qcApproved ? (
          asn.putawayApproved ? (
            <span
              aria-disabled="true"
              className={`${navBtn} cursor-default border border-success bg-success/10 text-success`}
            >
              ✓ {tr("ปิดงานรับสินค้าแล้ว", "Inbound completed")}
            </span>
          ) : putAllDone ? (
            <button
              type="button"
              onClick={() => actions.completeAsnPutaway(asn.id)}
              className={`${navBtn} bg-success text-white shadow-sm hover:brightness-95`}
            >
              ✓ {tr("ยืนยันปิดงานรับสินค้า (Complete ASN)", "Complete ASN")}
            </button>
          ) : (
            <span
              aria-disabled="true"
              title={tr(
                "ปิดงานได้เมื่อ PDA จัดเก็บครบทุกงาน",
                "Available once the PDA has put away every task",
              )}
              className={`${navBtn} cursor-not-allowed border border-silver-metal bg-silver text-muted opacity-70`}
            >
              ✓ {tr("ยืนยันปิดงานรับสินค้า (Complete ASN)", "Complete ASN")}
            </span>
          )
        ) : closed ? (
          qcAllDone ? (
            <Button
              onClick={() => {
                actions.approveQc(asn.id);
              }}
            >
              ✓ {tr("อนุมัติผล QC", "Approve QC result")}{" "}
              <span aria-hidden>→</span>
            </Button>
          ) : (
            <span
              aria-disabled="true"
              title={tr(
                "อนุมัติได้เมื่อฝ่าย QC ตรวจครบทุกล็อตแล้ว",
                "Available once QC has inspected every lot",
              )}
              className={`${navBtn} cursor-not-allowed border border-silver-metal bg-silver text-muted`}
            >
              ✓ {tr("อนุมัติผล QC", "Approve QC result")}{" "}
              <span aria-hidden>→</span>
            </span>
          )
        ) : counted ? (
          <Button onClick={onApprove}>
            ✓ {tr("อนุมัติรับเข้า", "Approve receipt")}{" "}
            <span aria-hidden>→</span>
          </Button>
        ) : (
          <span
            aria-disabled="true"
            title={tr(
              "อนุมัติได้เมื่อสแกนรับสินค้าครบแล้ว",
              "Available once all items are scanned in",
            )}
            className={`${navBtn} cursor-not-allowed border border-silver-metal bg-silver text-muted`}
          >
            ✓ {tr("อนุมัติรับเข้า", "Approve receipt")}{" "}
            <span aria-hidden>→</span>
          </span>
        )}
      </nav>

      <Card>
        <CardTitle>{tr("ความคืบหน้ากระบวนการ", "Workflow progress")}</CardTitle>
        <ol className="flex flex-col gap-2 md:flex-row md:items-center">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="flex flex-1 items-center gap-2"
              aria-current={s.state === "active" ? "step" : undefined}
            >
              <div
                className={`flex-1 rounded-md border-2 px-3 py-1.5 ${
                  s.state === "done"
                    ? "border-gold-deep bg-gold text-ink"
                    : s.state === "active"
                      ? "border-gold bg-white text-ink"
                      : "border-dashed border-muted bg-white text-muted"
                }`}
              >
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <span aria-hidden>
                    {s.state === "done"
                      ? "✓"
                      : s.state === "active"
                        ? "●"
                        : "○"}
                  </span>
                  {s.title}
                </div>
                <div
                  className={`text-[11px] leading-tight ${s.state === "active" ? "text-muted" : ""}`}
                >
                  {s.sub}
                </div>
              </div>
              {i < steps.length - 1 ? (
                <span
                  aria-hidden
                  className="hidden text-base text-muted md:inline"
                >
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        {!counted ? (
          <p className="mt-3 text-sm text-muted">
            {tr("นับสินค้าเข้าที่เครื่อง PDA:", "Count items in on the PDA:")}{" "}
            <Link
              href={`/pda/receive/${asn.id}`}
              className="text-gold-deep underline underline-offset-2"
            >
              /pda/receive/{asn.id}
            </Link>
          </p>
        ) : null}
      </Card>

      {p3 ? (
        <>
          <div className="rounded-lg border border-dashed border-silver-metal bg-white px-4 py-3 text-sm">
            <span className="font-semibold">
              {tr("สรุปภาพรวมการจัดเก็บ", "Putaway summary")}
            </span>
            <span className="mx-3 text-silver-metal" aria-hidden>
              |
            </span>
            • {tr("ยอดที่ต้องจัดเก็บ", "To put away")}: <b>{putQty}</b>{" "}
            {tr("ชิ้น", "pcs")}
            <span className="mx-3 text-silver-metal" aria-hidden>
              |
            </span>
            • {tr("สแกนเก็บสำเร็จแล้ว", "Put away")}: <b>{putDoneQty}</b>{" "}
            {tr("ชิ้น", "pcs")}
            <span className="mx-3 text-silver-metal" aria-hidden>
              |
            </span>
            • {tr("โซนเป้าหมาย", "Target zones")}: <b>{zones || "-"}</b>
          </div>
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <CardTitle>
                {tr(
                  "รายการจัดเก็บสินค้าเข้าตำแหน่ง (Putaway List)",
                  "Putaway list",
                )}
              </CardTitle>
              <Link
                href="/pda/putaway"
                className="text-sm text-gold-deep underline underline-offset-2"
              >
                {tr("ดูงานที่ PDA →", "Tasks on PDA →")}
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead className="border-b border-silver-metal">
                  <tr>
                    <th className={th}>{tr("สินค้า", "Product")}</th>
                    <th className={th}>{tr("เลขล็อต", "Lot")}</th>
                    <th className={`${th} text-right`}>
                      {tr("ยอดจัดเก็บ", "Putaway qty")}
                    </th>
                    <th className={th}>
                      {tr("ช่องจัดเก็บเป้าหมาย", "Target location")}
                    </th>
                    <th className={th}>{tr("ความคืบหน้า", "Progress")}</th>
                    <th className={th}>{tr("สถานะจัดเก็บ", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {putRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-muted"
                      >
                        {tr("ยังไม่มีงานจัดเก็บ", "No putaway tasks")}
                      </td>
                    </tr>
                  ) : null}
                  {putRows.map(({ r, qty, done, started, bin, more }) => (
                    <tr
                      key={r.id}
                      className="border-b border-silver hover:bg-silver/40"
                    >
                      <td className="px-3 py-2">
                        <ProductCell
                          sku={data.skus.find((k) => k.id === r.skuId)}
                          lang={lang}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.lotNo}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {qty} {tr("ชิ้น", "pcs")}
                      </td>
                      <td className="px-3 py-2">
                        {bin ? (
                          <>
                            <span className="font-mono font-semibold">
                              {bin.path}
                            </span>
                            {more > 0 ? (
                              <span className="text-xs text-muted">
                                {" "}
                                +{more}
                              </span>
                            ) : null}
                            <span className="block text-xs text-muted">
                              ({bin.zoneType} {tr("โซน", "zone")} {bin.zone})
                            </span>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="w-44">
                          <ProgressBar value={done} max={qty} />
                          <span className="text-xs tabular-nums text-muted">
                            {done} / {qty}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {done >= qty ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                            ✓ {tr("จัดเก็บเสร็จสิ้น", "Put away")}
                          </span>
                        ) : done > 0 || started ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            ● {tr("กำลังเก็บ", "In progress")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-silver px-2.5 py-1 text-xs font-semibold text-muted">
                            ○ {tr("รอนำไปเก็บ", "Waiting")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <CardTitle>
              {closed
                ? tr("ผลการตรวจคุณภาพ (QC) รายล็อต", "QC results by lot")
                : tr("รายการสินค้าท้ายรถคันนี้", "Items on this truck")}
            </CardTitle>
            {closed ? (
              <Link
                href={qcHref}
                className="text-sm text-gold-deep underline underline-offset-2"
              >
                {tr("ตรวจ QC ที่ PDA →", "QC on PDA →")}
              </Link>
            ) : null}
          </div>
          {closed ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead className="border-b border-silver-metal">
                  <tr>
                    <th className={th}>{tr("สินค้า", "Product")}</th>
                    <th className={th}>{tr("เลขล็อต", "Lot / Batch")}</th>
                    <th className={th}>{tr("วันหมดอายุ", "Expiry")}</th>
                    <th className={`${th} text-right`}>
                      {tr("จำนวนรับเข้า", "Received")}
                    </th>
                    <th className={th}>
                      {tr("ความคืบหน้าการตรวจ", "QC progress")}
                    </th>
                    <th className={th}>{tr("ผลการตรวจ", "QC result")}</th>
                    <th className={th}>{tr("สถานะ QC", "QC status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-6 text-center text-muted"
                      >
                        {tr("ยังไม่มีล็อตรอตรวจ", "No lots yet")}
                      </td>
                    </tr>
                  ) : null}
                  {receipts.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-silver hover:bg-silver/40"
                    >
                      <td className="px-3 py-2">
                        <ProductCell
                          sku={data.skus.find((k) => k.id === r.skuId)}
                          lang={lang}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.lotNo}</td>
                      <td className="px-3 py-2">{fmtDate(r.expiryDate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.qty} {tr("ชิ้น", "pcs")}
                      </td>
                      <td className="px-3 py-2">
                        <QcProgress r={r} />
                      </td>
                      <td className="px-3 py-2">
                        <QcResult r={r} data={data} tr={tr} />
                      </td>
                      <td className="px-3 py-2">
                        <QcStatusBadge r={r} data={data} tr={tr} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-silver-metal">
                  <tr>
                    <th className={th}>{tr("สินค้า", "Product")}</th>
                    <th className={`${th} text-right`}>
                      {tr("ยอดสั่ง", "Expected")}
                    </th>
                    <th className={`${th} text-right`}>
                      {tr("รับจริง", "Received")}
                    </th>
                    <th className={th}>{tr("ความคืบหน้า", "Progress")}</th>
                    <th className={th}>{tr("สถานะการรับ", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {asn.lines.map((ln) => (
                    <tr
                      key={ln.id}
                      className="border-b border-silver hover:bg-silver/40"
                    >
                      <td className="px-3 py-2">
                        <ProductCell
                          sku={data.skus.find((k) => k.id === ln.skuId)}
                          lang={lang}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {ln.expectedQty}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <b>{ln.receivedQty}</b>
                      </td>
                      <td className="px-3 py-2">
                        <div className="w-40">
                          <ProgressBar
                            value={ln.receivedQty}
                            max={ln.expectedQty}
                          />
                          <span className="text-xs tabular-nums text-muted">
                            {ln.receivedQty}/{ln.expectedQty}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">{statusOf(ln)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={tr(
          "ยืนยันอนุมัติรับเข้า – พบรายการไม่ตรงยอด",
          "Confirm receipt - quantities do not match",
        )}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              {tr("ยกเลิก", "Cancel")}
            </Button>
            <Button onClick={approve}>
              {tr("ยืนยันและบันทึกผล", "Confirm and save")}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm">
          {tr(
            "รายการต่อไปนี้ยอดรับไม่ตรงกับยอดตามสั่ง เมื่อยืนยัน ระบบจะปิดการรับของ ASN นี้และบันทึกส่วนต่างเป็นรายการที่รับทราบแล้ว",
            "These lines do not match the ordered quantity. Confirming closes receiving for this ASN and logs the differences as acknowledged.",
          )}
        </p>
        <ul className="divide-y divide-silver text-sm">
          {mismatches.map((ln) => {
            const diff = ln.receivedQty - ln.expectedQty;
            return (
              <li
                key={ln.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>
                  {skuLabel(
                    data.skus.find((k) => k.id === ln.skuId),
                    lang,
                  )}
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  {ln.expectedQty} → <b>{ln.receivedQty}</b>
                  <Badge tone="outline" icon="⚠">
                    {diff > 0
                      ? `${tr("เกินยอด", "Over")} (+${diff})`
                      : `${tr("ของขาด", "Short")} (−${-diff})`}
                  </Badge>
                </span>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </div>
  );
}
