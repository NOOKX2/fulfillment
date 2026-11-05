import { Suspense } from "react";
import { PdaReturn } from "@/components/features/pda/PdaReturns";
import { Skeleton } from "@/components/ui/Card";

export default function PdaReturnPage({ params }: { params: Promise<{ returnId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      {params.then(({ returnId }) => (
        <PdaReturn returnId={returnId} />
      ))}
    </Suspense>
  );
}
