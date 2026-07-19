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

  // Agrupar las órdenes por rifa para no mezclarlas todas en una sola lista.
  type OrderRow = (typeof withTickets)[number];
  const groups = new Map<
    string,
    { title: string; slug: string; orders: OrderRow[] }
  >();
  for (const row of withTickets) {
    const key = row.raffleSlug;
    if (!groups.has(key)) {
      groups.set(key, {
        title: row.raffleTitle,
        slug: row.raffleSlug,
        orders: [],
      });
    }
    groups.get(key)!.orders.push(row);
  }
  const raffleGroups = Array.from(groups.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
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

      <div className="space-y-8">
        {raffleGroups.length === 0 && (
          <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            No hay órdenes.
          </p>
        )}
        {raffleGroups.map((group) => (
          <section key={group.slug} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-primary">
                <Link href={`/r/${group.slug}`} className="hover:underline">
                  {group.title}
                </Link>
              </h2>
              <span className="text-sm text-muted-foreground">
                {group.orders.length} orden(es)
              </span>
            </div>

            {group.orders.map(
              ({
                order,
                raffleTitle,
                raffleSlug,
                raffleCurrency,
                proofUrl,
                methodName,
                ticketNumbers,
              }) => {
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
                          <h3 className="font-semibold">
                            {order.participantName}
                          </h3>
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
                          Números:{" "}
                          <span className="font-binance-num">
                            {ticketNumbers
                              .map((t) => formatTicketNumber(t.number))
                              .join(", ")}
                          </span>
                        </p>
                        <p className="mt-1 text-sm font-binance-num">
                          {formatMoney(
                            order.totalAmount,
                            order.currency || raffleCurrency,
                          )}{" "}
                          · {methodName || "—"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <OrderActions orderId={order.id} status={order.status} />
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
                          href={proofUrl}
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
          </section>
        ))}
      </div>
    </div>
  );
}
