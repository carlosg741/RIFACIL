import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ProofUploadForm } from "@/components/raffle/proof-upload-form";
import { DigitalTicket } from "@/components/raffle/digital-ticket";
import { PaymentMethodDetails } from "@/components/raffle/payment-method-details";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import { getOrderPublic } from "@/lib/actions/public";
import {
  formatMoney,
  formatTicketNumber,
  orderStatusLabel,
  padDigitsForTotal,
} from "@/lib/format";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const data = await getOrderPublic(orderId);
  if (!data || data.raffle.slug !== slug) notFound();

  const { order, raffle, paymentMethod, proof, tickets } = data;
  const digits = padDigitsForTotal(raffle.totalTickets);
  const canUpload =
    order.status === "pending_payment" || order.status === "rejected";
  const showTicket =
    order.status === "under_review" ||
    order.status === "paid" ||
    order.status === "pending_payment";

  return (
    <div className="min-h-full bg-background">
      <header className="mx-auto flex max-w-lg items-center justify-between px-4 py-5">
        <BrandLogo href={`/r/${slug}`} size="sm" />
        <Badge>{orderStatusLabel[order.status]}</Badge>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 pb-16">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-primary">
            Tu orden
          </h1>
          <p className="mt-1 text-muted-foreground">{raffle.title}</p>
        </div>

        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <p>
            <span className="text-muted-foreground">Participante:</span>{" "}
            {order.participantName}
          </p>
          <p>
            <span className="text-muted-foreground">Teléfono:</span>{" "}
            {order.participantPhone}
          </p>
          <p>
            <span className="text-muted-foreground">Números:</span>{" "}
            <span className="font-binance-num">
              {tickets
                .map((t) => formatTicketNumber(t.number, digits))
                .join(", ")}
            </span>
          </p>
          <p className="font-binance-num text-lg font-semibold text-primary">
            Total: {formatMoney(order.totalAmount, order.currency || raffle.currency)}
          </p>
          {order.reservedUntil && order.status !== "paid" && (
            <p className="text-sm text-accent">
              Reserva hasta{" "}
              {format(new Date(order.reservedUntil), "d MMM HH:mm", {
                locale: es,
              })}
            </p>
          )}
        </div>

        {paymentMethod && (
          <div className="space-y-3 rounded-2xl border border-primary/20 bg-secondary/40 p-5">
            <h2 className="font-semibold text-primary">Datos de pago</h2>
            <PaymentMethodDetails method={paymentMethod} framed={false} />
          </div>
        )}

        {proof && (
          <div className="rounded-2xl border bg-card p-5">
            <p className="mb-2 text-sm font-medium">Comprobante enviado</p>
            {proof.mimeType?.includes("pdf") ? (
              <a
                href={proof.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Ver PDF
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proof.fileUrl}
                alt="Comprobante"
                className="max-h-72 w-full rounded-lg object-contain"
              />
            )}
          </div>
        )}

        {canUpload && <ProofUploadForm orderId={order.id} />}

        {order.status === "under_review" && (
          <p className="text-center text-sm text-muted-foreground">
            Comprobante en revisión. Tu ticket ya está disponible abajo.
          </p>
        )}

        {showTicket && (
          <section className="space-y-3 border-t border-border pt-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-primary">
                Ticket digital
              </h2>
              <ButtonLink
                href={`/r/${slug}/ticket/${orderId}`}
                size="sm"
                variant="outline"
              >
                Abrir ticket
              </ButtonLink>
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
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link href={`/r/${slug}`} className="underline">
            Volver al talonario
          </Link>
        </p>
      </main>
    </div>
  );
}
