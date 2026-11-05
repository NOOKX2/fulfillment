import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  dark = false,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        dark ? "on-ink border-ink bg-ink text-white" : "border-silver-metal bg-white text-ink"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`mb-3 text-base font-semibold ${className}`}>{children}</h2>;
}

type Tone = "white" | "silver" | "ink";

/** Page section. Alternate `white` and `silver`; use `ink` for emphasis blocks. */
export function Section({
  tone = "white",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const t =
    tone === "ink"
      ? "on-ink bg-ink text-white"
      : tone === "silver"
        ? "bg-silver text-ink"
        : "bg-white text-ink";
  return <section className={`${t} ${className}`}>{children}</section>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-silver-metal p-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  dark = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  dark?: boolean;
}) {
  return (
    <div>
      <div className={`text-xs font-medium ${dark ? "text-silver-metal" : "text-muted"}`}>{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {hint ? <div className={`text-xs ${dark ? "text-silver-metal" : "text-muted"}`}>{hint}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="h-2.5 w-full overflow-hidden rounded-full bg-silver"
    >
      <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-silver ${className}`} aria-hidden />;
}
