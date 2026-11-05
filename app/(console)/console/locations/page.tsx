import { Suspense } from "react";
import { Locations } from "@/components/features/locations/Locations";

export default function LocationsPage() {
  return (
    <Suspense fallback={null}>
      <Locations />
    </Suspense>
  );
}
