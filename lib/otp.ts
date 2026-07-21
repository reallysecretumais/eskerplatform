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

export type OtpSendResult = { ok: boolean; devCode?: string; error?: string };

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
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[otp] whatsapp send failed:", res.status, t.slice(0, 300));
      return { ok: false, error: "send_failed" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[otp] whatsapp send error:", (e as Error).message);
    return { ok: false, error: "send_failed" };
  }
}
