import { Suspense } from "react";
import { PdaPick } from "@/components/features/pda/PdaPick";
import { Skeleton } from "@/components/ui/Card";

export default function PdaPickWavePage({ params }: { params: Promise<{ waveId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      {params.then(({ waveId }) => (
        <PdaPick waveId={waveId} />
      ))}
    </Suspense>
  );
}
