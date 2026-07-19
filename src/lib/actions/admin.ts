"use server";

import bcrypt from "bcryptjs";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ensureSchema, getDb } from "@/db";
import {
  donations,
  drawWinners,
  draws,
  organizations,
  orders,
  paymentMethods,
  paymentProofs,
  raffleCurrencies,
  rafflePrizes,
  raffles,
  tickets,
  users,
} from "@/db/schema";
import { isDemoRaffleSlug, slugify } from "@/lib/format";
import { releaseExpiredReservations } from "@/lib/tickets";
import { deleteStoredFiles } from "@/lib/upload";
import { parseLocalDateTime } from "@/lib/urls";

const RESERVED_DEMO_SLUG = "demo";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.organizationId || !session.user.id) {
    throw new Error("No autorizado");
  }

  await ensureSchema();
  const db = await getDb();
  const [row] = await db
    .select({
      userActive: users.active,
      orgActive: organizations.active,
      role: users.role,
      organizationId: users.organizationId,
    })
    .from(users)
    .innerJoin(organizations, eq(users.organizationId, organizations.id))
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!row?.userActive || !row.orgActive) {
    throw new Error("No autorizado");
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    organizationId: row.organizationId,
    role: row.role,
  };
}

async function requireSuperAdmin() {
  const user = await requireAdmin();
  if (user.role !== "super_admin") {
    throw new Error("No autorizado");
  }
  return user;
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresa tu contraseña actual."),
    newPassword: z
      .string()
      .min(8, "La nueva contraseña debe tener al menos 8 caracteres.")
      .max(100),
    confirmPassword: z.string().min(1, "Confirma la nueva contraseña."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas nuevas no coinciden.",
    path: ["confirmPassword"],
  });

export async function changeOwnPassword(
  raw: z.infer<typeof changePasswordSchema>,
) {
  const user = await requireAdmin();
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message || "Datos inválidos.",
    };
  }

  const db = await getDb();
  const [account] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!account) {
    return { ok: false as const, error: "Cuenta no encontrada." };
  }

  const currentIsValid = await bcrypt.compare(
    parsed.data.currentPassword,
    account.passwordHash,
  );
  if (!currentIsValid) {
    return {
      ok: false as const,
      error: "La contraseña actual es incorrecta.",
    };
  }

  const reusesCurrent = await bcrypt.compare(
    parsed.data.newPassword,
    account.passwordHash,
  );
  if (reusesCurrent) {
    return {
      ok: false as const,
      error: "La nueva contraseña debe ser diferente a la actual.",
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, user.id));

  return { ok: true as const };
}

export async function getAdminDashboard() {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();
  await releaseExpiredReservations();

  const orgRaffles = await db
    .select()
    .from(raffles)
    .where(eq(raffles.organizationId, user.organizationId))
    .orderBy(desc(raffles.createdAt));

  const pendingOrders = await db
    .select({
      order: orders,
      raffleTitle: raffles.title,
      raffleSlug: raffles.slug,
      raffleCurrency: raffles.currency,
    })
    .from(orders)
    .innerJoin(raffles, eq(orders.raffleId, raffles.id))
    .where(
      and(
        eq(raffles.organizationId, user.organizationId),
        eq(orders.status, "under_review"),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(20);

  const [paidCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tickets)
    .innerJoin(raffles, eq(tickets.raffleId, raffles.id))
    .where(
      and(
        eq(raffles.organizationId, user.organizationId),
        eq(tickets.status, "paid"),
      ),
    );

  return {
    raffles: orgRaffles,
    pendingOrders,
    paidTickets: Number(paidCount?.count ?? 0),
  };
}

export async function listAdminOrders(status?: string) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();
  await releaseExpiredReservations();

  const rows = await db
    .select({
      order: orders,
      raffleTitle: raffles.title,
      raffleSlug: raffles.slug,
      raffleCurrency: raffles.currency,
      proofUrl: paymentProofs.fileUrl,
      methodName: paymentMethods.name,
    })
    .from(orders)
    .innerJoin(raffles, eq(orders.raffleId, raffles.id))
    .leftJoin(paymentProofs, eq(paymentProofs.orderId, orders.id))
    .leftJoin(paymentMethods, eq(orders.paymentMethodId, paymentMethods.id))
    .where(
      and(
        eq(raffles.organizationId, user.organizationId),
        status
          ? eq(
              orders.status,
              status as
                | "pending_payment"
                | "under_review"
                | "paid"
                | "rejected"
                | "expired",
            )
          : undefined,
      ),
    )
    .orderBy(desc(orders.createdAt));

  return rows;
}

export async function approveOrder(orderId: string) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();

  const [row] = await db
    .select({ order: orders, raffle: raffles })
    .from(orders)
    .innerJoin(raffles, eq(orders.raffleId, raffles.id))
    .where(
      and(
        eq(orders.id, orderId),
        eq(raffles.organizationId, user.organizationId),
      ),
    )
    .limit(1);

  if (!row) return { ok: false as const, error: "Orden no encontrada." };
  if (row.order.status !== "under_review" && row.order.status !== "pending_payment") {
    return { ok: false as const, error: "Estado no válido para aprobar." };
  }

  const now = new Date();
  await db
    .update(orders)
    .set({ status: "paid", reviewedAt: now, updatedAt: now })
    .where(eq(orders.id, orderId));

  await db
    .update(tickets)
    .set({
      status: "paid",
      reservedUntil: null,
      updatedAt: now,
    })
    .where(eq(tickets.orderId, orderId));

  revalidatePath("/admin");
  revalidatePath("/admin/ordenes");
  revalidatePath(`/r/${row.raffle.slug}`);
  revalidatePath(`/r/${row.raffle.slug}/orden/${orderId}`);
  return { ok: true as const };
}

