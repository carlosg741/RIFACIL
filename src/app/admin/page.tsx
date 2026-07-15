import Link from "next/link";
import { getAdminDashboard } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import { formatMoney, orderStatusLabel, raffleStatusLabel } from "@/lib/format";
import { ReleaseExpiredButton } from "@/components/admin/release-expired-button";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboard();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-primary">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Resumen de tus rifas y pagos pendientes
          </p>
        </div>
        <div className="flex gap-2">
          <ReleaseExpiredButton />
          <ButtonLink href="/admin/rifas/nueva">Nueva rifa</ButtonLink>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Rifas" value={String(data.raffles.length)} />
        <Stat
          label="Órdenes en revisión"
          value={String(data.pendingOrders.length)}
        />
        <Stat label="Boletos pagados" value={String(data.paidTickets)} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-primary">Pendientes de revisar</h2>
          <Link href="/admin/ordenes" className="text-sm text-primary underline">
            Ver todas
          </Link>
        </div>
        {data.pendingOrders.length === 0 ? (
          <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            No hay comprobantes esperando revisión.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="p-3">Participante</th>
                  <th className="p-3">Rifa</th>
                  <th className="p-3">Monto</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.pendingOrders.map(({ order, raffleTitle, raffleSlug }) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="p-3">
                      <Link
                        href={`/admin/ordenes?highlight=${order.id}`}
                        className="font-medium underline"
                      >
                        {order.participantName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {order.participantPhone}
                      </div>
                    </td>
                    <td className="p-3">
                      <Link href={`/r/${raffleSlug}`} className="underline">
                        {raffleTitle}
                      </Link>
                    </td>
                    <td className="p-3">{formatMoney(order.totalAmount)}</td>
                    <td className="p-3">
                      <Badge variant="secondary">
                        {orderStatusLabel[order.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-primary">Tus rifas</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {data.raffles.map((r) => (
            <Link
              key={r.id}
              href={`/admin/rifas/${r.id}`}
              className="rounded-xl border bg-card p-5 transition hover:border-primary"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-[family-name:var(--font-display)] text-lg">
                  {r.title}
                </h3>
                <Badge variant="outline">{raffleStatusLabel[r.status]}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{r.prize}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                /r/{r.slug} · {formatMoney(r.pricePerTicket, r.currency)}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-primary">
        {value}
      </p>
    </div>
  );
}
