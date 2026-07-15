"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runDraw } from "@/lib/actions/admin";

export function DrawButton({
  raffleId,
  slug,
  disabled,
}: {
  raffleId: string;
  slug: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      disabled={disabled || pending}
      size="lg"
      onClick={() => {
        if (
          !confirm(
            "¿Confirmas el sorteo? Solo participarán boletos pagados y no se puede deshacer.",
          )
        ) {
          return;
        }
        start(async () => {
          const res = await runDraw(raffleId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(
            `Ganador(es): ${res.winners.map((w) => w.number).join(", ")}`,
          );
          router.push(`/r/${slug}/sorteo`);
          router.refresh();
        });
      }}
    >
      {pending ? "Sorteando…" : "Realizar sorteo"}
    </Button>
  );
}
