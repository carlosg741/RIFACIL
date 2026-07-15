import Link from "next/link";
import { auth } from "@/lib/auth";
import { listRaffles } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import { CreateDemoRaffleButton } from "@/components/admin/create-demo-raffle-button";
import { DeleteRaffleButton } from "@/components/admin/delete-raffle-button";
import { formatMoney, isDemoRaffleSlug, raffleStatusLabel } from "@/lib/format";

export default async function AdminRafflesPage() {
  const session = await auth();
  const isSuperAdmin = session?.user?.role === "super_admin";
  const rows = await listRaffles();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-primary">
            Rifas
          </h1>
          <p className="text-muted-foreground">Crea, edita o elimina tus talonarios</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSuperAdmin ? <CreateDemoRaffleButton /> : null}
          <ButtonLink href="/admin/rifas/nueva">Nueva rifa</ButtonLink>
        </div>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            Aún no tienes rifas. Crea la primera.
          </p>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/rifas/${r.id}`}
                  className="font-semibold underline"
                >
                  {r.title}
                </Link>
                <Badge variant="outline">{raffleStatusLabel[r.status]}</Badge>
                {isDemoRaffleSlug(r.slug) ? (
                  <Badge variant="secondary">Demo</Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                /r/{r.slug} · {r.totalTickets} números ·{" "}
                {formatMoney(r.pricePerTicket, r.currency)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/r/${r.slug}`} variant="outline" size="sm">
                Ver pública
              </ButtonLink>
              <ButtonLink href={`/admin/rifas/${r.id}`} size="sm">
                Administrar
              </ButtonLink>
              <DeleteRaffleButton raffleId={r.id} title={r.title} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
