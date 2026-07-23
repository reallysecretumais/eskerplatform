import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// Can we SELL an external (resale) unit's dates on the spot?
//
// Esker doesn't control these owners' calendars — the owner keeps selling the
// same apartment elsewhere. We may only instant-book when we have a recently
// synced copy of their calendar (the CRM's iCal cron → `external_ical_busy`,
// stamped on `external_properties.ical_synced_at`). Otherwise we ask the owner
// first (request-to-book) rather than taking money for a night that may be gone.
//
// `ical_synced_at` is stamped ONLY on a successful sync, so an empty calendar
// that synced fine still counts as fresh — never infer freshness from row count.
// It is deliberately absent from the public view; this is a server-side call.
// ─────────────────────────────────────────────────────────────────────────────

/** Past this, a cached owner calendar is too old to sell against. */
export const ICAL_FRESH_HOURS = 12;

export type ExternalBookability = {
  mode: "instant" | "request";
  reason: "ical-fresh" | "no-ical" | "stale-ical";
};

export async function getExternalBookability(listingId: string): Promise<ExternalBookability> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("external_properties")
    .select("ical_url, ical_synced_at")
    .eq("id", listingId)
    .maybeSingle();

  const row = data as { ical_url?: string | null; ical_synced_at?: string | null } | null;
  if (!row?.ical_url) return { mode: "request", reason: "no-ical" };
  if (!row.ical_synced_at) return { mode: "request", reason: "stale-ical" };

  const ageMs = Date.now() - new Date(row.ical_synced_at).getTime();
  return Number.isFinite(ageMs) && ageMs < ICAL_FRESH_HOURS * 3600 * 1000
    ? { mode: "instant", reason: "ical-fresh" }
    : { mode: "request", reason: "stale-ical" };
}

/** How long an owner's "available" answer authorises a booking of those exact
 *  dates — mirrors the CRM's trust window for a WhatsApp reply. */
export const AVAILABLE_TRUST_HOURS = 48;

/**
 * Did THIS account get an "available" answer for these EXACT dates, recently
 * enough to book on? An owner's WhatsApp tap isn't an iCal sync, so this is the
 * only thing that lets a request-to-book guest actually book without looping.
 * Exact-date + 48h match, per the CRM's trust rules.
 */
export async function hasAuthorizedRequest(
  accountId: string,
  listingId: string,
  checkin: string, // YYYY-MM-DD
  checkout: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - AVAILABLE_TRUST_HOURS * 3600 * 1000).toISOString();
  const { data } = await admin
    .from("external_date_requests")
    .select("id")
    .eq("account_id", accountId)
    .eq("external_property_id", listingId)
    .eq("status", "available")
    .eq("checkin", checkin)
    .eq("checkout", checkout)
    .gte("resolved_at", cutoff)
    .limit(1);
  return !!(data && data.length > 0);
}
