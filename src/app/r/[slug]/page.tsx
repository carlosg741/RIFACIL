import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TicketGrid } from "@/components/raffle/ticket-grid";
import { BrandLogo } from "@/components/brand-logo";
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
  const { raffle, tickets, paymentMethods } = data;

  return (
    <div className="min-h-full hero-mesh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <BrandLogo href="/" size="sm" />
        <Badge variant="secondary">{raffleStatusLabel[raffle.status]}</Badge>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 pb-24">
        <section className="animate-fade-up space-y-4">
          <p className="text-sm uppercase tracking-wider text-primary">Premio</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-foreground md:text-5xl">
            {raffle.title}
          </h1>
          <p className="text-xl text-primary">{raffle.prize}</p>
          {raffle.imageUrl && (
            <div className="flex max-h-[70vh] min-h-56 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-black/20 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={raffle.imageUrl}
                alt={raffle.prize}
                className="max-h-[calc(70vh-1rem)] max-w-full rounded-xl object-contain"
              />
            </div>
          )}
          {raffle.description && (
            <p className="max-w-2xl text-muted-foreground">{raffle.description}</p>
          )}
          <div className="flex flex-wrap gap-4 pt-2 font-binance-num text-sm text-muted-foreground">
            <span>
              {formatMoney(raffle.pricePerTicket, raffle.currency)} / número
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

        {raffle.status === "active" ? (
          <TicketGrid
            raffle={raffle}
            tickets={tickets}
            paymentMethods={paymentMethods}
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
