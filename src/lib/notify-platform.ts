import { and, eq } from "drizzle-orm";
import { ensureSchema, getDb } from "@/db";
import {
  organizations,
  raffles,
  tickets,
  users,
} from "@/db/schema";
import { sendEmail, isSmtpConfigured } from "@/lib/email";
import {
  formatMoney,
  formatTicketNumber,
  isDemoRaffleSlug,
  padDigitsForTotal,
} from "@/lib/format";
import { getAppBaseUrl } from "@/lib/urls";

/**
 * Notifica por SMTP solo al super_admin de la org plataforma,
 * solo rifas reales (no demo). Clientes no reciben correo.
 */
async function getPlatformRecipientsForRaffle(raffleId: string) {
  if (!isSmtpConfigured()) return null;

  await ensureSchema();
  const db = await getDb();

  const [row] = await db
    .select({
      raffleTitle: raffles.title,
      raffleSlug: raffles.slug,
      totalTickets: raffles.totalTickets,
      currency: raffles.currency,
      isPlatform: organizations.isPlatform,
      organizationId: organizations.id,
    })
    .from(raffles)
    .innerJoin(organizations, eq(raffles.organizationId, organizations.id))
    .where(eq(raffles.id, raffleId))
    .limit(1);

  if (!row?.isPlatform) return null;
  // La demo de la landing no genera correos
  if (isDemoRaffleSlug(row.raffleSlug)) return null;

  const admins = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(
      and(
        eq(users.organizationId, row.organizationId),
        eq(users.role, "super_admin"),
        eq(users.active, true),
      ),
    );

  const emails = admins.map((a) => a.email).filter(Boolean);
  if (emails.length === 0) return null;

  return { ...row, emails };
}

export async function notifyPlatformOrderProof(order: {
  id: string;
  raffleId: string;
  participantName: string;
  participantPhone: string;
  totalAmount: string;
}) {
  try {
    const meta = await getPlatformRecipientsForRaffle(order.raffleId);
    if (!meta) return;

    const db = await getDb();
    const orderTickets = await db
      .select({ number: tickets.number })
      .from(tickets)
      .where(eq(tickets.orderId, order.id));

    const digits = padDigitsForTotal(meta.totalTickets);
    const numbers = orderTickets
      .map((t) => formatTicketNumber(t.number, digits))
      .join(", ");

    const adminUrl = `${getAppBaseUrl()}/admin/ordenes?status=under_review`;
    const amount = formatMoney(order.totalAmount, meta.currency);

    const subject = `[Rifacil] Comprobante por revisar — ${meta.raffleTitle}`;
    const text = [
      "Hay un nuevo comprobante de pago para revisar.",
      "",
      `Rifa: ${meta.raffleTitle}`,
      `Participante: ${order.participantName}`,
      `Teléfono: ${order.participantPhone}`,
      `Números: ${numbers || "—"}`,
      `Monto: ${amount}`,
      "",
      `Revisa y aprueba aquí: ${adminUrl}`,
    ].join("\n");

    const result = await sendEmail({
      to: meta.emails,
      subject,
      text,
      html: `
        <p>Hay un nuevo <strong>comprobante de pago</strong> para revisar.</p>
        <ul>
          <li><strong>Rifa:</strong> ${escapeHtml(meta.raffleTitle)}</li>
          <li><strong>Participante:</strong> ${escapeHtml(order.participantName)}</li>
          <li><strong>Teléfono:</strong> ${escapeHtml(order.participantPhone)}</li>
          <li><strong>Números:</strong> ${escapeHtml(numbers || "—")}</li>
          <li><strong>Monto:</strong> ${escapeHtml(amount)}</li>
        </ul>
        <p><a href="${adminUrl}">Entrar a Órdenes y aprobar</a></p>
      `,
    });
    if (!result.ok) {
      console.error(
        "[notify] order email not sent",
        "skipped" in result && result.skipped ? "SMTP not configured" : result.error,
      );
    }
  } catch (err) {
    console.error("[notify] order proof failed", err);
  }
}

export async function notifyPlatformDonationProof(donation: {
  id: string;
  raffleId: string;
  donorName: string;
  donorPhone: string;
  amount: string;
}) {
  try {
    const meta = await getPlatformRecipientsForRaffle(donation.raffleId);
    if (!meta) return;

    const adminUrl = `${getAppBaseUrl()}/admin/donaciones?status=under_review`;
    const amount = formatMoney(donation.amount, meta.currency);

    const subject = `[Rifacil] Donación por revisar — ${meta.raffleTitle}`;
    const text = [
      "Hay una nueva donación con comprobante para revisar.",
      "",
      `Rifa: ${meta.raffleTitle}`,
      `Donante: ${donation.donorName}`,
      `Teléfono: ${donation.donorPhone}`,
      `Monto: ${amount}`,
      "",
      `Revisa aquí: ${adminUrl}`,
    ].join("\n");

    const result = await sendEmail({
      to: meta.emails,
      subject,
      text,
      html: `
        <p>Hay una nueva <strong>donación</strong> con comprobante para revisar.</p>
        <ul>
          <li><strong>Rifa:</strong> ${escapeHtml(meta.raffleTitle)}</li>
          <li><strong>Donante:</strong> ${escapeHtml(donation.donorName)}</li>
          <li><strong>Teléfono:</strong> ${escapeHtml(donation.donorPhone)}</li>
          <li><strong>Monto:</strong> ${escapeHtml(amount)}</li>
        </ul>
        <p><a href="${adminUrl}">Entrar a Donaciones</a></p>
      `,
    });
    if (!result.ok) {
      console.error(
        "[notify] donation email not sent",
        "skipped" in result && result.skipped ? "SMTP not configured" : result.error,
      );
    }
  } catch (err) {
    console.error("[notify] donation proof failed", err);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
