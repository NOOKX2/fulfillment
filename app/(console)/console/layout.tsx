import { ConsoleShell } from "@/components/shell/ConsoleShell";

// All data lives in localStorage and renders after hydration (behind <Hydrated>),
// so server-side instant-navigation validation does not apply to this app.
export const instant = false;

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
