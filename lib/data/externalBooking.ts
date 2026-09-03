import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// Can we SELL an external (resale) unit's dates on the spot?
//
// Esker doesn't control these owners' calendars — the owner keeps selling the
// same apartment elsewhere. We may only instant-book when we have a recently
// synced copy of their calendar (`external_ical_busy`, stamped on
// `external_properties.ical_synced_at`). Otherwise we ask the owner first
// (request-to-book) rather than taking money for a night that may be gone.
//
// The copy is kept fresh BY THIS FILE: when the stamp is missing or old we ask
// the CRM to pull that one calendar (`/api/platform/ical-refresh`) before
// answering. So the first guest to look at a stale listing warms it for
// everyone, and there is no scheduler whose absence quietly turns instant
// booking off. `refreshExternalCalendar` is also called on the booking path, so
// money never moves against a calendar we haven't just re-read.
//
// `ical_synced_at` is stamped ONLY on a successful sync, so an empty calendar
// that synced fine still counts as fresh — never infer freshness from row count.
// It is deliberately absent from the public view; this is a server-side call.
// ─────────────────────────────────────────────────────────────────────────────

/** Past this, a cached owner calendar is too old to sell against. */
export const ICAL_FRESH_HOURS = 12;

/** How long we'll wait for the CRM to pull a calendar before giving up and
 *  answering from what we already have. The owner's feed answers in well under
 *  a second; this only has to stop a hung provider from holding a page open. */
const REFRESH_TIMEOUT_MS = 6_000;

export type ExternalBookability = {
  mode: "instant" | "request";
  reason: "ical-fresh" | "no-ical" | "stale-ical";
};

/**
 * Ask the CRM to re-pull one owner calendar. Best-effort by design: any failure
 * leaves the previous rows and the previous stamp in place, which degrades to
 * request-to-book rather than to "those dates look free". Returns the fresh
 * `ical_synced_at` when the pull succeeded, else null.
 */
export async function refreshExternalCalendar(listingId: string): Promise<string | null> {
  const base = (process.env.CRM_URL || "https://os.eskerrentals.com").replace(/\/$/, "");
  const secret = process.env.PLATFORM_API_SECRET || process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.error("[ical-refresh] no PLATFORM_API_SECRET/REVALIDATE_SECRET configured");
    return null;
  }
  try {
    const res = await fetch(`${base}/api/platform/ical-refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-esker-secret": secret },
      body: JSON.stringify({ externalPropertyId: listingId }),
      cache: "no-store",
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const out = (await res.json().catch(() => null)) as { ok?: boolean; syncedAt?: string | null } | null;
    return out?.ok ? (out.syncedAt ?? null) : null;
  } catch {
    return null;
  }
}

const isFresh = (stamp: string | null | undefined): boolean => {
  if (!stamp) return false;
  const age = Date.now() - new Date(stamp).getTime();
  return Number.isFinite(age) && age < ICAL_FRESH_HOURS * 3600 * 1000;
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
  if (isFresh(row.ical_synced_at)) return { mode: "instant", reason: "ical-fresh" };

  // Stale or never synced — pull it now rather than losing the sale to a job
  // that isn't running. Costs the first viewer a fraction of a second, then the
  // stamp keeps every other viewer free for the next ICAL_FRESH_HOURS.
  const syncedAt = await refreshExternalCalendar(listingId);
  return isFresh(syncedAt) ? { mode: "instant", reason: "ical-fresh" } : { mode: "request", reason: "stale-ical" };
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
