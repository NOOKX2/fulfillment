"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { ScanInput } from "../scan/ScanInput";
import { SoundToggle } from "../scan/SoundToggle";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Hydrated } from "./Hydrated";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { routeForScan } from "@/lib/scan/route";
import { useT } from "@/lib/i18n/useT";
import type { DictKey } from "@/lib/i18n/th";
import { actions } from "@/lib/store/actions";
import { getData, useWms } from "@/lib/store/store";
import { useUi } from "@/lib/store/ui";

interface NavItem {
  href: string;
  key: DictKey;
  icon: string;
}
interface NavGroup {
  key: DictKey;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  { key: "nav.group.system", items: [{ href: "/console", key: "nav.dashboard", icon: "◆" }] },
  {
    key: "nav.group.inbound",
    items: [
      { href: "/console/inbound", key: "nav.inbound", icon: "▼" },
      { href: "/console/inbound/qc", key: "nav.qc", icon: "✓" },
      { href: "/console/inbound/discrepancies", key: "nav.discrepancies", icon: "≠" },
    ],
  },
  {
    key: "nav.group.putaway",
    items: [
      { href: "/console/putaway", key: "nav.putaway", icon: "⇥" },
      { href: "/console/locations", key: "nav.locations", icon: "▦" },
    ],
  },
  {
    key: "nav.group.orders",
    items: [
      { href: "/console/orders", key: "nav.orders", icon: "☰" },
      { href: "/console/inventory", key: "nav.inventory", icon: "▥" },
      { href: "/console/inventory/quarantine", key: "nav.quarantine", icon: "⛔" },
    ],
  },
  {
    key: "nav.group.pickpack",
    items: [
      { href: "/console/waves", key: "nav.waves", icon: "≋" },
      { href: "/console/pack", key: "nav.pack", icon: "▣" },
      { href: "/console/pack/bench", key: "nav.packBench", icon: "⚑" },
    ],
  },
  {
    key: "nav.group.shipping",
    items: [
      { href: "/console/shipping/staging", key: "nav.staging", icon: "▤" },
      { href: "/console/shipping/manifests", key: "nav.manifests", icon: "✍" },
      { href: "/console/integrations/outbox", key: "nav.outbox", icon: "⇪" },
    ],
  },
  { key: "nav.group.returns", items: [{ href: "/console/returns", key: "nav.returns", icon: "↩" }] },
  {
    key: "nav.group.system",
    items: [
      { href: "/console/dev/barcodes", key: "nav.barcodes", icon: "▮" },
      { href: "/console/settings", key: "nav.settings", icon: "⚙" },
    ],
  },
];

function Sidebar() {
  const pathname = usePathname();
  const { t } = useT();
  const all = NAV.flatMap((g) => g.items.map((i) => i.href));
  // Longest matching href wins so /console/inbound/qc does not also light up /console/inbound.
  const activeHref =
    all
      .filter((h) => pathname === h || (h !== "/console" && pathname.startsWith(`${h}/`)))
      .sort((a, b) => b.length - a.length)[0] ?? "/console";
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-6">
      {NAV.map((g, gi) => (
        <div key={`${g.key}-${gi}`} className="mt-4">
          {gi > 0 ? (
            <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-silver-metal">
              {t(g.key)}
            </div>
          ) : null}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = i.href === activeHref;
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-control border-l-4 px-3 text-sm ${
                      active
                        ? "border-gold bg-white/10 font-semibold text-white"
                        : "border-transparent text-silver hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span aria-hidden className={`w-4 text-center ${active ? "text-gold" : "text-silver-metal"}`}>
                      {i.icon}
                    </span>
                    {t(i.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Topbar() {
  const router = useRouter();
  const { t, tr } = useT();
  const queued = useWms((s) => s.data.outbox.filter((o) => o.status !== "sent").length);
  const [confirmReset, setConfirmReset] = useState(false);

  const onScan = (raw: string) => {
    const dest = routeForScan(getData(), raw);
    if (dest) router.push(dest);
    else
      useUi.getState().notify({
        kind: "error",
        text: tr(`ไม่พบข้อมูลสำหรับ "${raw}"`, `Nothing found for "${raw}"`),
      });
  };

  return (
    <header className="no-print flex flex-wrap items-center gap-3 border-b border-silver-metal bg-white px-4 py-2">
      <div className="min-w-60 flex-1">
        <ScanInput
          onScan={onScan}
          autoFocus={false}
          label={tr("สแกนค้นหา", "Global scan")}
          placeholder={tr("สแกน ASN / ออเดอร์ / พัสดุ / ช่องเก็บ…", "Scan ASN / order / parcel / bin…")}
        />
      </div>
      <Link
        href="/console/integrations/outbox"
        className="text-sm text-gold-deep underline underline-offset-2"
        aria-label={tr("สถานะการส่งไปแพลตฟอร์ม", "Platform outbox status")}
      >
        ⇪ {queued > 0 ? tr(`ค้าง ${queued}`, `${queued} pending`) : tr("ซิงก์ครบ", "All synced")}
      </Link>
      <SoundToggle />
      <LanguageSwitcher />
      <Link
        href="/pda"
        className="inline-flex min-h-11 items-center rounded-control bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/90"
      >
        📟 {t("mode.pda")}
      </Link>
      {confirmReset ? (
        <span className="flex items-center gap-2 text-sm">
          {t("common.resetDemoConfirm")}
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              actions.resetDemo();
              setConfirmReset(false);
            }}
          >
            {t("common.confirm")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirmReset(false)}>
            {t("common.cancel")}
          </Button>
        </span>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
          ↺ {t("common.resetDemo")}
        </Button>
      )}
    </header>
  );
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const { t, tr } = useT();
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="skip-link no-print">
        {tr("ข้ามไปยังเนื้อหา", "Skip to content")}
      </a>
      <aside className="on-ink no-print hidden w-64 shrink-0 flex-col bg-ink text-white md:flex">
        <div className="px-5 py-5">
          <div className="text-lg font-bold tracking-tight">
            <span className="text-gold">◆</span> {t("app.name")}
          </div>
          <div className="mt-1 text-xs text-silver-metal">{t("app.tagline")}</div>
          <Badge tone="accent" className="mt-3">
            {t("app.demoBadge")}
          </Badge>
        </div>
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <details className="on-ink no-print bg-ink text-white md:hidden">
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-semibold">
            <span className="text-gold">◆</span> {t("app.name")} · ☰ {tr("เมนู", "Menu")}
          </summary>
          <Suspense fallback={null}>
            <div className="flex max-h-[70vh] flex-col overflow-y-auto">
              <Sidebar />
            </div>
          </Suspense>
        </details>
        <Topbar />
        <main id="main" tabIndex={-1} className="flex-1 bg-white p-5 outline-none md:p-6">
          <Hydrated>{children}</Hydrated>
        </main>
      </div>
    </div>
  );
}
