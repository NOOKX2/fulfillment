import { Suspense } from "react";
import { ManifestDetail } from "@/components/features/shipping/ManifestDetail";
import { Skeleton } from "@/components/ui/Card";

export default function ManifestPage({ params }: { params: Promise<{ manifestId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      {params.then(({ manifestId }) => (
        <ManifestDetail manifestId={manifestId} />
      ))}
    </Suspense>
  );
}
