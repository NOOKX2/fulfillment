"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "@/lib/i18n/useT";
import { Button } from "./Button";

/** Modal built on the native <dialog> element (focus trap + Esc handled by the browser). */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useT();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(92vw,34rem)] rounded-lg border border-ink bg-white p-0 text-ink backdrop:bg-ink/60"
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-silver-metal px-5 py-3">
            <h2 className="text-lg font-bold">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label={t("common.close")}>
              ✕
            </Button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t border-silver-metal px-5 py-3">{footer}</div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
