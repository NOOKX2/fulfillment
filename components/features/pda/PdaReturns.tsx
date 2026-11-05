"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReturnFlow } from "@/components/features/returns/ReturnFlow";
import { ScanInput } from "@/components/scan/ScanInput";
import { ScanSimulator } from "@/components/scan/ScanSimulator";
import { StatusPill } from "@/components/ui/Badge";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

export function PdaReturnList() {
  const { tr } = useT();
  const router = useRouter();
  const data = useWms((s) => s.data);
  const open = data.returns.filter((r) => r.status !== "completed" && r.status !== "rejected");
  const intake = (raw: string) => {
    const res = actions.returnIntake({ raw });
    if (res.ok) router.push(`/pda/returns/${res.data.returnId}`);
  };
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{tr("รับคืนสินค้า", "Returns")}</h1>
      <ScanInput pda onScan={intake} label={tr("สแกน RMA / ใบปะหน้าเดิม", "Scan RMA / original AWB")} />
      <ScanSimulator
        dark
        chips={[
          ...data.returns
            .filter((r) => r.status === "expected")
            .slice(0, 4)
            .map((r) => ({ label: `RMA ${r.rmaNo}`, value: r.rmaNo })),
          { label: tr("RMA ที่ไม่มีในระบบ", "Unknown RMA"), value: "RMA-999999", wrong: true },
        ]}
        onScan={intake}
      />
      {open.length === 0 ? <p className="text-silver-metal">{tr("ไม่มีรายการคืนค้าง", "No open returns")}</p> : null}
      <ul className="space-y-3">
        {open.map((r) => (
          <li key={r.id}>
            <Link href={`/pda/returns/${r.id}`} className="block rounded-lg border border-silver-metal/50 p-4 hover:border-gold">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-bold">{r.rmaNo}</span>
                <StatusPill status={r.status} />
              </div>
              <div className="text-sm text-silver-metal">{data.orders.find((o) => o.id === r.orderId)?.channelOrderNo}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PdaReturn({ returnId }: { returnId: string }) {
  const { tr } = useT();
  const exists = useWms((s) => s.data.returns.some((r) => r.id === returnId));
  if (!exists) return <p>{tr("ไม่พบรายการคืน", "Return not found")}</p>;
  return (
    <div>
      <Link href="/pda/returns" className="mb-2 inline-block text-sm text-gold underline underline-offset-2">
        ← {tr("รายการคืน", "Returns")}
      </Link>
      <ReturnFlow returnId={returnId} pda />
    </div>
  );
}
