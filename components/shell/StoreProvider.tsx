"use client";

import { useEffect, type ReactNode } from "react";
import { ScanFeedbackHost } from "../scan/ScanFeedbackHost";
import { actions } from "@/lib/store/actions";
import { installFlushHandlers, STORE_KEY } from "@/lib/store/persist";
import { useWms } from "@/lib/store/store";
import { useUi } from "@/lib/store/ui";
import { OutboxRunner } from "./OutboxRunner";

/**
 * Hydrates the localStorage-backed store after mount. The module-level store
 * starts empty so server and first client render match (cacheComponents-safe);
 * `useHydrated()` gates every data view behind a skeleton.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const lang = useWms((s) => s.data.settings.lang);

  useEffect(() => {
    let cancelled = false;
    const removeFlush = installFlushHandlers();
    Promise.resolve(useWms.persist.rehydrate()).then(() => {
      if (cancelled) return;
      actions.seedIfEmpty();
      useUi.getState().setHydrated(true);
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORE_KEY) return;
      void useWms.persist.rehydrate();
      const l = useWms.getState().data.settings.lang;
      useUi.getState().notify({
        kind: "info",
        text: l === "th" ? "ข้อมูลถูกแก้ไขจากแท็บอื่น" : "Data was changed in another tab",
      });
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      removeFlush();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <>
      {children}
      <ScanFeedbackHost />
      <OutboxRunner />
    </>
  );
}
