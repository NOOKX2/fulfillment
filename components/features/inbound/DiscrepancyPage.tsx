"use client";

import { PageHeader } from "@/components/ui/Card";
import { useT } from "@/lib/i18n/useT";
import { DiscrepancyList } from "./DiscrepancyList";

export function DiscrepancyPage() {
  const { tr } = useT();
  return (
    <div>
      <PageHeader
        title={tr("รายการส่วนต่างการรับ", "Receiving discrepancies")}
        subtitle={tr(
          "ของขาด ของเกิน สินค้าผิด และของชำรุด – รับทราบ แล้วเลือกวิธีแก้ไข (เคลม ส่งคืน หรือรับส่วนเกิน)",
          "Shorts, overs, wrong and damaged items - acknowledge, then resolve (claim, return or accept the excess).",
        )}
      />
      <DiscrepancyList />
    </div>
  );
}
