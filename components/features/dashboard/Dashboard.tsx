"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Section, Stat } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Card";
import { skuLabel } from "@/lib/domain/format";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";

interface Step {
  n: number;
  href: string;
  titleTh: string;
  titleEn: string;
  features: string[];
}

const STEPS: Step[] = [
  {
    n: 1,
    href: "/console/inbound",
    titleTh: "รับสินค้าเข้าคลัง",
    titleEn: "Inbound & QC",
    features: ["ASN & PO Matching", "Barcode Receiving & Discrepancy Log", "QC & Quarantine"],
  },
  {
    n: 2,
    href: "/console/putaway",
    titleTh: "นำสินค้าเข้าจัดเก็บ",
    titleEn: "Putaway & Location Mapping",
    features: ["Bin / Location System", "Directed Putaway Logic", "Location Barcode Binding"],
  },
  {
    n: 3,
    href: "/console/orders",
    titleTh: "คำสั่งซื้อและสต็อก",
    titleEn: "Order & Inventory",
    features: ["Omnichannel Order Sync", "Real-time Stock Locking", "FIFO / FEFO Control"],
  },
  {
    n: 4,
    href: "/console/waves",
    titleTh: "หยิบและแพ็กสินค้า",
    titleEn: "Pick & Pack",
    features: ["Wave Picking", "Shortest Path Routing", "Packing Verification (Poka-yoke)", "Print-on-Demand AWB"],
  },
  {
    n: 5,
    href: "/console/shipping/staging",
    titleTh: "จัดส่งและส่งมอบพัสดุ",
    titleEn: "Shipping & Handover",
    features: ["Multi-carrier API", "Courier Staging & Sorting", "Handover Manifest", "Real-time Tracking Updates"],
  },
  {
    n: 6,
    href: "/console/returns",
    titleTh: "พัสดุตีกลับ",
    titleEn: "Returns & Reverse Logistics",
    features: ["Return Barcode Intake", "Condition Grading", "Restock / RTV"],
  },
];

