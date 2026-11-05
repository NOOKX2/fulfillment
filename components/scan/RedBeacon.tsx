"use client";

import { useT } from "@/lib/i18n/useT";

/** Simulated red alarm light for the pack bench. Latched until the mismatch is cleared. */
export function RedBeacon({ on, message }: { on: boolean; message?: string }) {
  const { tr } = useT();
  return (
    <div
      role={on ? "alert" : undefined}
      className={`flex items-center gap-4 rounded-lg border-2 p-4 ${
        on ? "border-danger bg-danger/10" : "border-silver-metal bg-white"
      }`}
    >
      <div
        aria-hidden
        className={`flex size-16 shrink-0 items-center justify-center rounded-full text-3xl ${
          on ? "beacon-pulse bg-danger text-white shadow-[0_0_0_8px_rgba(179,38,30,0.25)]" : "bg-silver text-muted"
        }`}
      >
        {on ? "⚠" : "●"}
      </div>
      <div>
        <div className="text-lg font-bold">
          {on ? tr("ไฟแดง – หยุด! ของไม่ตรง", "RED LIGHT – stop! Item mismatch") : tr("ไฟเขียว/พร้อมสแกน", "Clear – ready to scan")}
        </div>
        <div className="text-sm text-muted">
          {on
            ? (message ?? tr("นำสินค้าออกและสแกนชิ้นที่ถูกต้อง", "Remove the item and scan the correct one"))
            : tr("สแกนสินค้าที่ใส่กล่องทีละชิ้น", "Scan each item as it goes in the box")}
        </div>
      </div>
    </div>
  );
}
