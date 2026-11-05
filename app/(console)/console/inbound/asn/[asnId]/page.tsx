import { Suspense } from "react";
import { AsnDetail } from "@/components/features/inbound/AsnDetail";
import { Skeleton } from "@/components/ui/Card";

export default function AsnDetailPage({ params }: { params: Promise<{ asnId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      {params.then(({ asnId }) => (
        <AsnDetail asnId={asnId} />
      ))}
    </Suspense>
  );
}
