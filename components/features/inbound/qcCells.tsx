"use client";

import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Card";
import { skuLabel } from "@/lib/domain/format";
import type { AppState, Lang, ReceiptLine, Sku } from "@/lib/domain/types";

type Tr = (th: string, en: string) => string;

/** dd/mm/yyyy from an ISO date. */
export function fmtDate(iso?: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** Thumbnail placeholder + product name + barcode. */
export function ProductCell({
  sku,
  lang,
  dark,
}: {
  sku: Sku | undefined;
  lang: Lang;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={`flex size-10 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${
          dark
            ? "border-silver-metal/50 text-gold"
            : "border-silver-metal bg-silver text-muted"
        }`}
      >
        {sku ? sku.name.en.slice(0, 2).toUpperCase() : "?"}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{skuLabel(sku, lang)}</span>
        <span
          className={`block font-mono text-xs ${dark ? "text-silver-metal" : "text-muted"}`}
        >
          {sku?.code ?? "-"} · {sku?.barcodes[0] ?? "-"}
        </span>
      </span>
    </div>
  );
}

export function QcProgress({ r, dark }: { r: ReceiptLine; dark?: boolean }) {
  return (
    <div className="w-36">
      <ProgressBar value={r.qcDone} max={r.qty} />
      <span
        className={`text-xs tabular-nums ${dark ? "text-silver-metal" : "text-muted"}`}
      >
        {r.qcDone}/{r.qty}
      </span>
    </div>
  );
}

function tally(r: ReceiptLine, data: AppState) {
  const rows = data.qc.filter((q) => q.receiptLineId === r.id);
  return {
    pass: rows.reduce((n, q) => n + q.qtyPass, 0),
    hold: rows.reduce((n, q) => n + q.qtyHold, 0),
    quarantine: rows.reduce((n, q) => n + q.qtyQuarantine, 0),
  };
}

export function QcResult({
  r,
  data,
  tr,
}: {
  r: ReceiptLine;
  data: AppState;
  tr: Tr;
}) {
  const t = tally(r, data);
  if (r.qcDone === 0) return <span>-</span>;
  const bad = t.hold + t.quarantine;
  return (
    <span className="whitespace-nowrap tabular-nums">
      ✓ {tr("ผ่าน", "Pass")} {t.pass}
      {bad > 0
        ? ` / ⚠ ${t.hold > 0 ? `${tr("พัก", "Hold")} ${t.hold}` : ""}${t.hold > 0 && t.quarantine > 0 ? " · " : ""}${t.quarantine > 0 ? `${tr("กักกัน", "Quarantine")} ${t.quarantine}` : ""}`
        : ""}
    </span>
  );
}

export function QcStatusBadge({
  r,
  data,
  tr,
}: {
  r: ReceiptLine;
  data: AppState;
  tr: Tr;
}) {
  const t = tally(r, data);
  if (r.qcDone === 0)
    return (
      <Badge tone="dashed" icon="○">
        {tr("รอตรวจ", "Pending")}
      </Badge>
    );
  if (r.qcDone < r.qty)
    return (
      <Badge tone="accent" icon="▶">
        {tr("กำลังตรวจ", "In progress")}
      </Badge>
    );
  if (t.hold + t.quarantine > 0)
    return (
      <Badge tone="outline" icon="⚠">
        {tr("กักกัน/ไม่ผ่าน", "Hold / failed")}
      </Badge>
    );
  return (
    <Badge tone="solid" icon="✓">
      {tr("ผ่านครบแล้ว", "Fully passed")}
    </Badge>
  );
}