export async function rejectOrder(orderId: string) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();

  const [row] = await db
    .select({ order: orders, raffle: raffles })
    .from(orders)
    .innerJoin(raffles, eq(orders.raffleId, raffles.id))
    .where(
      and(
        eq(orders.id, orderId),
        eq(raffles.organizationId, user.organizationId),
      ),
    )
    .limit(1);

  if (!row) return { ok: false as const, error: "Orden no encontrada." };
  if (row.order.status !== "under_review" && row.order.status !== "pending_payment") {
    return { ok: false as const, error: "Estado no válido para rechazar." };
  }

  const now = new Date();
  await db
    .update(orders)
    .set({ status: "rejected", reviewedAt: now, updatedAt: now })
    .where(eq(orders.id, orderId));

  await db
    .update(tickets)
    .set({
      status: "available",
      orderId: null,
      reservedUntil: null,
      participantName: null,
      participantPhone: null,
      participantEmail: null,
      updatedAt: now,
    })
    .where(eq(tickets.orderId, orderId));

  revalidatePath("/admin");
  revalidatePath("/admin/ordenes");
  revalidatePath(`/r/${row.raffle.slug}`);
  revalidatePath(`/r/${row.raffle.slug}/orden/${orderId}`);
  return { ok: true as const };
}

export async function releaseExpiredNow() {
  await requireAdmin();
  const count = await releaseExpiredReservations();
  revalidatePath("/admin");
  revalidatePath("/admin/ordenes");
  return { ok: true as const, count };
}

const currencyEntrySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(6)
    .transform((v) => v.toUpperCase()),
  pricePerTicket: z.coerce.number().positive("El precio debe ser mayor a 0."),
});

function dedupeCurrencies<T extends { code: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.code)) return false;
    seen.add(row.code);
    return true;
  });
}

const raffleSchema = z.object({
  title: z.string().min(3).max(120),
  slug: z.string().min(2).max(60).optional(),
  description: z.string().max(2000).optional(),
  prize: z.string().min(2).max(200),
  pricePerTicket: z.coerce.number().positive(),
  currency: z.string().min(2).max(6).default("PEN"),
  currencies: z
    .array(currencyEntrySchema)
    .min(1, "Agrega al menos una moneda.")
    .max(20)
    .optional(),
  totalTickets: z.coerce.number().int().min(10).max(10000),
  reservationMinutes: z.coerce.number().int().min(5).max(1440).default(30),
  winnerCount: z.coerce.number().int().min(1).max(50).default(1),
  drawAt: z.string().min(1, "Elige la fecha del sorteo"),
  status: z.enum(["draft", "active", "closed", "drawn"]).default("active"),
  imageUrl: z.string().optional(),
  prizes: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(200),
        description: z
          .string()
          .trim()
          .max(2000, "La descripción del premio admite máximo 2000 caracteres.")
          .optional(),
        imageUrl: z
          .string()
          .trim()
          .max(2000, "La URL de imagen es demasiado larga.")
          .refine(
            (value) =>
              !value ||
              value.startsWith("http://") ||
              value.startsWith("https://") ||
              value.startsWith("/"),
            "Usa una URL de imagen (http/https) o súbela con “Adjuntar imagen”. No pegues imágenes en base64.",
          )
          .optional(),
      }),
    )
    .min(1, "Agrega al menos un premio.")
    .max(50)
    .optional(),
  donationsEnabled: z.boolean().default(false),
});

