"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { ensureSchema, getDb } from "@/db";
import {
  donations,
  organizations,
  orders,
  paymentMethods,
  paymentProofs,
  raffles,
  tickets,
} from "@/db/schema";
import { notifyPlatformOrderProof } from "@/lib/notify-platform";
import { releaseExpiredReservations } from "@/lib/tickets";
import { uploadProofFile } from "@/lib/upload";

const reserveSchema = z.object({
  raffleId: z.string().min(1),
  numbers: z.array(z.number().int().min(0)).min(1).max(50),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email().optional().or(z.literal("")),
  paymentMethodId: z.string().min(1),
});

export async function getRaffleBySlug(slug: string) {
  await ensureSchema();
  const db = await getDb();
  await releaseExpiredReservations();

  const [raffle] = await db
    .select()
    .from(raffles)
    .where(eq(raffles.slug, slug))
    .limit(1);

  if (!raffle) return null;

  const ticketRows = await db
    .select({
      id: tickets.id,
      number: tickets.number,
      status: tickets.status,
    })
    .from(tickets)
    .where(eq(tickets.raffleId, raffle.id))
    .orderBy(asc(tickets.number));

  const methods = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.raffleId, raffle.id),
        eq(paymentMethods.active, true),
      ),
    )
    .orderBy(asc(paymentMethods.sortOrder));

  return { raffle, tickets: ticketRows, paymentMethods: methods };
}

export async function createReservation(input: {
  raffleId: string;
  numbers: number[];
  name: string;
  phone: string;
  email?: string;
  paymentMethodId: string;
}) {
  const parsed = reserveSchema.safeParse({
    ...input,
    email: input.email || "",
  });
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos." };
  }

  await ensureSchema();
  const db = await getDb();
  await releaseExpiredReservations(parsed.data.raffleId);

  const [raffle] = await db
    .select()
    .from(raffles)
    .where(eq(raffles.id, parsed.data.raffleId))
    .limit(1);

  if (!raffle || raffle.status !== "active") {
    return { ok: false as const, error: "La rifa no está disponible." };
  }

  const uniqueNumbers = [...new Set(parsed.data.numbers)].sort((a, b) => a - b);
  if (uniqueNumbers.some((n) => n < 0 || n >= raffle.totalTickets)) {
    return { ok: false as const, error: "Números fuera de rango." };
  }

  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, parsed.data.paymentMethodId),
        eq(paymentMethods.raffleId, raffle.id),
        eq(paymentMethods.active, true),
      ),
    )
    .limit(1);

  if (!method) {
    return { ok: false as const, error: "Método de pago inválido." };
  }

  const reservedUntil = new Date(
    Date.now() + raffle.reservationMinutes * 60 * 1000,
  );
  const total =
    Number(raffle.pricePerTicket) * uniqueNumbers.length;

  const orderId = nanoid();

  // Atomic-ish reservation: update only if all still available
  const available = await db
    .select({ id: tickets.id, number: tickets.number })
    .from(tickets)
    .where(
      and(
        eq(tickets.raffleId, raffle.id),
        inArray(tickets.number, uniqueNumbers),
        eq(tickets.status, "available"),
      ),
    );

  if (available.length !== uniqueNumbers.length) {
    return {
      ok: false as const,
      error: "Algunos números ya no están disponibles. Elige otros.",
    };
  }

  await db.insert(orders).values({
    id: orderId,
    raffleId: raffle.id,
    paymentMethodId: method.id,
    status: "pending_payment",
    totalAmount: total.toFixed(2),
    ticketCount: uniqueNumbers.length,
    participantName: parsed.data.name,
    participantPhone: parsed.data.phone,
    participantEmail: parsed.data.email || null,
    reservedUntil,
  });

  await db
    .update(tickets)
    .set({
      status: "reserved",
      orderId,
      reservedUntil,
      participantName: parsed.data.name,
      participantPhone: parsed.data.phone,
      participantEmail: parsed.data.email || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tickets.raffleId, raffle.id),
        inArray(tickets.number, uniqueNumbers),
        eq(tickets.status, "available"),
      ),
    );

  const updated = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(and(eq(tickets.orderId, orderId), eq(tickets.status, "reserved")));

  if (updated.length !== uniqueNumbers.length) {
    await db.delete(orders).where(eq(orders.id, orderId));
    await db
      .update(tickets)
      .set({
        status: "available",
        orderId: null,
        reservedUntil: null,
        participantName: null,
        participantPhone: null,
        participantEmail: null,
        updatedAt: new Date(),
      })
      .where(eq(tickets.orderId, orderId));
    return {
      ok: false as const,
      error: "Los números se ocuparon al mismo tiempo. Intenta de nuevo.",
    };
  }

  revalidatePath(`/r/${raffle.slug}`);
  return {
    ok: true as const,
    orderId,
    reservedUntil: reservedUntil.toISOString(),
  };
}

