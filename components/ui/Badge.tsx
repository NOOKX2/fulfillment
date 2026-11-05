"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/useT";

type Tone = "neutral" | "solid" | "accent" | "outline" | "dashed" | "danger" | "success";

const tones: Record<Tone, string> = {
  neutral: "bg-silver text-ink border border-silver",
  solid: "bg-ink text-white border border-ink",
  accent: "bg-gold text-ink border border-gold",
  outline: "bg-white text-ink border-2 border-ink",
  dashed: "bg-white text-ink border-2 border-dashed border-muted",
  danger: "bg-danger text-white border border-danger",
  success: "bg-success text-white border border-success",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className = "",
}: {
  tone?: Tone;
  icon?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      {children}
    </span>
  );
}

/**
 * Status values are told apart by shape, border style, icon and label -
 * never by new hues. Red/green only appear for genuine error/success states.
 */
const STATUS_STYLE: Record<string, { tone: Tone; icon: string }> = {
  // stock
  sellable: { tone: "solid", icon: "✓" },
  pending_qc: { tone: "dashed", icon: "…" },
  hold: { tone: "outline", icon: "❚❚" },
  quarantine: { tone: "outline", icon: "⛔" },
  return_pending: { tone: "dashed", icon: "↩" },
  repack: { tone: "dashed", icon: "▣" },
  rtv: { tone: "outline", icon: "⇄" },
  destroy: { tone: "outline", icon: "✕" },
  // flow
  expected: { tone: "dashed", icon: "○" },
  receiving: { tone: "accent", icon: "▶" },
  received: { tone: "neutral", icon: "●" },
  closed: { tone: "neutral", icon: "■" },
  closed_with_discrepancy: { tone: "outline", icon: "!" },
  suggested: { tone: "dashed", icon: "○" },
  in_progress: { tone: "accent", icon: "▶" },
  completed: { tone: "solid", icon: "✓" },
  cancelled: { tone: "neutral", icon: "✕" },
  awaiting_payment: { tone: "dashed", icon: "฿" },
  paid_reserved: { tone: "neutral", icon: "🔒" },
  awaiting_stock: { tone: "outline", icon: "⏳" },
  allocated: { tone: "neutral", icon: "◧" },
  in_wave: { tone: "accent", icon: "≋" },
  picking: { tone: "accent", icon: "▶" },
  picked: { tone: "neutral", icon: "●" },
  packing: { tone: "accent", icon: "▣" },
  packed: { tone: "neutral", icon: "▣" },
  ready_to_ship: { tone: "solid", icon: "➤" },
  handed_over: { tone: "solid", icon: "✓" },
  return_in_progress: { tone: "outline", icon: "↩" },
  returned: { tone: "neutral", icon: "↩" },
  draft: { tone: "dashed", icon: "○" },
  released: { tone: "accent", icon: "▶" },
  pending: { tone: "dashed", icon: "○" },
  short: { tone: "outline", icon: "!" },
  skipped: { tone: "neutral", icon: "–" },
  open: { tone: "dashed", icon: "○" },
  verifying: { tone: "accent", icon: "▶" },
  verified: { tone: "solid", icon: "✓" },
  blocked: { tone: "danger", icon: "⚠" },
  label_issued: { tone: "solid", icon: "🏷" },
  label_printed: { tone: "neutral", icon: "🏷" },
  staged: { tone: "accent", icon: "▤" },
  manifested: { tone: "neutral", icon: "☰" },
  exception: { tone: "outline", icon: "!" },
  scanning: { tone: "accent", icon: "▶" },
  awaiting_signature: { tone: "outline", icon: "✍" },
  queued: { tone: "dashed", icon: "○" },
  sending: { tone: "accent", icon: "▶" },
  sent: { tone: "success", icon: "✓" },
  failed: { tone: "danger", icon: "✕" },
  grading: { tone: "accent", icon: "▶" },
  restock_pending: { tone: "outline", icon: "↩" },
  repack_pending: { tone: "dashed", icon: "▣" },
  disposition_pending: { tone: "outline", icon: "!" },
  rejected: { tone: "neutral", icon: "✕" },
  unpaid: { tone: "dashed", icon: "฿" },
  paid: { tone: "solid", icon: "✓" },
  cod: { tone: "outline", icon: "฿" },
  refunded: { tone: "neutral", icon: "↩" },
  acknowledged: { tone: "neutral", icon: "✓" },
  resolved: { tone: "solid", icon: "✓" },
  short_: { tone: "outline", icon: "!" },
  over: { tone: "accent", icon: "+" },
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const { st } = useT();
  const style = STATUS_STYLE[status] ?? { tone: "neutral" as Tone, icon: "" };
  return (
    <Badge tone={style.tone} icon={style.icon || undefined} className={className}>
      {st(status)}
    </Badge>
  );
}