export async function createRaffle(raw: z.infer<typeof raffleSchema>) {
  const user = await requireAdmin();
  const parsed = raffleSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "Revisa los datos del formulario.";
    return { ok: false as const, error: msg };
  }

  const drawAt = parseLocalDateTime(parsed.data.drawAt);
  if (!drawAt) {
    return { ok: false as const, error: "Fecha del sorteo inválida." };
  }

  await ensureSchema();
  const db = await getDb();
  const slug = slugify(parsed.data.slug || parsed.data.title) || nanoid(8);
  const raffleId = nanoid();
  const prizeRows = parsed.data.prizes?.length
    ? parsed.data.prizes
    : [
        {
          title: parsed.data.prize,
          description: undefined,
          imageUrl: undefined,
        },
      ];
  const primaryPrize = prizeRows[0]!;

  const currencyRows = dedupeCurrencies(
    parsed.data.currencies?.length
      ? parsed.data.currencies
      : [
          {
            code: parsed.data.currency.toUpperCase(),
            pricePerTicket: parsed.data.pricePerTicket,
          },
        ],
  );
  const primaryCurrency = currencyRows[0]!;

  if (user.role !== "super_admin" && isDemoRaffleSlug(slug)) {
    return {
      ok: false as const,
      error: 'El slug "demo" está reservado para la rifa de la landing.',
    };
  }

  const existing = await db
    .select({ id: raffles.id })
    .from(raffles)
    .where(
      and(
        eq(raffles.organizationId, user.organizationId),
        eq(raffles.slug, slug),
      ),
    )
    .limit(1);
  if (existing.length) {
    return { ok: false as const, error: "Ese slug ya existe." };
  }

  await db.insert(raffles).values({
    id: raffleId,
    organizationId: user.organizationId,
    title: parsed.data.title,
    slug,
    description: parsed.data.description || null,
    prize: primaryPrize.title,
    /** Imagen de identidad (persona, marca o institución), independiente de los premios */
    imageUrl: parsed.data.imageUrl || null,
    pricePerTicket: primaryCurrency.pricePerTicket.toFixed(2),
    currency: primaryCurrency.code,
    totalTickets: parsed.data.totalTickets,
    reservationMinutes: parsed.data.reservationMinutes,
    winnerCount: prizeRows.length,
    drawAt,
    status: parsed.data.status === "drawn" ? "active" : parsed.data.status,
    donationsEnabled: parsed.data.donationsEnabled,
  });

  await db.insert(rafflePrizes).values(
    prizeRows.map((prize, index) => ({
      id: nanoid(),
      raffleId,
      title: prize.title,
      description: prize.description || null,
      imageUrl: prize.imageUrl || null,
      position: index + 1,
    })),
  );

  await db.insert(raffleCurrencies).values(
    currencyRows.map((item, index) => ({
      id: nanoid(),
      raffleId,
      code: item.code,
      pricePerTicket: item.pricePerTicket.toFixed(2),
      position: index + 1,
    })),
  );

  const rows = Array.from({ length: parsed.data.totalTickets }, (_, i) => ({
    id: nanoid(),
    raffleId,
    number: i,
    status: "available" as const,
  }));

  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    await db.insert(tickets).values(rows.slice(i, i + chunk));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/rifas");
  return { ok: true as const, id: raffleId, slug };
}

export async function updateRaffle(
  id: string,
  raw: Partial<z.infer<typeof raffleSchema>>,
) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();

  const [current] = await db
    .select()
    .from(raffles)
    .where(
      and(eq(raffles.id, id), eq(raffles.organizationId, user.organizationId)),
    )
    .limit(1);
  if (!current) return { ok: false as const, error: "Rifa no encontrada." };
  if (current.status === "drawn") {
    return { ok: false as const, error: "No se puede editar una rifa sorteada." };
  }

  const nextSlug = raw.slug ? slugify(raw.slug) : current.slug;

  if (
    user.role !== "super_admin" &&
    isDemoRaffleSlug(nextSlug) &&
    !isDemoRaffleSlug(current.slug)
  ) {
    return {
      ok: false as const,
      error: 'El slug "demo" está reservado para la rifa de la landing.',
    };
  }

  const nextDrawAt =
    raw.drawAt !== undefined
      ? parseLocalDateTime(raw.drawAt)
      : current.drawAt;

  if (raw.drawAt !== undefined && !nextDrawAt) {
    return { ok: false as const, error: "Fecha del sorteo inválida." };
  }

  const nextPrizes = raw.prizes?.length ? raw.prizes : undefined;
  const primaryPrize = nextPrizes?.[0];

  const nextCurrencies = raw.currencies?.length
    ? dedupeCurrencies(
        raw.currencies.map((item) => ({
          code: item.code.toUpperCase(),
          pricePerTicket: Number(item.pricePerTicket),
        })),
      )
    : undefined;
  if (nextCurrencies?.some((c) => !c.pricePerTicket || c.pricePerTicket <= 0)) {
    return {
      ok: false as const,
      error: "Cada moneda debe tener un precio mayor a 0.",
    };
  }
  const primaryCurrency = nextCurrencies?.[0];

  await db
    .update(raffles)
    .set({
      title: raw.title ?? current.title,
      slug: nextSlug,
      description:
        raw.description !== undefined ? raw.description || null : current.description,
      prize: primaryPrize?.title ?? raw.prize ?? current.prize,
      imageUrl:
        raw.imageUrl !== undefined ? raw.imageUrl || null : current.imageUrl,
      pricePerTicket: primaryCurrency
        ? primaryCurrency.pricePerTicket.toFixed(2)
        : raw.pricePerTicket !== undefined
          ? Number(raw.pricePerTicket).toFixed(2)
          : current.pricePerTicket,
      currency: primaryCurrency?.code ?? raw.currency ?? current.currency,
      reservationMinutes:
        raw.reservationMinutes ?? current.reservationMinutes,
      winnerCount: nextPrizes?.length ?? raw.winnerCount ?? current.winnerCount,
      drawAt: nextDrawAt,
      status: (raw.status as typeof current.status) ?? current.status,
      donationsEnabled:
        raw.donationsEnabled !== undefined
          ? raw.donationsEnabled
          : current.donationsEnabled,
      updatedAt: new Date(),
    })
    .where(eq(raffles.id, id));

  if (nextPrizes) {
    await db.delete(rafflePrizes).where(eq(rafflePrizes.raffleId, id));
    await db.insert(rafflePrizes).values(
      nextPrizes.map((prize, index) => ({
        id: nanoid(),
        raffleId: id,
        title: prize.title,
        description: prize.description || null,
        imageUrl: prize.imageUrl || null,
        position: index + 1,
      })),
    );
  }

  if (nextCurrencies) {
    await db.delete(raffleCurrencies).where(eq(raffleCurrencies.raffleId, id));
    await db.insert(raffleCurrencies).values(
      nextCurrencies.map((item, index) => ({
        id: nanoid(),
        raffleId: id,
        code: item.code,
        pricePerTicket: item.pricePerTicket.toFixed(2),
        position: index + 1,
      })),
    );
  }

  revalidatePath("/admin/rifas");
  revalidatePath(`/r/${nextSlug}`);
  return { ok: true as const };
}

