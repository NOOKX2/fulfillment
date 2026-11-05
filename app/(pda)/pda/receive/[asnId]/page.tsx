import { Suspense } from "react";
import { PdaReceive } from "@/components/features/pda/PdaReceive";
import { Skeleton } from "@/components/ui/Card";

export default function PdaReceiveDetailPage({ params }: { params: Promise<{ asnId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      {params.then(({ asnId }) => (
        <PdaReceive asnId={asnId} />
      ))}
    </Suspense>
  );
}
