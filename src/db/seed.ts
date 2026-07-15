import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ensureSchema, getDb } from "./index";
import {
  organizations,
  paymentMethods,
  raffles,
  tickets,
  users,
} from "./schema";

async function seed() {
  await ensureSchema();
  const db = await getDb();

  const existing = await db.select().from(organizations).limit(1);
  if (existing.length > 0) {
    console.log("Seed skipped: organization already exists.");
    return;
  }

  const orgId = nanoid();
  const userId = nanoid();
  const raffleId = nanoid();
  const password = process.env.ADMIN_PASSWORD || "rifacil123";
  const passwordHash = await bcrypt.hash(password, 10);
  const adminEmail = process.env.ADMIN_EMAIL || "admin@rifacil.com";

  await db.insert(organizations).values({
    id: orgId,
    name: "Rifacil",
    slug: "rifacil",
    isPlatform: true,
    active: true,
  });

  await db.insert(users).values({
    id: userId,
    organizationId: orgId,
    email: adminEmail,
    name: "Administrador",
    passwordHash,
    role: "super_admin",
    active: true,
  });

  const drawAt = new Date();
  drawAt.setMonth(drawAt.getMonth() + 1);

  await db.insert(raffles).values({
    id: raffleId,
    organizationId: orgId,
    title: "Rifa de demostración",
    slug: "demo",
    description:
      "Plantilla de demostración. Prueba apartando números, subiendo un comprobante y explorando el panel de administración.",
    prize: "iPhone 16 Pro 128GB",
    pricePerTicket: "10.00",
    currency: "PEN",
    totalTickets: 100,
    reservationMinutes: 30,
    drawAt,
    status: "active",
    winnerCount: 1,
  });

  await db.insert(paymentMethods).values([
    {
      id: nanoid(),
      organizationId: orgId,
      raffleId,
      name: "Yape",
      instructions:
        "Envía el pago por Yape al número indicado y sube la captura del comprobante.",
      accountInfo: "999 888 777",
      accountHolder: "Rifacil Demo",
      sortOrder: 1,
      active: true,
    },
    {
      id: nanoid(),
      organizationId: orgId,
      raffleId,
      name: "Plin",
      instructions:
        "Transfiere por Plin al número indicado y adjunta el comprobante.",
      accountInfo: "999 888 777",
      accountHolder: "Rifacil Demo",
      sortOrder: 2,
      active: true,
    },
    {
      id: nanoid(),
      organizationId: orgId,
      raffleId,
      name: "Transferencia / SPEI",
      instructions:
        "Realiza la transferencia a la cuenta y sube el voucher de pago.",
      accountInfo: "BCP 191-4567890-0-12 · CCI 002191004567890012",
      accountHolder: "Rifacil Demo",
      sortOrder: 3,
      active: true,
    },
  ]);

  const ticketRows = Array.from({ length: 100 }, (_, i) => ({
    id: nanoid(),
    raffleId,
    number: i,
    status: "available" as const,
  }));
  await db.insert(tickets).values(ticketRows);

  const check = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  console.log("Seed complete.");
  console.log(`Admin: ${adminEmail}`);
  console.log(`Password: ${password}`);
  console.log(`Demo raffle: /r/demo`);
  console.log(`Users inserted: ${check.length}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
