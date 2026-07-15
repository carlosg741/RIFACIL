import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ensureSchema, getDb } from "@/db";
import { orders, paymentProofs, raffles } from "@/db/schema";
import { notifyPlatformOrderProof } from "@/lib/notify-platform";
import { releaseExpiredReservations } from "@/lib/tickets";
import { uploadProofFile } from "@/lib/upload";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const orderId = String(formData.get("orderId") || "");
    const file = formData.get("proof");

    if (!orderId || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { ok: false, error: "Adjunta el comprobante de pago." },
        { status: 400 },
      );
    }

    await ensureSchema();
    const db = await getDb();

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Orden no encontrada." },
        { status: 404 },
      );
    }
    if (order.status !== "pending_payment" && order.status !== "rejected") {
      return NextResponse.json(
        { ok: false, error: "Esta orden ya no admite comprobante." },
        { status: 400 },
      );
    }
    if (order.reservedUntil && order.reservedUntil < new Date()) {
      await releaseExpiredReservations(order.raffleId);
      return NextResponse.json(
        {
          ok: false,
          error: "La reserva expiró. Elige números de nuevo.",
        },
        { status: 400 },
      );
    }

    const uploaded = await uploadProofFile(file);
    const [existing] = await db
      .select()
      .from(paymentProofs)
      .where(eq(paymentProofs.orderId, orderId))
      .limit(1);

    if (existing) {
      await db
        .update(paymentProofs)
        .set({
          fileUrl: uploaded.url,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
        })
        .where(eq(paymentProofs.id, existing.id));
    } else {
      await db.insert(paymentProofs).values({
        id: nanoid(),
        orderId,
        fileUrl: uploaded.url,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
      });
    }

    await db
      .update(orders)
      .set({ status: "under_review", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId)));

    const [raffle] = await db
      .select({ slug: raffles.slug })
      .from(raffles)
      .where(eq(raffles.id, order.raffleId))
      .limit(1);

    if (raffle) {
      revalidatePath(`/r/${raffle.slug}`);
      revalidatePath(`/r/${raffle.slug}/orden/${orderId}`);
      revalidatePath(`/r/${raffle.slug}/ticket/${orderId}`);
      revalidatePath("/admin/ordenes");
    }

    // Solo rifas del super admin (org plataforma). Clientes no reciben correo.
    // Esperar el SMTP evita que Vercel cierre la función antes de enviarlo.
    await notifyPlatformOrderProof({
      id: order.id,
      raffleId: order.raffleId,
      participantName: order.participantName,
      participantPhone: order.participantPhone,
      totalAmount: order.totalAmount,
    });

    return NextResponse.json({
      ok: true,
      ticketPath: raffle ? `/r/${raffle.slug}/ticket/${orderId}` : null,
    });
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
