import nodemailer from "nodemailer";

export function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}

function getTransporter() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT || "587");
  const secure =
    process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}) {
  if (!isSmtpConfigured()) {
    return { ok: false as const, skipped: true as const };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return { ok: false as const, skipped: true as const };
  }

  const from =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER!.trim();

  try {
    await transporter.sendMail({
      from,
      to: Array.isArray(input.to) ? input.to.join(", ") : input.to,
      subject: input.subject,
      text: input.text,
      html: input.html || input.text.replace(/\n/g, "<br/>"),
    });
    return { ok: true as const };
  } catch (err) {
    console.error("[email] send failed", err);
    return { ok: false as const, error: err };
  }
}
