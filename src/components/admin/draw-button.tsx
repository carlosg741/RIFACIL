"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runDraw } from "@/lib/actions/admin";

function formatDrawAt(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DrawButton({
  raffleId,
  slug,
  drawAt,
  hasPaidTickets,
}: {
  raffleId: string;
  slug: string;
  drawAt: Date | string | null;
  hasPaidTickets: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const scheduled = drawAt ? new Date(drawAt) : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!scheduled) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [scheduled?.getTime()]);

  const scheduleReached = !scheduled || now >= scheduled.getTime();
  const canDraw = hasPaidTickets && !pending;

  function executeDraw(forceEarly: boolean) {
    if (!hasPaidTickets) {
      toast.error("No hay boletos pagados para sortear.");
      return;
    }

    if (!scheduleReached && !forceEarly) {
      toast.error(
        scheduled
          ? `El sorteo está programado para ${formatDrawAt(scheduled)}.`
          : "Aún no es la fecha del sorteo.",
      );
      return;
    }

    if (forceEarly && scheduled) {
      if (
        !confirm(
          `Estás por sortear ANTES de la fecha programada (${formatDrawAt(scheduled)}).\n\n¿Seguro que quieres adelantar el sorteo? No se puede deshacer.`,
        )
      ) {
        return;
      }
    } else if (
      !confirm(
        "¿Confirmas el sorteo? Solo participarán boletos pagados y no se puede deshacer.",
      )
    ) {
      return;
    }

    start(async () => {
      const res = await runDraw(raffleId, { forceEarly });
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
  }

  if (!hasPaidTickets) {
    return (
      <Button disabled size="lg">
        Realizar sorteo
      </Button>
    );
  }

  if (!scheduleReached && scheduled) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          disabled={pending}
          size="lg"
          variant="outline"
          onClick={() => executeDraw(true)}
        >
          {pending ? "Sorteando…" : "Sortear antes de la fecha"}
        </Button>
        <p className="max-w-xs text-right text-xs text-muted-foreground">
          Programado: {formatDrawAt(scheduled)}. El botón normal se habilita a
          esa hora.
        </p>
      </div>
    );
  }

  return (
    <Button
      disabled={!canDraw}
      size="lg"
      onClick={() => executeDraw(false)}
    >
      {pending ? "Sorteando…" : "Realizar sorteo"}
    </Button>
  );
}