export async function submitPaymentProof(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  const file = formData.get("proof");

  if (!orderId || !(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Adjunta el comprobante de pago." };
  }

  await ensureSchema();
  const db = await getDb();

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { ok: false as const, error: "Orden no encontrada." };
  }
  if (order.status !== "pending_payment" && order.status !== "rejected") {
    return { ok: false as const, error: "Esta orden ya no admite comprobante." };
  }
  if (order.reservedUntil && order.reservedUntil < new Date()) {
    await releaseExpiredReservations(order.raffleId);
    return { ok: false as const, error: "La reserva expiró. Elige números de nuevo." };
  }

  try {
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
      .where(eq(orders.id, orderId));

    const [raffle] = await db
      .select({ slug: raffles.slug })
      .from(raffles)
      .where(eq(raffles.id, order.raffleId))
      .limit(1);

    if (raffle) {
      revalidatePath(`/r/${raffle.slug}`);
      revalidatePath(`/r/${raffle.slug}/orden/${orderId}`);
      revalidatePath("/admin/ordenes");
    }

    await notifyPlatformOrderProof({
      id: order.id,
      raffleId: order.raffleId,
      participantName: order.participantName,
      participantPhone: order.participantPhone,
      totalAmount: order.totalAmount,
    });

    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "No se pudo subir el archivo.",
    };
  }
}

export async function getOrderPublic(orderId: string) {
  await ensureSchema();
  const db = await getDb();
  await releaseExpiredReservations();

  const [row] = await db
    .select({
      order: orders,
      raffle: raffles,
      paymentMethod: paymentMethods,
      proof: paymentProofs,
    })
    .from(orders)
    .innerJoin(raffles, eq(orders.raffleId, raffles.id))
    .leftJoin(
      paymentMethods,
      eq(orders.paymentMethodId, paymentMethods.id),
    )
    .leftJoin(paymentProofs, eq(paymentProofs.orderId, orders.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) return null;

  const orderTickets = await db
    .select({ number: tickets.number, status: tickets.status })
    .from(tickets)
    .where(eq(tickets.orderId, orderId))
    .orderBy(asc(tickets.number));

  return { ...row, tickets: orderTickets };
}

export async function getActiveDemoSlug() {
  try {
    await ensureSchema();
    const db = await getDb();
    const [row] = await db
      .select({ slug: raffles.slug })
      .from(raffles)
      .innerJoin(organizations, eq(raffles.organizationId, organizations.id))
      .where(
        and(
          eq(organizations.isPlatform, true),
          eq(raffles.slug, "demo"),
          eq(raffles.status, "active"),
        ),
      )
      .limit(1);
    return row?.slug ?? "demo";
  } catch {
    return "demo";
  }
}

const donationSchema = z.object({
  raffleId: z.string().min(1),
  amount: z.coerce.number().positive(),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email().optional().or(z.literal("")),
  paymentMethodId: z.string().min(1),
});

export async function createDonation(input: {
  raffleId: string;
  amount: number;
  name: string;
  phone: string;
  email?: string;
  paymentMethodId: string;
}) {
  const parsed = donationSchema.safeParse({
    ...input,
    email: input.email || "",
  });
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos." };
  }

  await ensureSchema();
  const db = await getDb();

  const [raffle] = await db
    .select()
    .from(raffles)
    .where(eq(raffles.id, parsed.data.raffleId))
    .limit(1);

  if (!raffle || !raffle.donationsEnabled) {
    return {
      ok: false as const,
      error: "Esta rifa no acepta donaciones.",
    };
  }

  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, parsed.data.paymentMethodId),
        eq(paymentMethods.raffleId, raffle.id),
        eq(paymentMethods.active, true),
      ),
    )
    .limit(1);

  if (!method) {
    return { ok: false as const, error: "Método de pago inválido." };
  }

  const donationId = nanoid();
  await db.insert(donations).values({
    id: donationId,
    raffleId: raffle.id,
    paymentMethodId: method.id,
    status: "pending_payment",
    amount: parsed.data.amount.toFixed(2),
    donorName: parsed.data.name,
    donorPhone: parsed.data.phone,
    donorEmail: parsed.data.email || null,
  });

  revalidatePath(`/r/${raffle.slug}`);
  revalidatePath("/admin/donaciones");
  return { ok: true as const, donationId, slug: raffle.slug };
}

export async function getDonationPublic(donationId: string) {
  await ensureSchema();
  const db = await getDb();

  const [row] = await db
    .select({
      donation: donations,
      raffle: raffles,
      paymentMethod: paymentMethods,
    })
    .from(donations)
    .innerJoin(raffles, eq(donations.raffleId, raffles.id))
    .leftJoin(
      paymentMethods,
      eq(donations.paymentMethodId, paymentMethods.id),
    )
    .where(eq(donations.id, donationId))
    .limit(1);

  return row ?? null;
}
