import "server-only";
import nodemailer from "nodemailer";

// Transactional email via the Esker business mailbox (Titan SMTP). Credentials
// come from env (the founder adds SMTP_PASS in Vercel — never in code). If email
// isn't configured, send() returns {ok:false} and the caller treats it as
// best-effort — guest comms must never break a booking.

const HOST = process.env.SMTP_HOST || "smtp.titan.email";
const PORT = Number(process.env.SMTP_PORT || "465");
const USER = process.env.SMTP_USER || "admin@eskerrentals.com";
const PASS = process.env.SMTP_PASS || "";
const FROM = process.env.SMTP_FROM || `Esker Rentals <${USER}>`;

type Transport = ReturnType<typeof nodemailer.createTransport>;
let cached: Transport | null = null;

function transport(): Transport | null {
  if (!PASS) return null; // not configured yet
  if (!cached) {
    cached = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465, // 465 = implicit TLS, 587 = STARTTLS
      auth: { user: USER, pass: PASS },
    });
  }
  return cached;
}

export function emailConfigured(): boolean {
  return Boolean(PASS);
}

export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string; replyTo?: string }): Promise<{ ok: boolean; error?: string }> {
  const t = transport();
  if (!t) return { ok: false, error: "email not configured" };
  try {
    await t.sendMail({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text, replyTo: opts.replyTo });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
