import { Suspense } from "react";
import { ReturnDetail } from "@/components/features/returns/ReturnDetail";
import { Skeleton } from "@/components/ui/Card";

export default function ReturnPage({ params }: { params: Promise<{ returnId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      {params.then(({ returnId }) => (
        <ReturnDetail returnId={returnId} />
      ))}
    </Suspense>
  );
}
