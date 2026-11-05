"use client";

import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui/Card";
import { useT } from "@/lib/i18n/useT";
import { useWms } from "@/lib/store/store";
import { ReturnFlow } from "./ReturnFlow";

export function ReturnDetail({ returnId }: { returnId: string }) {
  const { tr } = useT();
  const exists = useWms((s) => s.data.returns.some((r) => r.id === returnId));
  if (!exists) {
    return (
      <EmptyState>
        {tr("ไม่พบรายการคืน", "Return not found")}{" "}
        <Link className="underline" href="/console/returns">
          {tr("กลับ", "Back")}
        </Link>
      </EmptyState>
    );
  }
  return (
    <div>
      <PageHeader
        title={tr("รายละเอียดการรับคืน", "Return detail")}
        actions={
          <Link href="/console/returns" className="underline">
            {tr("← ทั้งหมด", "← All")}
          </Link>
        }
      />
      <ReturnFlow returnId={returnId} />
    </div>
  );
}
