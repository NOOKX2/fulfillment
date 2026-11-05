import { Suspense } from "react";
import { Inventory } from "@/components/features/inventory/Inventory";

export default function InventoryPage() {
  return (
    <Suspense fallback={null}>
      <Inventory />
    </Suspense>
  );
}
