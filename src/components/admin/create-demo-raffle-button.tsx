"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createFreshDemoRaffle } from "@/lib/actions/admin";

export function CreateDemoRaffleButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        const ok = window.confirm(
          "¿Crear una nueva rifa demo?\n\nLa demo actual (si existe) se archivará y la landing apuntará a una demo nueva vacía en /r/demo.",
        );
        if (!ok) return;
        start(async () => {
          const res = await createFreshDemoRaffle();
          if (!res.ok) {
            toast.error("No se pudo crear la demo");
            return;
          }
          toast.success("Nueva rifa demo lista");
          router.push(`/admin/rifas/${res.id}`);
          router.refresh();
        });
      }}
    >
      {pending ? "Creando demo…" : "Nueva rifa demo"}
    </Button>
  );
}
