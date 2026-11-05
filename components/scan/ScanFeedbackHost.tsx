"use client";

import { useEffect } from "react";
import { useUi } from "@/lib/store/ui";
import { useT } from "@/lib/i18n/useT";

/**
 * Visual layer of scan feedback. Errors are announced assertively with an icon
 * and text (never color alone); success is a polite gold-bordered confirmation.
 */
export function ScanFeedbackHost() {
  const fb = useUi((s) => s.feedback);
  const clear = useUi((s) => s.clearFeedback);
  const storageFull = useUi((s) => s.storageFull);
  const { t } = useT();

  useEffect(() => {
    if (!fb) return;
    const id = setTimeout(clear, fb.kind === "error" ? 6500 : 3200);
    return () => clearTimeout(id);
  }, [fb, clear]);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3 no-print"
        aria-live={fb?.kind === "error" ? "assertive" : "polite"}
      >
        {fb ? (
          <div
            key={fb.id}
            role={fb.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex max-w-2xl items-start gap-3 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg ${
              fb.kind === "error"
                ? "bg-danger text-white"
                : fb.kind === "ok"
                  ? "border-2 border-gold bg-ink text-white"
                  : "border border-silver-metal bg-white text-ink"
            }`}
          >
            <span aria-hidden className="text-lg leading-none">
              {fb.kind === "error" ? "⚠" : fb.kind === "ok" ? "✓" : "ℹ"}
            </span>
            <span>{fb.text}</span>
            <button
              type="button"
              onClick={clear}
              aria-label={t("common.close")}
              className="ml-2 opacity-80 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>
      {storageFull ? (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-0 z-50 bg-danger px-4 py-2 text-center text-sm font-semibold text-white no-print"
        >
          ⚠ {t("storage.full")}
        </div>
      ) : null}
    </>
  );
}