export async function listAdminDonations(status?: string) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();

  return db
    .select({
      donation: donations,
      raffleTitle: raffles.title,
      raffleSlug: raffles.slug,
      raffleCurrency: raffles.currency,
      methodName: paymentMethods.name,
    })
    .from(donations)
    .innerJoin(raffles, eq(donations.raffleId, raffles.id))
    .leftJoin(
      paymentMethods,
      eq(donations.paymentMethodId, paymentMethods.id),
    )
    .where(
      and(
        eq(raffles.organizationId, user.organizationId),
        status
          ? eq(
              donations.status,
              status as
                | "pending_payment"
                | "under_review"
                | "confirmed"
                | "rejected",
            )
          : undefined,
      ),
    )
    .orderBy(desc(donations.createdAt));
}

export async function confirmDonation(donationId: string) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();

  const [row] = await db
    .select({ donation: donations, raffle: raffles })
    .from(donations)
    .innerJoin(raffles, eq(donations.raffleId, raffles.id))
    .where(
      and(
        eq(donations.id, donationId),
        eq(raffles.organizationId, user.organizationId),
      ),
    )
    .limit(1);

  if (!row) return { ok: false as const, error: "Donación no encontrada." };
  if (
    row.donation.status !== "under_review" &&
    row.donation.status !== "pending_payment"
  ) {
    return { ok: false as const, error: "Estado no válido para confirmar." };
  }

  const now = new Date();
  await db
    .update(donations)
    .set({ status: "confirmed", reviewedAt: now, updatedAt: now })
    .where(eq(donations.id, donationId));

  revalidatePath("/admin/donaciones");
  revalidatePath(`/r/${row.raffle.slug}/donacion/${donationId}`);
  return { ok: true as const };
}

export async function rejectDonation(donationId: string) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();

  const [row] = await db
    .select({ donation: donations, raffle: raffles })
    .from(donations)
    .innerJoin(raffles, eq(donations.raffleId, raffles.id))
    .where(
      and(
        eq(donations.id, donationId),
        eq(raffles.organizationId, user.organizationId),
      ),
    )
    .limit(1);

  if (!row) return { ok: false as const, error: "Donación no encontrada." };

  const now = new Date();
  await db
    .update(donations)
    .set({ status: "rejected", reviewedAt: now, updatedAt: now })
    .where(eq(donations.id, donationId));

  revalidatePath("/admin/donaciones");
  revalidatePath(`/r/${row.raffle.slug}/donacion/${donationId}`);
  return { ok: true as const };
}

export async function listPaymentMethods() {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();
  return db
    .select({
      method: paymentMethods,
      raffleTitle: raffles.title,
      raffleSlug: raffles.slug,
    })
    .from(paymentMethods)
    .leftJoin(raffles, eq(paymentMethods.raffleId, raffles.id))
    .where(eq(paymentMethods.organizationId, user.organizationId))
    .orderBy(asc(paymentMethods.sortOrder));
}

export async function listRafflesForSelect() {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();
  return db
    .select({
      id: raffles.id,
      title: raffles.title,
      slug: raffles.slug,
      status: raffles.status,
    })
    .from(raffles)
    .where(eq(raffles.organizationId, user.organizationId))
    .orderBy(desc(raffles.createdAt));
}

const methodSchema = z.object({
  name: z.string().min(2).max(80),
  instructions: z.string().min(5).max(1000),
  raffleId: z.string().min(1, "Elige la rifa"),
  accountInfo: z.string().max(300).optional(),
  accountHolder: z.string().max(120).optional(),
  qrImageUrl: z.string().optional(),
  /** Moneda que acepta el método; "" o undefined = todas las monedas */
  currency: z.string().trim().max(6).optional(),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  documentId: z.string().trim().max(40).optional().or(z.literal("")),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export async function createPaymentMethod(raw: z.infer<typeof methodSchema>) {
  const user = await requireAdmin();
  const parsed = methodSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message || "Datos inválidos.",
    };
  }
  await ensureSchema();
  const db = await getDb();

  const [raffle] = await db
    .select({ id: raffles.id })
    .from(raffles)
    .where(
      and(
        eq(raffles.id, parsed.data.raffleId),
        eq(raffles.organizationId, user.organizationId),
      ),
    )
    .limit(1);
  if (!raffle) {
    return { ok: false as const, error: "Rifa no válida." };
  }

  const id = nanoid();
  await db.insert(paymentMethods).values({
    id,
    organizationId: user.organizationId,
    raffleId: parsed.data.raffleId,
    name: parsed.data.name,
    instructions: parsed.data.instructions,
    accountInfo: parsed.data.accountInfo || null,
    accountHolder: parsed.data.accountHolder || null,
    qrImageUrl: parsed.data.qrImageUrl || null,
    currency: parsed.data.currency?.toUpperCase() || null,
    contactEmail: parsed.data.contactEmail || null,
    documentId: parsed.data.documentId || null,
    active: parsed.data.active,
    sortOrder: parsed.data.sortOrder,
  });
  revalidatePath("/admin/metodos-pago");
  revalidatePath("/r", "layout");
  return { ok: true as const, id };
}

