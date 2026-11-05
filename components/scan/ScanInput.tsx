"use client";

import { useEffect, useRef, useState } from "react";
import { unlockAudio } from "@/lib/feedback/audio";
import { useT } from "@/lib/i18n/useT";

/**
 * Barcode field. A USB/Bluetooth wedge scanner "types" the code and sends Enter,
 * so Enter ends a scan. On PDA screens the soft keyboard is suppressed and focus
 * returns to the field when it would otherwise be lost to the page body.
 */
export function ScanInput({
  onScan,
  placeholder,
  pda = false,
  disabled = false,
  autoFocus = true,
  label,
  className = "",
}: {
  onScan: (raw: string) => void;
  placeholder?: string;
  pda?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
  className?: string;
}) {
  const { t } = useT();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [autoFocus, disabled]);

  const submit = () => {
    const raw = value.trim();
    if (!raw) return;
    unlockAudio();
    onScan(raw);
    setValue("");
    ref.current?.focus();
  };

  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      <div className="relative flex-1">
        <span
          aria-hidden
          className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg ${pda ? "text-gold-deep" : "text-muted"}`}
        >
          ▮▯▮
        </span>
        <input
          ref={ref}
          value={value}
          disabled={disabled}
          inputMode={pda ? "none" : "text"}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label={label ?? t("common.scan")}
          placeholder={placeholder ?? t("common.scanPrompt")}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          onBlur={() => {
            if (!pda) return;
            setTimeout(() => {
              const a = document.activeElement;
              if (!a || a === document.body) ref.current?.focus();
            }, 60);
          }}
          className={`w-full rounded-control border-2 bg-white pl-14 pr-3 font-mono text-ink placeholder:font-sans placeholder:text-muted/70 disabled:bg-silver ${
            pda ? "min-h-14 border-gold text-lg" : "min-h-11 border-muted"
          }`}
        />
      </div>
    </div>
  );
}
