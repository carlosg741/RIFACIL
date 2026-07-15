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

      <div className="space-y-4">
        {rows.length === 0 && (
          <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            No hay donaciones todavía.
          </p>
        )}
        {rows.map(({ donation, raffleTitle, raffleSlug, methodName }) => (
          <article
            key={donation.id}
            className="rounded-xl border bg-card p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{donation.donorName}</h2>
                  <Badge variant="secondary">
                    {donationStatusLabel[donation.status]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {donation.donorPhone}
                  {donation.donorEmail ? ` · ${donation.donorEmail}` : ""}
                </p>
                <p className="mt-2 text-sm">
                  <Link href={`/r/${raffleSlug}`} className="underline">
                    {raffleTitle}
                  </Link>
                  {" · "}
                  {methodName || "—"}
                </p>
                <p className="mt-1 font-binance-num text-lg font-semibold text-primary">
                  {formatMoney(donation.amount)}
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
        ))}
      </div>
    </div>
  );
}
