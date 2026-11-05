"use client";

import Link from "next/link";
import { StatusPill } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Card";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";

export function PdaReceiveList() {
  const { tr, l } = useT();
  const data = useWms((s) => s.data);
  const open = data.asns.filter((a) => a.status === "expected" || a.status === "receiving");
  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">{tr("เลือก ASN ที่จะรับ", "Choose an ASN to receive")}</h1>
      {open.length === 0 ? <p className="text-silver-metal">{tr("ไม่มี ASN ค้างรับ", "No open ASNs")}</p> : null}
      <ul className="space-y-3">
        {open.map((a) => {
          const exp = a.lines.reduce((n, x) => n + x.expectedQty, 0);
          const rec = a.lines.reduce((n, x) => n + x.receivedQty, 0);
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
    </div>
  );
}
