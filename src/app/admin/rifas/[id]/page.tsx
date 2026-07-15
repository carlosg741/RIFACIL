import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  getRaffleForAdmin,
  getRafflePrizesForAdmin,
} from "@/lib/actions/admin";
import { countTicketStats } from "@/lib/tickets";
import { RaffleForm } from "@/components/admin/raffle-form";
import { RaffleSharePanel } from "@/components/admin/raffle-share-panel";
import { DrawButton } from "@/components/admin/draw-button";
import { DeleteRaffleButton } from "@/components/admin/delete-raffle-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import { isDemoRaffleSlug, raffleStatusLabel } from "@/lib/format";

export default async function AdminRaffleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [raffle, prizes] = await Promise.all([
    getRaffleForAdmin(id),
    getRafflePrizesForAdmin(id),
  ]);
  if (!raffle) notFound();
  const stats = await countTicketStats(raffle.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-primary">
              {raffle.title}
            </h1>
            <Badge>{raffleStatusLabel[raffle.status]}</Badge>
          </div>
          <p className="text-muted-foreground">
            <Link href={`/r/${raffle.slug}`} className="underline">
              /r/{raffle.slug}
            </Link>
            {raffle.drawAt && (
              <>
                {" · "}
                Sorteo{" "}
                {format(new Date(raffle.drawAt), "d MMM yyyy · HH:mm", {
                  locale: es,
                })}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/r/${raffle.slug}`} variant="outline">
            Ver pública
          </ButtonLink>
          {raffle.status === "drawn" ? (
            <ButtonLink href={`/r/${raffle.slug}/sorteo`}>
              Ver resultado
            </ButtonLink>
          ) : (
            <DrawButton
              raffleId={raffle.id}
              slug={raffle.slug}
              disabled={stats.paid === 0}
            />
          )}
          <DeleteRaffleButton raffleId={raffle.id} title={raffle.title} />
        </div>
      </div>

      {isDemoRaffleSlug(raffle.slug) ? (
        <p className="rounded-xl border border-primary/30 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          Esta es una rifa <span className="text-primary">demo</span>: no envía
          correos de comprobantes. Cuando se llene, en{" "}
          <Link href="/admin/rifas" className="underline">
            Rifas
          </Link>{" "}
          usa <strong className="text-foreground">Nueva rifa demo</strong> para
          archivar esta y crear otra en /r/demo.
        </p>
      ) : null}

      <RaffleSharePanel slug={raffle.slug} title={raffle.title} />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Disponibles", stats.available],
          ["Apartados", stats.reserved],
          ["Pagados", stats.paid],
          ["Total", stats.total],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-binance-num text-2xl font-semibold text-primary">
              {value}
            </p>
          </div>
        ))}
      </div>

      {raffle.status !== "drawn" && (
        <section>
          <h2 className="mb-3 font-semibold text-primary">Editar</h2>
          <RaffleForm raffle={raffle} initialPrizes={prizes} />
        </section>
      )}
    </div>
  );
}
