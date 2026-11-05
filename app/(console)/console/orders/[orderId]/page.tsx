import { Suspense } from "react";
import { OrderDetail } from "@/components/features/orders/OrderDetail";
import { Skeleton } from "@/components/ui/Card";

export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      {params.then(({ orderId }) => (
        <OrderDetail orderId={orderId} />
      ))}
    </Suspense>
  );
}
