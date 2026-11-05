"use client";

import Link from "next/link";
import { ReceivePanel } from "@/components/features/inbound/ReceivePanel";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";

export function PdaReceive({ asnId }: { asnId: string }) {
  const { tr } = useT();
  const asn = useWms((s) => s.data.asns.find((a) => a.id === asnId));
  if (!asn) return <p>{tr("ไม่พบ ASN", "ASN not found")}</p>;
  return (
    <div>
      <Link href="/pda/receive" className="mb-2 inline-block text-sm text-gold underline underline-offset-2">
        ← {tr("เลือก ASN อื่น", "Other ASNs")}
      </Link>
      <h1 className="mb-3 font-mono text-xl font-bold">{asn.asnNo}</h1>
      <ReceivePanel asnId={asn.id} pda />
    </div>
  );
}
