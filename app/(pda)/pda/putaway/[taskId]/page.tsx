import { Suspense } from "react";
import { PdaPutaway } from "@/components/features/pda/PdaPutaway";
import { Skeleton } from "@/components/ui/Card";

export default function PdaPutawayTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      {params.then(({ taskId }) => (
        <PdaPutaway taskId={taskId} />
      ))}
    </Suspense>
  );
}
