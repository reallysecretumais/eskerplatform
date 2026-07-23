import "server-only";

// Generic WhatsApp Cloud API template send from the website, using the same
// number/creds already configured for OTP. Kept tiny and best-effort: the caller
// always has other channels (in-app + email), so a WhatsApp failure never blocks
// anything. Returns the wa_message_id when accepted (logged for traceability, the
// same lesson as the OTP hardening) or a reason on failure.

type Component =
  | { type: "body"; parameters: { type: "text"; text: string }[] }
  | { type: "button"; sub_type: "url"; index: string; parameters: { type: "text"; text: string }[] };

export type WaTemplateResult = { ok: boolean; waMessageId?: string; error?: string; metaCode?: number };

function creds() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  return phoneNumberId && token ? { phoneNumberId, token } : null;
}

export function whatsappSendConfigured(): boolean {
  return creds() !== null;
}

/** Send an approved template to `to` (E.164 digits). No-ops (not_configured) when
 *  creds are absent, so the site runs fine before the number is live. */
export async function sendWhatsappTemplate(
  to: string,
  template: string,
  components: Component[],
  lang = "en",
): Promise<WaTemplateResult> {
  const c = creds();
  if (!c) return { ok: false, error: "not_configured" };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${c.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: template, language: { code: lang }, components },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text().catch(() => "");
    let parsed: { messages?: { id?: string }[]; error?: { code?: number; message?: string } } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw text for the log */
    }
    if (!res.ok) {
      console.error(`[wa] template ${template} FAILED to=${to} http=${res.status} metaCode=${parsed?.error?.code ?? "?"} msg=${parsed?.error?.message ?? text.slice(0, 160)}`);
      return { ok: false, error: "send_failed", metaCode: parsed?.error?.code };
    }
    const waMessageId = parsed?.messages?.[0]?.id;
    console.log(`[wa] template ${template} accepted to=${to} wa_message_id=${waMessageId ?? "?"}`);
    return { ok: true, waMessageId };
  } catch (e) {
    console.error(`[wa] template ${template} ERROR to=${to}:`, (e as Error).message);
    return { ok: false, error: "send_failed" };
  }
}
