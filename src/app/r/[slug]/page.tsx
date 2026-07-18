import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TicketGrid } from "@/components/raffle/ticket-grid";
import { PrizeCarousel } from "@/components/raffle/prize-carousel";
import { BrandLogo } from "@/components/brand-logo";
import { ButtonLink } from "@/components/button-link";
import { Badge } from "@/components/ui/badge";
import { getRaffleBySlug } from "@/lib/actions/public";
import { formatMoney, raffleStatusLabel } from "@/lib/format";

export default async function RafflePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getRaffleBySlug(slug);
  if (!data) notFound();
  const { raffle, prizes, currencies, tickets, paymentMethods } = data;
  const currencyViews = currencies.map((c) => ({
    code: c.code,
    pricePerTicket: c.pricePerTicket,
  }));
  const displayPrizes =
    prizes.length > 0
      ? prizes
      : [
          {
            id: `${raffle.id}-legacy`,
            title: raffle.prize,
            description: null,
            imageUrl: null,
            position: 1,
          },
        ];

  return (
    <div className="min-h-full hero-mesh">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5">
        <div className="flex items-center gap-3">
          <BrandLogo href="/" size="sm" />
          <ButtonLink href="/" size="sm" variant="outline">
            Inicio
          </ButtonLink>
        </div>
        <Badge variant="secondary">{raffleStatusLabel[raffle.status]}</Badge>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 pb-24">
        <section className="animate-fade-up space-y-4">
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-foreground md:text-5xl">
            {raffle.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-primary/30 bg-secondary/40 px-4 py-3">
            {raffle.drawAt ? (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Fecha del sorteo
                </p>
                <p className="font-binance-num font-semibold text-primary">
                  {format(new Date(raffle.drawAt), "d MMMM yyyy · HH:mm", {
                    locale: es,
                  })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Fecha del sorteo por anunciar
              </p>
            )}
            <ButtonLink
              href={`/r/${raffle.slug}/sorteo`}
              size="sm"
              variant={raffle.status === "drawn" ? "default" : "secondary"}
            >
              {raffle.status === "drawn"
                ? "Ver ganadores"
                : "Ver resultado del sorteo"}
            </ButtonLink>
          </div>
          {raffle.imageUrl ? (
            <div className="flex max-h-[50vh] min-h-48 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-black/10 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={raffle.imageUrl}
                alt={raffle.title}
                className="max-h-[calc(50vh-1.5rem)] max-w-full rounded-xl object-contain"
              />
            </div>
          ) : null}
          {raffle.description && (
            <p className="max-w-2xl text-muted-foreground">{raffle.description}</p>
          )}
          <div className="flex flex-wrap gap-4 font-binance-num text-sm text-muted-foreground">
            <span>
              {currencyViews
                .map((c) => formatMoney(c.pricePerTicket, c.code))
                .join(" · ")}{" "}
              / número
            </span>
            {raffle.drawAt && (
              <span>
                Sorteo:{" "}
                {format(new Date(raffle.drawAt), "d MMM yyyy", { locale: es })}
              </span>
            )}
            {raffle.status === "drawn" && (
              <Link href={`/r/${raffle.slug}/sorteo`} className="underline">
                Ver ganadores
              </Link>
            )}
          </div>
        </section>

        <section className="animate-fade-up space-y-4">
          <p className="text-sm uppercase tracking-wider text-primary">
            {displayPrizes.length === 1 ? "Premio" : "Premios"}
          </p>
          <PrizeCarousel prizes={displayPrizes} />
        </section>

        {raffle.status === "active" ? (
          <TicketGrid
            raffle={raffle}
            tickets={tickets}
            paymentMethods={paymentMethods}
            currencies={currencyViews}
          />
        ) : (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              Esta rifa no acepta nuevas participaciones.
            </p>
            {raffle.status === "drawn" && (
              <Link
                href={`/r/${raffle.slug}/sorteo`}
                className="mt-4 inline-block text-primary underline"
              >
                Ir al resultado del sorteo
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
