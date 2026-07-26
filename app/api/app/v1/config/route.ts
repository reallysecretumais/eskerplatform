import { ok, guard } from "@/lib/app/api";
import { brand } from "@/lib/brand";
import { payments, support, MIN_ADVANCE, advancePct } from "@/lib/payments";
import { getWebsiteAi } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/config — the app's boot handshake. Called on every launch
 * before anything else renders.
 *
 * Everything here is REMOTELY CONTROLLED on purpose: the store takes days to
 * approve a build, so the switches that matter in an emergency (kill a broken
 * AI surface, force an upgrade, show a maintenance notice) must not require one.
 * All values are public — no account needed and nothing sensitive is exposed.
 *
 * `minVersion` is the force-update gate: the app compares its own build and, if
 * it's older, blocks with an upgrade prompt. Keep it BELOW the current release
 * unless you genuinely intend to lock older installs out.
 */

// Bump `minVersion` only to lock out builds with a real defect (a broken payment
// path, a security fix). `latestVersion` drives a soft "update available" nudge.
const MIN_SUPPORTED_VERSION = "1.0.0";
const LATEST_VERSION = "1.0.0";

export const GET = guard(async () => {
  const ai = await getWebsiteAi();

  return ok({
    // ── Release gates ───────────────────────────────────────────────
    minVersion: MIN_SUPPORTED_VERSION,
    latestVersion: LATEST_VERSION,
    maintenance: { active: false, message: "" },

    // ── Feature flags. The app hides a surface when its flag is false, so a
    //    half-finished or misbehaving feature can be pulled without a release.
    features: {
      aiSearch: ai.search.enabled,
      aiVoice: ai.voice.enabled,
      aiPropertyQa: ai.concierge.enabled,
      // Guest chat is deliberately human-only (no auto-AI) — same policy as web.
      chat: true,
      // Turns on with the payment gateway (Batch: payments). Until then the app
      // shows bank transfer only, rather than a card button that can't work.
      onlinePayments: false,
      saves: true,
    },

    // ── Brand (the app renders no hardcoded name) ───────────────────
    brand: {
      name: brand.name,
      exclusiveTier: brand.exclusiveTier,
      gold: brand.gold,
      whatsapp: brand.whatsapp,
      expansionNote: brand.expansionNote,
    },

    // ── Money rules, so the app never hardcodes a percentage ────────
    money: {
      currency: "PKR",
      symbol: "₨",
      minAdvance: MIN_ADVANCE,
      advancePctExclusive: advancePct(true),
      advancePctStandard: advancePct(false),
      methods: payments.methods,
      accountTitle: payments.title,
      bankAccounts: payments.accounts,
    },

    support: { email: support.email, whatsapp: brand.whatsapp },
  });
});
