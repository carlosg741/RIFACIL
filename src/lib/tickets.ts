import { and, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { ensureSchema, getDb } from "@/db";
import { orders, tickets } from "@/db/schema";

export async function releaseExpiredReservations(raffleId?: string) {
  await ensureSchema();
  const db = await getDb();
  const now = new Date();

  const expiredOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        raffleId ? eq(orders.raffleId, raffleId) : undefined,
        inArray(orders.status, ["pending_payment", "under_review"]),
        isNotNull(orders.reservedUntil),
        lt(orders.reservedUntil, now),
      ),
    );

  if (expiredOrders.length === 0) {
    // Also clear any orphan reserved tickets past reservedUntil
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
      .where(
        and(
          raffleId ? eq(tickets.raffleId, raffleId) : undefined,
          eq(tickets.status, "reserved"),
          isNotNull(tickets.reservedUntil),
          lt(tickets.reservedUntil, now),
        ),
      );
    return 0;
  }

  const orderIds = expiredOrders.map((o) => o.id);

  await db
    .update(orders)
    .set({ status: "expired", updatedAt: now })
    .where(inArray(orders.id, orderIds));

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
    .where(
      and(
        inArray(tickets.orderId, orderIds),
        or(eq(tickets.status, "reserved"), eq(tickets.status, "available")),
      ),
    );

  return orderIds.length;
}

export async function countTicketStats(raffleId: string) {
  await ensureSchema();
  const db = await getDb();
  const rows = await db
    .select({
      status: tickets.status,
      count: sql<number>`count(*)::int`,
    })
    .from(tickets)
    .where(eq(tickets.raffleId, raffleId))
    .groupBy(tickets.status);

  const stats = {
    available: 0,
    reserved: 0,
    paid: 0,
    cancelled: 0,
    total: 0,
  };
  for (const row of rows) {
    stats[row.status] = Number(row.count);
    stats.total += Number(row.count);
  }
  return stats;
}
