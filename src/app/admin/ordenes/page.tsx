import Link from "next/link";
import { listAdminOrders, getOrderTickets } from "@/lib/actions/admin";
import { OrderActions } from "@/components/admin/order-actions";
import { AdminTicketActions } from "@/components/admin/admin-ticket-actions";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import {
  formatMoney,
  formatTicketNumber,
  orderStatusLabel,
} from "@/lib/format";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; highlight?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listAdminOrders(sp.status);

  const withTickets = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      ticketNumbers: await getOrderTickets(row.order.id),
    })),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-primary">
            Órdenes
          </h1>
          <p className="text-muted-foreground">
            Revisa comprobantes, confirma pagos y envía tickets por WhatsApp
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["", "Todas"],
            ["under_review", "En revisión"],
            ["paid", "Pagadas"],
            ["pending_payment", "Pendientes"],
            ["rejected", "Rechazadas"],
          ].map(([value, label]) => (
            <ButtonLink
              key={label}
              href={value ? `/admin/ordenes?status=${value}` : "/admin/ordenes"}
              variant={
                (sp.status || "") === value ? "default" : "outline"
              }
              size="sm"
            >
              {label}
            </ButtonLink>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {withTickets.length === 0 && (
          <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            No hay órdenes.
          </p>
        )}
        {withTickets.map(
          ({ order, raffleTitle, raffleSlug, proofUrl, methodName, ticketNumbers }) => {
            const highlight = sp.highlight === order.id;
            return (
              <article
                key={order.id}
                id={order.id}
                className={`rounded-xl border bg-card p-5 ${highlight ? "ring-2 ring-primary" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{order.participantName}</h2>
                      <Badge variant="secondary">
                        {orderStatusLabel[order.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.participantPhone}
                      {order.participantEmail
                        ? ` · ${order.participantEmail}`
                        : ""}
                    </p>
                    <p className="mt-2 text-sm">
                      <Link href={`/r/${raffleSlug}`} className="underline">
                        {raffleTitle}
                      </Link>
                      {" · "}
                      Números:{" "}
                      <span className="font-binance-num">
                        {ticketNumbers
                          .map((t) => formatTicketNumber(t.number))
                          .join(", ")}
                      </span>
                    </p>
                    <p className="mt-1 text-sm font-binance-num">
                      {formatMoney(order.totalAmount)} · {methodName || "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {(order.status === "under_review" ||
                      order.status === "pending_payment") && (
                      <OrderActions orderId={order.id} />
                    )}
                    <AdminTicketActions
                      slug={raffleSlug}
                      orderId={order.id}
                      phone={order.participantPhone}
                      name={order.participantName}
                      raffleTitle={raffleTitle}
                      numbers={ticketNumbers.map((t) => t.number)}
                    />
                  </div>
                </div>
                {proofUrl && (
                  <div className="mt-4">
                    <a
                      href={proofUrl.startsWith("data:") ? proofUrl : proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline"
                    >
                      Ver comprobante
                    </a>
                    {!proofUrl.includes("application/pdf") && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={proofUrl}
                        alt="Comprobante"
                        className="mt-2 max-h-48 rounded-lg border object-contain"
                      />
                    )}
                  </div>
                )}
              </article>
            );
          },
        )}
      </div>
    </div>
  );
}
