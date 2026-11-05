"use client";

import type { ReactNode } from "react";
import { useHydrated } from "@/lib/store/ui";
import { Skeleton } from "../ui/Card";

/** Renders children only after the store has hydrated; shows skeletons before. */
export function Hydrated({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
