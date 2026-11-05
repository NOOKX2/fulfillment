"use client";

import { useT } from "@/lib/i18n/useT";
import type { Bin } from "@/lib/domain/types";

/** Z › A › R › S › B breadcrumb for a bin, with Thai/English hierarchy labels. */
export function PathBreadcrumb({ bin, large = false }: { bin: Bin | undefined; large?: boolean }) {
  const { tr } = useT();
  if (!bin) return <span className="text-muted">-</span>;
  const parts: [string, string][] = [
    [tr("โซน", "Zone"), bin.zone],
    [tr("ทางเดิน", "Aisle"), bin.aisle],
    [tr("ชั้นวาง", "Rack"), bin.rack],
    [tr("ชั้น", "Shelf"), bin.shelf],
    [tr("ช่อง", "Bin"), bin.bin],
  ];
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 ${large ? "text-lg font-semibold" : "text-sm"}`}>
      {parts.map(([label, v], i) => (
        <span key={label} className="inline-flex items-center gap-1">
          {i > 0 ? <span aria-hidden className="text-silver-metal">›</span> : null}
          <span className={large ? "text-muted" : "text-xs text-muted"}>{label}</span>
          <span className="font-mono font-semibold">{v}</span>
        </span>
      ))}
    </span>
  );
}
