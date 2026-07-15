import { notFound } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { getDonationPublic } from "@/lib/actions/public";
import { donationStatusLabel, formatMoney } from "@/lib/format";

export default async function DonationStatusPage({
  params,
}: {
  params: Promise<{ slug: string; donationId: string }>;
}) {
  const { slug, donationId } = await params;
  const data = await getDonationPublic(donationId);
  if (!data || data.raffle.slug !== slug) notFound();

  const { donation, raffle, paymentMethod } = data;

  return (
    <div className="min-h-full bg-background">
      <header className="mx-auto flex max-w-lg items-center justify-between px-4 py-5">
        <BrandLogo href={`/r/${slug}`} size="sm" />
        <Badge>{donationStatusLabel[donation.status]}</Badge>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 pb-16">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-primary">
            Tu donación
          </h1>
          <p className="mt-1 text-muted-foreground">{raffle.title}</p>
        </div>

        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <p>
            <span className="text-muted-foreground">Donante:</span>{" "}
            {donation.donorName}
          </p>
          <p>
            <span className="text-muted-foreground">Teléfono:</span>{" "}
            {donation.donorPhone}
          </p>
          <p className="font-binance-num text-lg font-semibold text-primary">
            Monto: {formatMoney(donation.amount, raffle.currency)}
          </p>
          {paymentMethod && (
            <p className="text-sm text-muted-foreground">
              Método: {paymentMethod.name}
            </p>
          )}
        </div>

        {donation.proofUrl && (
          <div className="rounded-2xl border bg-card p-5">
            <p className="mb-2 text-sm font-medium">Comprobante</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={donation.proofUrl}
              alt="Comprobante de donación"
              className="max-h-72 w-full rounded-lg object-contain"
            />
          </div>
        )}

        {donation.status === "under_review" && (
          <p className="text-center text-sm text-muted-foreground">
            Tu donación está en revisión. ¡Gracias por colaborar!
          </p>
        )}
        {donation.status === "confirmed" && (
          <p className="text-center text-sm font-medium text-[#0ecb81]">
            Donación confirmada. ¡Muchas gracias!
          </p>
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
