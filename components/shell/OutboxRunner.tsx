"use client";

import { useEffect, useRef } from "react";
import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";
import { useHydrated } from "@/lib/store/ui";

/**
 * Simulates the platform push: each queued event goes `sending` immediately and
 * resolves to `sent` (or `failed` when the demo switch is on) after 600 ms.
 */
export function OutboxRunner() {
  const hydrated = useHydrated();
  const queued = useWms((s) =>
    s.data.outbox
      .filter((o) => o.status === "queued")
      .map((o) => o.id)
      .join(","),
  );
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    if (!hydrated || !queued) return;
    for (const id of queued.split(",")) {
      if (inFlight.current.has(id)) continue;
      inFlight.current.add(id);
      actions.outboxBegin(id);
      setTimeout(() => {
        actions.outboxFinish(id);
        inFlight.current.delete(id);
      }, 600);
    }
  }, [hydrated, queued]);

  return null;
}
