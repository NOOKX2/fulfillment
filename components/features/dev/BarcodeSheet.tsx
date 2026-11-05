"use client";

import { useMemo, useState } from "react";
import { BarcodeSvg } from "@/components/scan/BarcodeSvg";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { skuLabel } from "@/lib/domain/format";
import { asnBarcode, orderBarcode, returnBarcode, toteBarcode, trackingBarcode } from "@/lib/scan/parse";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";

type Cat = "bins" | "skus" | "asn" | "orders" | "totes" | "tracking" | "returns";

/** Printable A4 sheet of every barcode the demo can scan, so a real hardware scanner also works. */
export function BarcodeSheet() {
  const { tr, lang } = useT();
  const data = useWms((s) => s.data);
  const [cat, setCat] = useState<Cat>("bins");

  const items = useMemo(() => {
    switch (cat) {
      case "bins":
        return data.bins.map((b) => ({ key: b.id, value: b.barcode, label: b.path }));
      case "skus":
        return data.skus.flatMap((k) =>
          k.barcodes.slice(0, 1).map((v) => ({ key: k.id, value: v, label: skuLabel(k, lang) })),
        );
      case "asn":
        return data.asns.map((a) => ({ key: a.id, value: asnBarcode(a.asnNo), label: a.asnNo }));
      case "orders":
        return data.orders.map((o) => ({ key: o.id, value: orderBarcode(o.id), label: o.channelOrderNo }));
      case "totes":
        return data.totes.map((t) => ({ key: t.id, value: toteBarcode(t.id), label: t.id }));
      case "tracking":
        return data.shipments.map((s) => ({ key: s.id, value: trackingBarcode(s.trackingNo), label: s.trackingNo }));
      case "returns":
        return data.returns.flatMap((r) => [
          { key: `${r.id}-rma`, value: returnBarcode(r.rmaNo), label: r.rmaNo },
          { key: `${r.id}-trk`, value: trackingBarcode(r.returnTrackingNo), label: r.returnTrackingNo },
        ]);
    }
  }, [cat, data, lang]);

  const tabs: { key: Cat; label: string }[] = [
    { key: "bins", label: tr("ช่องเก็บ", "Bins") },
    { key: "skus", label: tr("สินค้า", "SKUs") },
    { key: "asn", label: "ASN" },
    { key: "orders", label: tr("ออเดอร์", "Orders") },
    { key: "totes", label: tr("ตะกร้า", "Totes") },
    { key: "tracking", label: tr("เลขพัสดุ", "Tracking") },
    { key: "returns", label: tr("ตีกลับ", "Returns") },
  ];

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={tr("พิมพ์บาร์โค้ดทดสอบ", "Test barcode sheet")}
          subtitle={tr(
            "พิมพ์ลงกระดาษ A4 แล้วสแกนด้วยเครื่องสแกนจริงได้ หรือใช้ตัวจำลองในหน้าจอ (Code 128)",
            "Print on A4 and scan with a real hardware scanner, or use the on-screen simulators (Code 128).",
          )}
          actions={<Button onClick={() => window.print()}>🖨 {tr("พิมพ์", "Print")}</Button>}
        />
        <Tabs
          tabs={tabs.map((t) => ({ ...t, count: undefined }))}
          value={cat}
          onChange={setCat}
        />
        {items.length === 0 ? (
          <p className="text-sm text-muted">{tr("ยังไม่มีข้อมูลหมวดนี้", "Nothing in this category yet.")}</p>
        ) : null}
      </div>
      <div className="print-area print-a4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {items.map((i) => (
          <figure key={i.key} className="break-inside-avoid rounded border border-silver-metal bg-white p-2">
            <BarcodeSvg value={i.value} height={44} moduleWidth={1.3} />
            <figcaption className="mt-1 truncate text-center text-xs">{i.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
