export function formatMoney(
  amount: string | number,
  currency = "PEN",
  locale = "es-PE",
) {
  const value = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    // Códigos no ISO (USDT, USDC…): número + código
    const num = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${num} ${currency}`;
  }
}

export function formatTicketNumber(n: number, digits = 2) {
  return String(n).padStart(Math.max(digits, String(n).length), "0");
}

export function padDigitsForTotal(total: number) {
  return Math.max(2, String(Math.max(total - 1, 0)).length);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/** Rifa demo de la landing (`demo` o archivadas `demo-archivo-…`) */
export function isDemoRaffleSlug(slug: string) {
  const s = slugify(slug);
  return s === "demo" || s.startsWith("demo-");
}

export const orderStatusLabel: Record<string, string> = {
  pending_payment: "Pendiente de pago",
  under_review: "En revisión",
  paid: "Pagado",
  rejected: "Rechazado",
  expired: "Expirado",
};

export const raffleStatusLabel: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  closed: "Cerrada",
  drawn: "Sorteada",
};

export const ticketStatusLabel: Record<string, string> = {
  available: "Disponible",
  reserved: "Apartado",
  paid: "Pagado",
  cancelled: "Cancelado",
};

export const donationStatusLabel: Record<string, string> = {
  pending_payment: "Pendiente de pago",
  under_review: "En revisión",
  confirmed: "Confirmada",
  rejected: "Rechazada",
};
