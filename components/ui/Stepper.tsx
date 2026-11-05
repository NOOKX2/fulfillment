"use client";

import { Button } from "./Button";

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <Button variant="secondary" size="sm" onClick={() => onChange(clamp(value - 1))} aria-label="-1">
        −
      </Button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        aria-label={label}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        className="min-h-9 w-16 rounded-control border border-muted bg-white text-center tabular-nums"
      />
      <Button variant="secondary" size="sm" onClick={() => onChange(clamp(value + 1))} aria-label="+1">
        +
      </Button>
    </div>
  );
}
