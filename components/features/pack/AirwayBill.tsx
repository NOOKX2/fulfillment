"use client";

import { BarcodeSvg } from "@/components/scan/BarcodeSvg";
import { localDate, localHM } from "@/lib/clock";
import { laneId } from "@/lib/domain/carriers";
import { skuLabel } from "@/lib/domain/format";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";

/** 100 x 150 mm airway bill. Always black on white so it prints on a thermal-style label. */
export function AirwayBill({ shipmentId }: { shipmentId: string }) {
  const { tr, l, lang } = useT();
  const data = useWms((s) => s.data);
  const sh = data.shipments.find((x) => x.id === shipmentId);
  const order = sh ? data.orders.find((o) => o.id === sh.orderId) : undefined;
  if (!sh || !order) return null;
  const cfg = data.settings.carriers.find((c) => c.code === sh.carrier);
  const items = order.lines.map((ln) => ({
    label: skuLabel(data.skus.find((k) => k.id === ln.skuId), lang),
    qty: ln.qty,
  }));

  return (
    <div
      className="awb-label box-border flex flex-col gap-2 border-2 border-black bg-white p-3 text-black"
      style={{ width: "100mm", minHeight: "150mm" }}
    >
      <div className="flex items-start justify-between gap-2 border-b-2 border-black pb-2">
        <div>
          <div className="text-xl font-extrabold leading-tight">{cfg ? l(cfg.name) : sh.carrier}</div>
          <div className="text-[10px]">
            {localDate(sh.labelPrintedAt)} {localHM(sh.labelPrintedAt)}
            {sh.reprintCount > 0 ? ` · ${tr("พิมพ์ซ้ำ", "reprint")} ${sh.reprintCount}` : ""}
          </div>
        </div>
        <div className="border-2 border-black px-2 py-1 text-center">
          <div className="text-[9px] leading-none">{tr("รหัสคัดแยก", "SORT")}</div>
          <div className="text-base font-extrabold leading-tight">{cfg ? laneId(cfg) : "-"}</div>
        </div>
      </div>

      <div className="flex justify-center">
        <BarcodeSvg value={sh.trackingNo} height={64} moduleWidth={1.4} className="w-full" />
      </div>

      <div className="border-y border-black py-2">
        <div className="text-[10px] font-bold uppercase">{tr("ผู้รับ", "Ship to")}</div>
        <div className="text-base font-bold leading-tight">{order.buyerName}</div>
        <div className="text-sm leading-snug">{order.address}</div>
        <div className="text-sm font-semibold">{order.phone}</div>
      </div>

      {order.codAmount ? (
        <div className="border-2 border-black p-2 text-center">
          <div className="text-[10px] font-bold">{tr("เก็บเงินปลายทาง (COD)", "CASH ON DELIVERY")}</div>
          <div className="text-2xl font-extrabold">฿{order.codAmount.toLocaleString()}</div>
        </div>
      ) : null}

      <div className="flex-1 text-xs">
        <div className="mb-0.5 font-bold">
          {tr("รายการ", "Contents")} ({items.reduce((n, i) => n + i.qty, 0)})
        </div>
        <ul className="leading-snug">
          {items.map((i) => (
            <li key={i.label}>
              {i.qty} × {i.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-end justify-between gap-2 border-t border-black pt-2 text-[10px]">
        <div>
          <div>
            {tr("ออเดอร์", "Order")}: <b>{order.channelOrderNo}</b>
          </div>
          <div>
            {tr("น้ำหนัก", "Weight")}: <b>{(sh.weightG / 1000).toFixed(2)} kg</b> · {sh.boxSize}
          </div>
        </div>
        <BarcodeSvg value={`ORD:${order.id}`} height={24} moduleWidth={0.9} showText={false} />
      </div>
      <div className="text-center font-mono text-xs font-bold">{sh.trackingNo}</div>
    </div>
  );
}
