"use client";

import Link from "next/link";
import { StatusPill } from "@/components/ui/Badge";
import { PutawayFlow } from "@/components/features/putaway/PutawayFlow";
import { skuLabel } from "@/lib/domain/format";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";

export function PdaPutawayList() {
  const { tr, lang } = useT();
  const data = useWms((s) => s.data);
  const open = data.putaway.filter((t) => t.status === "suggested" || t.status === "in_progress");
  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">{tr("งานจัดเก็บ", "Putaway tasks")}</h1>
      {open.length === 0 ? <p className="text-silver-metal">{tr("ไม่มีงานค้าง", "No open tasks")}</p> : null}
      <ul className="space-y-3">
        {open.map((t) => (
          <li key={t.id}>
            <Link href={`/pda/putaway/${t.id}`} className="block rounded-lg border border-silver-metal/50 p-4 hover:border-gold">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-bold">{skuLabel(data.skus.find((k) => k.id === t.skuId), lang)}</span>
                <StatusPill status={t.status} />
              </div>
              <div className="text-sm text-silver-metal">
                {tr("จำนวน", "Qty")} {t.qty} · {tr("ล็อต", "lot")} {t.lotNo} · → {data.bins.find((b) => b.id === t.suggestions[0]?.binId)?.path ?? "?"}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PdaPutaway({ taskId }: { taskId: string }) {
  const { tr } = useT();
  const exists = useWms((s) => s.data.putaway.some((t) => t.id === taskId));
  const nextId = useWms(
    (s) => s.data.putaway.find((t) => t.id !== taskId && (t.status === "suggested" || t.status === "in_progress"))?.id,
  );
  if (!exists) return <p>{tr("ไม่พบงาน", "Task not found")}</p>;
  return (
    <div>
      <Link href="/pda/putaway" className="mb-2 inline-block text-sm text-gold underline underline-offset-2">
        ← {tr("รายการงาน", "Task list")}
      </Link>
      <PutawayFlow taskId={taskId} pda />
      {nextId ? (
        <Link
          href={`/pda/putaway/${nextId}`}
          className="mt-4 flex min-h-14 items-center justify-center rounded-control bg-gold text-base font-semibold text-ink"
        >
          {tr("งานถัดไป →", "Next task →")}
        </Link>
      ) : null}
    </div>
  );
}
