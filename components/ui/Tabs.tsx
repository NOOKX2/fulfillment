"use client";

import type { ReactNode } from "react";

export interface TabDef<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
}

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: TabDef<K>[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-silver-metal">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`-mb-px min-h-11 border-b-4 px-4 text-sm font-semibold ${
              active ? "border-gold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.count !== undefined ? (
              <span className="ml-2 rounded-full bg-silver px-2 py-0.5 text-xs text-ink">{t.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
