import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ensureSchema, getDb } from "@/db";
import { donations, raffles } from "@/db/schema";
import { notifyPlatformDonationProof } from "@/lib/notify-platform";
import { uploadProofFile } from "@/lib/upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const donationId = String(formData.get("donationId") || "");
    const file = formData.get("proof");

    if (!donationId || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { ok: false, error: "Adjunta el comprobante de pago." },
        { status: 400 },
      );
    }

    await ensureSchema();
    const db = await getDb();

    const [donation] = await db
      .select()
      .from(donations)
      .where(eq(donations.id, donationId))
      .limit(1);

    if (!donation) {
      return NextResponse.json(
        { ok: false, error: "Donación no encontrada." },
        { status: 404 },
      );
    }
    if (
      donation.status !== "pending_payment" &&
      donation.status !== "rejected"
    ) {
      return NextResponse.json(
        { ok: false, error: "Esta donación ya no admite comprobante." },
        { status: 400 },
      );
    }

    const uploaded = await uploadProofFile(file);
    await db
      .update(donations)
      .set({
        proofUrl: uploaded.url,
        proofFileName: uploaded.fileName,
        status: "under_review",
        updatedAt: new Date(),
      })
      .where(eq(donations.id, donationId));

    const [raffle] = await db
      .select({ slug: raffles.slug })
      .from(raffles)
      .where(eq(raffles.id, donation.raffleId))
      .limit(1);

    if (raffle) {
      revalidatePath(`/r/${raffle.slug}/donacion/${donationId}`);
      revalidatePath("/admin/donaciones");
    }

    void notifyPlatformDonationProof({
      id: donation.id,
      raffleId: donation.raffleId,
      donorName: donation.donorName,
      donorPhone: donation.donorPhone,
      amount: donation.amount,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "No se pudo subir el archivo.",
      },
      { status: 500 },
    );
  }
}
