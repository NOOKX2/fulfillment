"use client";

import Link from "next/link";
import { PickFlow } from "@/components/features/pick/PickFlow";
import { StatusPill } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Card";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";

export function PdaPickList() {
  const { tr, st } = useT();
  const data = useWms((s) => s.data);
  const waves = data.waves.filter((w) => w.status === "released" || w.status === "picking");
  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">{tr("รอบหยิบที่พร้อมหยิบ", "Waves ready to pick")}</h1>
      {waves.length === 0 ? <p className="text-silver-metal">{tr("ยังไม่มีรอบที่ปล่อย – ปล่อยรอบหยิบที่คอนโซลก่อน", "No released waves - release one in the console first.")}</p> : null}
      <ul className="space-y-3">
        {waves.map((w) => {
          const tasks = data.pickTasks.filter((t) => t.waveId === w.id);
          const done = tasks.filter((t) => t.status !== "pending").length;
          return (
            <li key={w.id}>
              <Link href={`/pda/pick/${w.id}`} className="block rounded-lg border border-silver-metal/50 p-4 hover:border-gold">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-lg font-bold">{w.name}</span>
                  <StatusPill status={w.status} />
                </div>
                <div className="mb-2 text-sm text-silver-metal">
                  {st(w.strategy)} · {w.carrier ? st(w.carrier) : ""}
                </div>
                <div className="mb-1 text-sm tabular-nums">
                  {done} / {tasks.length}
                </div>
                <ProgressBar value={done} max={tasks.length} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PdaPick({ waveId }: { waveId: string }) {
  const { tr } = useT();
  return (
    <div>
      <Link href="/pda/pick" className="mb-2 inline-block text-sm text-gold underline underline-offset-2">
        ← {tr("รอบหยิบ", "Waves")}
      </Link>
      <PickFlow waveId={waveId} pda />
    </div>
  );
}
