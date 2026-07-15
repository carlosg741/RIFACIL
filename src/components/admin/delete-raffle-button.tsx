"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteRaffle } from "@/lib/actions/admin";

export function DeleteRaffleButton({
  raffleId,
  title,
  redirectTo = "/admin/rifas",
}: {
  raffleId: string;
  title: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        const ok = window.confirm(
          `¿Eliminar la rifa “${title}”?\n\nSe borrarán tickets, órdenes, comprobantes y métodos de pago ligados. Esta acción no se puede deshacer.`,
        );
        if (!ok) return;
        start(async () => {
          const res = await deleteRaffle(raffleId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Rifa eliminada");
          router.push(redirectTo);
          router.refresh();
        });
      }}
    >
      {pending ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
