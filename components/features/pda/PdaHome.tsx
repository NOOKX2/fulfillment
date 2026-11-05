"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";

export function PdaHome() {
  const { tr } = useT();
  const data = useWms((s) => s.data);
  const tiles = [
    {
      href: "/pda/receive",
      icon: "▼",
      title: tr("รับสินค้า", "Receive"),
      sub: tr(`${data.asns.filter((a) => a.status === "expected" || a.status === "receiving").length} ASN ค้างรับ`, `${data.asns.filter((a) => a.status === "expected" || a.status === "receiving").length} open ASNs`),
    },
    {
      href: "/pda/qc",
      icon: "✔",
      title: tr("ตรวจคุณภาพ (QC)", "Quality check (QC)"),
      sub: tr(`${data.receipts.filter((r) => r.qty - r.qcDone > 0).length} ล็อตรอตรวจ`, `${data.receipts.filter((r) => r.qty - r.qcDone > 0).length} lots waiting`),
    },
    {
      href: "/pda/putaway",
      icon: "⇥",
      title: tr("จัดเก็บ", "Putaway"),
      sub: tr(`${data.putaway.filter((p) => p.status === "suggested" || p.status === "in_progress").length} งานค้าง`, `${data.putaway.filter((p) => p.status === "suggested" || p.status === "in_progress").length} open tasks`),
    },
    {
      href: "/pda/pick",
      icon: "≋",
      title: tr("หยิบสินค้า", "Pick"),
      sub: tr(`${data.waves.filter((w) => w.status === "released" || w.status === "picking").length} รอบพร้อมหยิบ`, `${data.waves.filter((w) => w.status === "released" || w.status === "picking").length} waves ready`),
    },
    {
      href: "/pda/returns",
      icon: "↩",
      title: tr("รับคืน", "Returns"),
      sub: tr(`${data.returns.filter((r) => r.status !== "completed" && r.status !== "rejected").length} รายการค้าง`, `${data.returns.filter((r) => r.status !== "completed" && r.status !== "rejected").length} open`),
    },
  ];
  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">{tr("เมนูหน้างาน", "Floor tasks")}</h1>
      <p className="mb-4 text-sm text-silver-metal">
        {tr("โหมดเครื่องสแกน (PDA) – ปุ่มใหญ่ สแกนทีละขั้น", "Handheld scanner mode - big targets, one scan at a time.")}
      </p>
      <ul className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="flex min-h-32 flex-col justify-between rounded-lg border-2 border-gold p-4 hover:bg-white/10"
            >
              <span aria-hidden className="text-3xl text-gold">
                {t.icon}
              </span>
              <span>
                <span className="block text-lg font-bold">{t.title}</span>
                <span className="block text-sm text-silver-metal">{t.sub}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
