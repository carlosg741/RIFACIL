import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getDrawByRaffleSlug } from "@/lib/actions/admin";
import { formatTicketNumber, padDigitsForTotal } from "@/lib/format";

export default async function DrawPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getDrawByRaffleSlug(slug);
  if (!data) notFound();
  const { raffle, draw, winners } = data;
  const digits = padDigitsForTotal(raffle.totalTickets);

  return (
    <div className="min-h-full hero-mesh">
      <header className="mx-auto max-w-2xl px-4 py-5">
        <Link
          href={`/r/${slug}`}
          className="font-[family-name:var(--font-display)] text-lg font-semibold text-primary"
        >
          Rifacil
        </Link>
      </header>
      <main className="mx-auto max-w-2xl space-y-8 px-4 pb-20">
        <div className="animate-fade-up">
          <p className="text-sm uppercase tracking-wider text-teal">
            Resultado del sorteo
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-primary">
            {raffle.title}
          </h1>
          <p className="mt-2 text-primary/80">
            {raffle.winnerCount === 1
              ? "1 premio"
              : `${raffle.winnerCount} premios`}
          </p>
        </div>

        {!draw ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
            Aún no se ha realizado el sorteo.
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {winners.map((w) => (
                <div
                  key={w.id}
                  className="animate-fade-up overflow-hidden rounded-2xl border bg-card shadow-sm sm:flex"
                >
                  {w.prizeImageUrl ? (
                    <div className="flex min-h-48 items-center justify-center bg-black/10 p-3 sm:w-56 sm:shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={w.prizeImageUrl}
                        alt={w.prizeTitle || `Premio ${w.prizePosition}`}
                        className="max-h-56 max-w-full rounded-lg object-contain"
                      />
                    </div>
                  ) : null}
                  <div className="p-6">
                    <p className="text-sm text-muted-foreground">
                      Premio #{w.prizePosition}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {w.prizeTitle || raffle.prize}
                    </p>
                    {w.prizeDescription ? (
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {w.prizeDescription}
                      </p>
                    ) : null}
                    <p className="mt-4 font-[family-name:var(--font-display)] text-5xl font-semibold text-primary">
                      {formatTicketNumber(w.ticketNumber, digits)}
                    </p>
                    <p className="mt-2 font-medium">
                      {w.participantName || "Participante"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-card/80 p-4 text-xs text-muted-foreground">
              <p>
                Sorteado el{" "}
                {format(new Date(draw.drawnAt), "d MMMM yyyy · HH:mm", {
                  locale: es,
                })}
              </p>
              <p className="mt-1 break-all">
                Semilla: {draw.seed}
              </p>
              <p className="mt-1">
                Entre {draw.paidTicketCount} boletos pagados
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
