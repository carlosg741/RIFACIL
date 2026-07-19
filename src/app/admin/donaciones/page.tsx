import Link from "next/link";
import { listAdminDonations } from "@/lib/actions/admin";
import { DonationActions } from "@/components/admin/donation-actions";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import { donationStatusLabel, formatMoney } from "@/lib/format";

export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listAdminDonations(sp.status);

  // Agrupar las donaciones por rifa, ya que cada aporte pertenece a una rifa.
  type DonationRow = (typeof rows)[number];
  const groups = new Map<
    string,
    { title: string; slug: string; donations: DonationRow[] }
  >();
  for (const row of rows) {
    const key = row.raffleSlug;
    if (!groups.has(key)) {
      groups.set(key, {
        title: row.raffleTitle,
        slug: row.raffleSlug,
        donations: [],
      });
    }
    groups.get(key)!.donations.push(row);
  }
  const raffleGroups = Array.from(groups.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-primary">
            Donaciones
          </h1>
          <p className="text-muted-foreground">
            Aportes sin números de rifa · revisa comprobantes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["", "Todas"],
            ["under_review", "En revisión"],
            ["confirmed", "Confirmadas"],
            ["pending_payment", "Pendientes"],
            ["rejected", "Rechazadas"],
          ].map(([value, label]) => (
            <ButtonLink
              key={label}
              href={
                value
                  ? `/admin/donaciones?status=${value}`
                  : "/admin/donaciones"
              }
              variant={(sp.status || "") === value ? "default" : "outline"}
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
            No hay donaciones todavía.
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
                {group.donations.length} donación(es)
              </span>
            </div>

            {group.donations.map(
              ({ donation, raffleCurrency, methodName }) => (
                <article
                  key={donation.id}
                  className="rounded-xl border bg-card p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{donation.donorName}</h3>
                        <Badge variant="secondary">
                          {donationStatusLabel[donation.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {donation.donorPhone}
                        {donation.donorEmail
                          ? ` · ${donation.donorEmail}`
                          : ""}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {methodName || "—"}
                      </p>
                      <p className="mt-1 font-binance-num text-lg font-semibold text-primary">
                        {formatMoney(
                          donation.amount,
                          donation.currency || raffleCurrency,
                        )}
                      </p>
                    </div>
                    {(donation.status === "under_review" ||
                      donation.status === "pending_payment") && (
                      <DonationActions donationId={donation.id} />
                    )}
                  </div>
                  {donation.proofUrl && (
                    <div className="mt-4">
                      <a
                        href={donation.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary underline"
                      >
                        Ver comprobante
                      </a>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={donation.proofUrl}
                        alt="Comprobante"
                        className="mt-2 max-h-48 rounded-lg border object-contain"
                      />
                    </div>
                  )}
                </article>
              ),
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
