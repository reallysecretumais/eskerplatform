import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExternal, type PublicListing } from "@/lib/data/listings";

/**
 * AVAILABILITY IS THREE-VALUED, and every public surface used to flatten it to
 * two.
 *
 * `freeTonight` meant "no busy row covers tonight". For a stay Esker runs that
 * is the truth — we own the calendar, so silence means free. For a resold unit
 * whose owner has never linked a calendar, silence means we have *no idea*, and
 * calling it free is how the app came to say "17 open tonight" out of twenty
 * when most of those twenty were guesses.
 *
 *   confirmed  — we can stand behind it
 *   busy       — we know it is gone
 *   unknown    — nobody has told us, and we must not pretend otherwise
 *
 * WHERE CONFIDENCE COMES FROM, strongest first:
 *
 *  1. It is ours. Internal stock has a calendar we control; no busy row IS the
 *     answer.
 *  2. A synced owner calendar. `external_properties.ical_synced_at` is stamped
 *     only on a SUCCESSFUL sync, so an empty calendar that synced fine still
 *     counts — never infer freshness from row count.
 *  3. The owner said so. A WhatsApp "Available" tap in
 *     `external_availability_checks`, still inside its trust window and
 *     covering the date in question.
 *
 * THE ANSWER IS SHARED. Previously an owner's reply only ever reached the one
 * guest who triggered it: the CRM pinged the Platform, which matched the reply
 * to a row in `external_date_requests` and no-opped when there wasn't one — so
 * every staff-initiated ask improved nothing a visitor could see. Reading the
 * CRM's own table instead means one answer serves everyone for its window,
 * which is the whole point of asking owners less often rather than more.
 *
 * Both apps share one Postgres, so this reads the CRM's table directly rather
 * than mirroring it. A second copy of a fact is a second chance to disagree.
 */

/** Fresh enough to sell against: matches the CRM's iCal rule exactly. */
export const ICAL_FRESH_HOURS = 12;
/** How long an owner's tap is trusted. Matches the CRM's reply window. */
export const TAP_TRUST_HOURS = 48;
/**
 * Inside this, a signal is strong enough to take money on the spot; beyond it
 * the listing still SHOWS as available but the guest goes through
 * request-to-book while we re-confirm. See the ladder in
 * AVAILABILITY_TRUTH_PLAN.md — time is a proxy for "has something happened
 * since", and the shorter the gap the safer the assumption.
 */
export const INSTANT_HOURS = 12;

export type Confidence = "confirmed" | "busy" | "unknown";

export type ListingConfidence = {
  state: Confidence;
  /** True only when the signal is fresh enough to book without re-asking. */
  instant: boolean;
};

type Signals = {
  /** Listing ids whose owner calendar synced within ICAL_FRESH_HOURS. */
  icalFresh: Map<string, number>;
  /** Listing id → age in ms of the freshest "available" tap covering the date. */
  tapped: Map<string, number>;
};

/**
 * One round trip for both external signals, for every listing at once.
 *
 * Deliberately NOT per-listing: the grid asks about twenty listings on every
 * render, and a per-listing call is how a home screen turns into forty queries.
 */
async function loadSignals(dateIso: string): Promise<Signals> {
  const admin = createAdminClient();
  const now = Date.now();
  const tapCutoff = new Date(now - TAP_TRUST_HOURS * 3600_000).toISOString();

  const [props, checks] = await Promise.all([
    admin.from("external_properties").select("id, ical_synced_at"),
    admin
      .from("external_availability_checks")
      .select("external_property_id, responded_at, checkin, checkout")
      .eq("status", "available")
      .gte("responded_at", tapCutoff)
      .order("responded_at", { ascending: false }),
  ]);

  const icalFresh = new Map<string, number>();
  for (const r of (props.data ?? []) as { id: string; ical_synced_at: string | null }[]) {
    if (!r.ical_synced_at) continue;
    const age = now - new Date(r.ical_synced_at).getTime();
    if (Number.isFinite(age) && age >= 0 && age < ICAL_FRESH_HOURS * 3600_000) icalFresh.set(r.id, age);
  }

  const tapped = new Map<string, number>();
  type Row = { external_property_id: string; responded_at: string; checkin: string | null; checkout: string | null };
  for (const r of (checks.data ?? []) as Row[]) {
    // A tap answers the dates it was ASKED about and nothing else. An owner who
    // said "free this weekend" has said nothing whatsoever about next Tuesday,
    // and treating the answer as general is exactly the error this file exists
    // to remove.
    if (!coversDate(r.checkin, r.checkout, dateIso)) continue;
    const age = now - new Date(r.responded_at).getTime();
    if (!Number.isFinite(age) || age < 0) continue;
    // Ordered newest-first, so the first hit for a property is its freshest.
    if (!tapped.has(r.external_property_id)) tapped.set(r.external_property_id, age);
  }

  return { icalFresh, tapped };
}

/** Does a tap's asked-about range cover this date? Checkout is exclusive — the
 *  morning a guest leaves is a night the place is free again. */
function coversDate(checkin: string | null, checkout: string | null, dateIso: string): boolean {
  if (!checkin || !checkout) return false;
  const ci = checkin.slice(0, 10);
  const co = checkout.slice(0, 10);
  return ci <= dateIso && dateIso < co;
}

/**
 * Confidence for every listing on a given date, in one pass.
 *
 * `busyIds` is the set already known to be taken from `public_availability` —
 * computed by the caller, which has it to hand.
 */
export async function confidenceFor(
  listings: PublicListing[],
  dateIso: string,
  isBusy: (l: PublicListing) => boolean,
): Promise<Map<string, ListingConfidence>> {
  const externals = listings.filter(isExternal);
  // Nothing external in this market: every answer is already known, so don't
  // pay for the signal queries at all.
  const signals = externals.length
    ? await loadSignals(dateIso)
    : { icalFresh: new Map<string, number>(), tapped: new Map<string, number>() };

  const out = new Map<string, ListingConfidence>();
  for (const l of listings) {
    if (isBusy(l)) {
      out.set(l.id, { state: "busy", instant: false });
      continue;
    }
    if (!isExternal(l)) {
      // Ours. We hold the calendar, so an empty night is a free night.
      out.set(l.id, { state: "confirmed", instant: true });
      continue;
    }
    const ical = signals.icalFresh.get(l.id);
    if (ical !== undefined) {
      out.set(l.id, { state: "confirmed", instant: true });
      continue;
    }
    const tap = signals.tapped.get(l.id);
    if (tap !== undefined) {
      out.set(l.id, { state: "confirmed", instant: tap < INSTANT_HOURS * 3600_000 });
      continue;
    }
    out.set(l.id, { state: "unknown", instant: false });
  }
  return out;
}
