"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveOrder, rejectOrder } from "@/lib/actions/admin";

export function OrderActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await approveOrder(orderId);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Pago aprobado");
              router.refresh();
            }
          })
        }
      >
        Aprobar
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await rejectOrder(orderId);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Orden rechazada · números liberados");
              router.refresh();
            }
          })
        }
      >
        Rechazar
      </Button>
    </div>
  );
}
