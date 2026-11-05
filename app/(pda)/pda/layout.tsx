import { PdaShell } from "@/components/shell/PdaShell";

// See console layout: data renders client-side after hydration.
export const instant = false;

export default function PdaLayout({ children }: { children: React.ReactNode }) {
  return <PdaShell>{children}</PdaShell>;
}