export async function updatePaymentMethod(
  id: string,
  raw: Partial<z.infer<typeof methodSchema>>,
) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();
  const [current] = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, id),
        eq(paymentMethods.organizationId, user.organizationId),
      ),
    )
    .limit(1);
  if (!current) return { ok: false as const, error: "No encontrado." };

  let nextRaffleId = current.raffleId;
  if (raw.raffleId !== undefined) {
    const [raffle] = await db
      .select({ id: raffles.id })
      .from(raffles)
      .where(
        and(
          eq(raffles.id, raw.raffleId),
          eq(raffles.organizationId, user.organizationId),
        ),
      )
      .limit(1);
    if (!raffle) {
      return { ok: false as const, error: "Rifa no válida." };
    }
    nextRaffleId = raw.raffleId;
  }

  await db
    .update(paymentMethods)
    .set({
      name: raw.name ?? current.name,
      instructions: raw.instructions ?? current.instructions,
      raffleId: nextRaffleId,
      accountInfo:
        raw.accountInfo !== undefined
          ? raw.accountInfo || null
          : current.accountInfo,
      accountHolder:
        raw.accountHolder !== undefined
          ? raw.accountHolder || null
          : current.accountHolder,
      qrImageUrl:
        raw.qrImageUrl !== undefined
          ? raw.qrImageUrl || null
          : current.qrImageUrl,
      currency:
        raw.currency !== undefined
          ? raw.currency?.toUpperCase() || null
          : current.currency,
      contactEmail:
        raw.contactEmail !== undefined
          ? raw.contactEmail || null
          : current.contactEmail,
      documentId:
        raw.documentId !== undefined
          ? raw.documentId || null
          : current.documentId,
      active: raw.active ?? current.active,
      sortOrder: raw.sortOrder ?? current.sortOrder,
    })
    .where(eq(paymentMethods.id, id));

  revalidatePath("/admin/metodos-pago");
  revalidatePath("/r", "layout");
  return { ok: true as const };
}

export async function duplicatePaymentMethod(
  id: string,
  targetRaffleId: string,
) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();

  const [current] = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, id),
        eq(paymentMethods.organizationId, user.organizationId),
      ),
    )
    .limit(1);
  if (!current) {
    return { ok: false as const, error: "Método no encontrado." };
  }

  const [raffle] = await db
    .select({ id: raffles.id, title: raffles.title })
    .from(raffles)
    .where(
      and(
        eq(raffles.id, targetRaffleId),
        eq(raffles.organizationId, user.organizationId),
      ),
    )
    .limit(1);
  if (!raffle) {
    return { ok: false as const, error: "Rifa de destino no válida." };
  }

  const newId = nanoid();
  await db.insert(paymentMethods).values({
    id: newId,
    organizationId: user.organizationId,
    raffleId: raffle.id,
    name: current.name,
    instructions: current.instructions,
    accountInfo: current.accountInfo,
    accountHolder: current.accountHolder,
    qrImageUrl: current.qrImageUrl,
    currency: current.currency,
    contactEmail: current.contactEmail,
    documentId: current.documentId,
    active: current.active,
    sortOrder: current.sortOrder,
  });

  revalidatePath("/admin/metodos-pago");
  revalidatePath("/r", "layout");
  return { ok: true as const, id: newId, raffleTitle: raffle.title };
}

export async function deletePaymentMethod(id: string) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();
  await db
    .delete(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, id),
        eq(paymentMethods.organizationId, user.organizationId),
      ),
    );
  revalidatePath("/admin/metodos-pago");
  return { ok: true as const };
}

export async function getRaffleForAdmin(id: string) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();
  const [raffle] = await db
    .select()
    .from(raffles)
    .where(
      and(eq(raffles.id, id), eq(raffles.organizationId, user.organizationId)),
    )
    .limit(1);
  return raffle ?? null;
}

export async function getRafflePrizesForAdmin(raffleId: string) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();

  const [raffle] = await db
    .select({ id: raffles.id })
    .from(raffles)
    .where(
      and(
        eq(raffles.id, raffleId),
        eq(raffles.organizationId, user.organizationId),
      ),
    )
    .limit(1);
  if (!raffle) return [];

  return db
    .select()
    .from(rafflePrizes)
    .where(eq(rafflePrizes.raffleId, raffleId))
    .orderBy(asc(rafflePrizes.position));
}

