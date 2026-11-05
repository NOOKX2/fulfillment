import { Suspense } from "react";
import { PdaQc } from "@/components/features/pda/PdaQc";

export default function PdaQcPage() {
  return (
    <Suspense fallback={null}>
      <PdaQc />
    </Suspense>
  );
}
