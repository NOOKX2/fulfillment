"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { SoundToggle } from "../scan/SoundToggle";
import { Hydrated } from "./Hydrated";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useT } from "@/lib/i18n/useT";

const TABS = [
  { href: "/pda/receive", icon: "▼", th: "รับ", en: "Receive" },
  { href: "/pda/putaway", icon: "⇥", th: "จัดเก็บ", en: "Putaway" },
  { href: "/pda/pick", icon: "≋", th: "หยิบ", en: "Pick" },
  { href: "/pda/returns", icon: "↩", th: "คืน", en: "Returns" },
];

function BottomBar() {
  const pathname = usePathname();
  const { tr, t } = useT();
  return (
    <nav
      aria-label="PDA"
      className="sticky bottom-0 z-10 grid grid-cols-5 border-t border-silver-metal/40 bg-ink"
    >
      <Link
        href="/pda"
        aria-current={pathname === "/pda" ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center text-xs ${pathname === "/pda" ? "text-gold" : "text-silver"}`}
      >
        <span aria-hidden className="text-lg">◆</span>
        {tr("เมนู", "Menu")}
      </Link>
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center text-xs ${active ? "text-gold" : "text-silver"}`}
          >
            <span aria-hidden className="text-lg">{tab.icon}</span>
            {tr(tab.th, tab.en)}
          </Link>
        );
      })}
      <span className="sr-only">{t("pda.home")}</span>
    </nav>
  );
}

/** Dark, single-column hardware-scanner shell with large touch targets. */
export function PdaShell({ children }: { children: ReactNode }) {
  const { t, tr } = useT();
  return (
    <div className="on-ink mx-auto flex min-h-screen w-full max-w-md flex-col bg-ink text-white">
      <a href="#main" className="skip-link">
        {tr("ข้ามไปยังเนื้อหา", "Skip to content")}
      </a>
      <header className="flex items-center justify-between gap-2 border-b border-silver-metal/30 px-4 py-3">
        <Link href="/pda" className="text-base font-bold">
          <span className="text-gold">◆</span> PDA
        </Link>
        <div className="flex items-center gap-2">
          <SoundToggle onDark />
          <LanguageSwitcher onDark />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 px-4 py-4 outline-none">
        <Hydrated>{children}</Hydrated>
        <div className="mt-6 text-center">
          <Link href="/console" className="text-sm text-gold underline underline-offset-2">
            ← {t("mode.console")}
          </Link>
        </div>
      </main>
      <Suspense fallback={null}>
        <BottomBar />
      </Suspense>
    </div>
  );
}
