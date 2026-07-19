import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { DigitalTicket } from "@/components/raffle/digital-ticket";
import { ButtonLink } from "@/components/button-link";
import { getOrderPublic } from "@/lib/actions/public";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const data = await getOrderPublic(orderId);
  if (!data || data.raffle.slug !== slug) notFound();

  const { order, raffle, tickets } = data;
  // El ticket solo está disponible tras adjuntar el comprobante de pago.
  const ticketReady =
    order.status === "under_review" || order.status === "paid";

  return (
    <div className="min-h-full bg-background">
      <header className="mx-auto flex max-w-lg items-center justify-between px-4 py-5 print:hidden">
        <BrandLogo href={`/r/${slug}`} size="sm" />
        <ButtonLink href={`/r/${slug}/orden/${orderId}`} variant="outline" size="sm">
          Ver orden
        </ButtonLink>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 pb-16">
        {ticketReady ? (
          <>
            <div className="print:hidden">
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary">
                Tu ticket digital
              </h1>
              <p className="text-sm text-muted-foreground">
                Guarda este enlace o imprímelo. El organizador también puede
                enviártelo por WhatsApp.
              </p>
            </div>

            <DigitalTicket
              slug={slug}
              orderId={order.id}
              raffleTitle={raffle.title}
              prize={raffle.prize}
              participantName={order.participantName}
              participantPhone={order.participantPhone}
              numbers={tickets.map((t) => t.number)}
              totalTickets={raffle.totalTickets}
              totalAmount={order.totalAmount}
              currency={order.currency || raffle.currency}
              status={order.status}
              drawAt={raffle.drawAt}
              raffleStatus={raffle.status}
            />
          </>
        ) : (
          <div className="rounded-2xl border border-primary/30 bg-secondary/40 p-6 text-center">
            <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-primary">
              Falta tu comprobante
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Para obtener tu ticket digital primero debes adjuntar el
              comprobante de pago en tu orden.
            </p>
            <ButtonLink
              href={`/r/${slug}/orden/${orderId}`}
              className="mt-4"
            >
              Ir a mi orden y subir comprobante
            </ButtonLink>
          </div>
        )}
      </main>
    </div>
  );
}
