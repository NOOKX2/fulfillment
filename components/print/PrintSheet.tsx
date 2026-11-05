import type { ReactNode } from "react";

/**
 * Print-only wrapper. Hidden on screen; during `window.print()` only
 * `.print-area` stays visible (see globals.css). `page` picks the @page size.
 */
export function PrintSheet({
  page,
  children,
}: {
  page: "awb" | "a4";
  children: ReactNode;
}) {
  return (
    <div className={`print-area hidden print:block ${page === "awb" ? "print-awb" : "print-a4"}`}>
      {children}
    </div>
  );
}
