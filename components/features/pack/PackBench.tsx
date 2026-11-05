"use client";

import { useMemo, useState } from "react";
import { PrintSheet } from "@/components/print/PrintSheet";
import { RedBeacon } from "@/components/scan/RedBeacon";
import { ScanInput } from "@/components/scan/ScanInput";
import { ScanSimulator, type SimChip } from "@/components/scan/ScanSimulator";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, PageHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Select, Textarea } from "@/components/ui/form";
import { mismatchText, skuLabel, type MismatchDetail } from "@/lib/domain/format";
import type { BoxSize, Order } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";
import { AirwayBill } from "./AirwayBill";

const BOXES: { key: BoxSize; label: string }[] = [
  { key: "ENV_S", label: "ENV_S - ซอง S / Envelope S" },
  { key: "ENV_M", label: "ENV_M - ซอง M / Envelope M" },
  { key: "BOX_S", label: "BOX_S - กล่อง S / Box S" },
  { key: "BOX_M", label: "BOX_M - กล่อง M / Box M" },
  { key: "BOX_L", label: "BOX_L - กล่อง L / Box L" },
];

const ACTIVE = ["open", "verifying", "verified", "blocked"];

export function PackBench() {
  const { tr, lang, st } = useT();
  const data = useWms((s) => s.data);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [toteId, setToteId] = useState<string | undefined>(undefined);
  const [box, setBox] = useState<BoxSize | "">("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reason, setReason] = useState("");

  const session =
    data.packSessions.find((p) => p.id === sessionId) ??
    (sessionId ? undefined : data.packSessions.find((p) => ACTIVE.includes(p.status)));
  const order: Order | undefined = session ? data.orders.find((o) => o.id === session.orderId) : undefined;
  const shipment = order?.shipmentId ? data.shipments.find((x) => x.id === order.shipmentId) : undefined;

  const readyOrders = data.orders.filter((o) => o.status === "picked" || o.status === "packing");
  const recentMismatch = session?.mismatches[session.mismatches.length - 1];
  const sinceOverride = session
    ? session.mismatches.filter((m) => !session.supervisorOverride || m.at > session.supervisorOverride.at).length
    : 0;
  const needSupervisor = !!session && session.status === "blocked" && sinceOverride >= 3;

  const suggestedBox: BoxSize = useMemo(() => {
    if (!order) return "ENV_S";
    const skus = order.lines.map((l) => data.skus.find((k) => k.id === l.skuId));
    if (skus.every((k) => k?.packClass === "envelope")) return order.lines.reduce((n, l) => n + l.qty, 0) > 1 ? "ENV_M" : "ENV_S";
    return skus.some((k) => k?.sizeClass === "XL" || k?.sizeClass === "L") ? "BOX_M" : "BOX_S";
  }, [order, data.skus]);

  const onScan = (raw: string) => {
    const res = actions.packScan({ sessionId: session && ACTIVE.includes(session.status) ? session.id : undefined, toteId, raw });
    if (res.ok) {
      if (res.data.event === "tote") setToteId(res.data.toteId);
      if (res.data.sessionId) setSessionId(res.data.sessionId);
    }
  };

  const issue = () => {
    if (!session) return;
    const res = actions.issueLabel({ sessionId: session.id, boxSize: (box || suggestedBox) as BoxSize });
    if (res.ok) setBox("");
  };

  const next = () => {
    if (session) actions.closePack(session.id);
    setSessionId(null);
    setBox("");
  };

  const chips = ((): SimChip[] => {
    const list: SimChip[] = [];
    if (!session || !ACTIVE.includes(session.status)) {
      for (const t of data.totes.filter((x) => x.orderIds.some((id) => readyOrders.some((o) => o.id === id))).slice(0, 3)) {
        list.push({ label: `${tr("ตะกร้า", "Tote")} ${t.id}`, value: t.barcode });
      }
      for (const o of readyOrders.slice(0, 3)) list.push({ label: o.channelOrderNo, value: `ORD:${o.id}` });
      const first = readyOrders[0];
      const k = first ? data.skus.find((x) => x.id === first.lines[0].skuId) : undefined;
      if (k) list.push({ label: skuLabel(k, lang), value: k.barcodes[0] });
      return list;
    }
    const remaining = session.expected.filter((e) => (session.scanned.find((x) => x.skuId === e.skuId)?.qty ?? 0) < e.qty);
    const exp = remaining[0] ? data.skus.find((k) => k.id === remaining[0].skuId) : undefined;
    if (exp) list.push({ label: skuLabel(exp, lang), value: exp.barcodes[0] });
    for (const e of session.expected.filter((x) => !remaining.includes(x))) {
      const k = data.skus.find((y) => y.id === e.skuId);
      if (k) list.push({ label: `${tr("เกินจำนวน", "Over qty")}: ${skuLabel(k, lang)}`, value: k.barcodes[0], wrong: true });
    }
    if (exp) {
      const sibling = data.skus.find((k) => k.modelCode === exp.modelCode && k.id !== exp.id);
      if (sibling) list.push({ label: `${tr("ผิดสี/ไซส์", "Wrong variant")}: ${skuLabel(sibling, lang)}`, value: sibling.barcodes[0], wrong: true });
      const other = data.skus.find((k) => k.modelCode !== exp.modelCode && !session.expected.some((e) => e.skuId === k.id));
      if (other) list.push({ label: `${tr("สินค้าผิดรุ่น", "Wrong model")}: ${skuLabel(other, lang)}`, value: other.barcodes[0], wrong: true });
    }
    return list;
  })();

  const beaconMsg = recentMismatch
    ? mismatchText(
        data,
        { reason: recentMismatch.reason, expectedSkuId: recentMismatch.expectedSkuId, scannedSkuId: recentMismatch.scannedSkuId } satisfies MismatchDetail,
        lang,
      )
    : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        title={tr("โต๊ะแพ็ก", "Pack bench")}
        subtitle={tr(
          "สแกนสินค้าทีละชิ้นที่ใส่กล่อง ระบบเทียบกับออเดอร์ทันที ถ้าผิดไฟแดงจะติดและออกใบปะหน้าไม่ได้จนกว่าจะแก้ ผิดซ้ำ 3 ครั้งต้องให้หัวหน้างานปลดล็อก",
          "Scan every item as it goes in the box. A wrong item turns the red light on and blocks the label; three misses need a supervisor.",
        )}
      />

      <Card>
        <ScanInput
          onScan={onScan}
          disabled={!!session && session.status === "label_issued"}
          label={tr("สแกนที่โต๊ะแพ็ก", "Scan at pack bench")}
          placeholder={
            session && ACTIVE.includes(session.status)
              ? tr("สแกนสินค้าทีละชิ้น", "Scan each item")
              : tr("สแกนตะกร้า ออเดอร์ หรือสินค้าชิ้นแรก", "Scan a tote, an order, or the first item")
          }
        />
        {toteId ? (
          <div className="mt-2 text-sm text-muted">
            {tr("ตะกร้าปัจจุบัน", "Current tote")}: <b className="font-mono">{toteId}</b>{" "}
            <button type="button" className="ml-2 text-gold-deep underline" onClick={() => setToteId(undefined)}>
              {tr("ล้าง", "clear")}
            </button>
          </div>
        ) : null}
      </Card>

      {session && order ? (
        <>
          <RedBeacon on={session.redLightOn} message={beaconMsg} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-lg font-bold">{order.channelOrderNo}</div>
                  <div className="text-sm text-muted">
                    {order.buyerName} · {st(order.carrier)}
                  </div>
                </div>
                <StatusPill status={session.status} />
              </div>
              <ul className="space-y-2">
                {session.expected.map((e) => {
                  const got = session.scanned.find((x) => x.skuId === e.skuId)?.qty ?? 0;
                  const complete = got >= e.qty;
                  return (
                    <li
                      key={e.skuId}
                      className={`flex items-center justify-between gap-2 rounded-lg border-2 p-3 ${complete ? "border-ink bg-silver" : "border-dashed border-muted"}`}
                    >
                      <span className="font-medium">
                        <span aria-hidden className="mr-2">{complete ? "✓" : "○"}</span>
                        {skuLabel(data.skus.find((k) => k.id === e.skuId), lang)}
                      </span>
                      <span className="text-xl font-bold tabular-nums">
                        {got} / {e.qty}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {session.mismatches.length > 0 ? (
                <div className="mt-3 text-sm">
                  <Badge tone="outline" icon="!">
                    {tr("สแกนผิด", "Mismatches")} {session.mismatches.length}
                  </Badge>
                </div>
              ) : null}
            </Card>

            <Card>
              <CardTitle>{tr("ออกใบปะหน้า", "Airway bill")}</CardTitle>
              {session.status === "label_issued" && shipment ? (
                <div className="space-y-3" role="status">
                  <div className="text-sm">
                    ✓ {tr("ออกใบปะหน้าแล้ว", "Label issued")}:{" "}
                    <b className="font-mono">{shipment.trackingNo}</b>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => window.print()}>🖨 {tr("พิมพ์ใบปะหน้า", "Print label")}</Button>
                    <Button variant="secondary" onClick={() => actions.reprint(shipment.id)}>
                      {tr("นับพิมพ์ซ้ำ", "Log reprint")} ({shipment.reprintCount})
                    </Button>
                    <Button variant="secondary" onClick={next}>
                      {tr("ออเดอร์ถัดไป →", "Next order →")}
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded border border-silver-metal p-2">
                    <AirwayBill shipmentId={shipment.id} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Field label={tr("ขนาดกล่อง/ซอง", "Box / envelope size")} hint={tr(`แนะนำ ${suggestedBox}`, `Suggested ${suggestedBox}`)}>
                    <Select value={box || suggestedBox} onChange={(e) => setBox(e.target.value as BoxSize)}>
                      {BOXES.map((b) => (
                        <option key={b.key} value={b.key}>
                          {b.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={session.status !== "verified" || session.redLightOn}
                    onClick={issue}
                  >
                    🏷 {tr("ออกใบปะหน้า", "Issue label")}
                  </Button>
                  {session.status !== "verified" ? (
                    <p className="text-sm text-muted">
                      {session.redLightOn
                        ? tr("ไฟแดงติดอยู่ – ออกใบปะหน้าไม่ได้", "Red light is on - label blocked")
                        : tr("สแกนสินค้าให้ครบก่อนจึงจะออกใบปะหน้าได้", "Scan every item before the label can be issued")}
                    </p>
                  ) : null}

                  {session.status === "blocked" ? (
                    <div className="space-y-2 rounded-lg border-2 border-dashed border-ink p-3">
                      {recentMismatch?.reason === "over_qty" && !needSupervisor ? (
                        <div>
                          <p className="mb-2 text-sm">{tr("เอาชิ้นที่เกินออกจากกล่องแล้ว?", "Removed the extra item from the box?")}</p>
                          <Button size="sm" variant="secondary" onClick={() => actions.packClearAlarm(session.id)}>
                            {tr("เอาออกแล้ว – ปิดไฟแดง", "Removed - clear alarm")}
                          </Button>
                        </div>
                      ) : null}
                      {needSupervisor ? (
                        <p className="text-sm font-semibold">
                          {tr("ผิดซ้ำ 3 ครั้ง – ต้องให้หัวหน้างานอนุมัติ", "3 mismatches - supervisor approval required")}
                        </p>
                      ) : null}
                      <Button size="sm" variant="secondary" onClick={() => setOverrideOpen(true)}>
                        🔑 {tr("หัวหน้างานปลดล็อก", "Supervisor override")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </Card>
          </div>
          {session.status !== "label_issued" ? <ScanSimulator chips={chips} onScan={onScan} /> : null}
        </>
      ) : (
        <>
          <RedBeacon on={false} />
          <Card>
            <CardTitle>{tr("พร้อมแพ็ก", "Ready to pack")}</CardTitle>
            {readyOrders.length === 0 ? (
              <p className="text-sm text-muted">
                {tr("ยังไม่มีออเดอร์ที่หยิบเสร็จ – หยิบสินค้าที่หน้ารอบหยิบก่อน", "No picked orders yet - finish a pick wave first.")}
              </p>
            ) : (
              <ul className="divide-y divide-silver text-sm">
                {readyOrders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <b className="font-mono">{o.channelOrderNo}</b> · {o.buyerName}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone="neutral">{st(o.carrier)}</Badge>
                      <Button size="sm" onClick={() => onScan(`ORD:${o.id}`)}>
                        {tr("เริ่มแพ็ก", "Start pack")}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <ScanSimulator chips={chips} onScan={onScan} />
        </>
      )}

      <Dialog
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title={tr("หัวหน้างานปลดล็อก", "Supervisor override")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOverrideOpen(false)}>
              {tr("ยกเลิก", "Cancel")}
            </Button>
            <Button
              disabled={!reason.trim()}
              onClick={() => {
                if (!session) return;
                const res = actions.packOverride({ sessionId: session.id, reason });
                if (res.ok) {
                  setOverrideOpen(false);
                  setReason("");
                }
              }}
            >
              {tr("ยืนยัน", "Confirm")}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          {tr("เหตุผลจะถูกบันทึกไว้ และจำนวนครั้งที่สแกนผิดจะเริ่มนับใหม่", "The reason is logged and the mismatch counter restarts.")}
        </p>
        <Field label={tr("เหตุผล", "Reason")}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>

      {shipment ? (
        <PrintSheet page="awb">
          <AirwayBill shipmentId={shipment.id} />
        </PrintSheet>
      ) : null}
    </div>
  );
}