export async function getRaffleCurrenciesForAdmin(raffleId: string) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();

  const [raffle] = await db
    .select({ id: raffles.id })
    .from(raffles)
    .where(
      and(
        eq(raffles.id, raffleId),
        eq(raffles.organizationId, user.organizationId),
      ),
    )
    .limit(1);
  if (!raffle) return [];

  return db
    .select()
    .from(raffleCurrencies)
    .where(eq(raffleCurrencies.raffleId, raffleId))
    .orderBy(asc(raffleCurrencies.position));
}

export async function listRaffles() {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();
  return db
    .select()
    .from(raffles)
    .where(eq(raffles.organizationId, user.organizationId))
    .orderBy(desc(raffles.createdAt));
}

export async function deleteRaffle(id: string) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();

  const [current] = await db
    .select({
      id: raffles.id,
      slug: raffles.slug,
      imageUrl: raffles.imageUrl,
    })
    .from(raffles)
    .where(
      and(eq(raffles.id, id), eq(raffles.organizationId, user.organizationId)),
    )
    .limit(1);

  if (!current) {
    return { ok: false as const, error: "Rifa no encontrada." };
  }

  // Recolectar archivos de la rifa ANTES de borrar filas (cascada elimina proofs).
  // No incluimos QR de métodos de pago: los métodos se conservan para otras rifas.
  const [prizeRows, orderProofRows, donationRows] = await Promise.all([
    db
      .select({ imageUrl: rafflePrizes.imageUrl })
      .from(rafflePrizes)
      .where(eq(rafflePrizes.raffleId, id)),
    db
      .select({ fileUrl: paymentProofs.fileUrl })
      .from(paymentProofs)
      .innerJoin(orders, eq(paymentProofs.orderId, orders.id))
      .where(eq(orders.raffleId, id)),
    db
      .select({ proofUrl: donations.proofUrl })
      .from(donations)
      .where(eq(donations.raffleId, id)),
  ]);

  const filesToDelete = [
    current.imageUrl,
    ...prizeRows.map((row) => row.imageUrl),
    ...orderProofRows.map((row) => row.fileUrl),
    ...donationRows.map((row) => row.proofUrl),
  ];

  // Desasignar métodos (no borrarlos) para poder reutilizarlos en otra rifa
  await db
    .update(paymentMethods)
    .set({ raffleId: null })
    .where(eq(paymentMethods.raffleId, id));

  await db.delete(raffles).where(eq(raffles.id, id));
  await deleteStoredFiles(filesToDelete);

  revalidatePath("/admin");
  revalidatePath("/admin/rifas");
  revalidatePath("/admin/ordenes");
  revalidatePath("/admin/donaciones");
  revalidatePath("/admin/metodos-pago");
  revalidatePath(`/r/${current.slug}`);
  revalidatePath("/");
  return { ok: true as const };
}

/**
 * Archiva la demo actual (si existe) y crea una nueva `/r/demo` vacía.
 * Solo super_admin (org plataforma).
 */
export async function createFreshDemoRaffle() {
  const user = await requireSuperAdmin();
  await ensureSchema();
  const db = await getDb();

  const [currentDemo] = await db
    .select()
    .from(raffles)
    .where(
      and(
        eq(raffles.organizationId, user.organizationId),
        eq(raffles.slug, RESERVED_DEMO_SLUG),
      ),
    )
    .limit(1);

  const currentPrizes = currentDemo
    ? await db
        .select()
        .from(rafflePrizes)
        .where(eq(rafflePrizes.raffleId, currentDemo.id))
        .orderBy(asc(rafflePrizes.position))
    : [];

  const currentCurrencies = currentDemo
    ? await db
        .select()
        .from(raffleCurrencies)
        .where(eq(raffleCurrencies.raffleId, currentDemo.id))
        .orderBy(asc(raffleCurrencies.position))
    : [];

  if (currentDemo) {
    const archiveSlug = `demo-archivo-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${nanoid(4)}`;
    await db
      .update(raffles)
      .set({
        slug: archiveSlug,
        status: "closed",
        updatedAt: new Date(),
      })
      .where(eq(raffles.id, currentDemo.id));
  }

  const raffleId = nanoid();
  const drawAt = new Date();
  drawAt.setMonth(drawAt.getMonth() + 1);

  const title = "Rifa de demostración";
  const totalTickets = currentDemo?.totalTickets ?? 100;
  const pricePerTicket = currentDemo?.pricePerTicket ?? "10.00";
  const currency = currentDemo?.currency ?? "PEN";
  const prize = currentDemo?.prize ?? "Premio de demostración";
  const description =
    currentDemo?.description ??
    "Plantilla de demostración. Prueba apartando números y subiendo un comprobante.";

  await db.insert(raffles).values({
    id: raffleId,
    organizationId: user.organizationId,
    title,
    slug: RESERVED_DEMO_SLUG,
    description,
    prize,
    imageUrl: currentDemo?.imageUrl ?? null,
    pricePerTicket,
    currency,
    totalTickets,
    reservationMinutes: currentDemo?.reservationMinutes ?? 30,
    winnerCount: currentDemo?.winnerCount ?? 1,
    drawAt,
    status: "active",
    donationsEnabled: currentDemo?.donationsEnabled ?? false,
  });

  const demoPrizes =
    currentPrizes.length > 0
      ? currentPrizes
      : [
          {
            title: prize,
            description: null,
            imageUrl: currentDemo?.imageUrl ?? null,
          },
        ];
  await db.insert(rafflePrizes).values(
    demoPrizes.map((item, index) => ({
      id: nanoid(),
      raffleId,
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      position: index + 1,
    })),
  );

  const demoCurrencies =
    currentCurrencies.length > 0
      ? currentCurrencies
      : [{ code: currency, pricePerTicket }];
  await db.insert(raffleCurrencies).values(
    demoCurrencies.map((item, index) => ({
      id: nanoid(),
      raffleId,
      code: item.code,
      pricePerTicket: item.pricePerTicket,
      position: index + 1,
    })),
  );

  const ticketRows = Array.from({ length: totalTickets }, (_, i) => ({
    id: nanoid(),
    raffleId,
    number: i,
    status: "available" as const,
  }));
  const chunk = 200;
  for (let i = 0; i < ticketRows.length; i += chunk) {
    await db.insert(tickets).values(ticketRows.slice(i, i + chunk));
  }

  if (currentDemo) {
    const methods = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.raffleId, currentDemo.id));

    if (methods.length > 0) {
      await db.insert(paymentMethods).values(
        methods.map((m, i) => ({
          id: nanoid(),
          organizationId: user.organizationId,
          raffleId,
          name: m.name,
          instructions: m.instructions,
          accountInfo: m.accountInfo,
          accountHolder: m.accountHolder,
          qrImageUrl: m.qrImageUrl,
          currency: m.currency,
          contactEmail: m.contactEmail,
          documentId: m.documentId,
          active: m.active,
          sortOrder: m.sortOrder ?? i + 1,
        })),
      );
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/rifas");
  revalidatePath("/admin/metodos-pago");
  revalidatePath("/r/demo");
  revalidatePath("/");
  return { ok: true as const, id: raffleId, slug: RESERVED_DEMO_SLUG };
}

function secureShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    const j = rand[0]! % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export async function runDraw(
  raffleId: string,
  options?: { forceEarly?: boolean },
) {
  const user = await requireAdmin();
  await ensureSchema();
  const db = await getDb();

  const [raffle] = await db
    .select()
    .from(raffles)
    .where(
      and(
        eq(raffles.id, raffleId),
        eq(raffles.organizationId, user.organizationId),
      ),
    )
    .limit(1);

  if (!raffle) return { ok: false as const, error: "Rifa no encontrada." };
  if (raffle.status === "drawn") {
    return { ok: false as const, error: "Esta rifa ya fue sorteada." };
  }

  if (raffle.drawAt && new Date() < new Date(raffle.drawAt) && !options?.forceEarly) {
    return {
      ok: false as const,
      error:
        "Aún no llega la fecha y hora programadas del sorteo. Si quieres adelantarlo, confirma “sortear antes de la fecha”.",
    };
  }

  const paid = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.raffleId, raffleId), eq(tickets.status, "paid")));

  if (paid.length === 0) {
    return {
      ok: false as const,
      error: "No hay boletos pagados para sortear.",
    };
  }

  const winnerCount = Math.min(raffle.winnerCount, paid.length);
  const seedBytes = new Uint8Array(32);
  crypto.getRandomValues(seedBytes);
  const seed = Array.from(seedBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const shuffled = secureShuffle(paid);
  const winners = shuffled.slice(0, winnerCount);
  const drawId = nanoid();
  const earlyNote =
    raffle.drawAt && new Date() < new Date(raffle.drawAt) && options?.forceEarly
      ? " Adelantado antes de la fecha programada."
      : "";

  await db.insert(draws).values({
    id: drawId,
    raffleId,
    seed,
    paidTicketCount: paid.length,
    notes: `Sorteo con ${winnerCount} ganador(es) de ${paid.length} boletos pagados.${earlyNote}`,
  });

  await db.insert(drawWinners).values(
    winners.map((t, i) => ({
      id: nanoid(),
      drawId,
      ticketId: t.id,
      ticketNumber: t.number,
      prizePosition: i + 1,
      participantName: t.participantName,
      participantPhone: t.participantPhone,
    })),
  );

  await db
    .update(raffles)
    .set({ status: "drawn", updatedAt: new Date() })
    .where(eq(raffles.id, raffleId));

  revalidatePath(`/admin/rifas/${raffleId}`);
  revalidatePath(`/r/${raffle.slug}`);
  revalidatePath(`/r/${raffle.slug}/sorteo`);
  return {
    ok: true as const,
    drawId,
    winners: winners.map((t, i) => ({
      number: t.number,
      position: i + 1,
      name: t.participantName,
    })),
  };
}

