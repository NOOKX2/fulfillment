"use client";

import Link from "next/link";
import { StatusPill } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Card";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";
import type { Asn } from "@/lib/domain/types";

function totals(a: Asn) {
  return {
    exp: a.lines.reduce((n, x) => n + x.expectedQty, 0),
    rec: a.lines.reduce((n, x) => n + x.receivedQty, 0),
  };
}

export function PdaReceiveList() {
  const { tr, l } = useT();
  const data = useWms((s) => s.data);
  const open = data.asns.filter((a) => a.status === "expected" || a.status === "receiving");
  // After console approval, ASN is closed — show these at the bottom so the floor can see what finished.
  const done = data.asns.filter((a) => a.status === "closed" || a.status === "closed_with_discrepancy");

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">{tr("เลือก ASN ที่จะรับ", "Choose an ASN to receive")}</h1>
      {open.length === 0 ? <p className="text-silver-metal">{tr("ไม่มี ASN ค้างรับ", "No open ASNs")}</p> : null}
      <ul className="space-y-3">
        {open.map((a) => {
          const { exp, rec } = totals(a);
          const sup = data.suppliers.find((s) => s.id === a.supplierId);
          return (
            <li key={a.id}>
              <Link href={`/pda/receive/${a.id}`} className="block rounded-lg border border-silver-metal/50 p-4 hover:border-gold">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-lg font-bold">{a.asnNo}</span>
                  <StatusPill status={a.status} />
                </div>
                <div className="mb-2 text-sm text-silver-metal">{sup ? l(sup.name) : ""}</div>
                <div className="mb-1 text-sm tabular-nums">
                  {rec} / {exp}
                </div>
                <ProgressBar value={rec} max={exp} />
              </Link>
            </li>
          );
        })}
      </ul>

      {done.length > 0 ? (
        <section className="mt-8" aria-labelledby="pda-receive-done">
          <h2 id="pda-receive-done" className="mb-3 text-base font-semibold text-silver-metal">
            {tr("รับเข้าสำเร็จแล้ว", "Receive complete")}
          </h2>
          <ul className="space-y-3">
            {done.map((a) => {
              const { exp, rec } = totals(a);
              const sup = data.suppliers.find((s) => s.id === a.supplierId);
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-success/40 bg-success/10 p-4"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-lg font-bold">{a.asnNo}</span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                      <span aria-hidden className="text-base">
                        ✓
                      </span>
                      {tr("สแกนสำเร็จ", "Scan complete")}
                    </span>
                  </div>
                  <div className="mb-1 text-sm text-silver-metal">{sup ? l(sup.name) : ""}</div>
                  <div className="text-sm tabular-nums text-silver-metal">
                    {rec} / {exp} ·{" "}
                    {a.status === "closed_with_discrepancy"
                      ? tr("ปิด (มีส่วนต่าง)", "Closed with discrepancy")
                      : tr("อนุมัติรับเข้าแล้ว", "Receipt approved")}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
