"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Select, Textarea } from "@/components/ui/form";
import { skuLabel } from "@/lib/domain/format";
import type { Discrepancy, DiscrepancyResolution, DiscrepancyType } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";

const OPTIONS: Record<DiscrepancyType, DiscrepancyResolution[]> = {
  short: ["claim_short", "reject"],
  over: ["accept_over", "return_to_supplier"],
  wrong_item: ["return_to_supplier", "reject"],
  damaged: ["return_to_supplier", "claim_short", "reject"],
  no_asn_line: ["accept_over", "return_to_supplier", "reject"],
};

/** Discrepancy log. Pass `asnId` to scope it to one ASN. */
export function DiscrepancyList({ asnId }: { asnId?: string }) {
  const { tr, lang, st } = useT();
  const data = useWms((s) => s.data);
  const [target, setTarget] = useState<Discrepancy | null>(null);
  const [resolution, setResolution] = useState<DiscrepancyResolution>("claim_short");
  const [note, setNote] = useState("");

  const rows = data.discrepancies
    .filter((d) => !asnId || d.asnId === asnId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const cols: Column<Discrepancy>[] = [
    { key: "type", header: tr("ประเภท", "Type"), cell: (d) => <b>{st(d.type)}</b> },
    ...(asnId
      ? []
      : [
          {
            key: "asn",
            header: "ASN",
            cell: (d: Discrepancy) => {
              const a = data.asns.find((x) => x.id === d.asnId);
              return a ? (
                <Link href={`/console/inbound/asn/${a.id}`} className="font-mono text-gold-deep underline underline-offset-2">
                  {a.asnNo}
                </Link>
              ) : (
                "-"
              );
            },
          } satisfies Column<Discrepancy>,
        ]),
    {
      key: "sku",
      header: tr("สินค้า", "SKU"),
      cell: (d) => (d.skuId ? skuLabel(data.skus.find((k) => k.id === d.skuId), lang) : d.scannedBarcode ?? "-"),
    },
    { key: "exp", header: tr("ควรได้", "Expected"), align: "right", cell: (d) => d.expectedQty },
    { key: "act", header: tr("ได้จริง", "Actual"), align: "right", cell: (d) => d.actualQty },
    { key: "status", header: tr("สถานะ", "Status"), cell: (d) => <StatusPill status={d.status} /> },
    {
      key: "res",
      header: tr("การแก้ไข", "Resolution"),
      cell: (d) => (d.resolution ? st(d.resolution) : <span className="text-muted">-</span>),
    },
    {
      key: "do",
      header: "",
      cell: (d) =>
        d.status === "resolved" ? null : (
          <div className="flex gap-1">
            {d.status === "open" ? (
              <Button size="sm" variant="secondary" onClick={() => actions.acknowledgeDiscrepancy(d.id)}>
                {tr("รับทราบ", "Acknowledge")}
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => {
                setTarget(d);
                setResolution(OPTIONS[d.type][0]);
                setNote("");
              }}
            >
              {tr("แก้ไข", "Resolve")}
            </Button>
          </div>
        ),
    },
  ];

  return (
    <>
      <DataTable
        dense
        columns={cols}
        rows={rows}
        rowKey={(d) => d.id}
        empty={tr("ไม่มีส่วนต่าง", "No discrepancies")}
      />
      <Dialog
        open={!!target}
        onClose={() => setTarget(null)}
        title={tr("แก้ไขส่วนต่าง", "Resolve discrepancy")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              {tr("ยกเลิก", "Cancel")}
            </Button>
            <Button
              onClick={() => {
                if (!target) return;
                const res = actions.resolveDiscrepancy({ id: target.id, resolution, note: note.trim() || undefined });
                if (res.ok) setTarget(null);
              }}
            >
              {tr("ยืนยัน", "Confirm")}
            </Button>
          </>
        }
      >
        {target ? (
          <div className="space-y-3">
            <p className="text-sm">
              <b>{st(target.type)}</b> · {tr("ควรได้", "expected")} {target.expectedQty} / {tr("ได้จริง", "actual")} {target.actualQty}
            </p>
            <Field label={tr("วิธีแก้ไข", "Resolution")}>
              <Select value={resolution} onChange={(e) => setResolution(e.target.value as DiscrepancyResolution)}>
                {OPTIONS[target.type].map((r) => (
                  <option key={r} value={r}>
                    {st(r)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr("หมายเหตุ", "Note")}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
