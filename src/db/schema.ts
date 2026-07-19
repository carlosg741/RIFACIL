import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export const raffleStatusEnum = pgEnum("raffle_status", [
  "draft",
  "active",
  "closed",
  "drawn",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "available",
  "reserved",
  "paid",
  "cancelled",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "under_review",
  "paid",
  "rejected",
  "expired",
]);

export const donationStatusEnum = pgEnum("donation_status", [
  "pending_payment",
  "under_review",
  "confirmed",
  "rejected",
]);

function id() {
  return text("id")
    .primaryKey()
    .$defaultFn(() => nanoid());
}

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /** Org de la plataforma (Rifacil): dueña de la rifa demo de la landing */
  isPlatform: boolean("is_platform").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const users = pgTable("users", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  /** Roles: super_admin (plataforma) | client */
  role: text("role").notNull().default("client"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Rifa donde se muestra este método (null = sin asignar; se conserva al borrar la rifa) */
    raffleId: text("raffle_id").references(() => raffles.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    instructions: text("instructions").notNull(),
    accountInfo: text("account_info"),
    accountHolder: text("account_holder"),
    qrImageUrl: text("qr_image_url"),
    /** Moneda que acepta este método (null = todas las monedas de la rifa) */
    currency: text("currency"),
    /** Email asociado a la cuenta de cobro (PayPal, Wise, etc.) */
    contactEmail: text("contact_email"),
    /** Cédula / DNI / ID del titular de la cuenta de cobro */
    documentId: text("document_id"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("payment_methods_raffle_idx").on(t.raffleId)],
);

export const raffles = pgTable(
  "raffles",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    prize: text("prize").notNull(),
    imageUrl: text("image_url"),
    pricePerTicket: numeric("price_per_ticket", {
      precision: 12,
      scale: 2,
    }).notNull(),
    currency: text("currency").notNull().default("PEN"),
    totalTickets: integer("total_tickets").notNull(),
    reservationMinutes: integer("reservation_minutes").notNull().default(30),
    drawAt: timestamp("draw_at", { withTimezone: true }),
    status: raffleStatusEnum("status").notNull().default("draft"),
    winnerCount: integer("winner_count").notNull().default(1),
    donationsEnabled: boolean("donations_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("raffles_org_slug_idx").on(t.organizationId, t.slug),
    index("raffles_slug_idx").on(t.slug),
  ],
);

export const raffleCurrencies = pgTable(
  "raffle_currencies",
  {
    id: id(),
    raffleId: text("raffle_id")
      .notNull()
      .references(() => raffles.id, { onDelete: "cascade" }),
    /** Código de moneda: PEN, USD, USDT, VES, EUR, COP, CLP, BRL… */
    code: text("code").notNull(),
    pricePerTicket: numeric("price_per_ticket", {
      precision: 12,
      scale: 2,
    }).notNull(),
    /** Orden de aparición; la posición 1 es la moneda principal */
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("raffle_currencies_raffle_code_idx").on(t.raffleId, t.code),
    index("raffle_currencies_raffle_idx").on(t.raffleId),
  ],
);

export const rafflePrizes = pgTable(
  "raffle_prizes",
  {
    id: id(),
    raffleId: text("raffle_id")
      .notNull()
      .references(() => raffles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("raffle_prizes_raffle_position_idx").on(
      t.raffleId,
      t.position,
    ),
  ],
);

export const donations = pgTable(
  "donations",
  {
    id: id(),
    raffleId: text("raffle_id")
      .notNull()
      .references(() => raffles.id, { onDelete: "cascade" }),
    paymentMethodId: text("payment_method_id").references(
      () => paymentMethods.id,
      { onDelete: "set null" },
    ),
    status: donationStatusEnum("status").notNull().default("pending_payment"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    /** Moneda elegida por el donante (null = moneda base de la rifa) */
    currency: text("currency"),
    donorName: text("donor_name").notNull(),
    donorPhone: text("donor_phone").notNull(),
    donorEmail: text("donor_email"),
    proofUrl: text("proof_url"),
    proofFileName: text("proof_file_name"),
    notes: text("notes"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("donations_raffle_status_idx").on(t.raffleId, t.status)],
);

export const tickets = pgTable(
  "tickets",
  {
    id: id(),
    raffleId: text("raffle_id")
      .notNull()
      .references(() => raffles.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    status: ticketStatusEnum("status").notNull().default("available"),
    orderId: text("order_id"),
    reservedUntil: timestamp("reserved_until", { withTimezone: true }),
    participantName: text("participant_name"),
    participantPhone: text("participant_phone"),
    participantEmail: text("participant_email"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("tickets_raffle_number_idx").on(t.raffleId, t.number),
    index("tickets_raffle_status_idx").on(t.raffleId, t.status),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    raffleId: text("raffle_id")
      .notNull()
      .references(() => raffles.id, { onDelete: "cascade" }),
    paymentMethodId: text("payment_method_id").references(
      () => paymentMethods.id,
      { onDelete: "set null" },
    ),
    status: orderStatusEnum("status").notNull().default("pending_payment"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    /** Moneda elegida por el participante (null = moneda base de la rifa) */
    currency: text("currency"),
    ticketCount: integer("ticket_count").notNull(),
    participantName: text("participant_name").notNull(),
    participantPhone: text("participant_phone").notNull(),
    participantEmail: text("participant_email"),
    notes: text("notes"),
    reservedUntil: timestamp("reserved_until", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("orders_raffle_status_idx").on(t.raffleId, t.status)],
);

export const paymentProofs = pgTable("payment_proofs", {
  id: id(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" })
    .unique(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const draws = pgTable("draws", {
  id: id(),
  raffleId: text("raffle_id")
    .notNull()
    .references(() => raffles.id, { onDelete: "cascade" })
    .unique(),
  seed: text("seed").notNull(),
  drawnAt: timestamp("drawn_at", { withTimezone: true }).defaultNow().notNull(),
  paidTicketCount: integer("paid_ticket_count").notNull(),
  notes: text("notes"),
});

export const drawWinners = pgTable("draw_winners", {
  id: id(),
  drawId: text("draw_id")
    .notNull()
    .references(() => draws.id, { onDelete: "cascade" }),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  ticketNumber: integer("ticket_number").notNull(),
  prizePosition: integer("prize_position").notNull(),
  participantName: text("participant_name"),
  participantPhone: text("participant_phone"),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  raffles: many(raffles),
  paymentMethods: many(paymentMethods),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  raffle: one(raffles, {
    fields: [paymentMethods.raffleId],
    references: [raffles.id],
  }),
  organization: one(organizations, {
    fields: [paymentMethods.organizationId],
    references: [organizations.id],
  }),
}));

export const rafflesRelations = relations(raffles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [raffles.organizationId],
    references: [organizations.id],
  }),
  tickets: many(tickets),
  orders: many(orders),
  donations: many(donations),
  paymentMethods: many(paymentMethods),
  prizes: many(rafflePrizes),
  currencies: many(raffleCurrencies),
  draw: one(draws),
}));

export const raffleCurrenciesRelations = relations(
  raffleCurrencies,
  ({ one }) => ({
    raffle: one(raffles, {
      fields: [raffleCurrencies.raffleId],
      references: [raffles.id],
    }),
  }),
);

export const rafflePrizesRelations = relations(rafflePrizes, ({ one }) => ({
  raffle: one(raffles, {
    fields: [rafflePrizes.raffleId],
    references: [raffles.id],
  }),
}));

export const donationsRelations = relations(donations, ({ one }) => ({
  raffle: one(raffles, {
    fields: [donations.raffleId],
    references: [raffles.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [donations.paymentMethodId],
    references: [paymentMethods.id],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  raffle: one(raffles, {
    fields: [tickets.raffleId],
    references: [raffles.id],
  }),
  order: one(orders, {
    fields: [tickets.orderId],
    references: [orders.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  raffle: one(raffles, {
    fields: [orders.raffleId],
    references: [raffles.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [orders.paymentMethodId],
    references: [paymentMethods.id],
  }),
  proof: one(paymentProofs),
  tickets: many(tickets),
}));

export const drawsRelations = relations(draws, ({ one, many }) => ({
  raffle: one(raffles, {
    fields: [draws.raffleId],
    references: [raffles.id],
  }),
  winners: many(drawWinners),
}));

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Raffle = typeof raffles.$inferSelect;
export type RafflePrize = typeof rafflePrizes.$inferSelect;
export type RaffleCurrency = typeof raffleCurrencies.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type Donation = typeof donations.$inferSelect;
export type Draw = typeof draws.$inferSelect;
export type DrawWinner = typeof drawWinners.$inferSelect;
