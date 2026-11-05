"use client";

import { useT } from "@/lib/i18n/useT";
import { unlockAudio } from "@/lib/feedback/audio";

export interface SimChip {
  label: string;
  value: string;
  /** Mark deliberate wrong scans so the demo can trigger errors. */
  wrong?: boolean;
}

/** Demo-only drawer: tap a chip to "scan" the barcode the current step expects. */
export function ScanSimulator({
  chips,
  onScan,
  dark = false,
}: {
  chips: SimChip[];
  onScan: (raw: string) => void;
  dark?: boolean;
}) {
  const { t } = useT();
  if (chips.length === 0) return null;
  return (
    <details
      className={`rounded-lg border p-3 text-sm ${
        dark ? "on-ink border-silver-metal/50 bg-ink text-white" : "border-silver-metal bg-white"
      }`}
    >
      <summary className="cursor-pointer font-semibold">{t("scan.simulator")}</summary>
      <p className={`mt-2 text-xs ${dark ? "text-silver-metal" : "text-muted"}`}>
        {t("scan.simulatorHint")}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={`${c.label}-${c.value}`}
            type="button"
            onClick={() => {
              unlockAudio();
              onScan(c.value);
            }}
            className={`min-h-9 rounded-full border-2 px-3 text-xs font-semibold ${
              c.wrong
                ? `border-dashed ${dark ? "border-silver-metal" : "border-muted"}`
                : dark
                  ? "border-gold text-gold"
                  : "border-ink"
            } ${dark ? "hover:bg-white/10" : "hover:bg-silver"}`}
          >
            {c.wrong ? "✕ " : "▮ "}
            {c.label}
          </button>
        ))}
      </div>
    </details>
  );
}
