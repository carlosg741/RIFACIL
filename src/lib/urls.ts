/** Parsea datetime-local (hora local del navegador) sin desfases UTC. */
export function parseLocalDateTime(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const m = value.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    m[6] ? Number(m[6]) : 0,
    0,
  );
}

export function toLocalDateTimeValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function rafflePublicUrl(slug: string, baseUrl?: string) {
  return `${baseUrl || getAppBaseUrl()}/r/${slug}`;
}

export function ticketPublicUrl(
  slug: string,
  orderId: string,
  baseUrl?: string,
) {
  return `${baseUrl || getAppBaseUrl()}/r/${slug}/ticket/${orderId}`;
}

export function whatsappShareUrl(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
