"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  approveOrder,
  deleteOrder,
  rejectOrder,
  revertOrderToReview,
} from "@/lib/actions/admin";

export function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const canApprove = status === "under_review" || status === "pending_payment";
  const canRevert = status === "paid";

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canApprove && (
        <>
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
        </>
      )}

      {canRevert && (
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await revertOrderToReview(orderId);
              if (!res.ok) toast.error(res.error);
              else {
                toast.success("Orden regresada a revisión");
                router.refresh();
              }
            })
          }
        >
          Volver a revisión
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        className="border-destructive/40 text-destructive hover:bg-destructive/10"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "¿Borrar esta orden? Se liberarán sus números y se eliminará el comprobante. Esta acción no se puede deshacer.",
            )
          )
            return;
          start(async () => {
            const res = await deleteOrder(orderId);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Orden borrada · números liberados");
              router.refresh();
            }
          });
        }}
      >
        Borrar
      </Button>
    </div>
  );
}