export function Dashboard() {
  const { t, tr, lang } = useT();
  const data = useWms((s) => s.data);

  const k = useMemo(() => {
    const qty = (status: string) =>
      data.stock.filter((r) => r.status === status).reduce((n, r) => n + r.qty, 0);
    const orderCount = (...st: string[]) => data.orders.filter((o) => st.includes(o.status)).length;
    return {
      asnOpen: data.asns.filter((a) => a.status === "expected" || a.status === "receiving").length,
      pendingQc: qty("pending_qc"),
      holdQuarantine: qty("hold") + qty("quarantine"),
      putawayOpen: data.putaway.filter((p) => p.status === "suggested" || p.status === "in_progress").length,
      sellable: data.stock
        .filter((r) => r.status === "sellable" && data.bins.find((b) => b.id === r.binId)?.zoneType !== "receiving")
        .reduce((n, r) => n + r.qty, 0),
      awaitingStock: orderCount("awaiting_stock"),
      reserved: data.reservations.filter((r) => r.status === "active").reduce((n, r) => n + r.qty, 0),
      toPick: orderCount("paid_reserved", "allocated", "in_wave", "picking"),
      toPack: orderCount("picked", "packing"),
      toShip: orderCount("packed", "ready_to_ship"),
      returnsOpen: data.returns.filter((r) => r.status !== "completed" && r.status !== "rejected").length,
      outboxPending: data.outbox.filter((o) => o.status !== "sent").length,
    };
  }, [data]);

  const stepStat = (n: number): { label: string; value: number }[] => {
    switch (n) {
      case 1:
        return [
          { label: tr("ASN รอรับ", "ASNs open"), value: k.asnOpen },
          { label: tr("รอ QC", "Pending QC"), value: k.pendingQc },
        ];
      case 2:
        return [{ label: tr("งานจัดเก็บค้าง", "Open putaway"), value: k.putawayOpen }];
      case 3:
        return [
          { label: tr("ขายได้", "Sellable"), value: k.sellable },
          { label: tr("ล็อกไว้", "Reserved"), value: k.reserved },
        ];
      case 4:
        return [
          { label: tr("รอหยิบ", "To pick"), value: k.toPick },
          { label: tr("รอแพ็ก", "To pack"), value: k.toPack },
        ];
      case 5:
        return [{ label: tr("รอส่งมอบ", "To hand over"), value: k.toShip }];
      default:
        return [{ label: tr("ตีกลับค้าง", "Open returns"), value: k.returnsOpen }];
    }
  };

  const recent = [...data.ledger].slice(-8).reverse();

  return (
    <div className="-m-5 md:-m-6">
      <Section tone="ink" className="px-5 py-8 md:px-8">
        <h1 className="text-2xl font-bold md:text-3xl">
          {tr("กระบวนการ Fulfillment ตั้งแต่ต้นจนจบ", "End-to-end fulfillment workflow")}
        </h1>
        <p className="mt-2 max-w-3xl text-silver">
          {tr(
            "6 ขั้นตอนต่อเนื่อง: ข้อมูลจากขั้นตอนหนึ่งไหลไปยังขั้นถัดไปจริง ตั้งแต่รับของ จัดเก็บ ล็อกสต็อก หยิบแพ็ก ส่งมอบ จนถึงรับคืน",
            "Six connected steps - what happens in one step really flows into the next: receive, put away, lock stock, pick & pack, hand over, and take returns.",
          )}
        </p>
        <ol className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n}>
              <Link
                href={s.href}
                className="group block h-full rounded-lg border border-silver-metal/40 bg-white/5 p-4 hover:border-gold hover:bg-white/10"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold text-base font-bold text-ink">
                    {s.n}
                  </span>
                  <div>
                    <div className="font-semibold">{lang === "th" ? s.titleTh : s.titleEn}</div>
                    <div className="text-xs text-silver-metal">{lang === "th" ? s.titleEn : s.titleTh}</div>
                  </div>
                </div>
                <ul className="mt-3 space-y-0.5 text-sm text-silver">
                  {s.features.map((f) => (
                    <li key={f}>
                      <span className="text-gold" aria-hidden>
                        ›{" "}
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-6 border-t border-silver-metal/30 pt-3">
                  {stepStat(s.n).map((x) => (
                    <Stat key={x.label} label={x.label} value={x.value} dark />
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="silver" className="px-5 py-6 md:px-8">
        <PageHeader title={tr("ภาพรวมสด", "Live snapshot")} />
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 xl:grid-cols-6">
          <Stat label={tr("ASN รอรับ", "ASNs open")} value={k.asnOpen} />
          <Stat label={tr("กักกัน/พัก", "Hold / quarantine")} value={k.holdQuarantine} hint={tr("ไม่ใช่สต็อกขาย", "not sellable")} />
          <Stat label={tr("พร้อมขาย", "Sellable")} value={k.sellable} />
          <Stat label={tr("รอสต็อก", "Awaiting stock")} value={k.awaitingStock} />
          <Stat label={tr("รอหยิบ", "To pick")} value={k.toPick} />
          <Stat label={tr("รอส่งมอบ", "To ship")} value={k.toShip} />
          <Stat label={tr("ตีกลับค้าง", "Open returns")} value={k.returnsOpen} />
          <Stat label={tr("ส่งแพลตฟอร์มค้าง", "Outbox pending")} value={k.outboxPending} />
        </div>
      </Section>

      <Section tone="white" className="px-5 py-6 md:px-8">
        <PageHeader
          title={tr("ความเคลื่อนไหวล่าสุด", "Recent stock movements")}
          subtitle={tr("จากสมุดบัญชีสต็อก (ledger)", "From the stock ledger")}
        />
        {recent.length === 0 ? (
          <p className="text-sm text-muted">{t("common.noData")}</p>
        ) : (
          <ul className="divide-y divide-silver text-sm">
            {recent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-24 shrink-0 rounded bg-silver px-2 py-0.5 text-center font-mono text-xs">{e.type}</span>
                <span className="font-medium">
                  {skuLabel(data.skus.find((x) => x.id === e.skuId), lang)}
                </span>
                <span className="tabular-nums">× {e.qty}</span>
                {e.refId ? <span className="font-mono text-xs text-muted">{e.refId}</span> : null}
                {e.note ? <span className="text-xs text-muted">{e.note}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
