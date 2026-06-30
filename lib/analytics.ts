import "server-only";
import crypto from "crypto";

// Meta Conversions API (server-side events) — reliable, ad-blocker-proof
// tracking that complements the browser Pixel. No-op until META_PIXEL_ID +
// META_CAPI_TOKEN are set, so it's safe to ship now. Hashes PII (email/phone)
// per Meta's spec for match quality; never sends raw PII.

const PIXEL = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const TOKEN = process.env.META_CAPI_TOKEN || "";

const sha = (v?: string | null) => (v ? crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex") : undefined);

export async function capiEvent(
  name: string,
  opts: { email?: string | null; phone?: string | null; value?: number; currency?: string; sourceUrl?: string; contentIds?: string[] } = {},
): Promise<void> {
  if (!PIXEL || !TOKEN) return;
  try {
    const user_data: Record<string, string[]> = {};
    const em = sha(opts.email);
    const ph = sha(opts.phone?.replace(/\D/g, ""));
    if (em) user_data.em = [em];
    if (ph) user_data.ph = [ph];
    const custom_data: Record<string, unknown> = {};
    if (opts.value != null) {
      custom_data.value = opts.value;
      custom_data.currency = opts.currency ?? "PKR";
    }
    if (opts.contentIds?.length) {
      custom_data.content_ids = opts.contentIds;
      custom_data.content_type = "product";
    }
    await fetch(`https://graph.facebook.com/v19.0/${PIXEL}/events?access_token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{ event_name: name, event_time: Math.floor(Date.now() / 1000), action_source: "website", event_source_url: opts.sourceUrl, user_data, custom_data }],
      }),
    });
  } catch {
    /* best-effort */
  }
}