export async function getDrawByRaffleSlug(slug: string) {
  await ensureSchema();
  const db = await getDb();
  const [raffle] = await db
    .select()
    .from(raffles)
    .where(eq(raffles.slug, slug))
    .limit(1);
  if (!raffle) return null;

  const [draw] = await db
    .select()
    .from(draws)
    .where(eq(draws.raffleId, raffle.id))
    .limit(1);
  if (!draw) return { raffle, draw: null, winners: [] };

  const winners = await db
    .select({
      id: drawWinners.id,
      drawId: drawWinners.drawId,
      ticketId: drawWinners.ticketId,
      ticketNumber: drawWinners.ticketNumber,
      prizePosition: drawWinners.prizePosition,
      participantName: drawWinners.participantName,
      participantPhone: drawWinners.participantPhone,
      prizeTitle: rafflePrizes.title,
      prizeDescription: rafflePrizes.description,
      prizeImageUrl: rafflePrizes.imageUrl,
    })
    .from(drawWinners)
    .leftJoin(
      rafflePrizes,
      and(
        eq(rafflePrizes.raffleId, raffle.id),
        eq(rafflePrizes.position, drawWinners.prizePosition),
      ),
    )
    .where(eq(drawWinners.drawId, draw.id))
    .orderBy(asc(drawWinners.prizePosition));

  return { raffle, draw, winners };
}

export async function getOrderTickets(orderId: string) {
  await ensureSchema();
  const db = await getDb();
  return db
    .select({ number: tickets.number })
    .from(tickets)
    .where(eq(tickets.orderId, orderId))
    .orderBy(asc(tickets.number));
}

/* ——— Gestión de clientes (solo super_admin) ——— */

export async function listClients() {
  await requireSuperAdmin();
  await ensureSchema();
  const db = await getDb();

  return db
    .select({
      userId: users.id,
      email: users.email,
      contactName: users.name,
      userActive: users.active,
      createdAt: users.createdAt,
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      orgActive: organizations.active,
    })
    .from(users)
    .innerJoin(organizations, eq(users.organizationId, organizations.id))
    .where(
      and(eq(users.role, "client"), eq(organizations.isPlatform, false)),
    )
    .orderBy(desc(users.createdAt));
}

const createClientSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
});

export async function createClient(raw: z.infer<typeof createClientSchema>) {
  await requireSuperAdmin();
  const parsed = createClientSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message || "Datos inválidos.",
    };
  }

  await ensureSchema();
  const db = await getDb();
  const email = parsed.data.email.toLowerCase();

  const [emailTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (emailTaken) {
    return { ok: false as const, error: "Ese email ya está registrado." };
  }

  let orgSlug = slugify(parsed.data.organizationName) || nanoid(8);
  if (orgSlug === "rifacil" || orgSlug === RESERVED_DEMO_SLUG) {
    orgSlug = `${orgSlug}-${nanoid(4)}`;
  }

  const [slugTaken] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);
  if (slugTaken) {
    orgSlug = `${orgSlug}-${nanoid(4)}`;
  }

  const orgId = nanoid();
  const userId = nanoid();
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await db.insert(organizations).values({
    id: orgId,
    name: parsed.data.organizationName,
    slug: orgSlug,
    isPlatform: false,
    active: true,
  });

  await db.insert(users).values({
    id: userId,
    organizationId: orgId,
    email,
    name: parsed.data.contactName,
    passwordHash,
    role: "client",
    active: true,
  });

  revalidatePath("/admin/clientes");
  return { ok: true as const, userId, organizationId: orgId };
}

const updateClientSchema = z.object({
  organizationName: z.string().trim().min(2).max(120).optional(),
  contactName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(6).max(100).optional(),
  active: z.boolean().optional(),
});

export async function updateClient(
  userId: string,
  raw: z.infer<typeof updateClientSchema>,
) {
  await requireSuperAdmin();
  const parsed = updateClientSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message || "Datos inválidos.",
    };
  }

  await ensureSchema();
  const db = await getDb();

  const [row] = await db
    .select({
      user: users,
      org: organizations,
    })
    .from(users)
    .innerJoin(organizations, eq(users.organizationId, organizations.id))
    .where(and(eq(users.id, userId), eq(users.role, "client")))
    .limit(1);

  if (!row || row.org.isPlatform) {
    return { ok: false as const, error: "Cliente no encontrado." };
  }

  if (parsed.data.email) {
    const email = parsed.data.email.toLowerCase();
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, userId)))
      .limit(1);
    if (taken) {
      return { ok: false as const, error: "Ese email ya está registrado." };
    }
  }

  const userPatch: Partial<typeof users.$inferInsert> = {};
  if (parsed.data.contactName !== undefined) {
    userPatch.name = parsed.data.contactName;
  }
  if (parsed.data.email !== undefined) {
    userPatch.email = parsed.data.email.toLowerCase();
  }
  if (parsed.data.password) {
    userPatch.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }
  if (parsed.data.active !== undefined) {
    userPatch.active = parsed.data.active;
  }

  if (Object.keys(userPatch).length > 0) {
    await db.update(users).set(userPatch).where(eq(users.id, userId));
  }

  const orgPatch: Partial<typeof organizations.$inferInsert> = {};
  if (parsed.data.organizationName !== undefined) {
    orgPatch.name = parsed.data.organizationName;
  }
  if (parsed.data.active !== undefined) {
    orgPatch.active = parsed.data.active;
  }

  if (Object.keys(orgPatch).length > 0) {
    await db
      .update(organizations)
      .set(orgPatch)
      .where(eq(organizations.id, row.org.id));
  }

  revalidatePath("/admin/clientes");
  return { ok: true as const };
}

export async function setClientActive(userId: string, active: boolean) {
  return updateClient(userId, { active });
}
