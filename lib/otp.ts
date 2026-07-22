import "server-only";
import { createHash, randomInt } from "node:crypto";

// WhatsApp OTP helpers. The SEND is a seam: it talks to the WhatsApp Cloud API
// when creds are present, and no-ops safely until the number is live. In dev it
// logs the code so the flow is testable without a live number.

// MUST match the approved `login_code` template's footer
// ("Expires in 15 minutes", code_expiration_minutes: 15) — otherwise the message
// promises longer than the code actually lives and guests hit a false expiry.
export const OTP_TTL_MIN = 15;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SEC = 60;

/** Normalise a Pakistani number to E.164 digits (923xxxxxxxxx), or null if it
 *  doesn't look like a valid mobile. */
export function toE164Pk(raw: string): string | null {
  const d = (raw || "").replace(/\D/g, "");
  let n = d;
  if (n.startsWith("0")) n = "92" + n.slice(1);
  else if (n.startsWith("3")) n = "92" + n; // "3xxxxxxxxx" typed without 0
  else if (!n.startsWith("92") && n.length === 10) n = "92" + n;
  // PK mobiles: 92 + 3 + 9 digits = 12 digits, mobile prefix starts 923.
  return /^923\d{9}$/.test(n) ? n : null;
}

/** Pretty form for display: +92 3xx xxxxxxx */
export function prettyPk(e164: string): string {
  const m = e164.match(/^92(3\d{2})(\d{7})$/);
  return m ? `+92 ${m[1]} ${m[2]}` : `+${e164}`;
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(code: string, accountId: string): string {
  return createHash("sha256").update(`${code}:${accountId}`).digest("hex");
}

function waConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  // WHATSAPP_ACCESS_TOKEN is the CRM's name for the same credential — accepted
  // here so the founder can paste identical values into both Vercel projects.
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const template = process.env.WHATSAPP_OTP_TEMPLATE || "otp";
  const lang = process.env.WHATSAPP_OTP_LANG || "en";
  return phoneNumberId && token ? { phoneNumberId, token, template, lang } : null;
}

export function whatsappConfigured(): boolean {
  return waConfig() !== null;
}

export type OtpSendResult = {
  ok: boolean;
  devCode?: string;
  error?: string; // "not_configured" | "send_failed"
  /** Meta's message id. The ONLY handle for tracing a message that Meta accepted
   *  but never delivered — always logged, so `vercel logs | grep [otp]` can tie a
   *  guest's "I never got it" to a specific send. */
  waMessageId?: string;
  metaCode?: number; // e.g. 131042 = payment restricted
  metaMessage?: string;
};

/** Meta error codes worth telling the guest something specific about. Anything
 *  else falls back to the generic message. */
const META_ERROR_COPY: Record<number, string> = {
  131042: "WhatsApp is temporarily unavailable on our side. Please continue with email — we're on it.",
  131026: "We couldn't reach that number on WhatsApp. Check the number, or sign up with email instead.",
  132001: "WhatsApp verification is misconfigured on our side. Please use email — we've been alerted.",
  133010: "WhatsApp verification isn't switched on yet. Please use email for now.",
};

/** Guest-safe wording for a failed send. */
export function otpSendMessage(r: OtpSendResult): string {
  if (r.error === "not_configured") return "WhatsApp verification isn't available yet — please use email for now.";
  if (r.metaCode && META_ERROR_COPY[r.metaCode]) return META_ERROR_COPY[r.metaCode];
  return "Couldn't send the code. Check the number and try again, or use email.";
}

/**
 * Send the OTP via the WhatsApp authentication template (Copy-code button).
 * - Configured: calls the Cloud API. (The exact button component is verified
 *   against the live template when the number goes live — kept simple here.)
 * - Not configured + dev: logs the code and returns devCode so the UI is testable.
 * - Not configured + prod: returns not_configured (caller falls back to email).
 */
export async function sendWhatsappOtp(e164: string, code: string): Promise<OtpSendResult> {
  const cfg = waConfig();
  if (!cfg) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[otp] (dev) code for ${e164}: ${code}`);
      return { ok: true, devCode: code };
    }
    return { ok: false, error: "not_configured" };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: e164,
        type: "template",
        template: {
          name: cfg.template,
          language: { code: cfg.lang },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
          ],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const bodyText = await res.text().catch(() => "");
    let parsed: {
      messages?: { id?: string; message_status?: string }[];
      error?: { code?: number; message?: string; error_data?: { details?: string } };
    } | null = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      /* non-JSON — keep the raw text for the log */
    }

    if (!res.ok) {
      const err = parsed?.error;
      // Persist Meta's REASON, not just "failed" — a generic error is what made
      // the 2026-07-21 billing restriction take an hour to identify.
      console.error(
        `[otp] send FAILED to=${e164} http=${res.status} metaCode=${err?.code ?? "?"} msg=${err?.message ?? bodyText.slice(0, 200)}`,
      );
      return { ok: false, error: "send_failed", metaCode: err?.code, metaMessage: err?.message ?? err?.error_data?.details };
    }

    const waMessageId = parsed?.messages?.[0]?.id;
    // NOTE: Meta returns `accepted` here, which means QUEUED — not delivered. A
    // payment restriction or a block still returns 200. True delivery status only
    // arrives later on the CRM's status webhook, so this id is the handle that
    // makes a silent non-delivery traceable after the fact.
    console.log(`[otp] send accepted to=${e164} wa_message_id=${waMessageId ?? "?"} status=${parsed?.messages?.[0]?.message_status ?? "?"}`);
    return { ok: true, waMessageId };
  } catch (e) {
    console.error(`[otp] send ERROR to=${e164}:`, (e as Error).message);
    return { ok: false, error: "send_failed" };
  }
}
