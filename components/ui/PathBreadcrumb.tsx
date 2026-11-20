"use client";

import { useT } from "@/lib/i18n/useT";
import type { Bin } from "@/lib/domain/types";

function Part({ label, value, labelClass }: { label: string; value: string; labelClass: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={labelClass}>{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </span>
  );
}

/**
 * Bin location for floor screens: big path code first, then two short detail lines
 * (zone/aisle, then rack/shelf/bin) so pickers can match labels quickly.
 */
export function PathBreadcrumb({ bin, large = false }: { bin: Bin | undefined; large?: boolean }) {
  const { tr } = useT();
  if (!bin) return <span className="text-muted">-</span>;

  const labelClass = large ? "text-sm text-muted" : "text-xs text-muted";
  const rowClass = `flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${large ? "text-sm" : "text-xs"}`;

  return (
    <span className={`flex min-w-0 flex-col ${large ? "gap-1" : "gap-0.5"}`}>
      <span className={`font-mono font-bold tracking-wide ${large ? "text-xl" : "text-sm"}`}>{bin.path}</span>
      <span className={rowClass}>
        <Part label={tr("โซน", "Zone")} value={bin.zone} labelClass={labelClass} />
        <span aria-hidden className="text-silver-metal">
          ·
        </span>
        <Part label={tr("ทางเดิน", "Aisle")} value={bin.aisle} labelClass={labelClass} />
      </span>
      <span className={rowClass}>
        <Part label={tr("ชั้นวาง", "Rack")} value={bin.rack} labelClass={labelClass} />
        <span aria-hidden className="text-silver-metal">
          ·
        </span>
        <Part label={tr("ชั้น", "Shelf")} value={bin.shelf} labelClass={labelClass} />
        <span aria-hidden className="text-silver-metal">
          ·
        </span>
        <Part label={tr("ช่อง", "Bin")} value={bin.bin} labelClass={labelClass} />
      </span>
    </span>
  );
}
