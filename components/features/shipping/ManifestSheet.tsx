"use client";

import { BarcodeSvg } from "@/components/scan/BarcodeSvg";
import { localDate, localHM } from "@/lib/clock";
import { useT } from "@/lib/i18n/useT";
import { loadSignature } from "@/lib/store/persist";
import { useWms } from "@/lib/store/store";

/** A4 handover manifest (print only). Black on white. */
export function ManifestSheet({ manifestId }: { manifestId: string }) {
  const { tr, l } = useT();
  const data = useWms((s) => s.data);
  const m = data.manifests.find((x) => x.id === manifestId);
  if (!m) return null;
  const cfg = data.settings.carriers.find((c) => c.code === m.carrier);
  const rows = m.shipmentIds
    .map((id) => data.shipments.find((x) => x.id === id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .map((sh) => ({ sh, order: data.orders.find((o) => o.id === sh.orderId) }));
  const totalWeight = rows.reduce((n, r) => n + r.sh.weightG, 0);
  const cod = rows.reduce((n, r) => n + (r.order?.codAmount ?? 0), 0);
  const sig = m.signatureKey ? loadSignature(m.signatureKey) : undefined;

  return (
    <div className="bg-white p-2 text-[12px] text-black">
      <div className="flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <div className="text-xl font-extrabold">{tr("ใบส่งมอบพัสดุ", "Parcel handover manifest")}</div>
          <div>{cfg ? l(cfg.name) : m.carrier}</div>
          <div className="font-mono font-bold">{m.manifestNo}</div>
          <div>
            {localDate(m.createdAt)} {localHM(m.createdAt)}
          </div>
        </div>
        <BarcodeSvg value={m.manifestNo} height={48} moduleWidth={1.4} />
      </div>

      <table className="my-3 w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1">#</th>
            <th>{tr("เลขพัสดุ", "Tracking")}</th>
            <th>{tr("ออเดอร์", "Order")}</th>
            <th>{tr("ผู้รับ", "Recipient")}</th>
            <th className="text-right">{tr("น้ำหนัก (g)", "Weight (g)")}</th>
            <th className="text-right">COD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ sh, order }, i) => (
            <tr key={sh.id} className="border-b border-black">
              <td className="py-1">{i + 1}</td>
              <td className="font-mono">{sh.trackingNo}</td>
              <td>{order?.channelOrderNo}</td>
              <td>{order?.buyerName}</td>
              <td className="text-right">{sh.weightG}</td>
              <td className="text-right">{order?.codAmount ? order.codAmount.toLocaleString("en-US") : "-"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td colSpan={4} className="pt-2">
              {tr("รวม", "Total")} {rows.length} {tr("ชิ้น", "parcels")}
            </td>
            <td className="pt-2 text-right">{totalWeight}</td>
            <td className="pt-2 text-right">{cod ? cod.toLocaleString("en-US") : "-"}</td>
          </tr>
        </tfoot>
      </table>

      {m.exceptions.length > 0 ? (
        <p className="mb-3">
          {tr("รายการผิดปกติ", "Exceptions")}: {m.exceptions.length}
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <div className="flex h-24 items-end border-b border-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {sig ? <img src={sig} alt="" className="h-20" /> : null}
          </div>
          <div className="mt-1">
            {tr("ผู้ขับ/ผู้รับพัสดุ", "Driver / receiver")}: {m.driverName ?? "-"}
          </div>
          <div>
            {tr("ทะเบียนรถ", "Plate")}: {m.vehiclePlate ?? "-"}
          </div>
          <div>
            {m.signedAt ? `${localDate(m.signedAt)} ${localHM(m.signedAt)}` : ""}
          </div>
        </div>
        <div>
          <div className="h-24 border-b border-black" />
          <div className="mt-1">{tr("เจ้าหน้าที่คลัง", "Warehouse staff")}</div>
        </div>
      </div>
    </div>
  );
}
