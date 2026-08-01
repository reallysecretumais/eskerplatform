import "server-only";
import { unstable_cache } from "next/cache";
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

/**
 * HOW LONG AN OWNER'S ANSWER IS TRUSTED, by how far away the night is.
 *
 * A flat 48h treats "is tonight free?" and "is a night in October free?" as the
 * same question, and they are not. The risk being priced is *something has
 * happened since* — and the nearer the night, the faster it moves: tonight can
 * be sold in the next hour, whereas a night ten weeks out rarely changes in a
 * week. A single window therefore either expires far-future answers pointlessly
 * (re-asking owners about October every two days is how you get ignored) or
 * trusts imminent ones too long.
 *
 * Three rungs, capped deliberately low. The founder's brief was "longer for
 * distant dates, but not way too long", and a week is where that lands: long
 * enough to stop pestering, short enough that no promise outlives the owner's
 * memory of making it.
 */
export const TRUST_HOURS = { near: 48, mid: 96, far: 168 } as const;
/** Nights within this many days are "near" — the fast-moving end. */
const NEAR_DAYS = 7;
/** Beyond this many days out, a night is "far" and moves slowly. */
const FAR_DAYS = 30;

/** The trust window for an answer about a night `leadDays` from today. */
export function trustHoursFor(leadDays: number): number {
  if (leadDays <= NEAR_DAYS) return TRUST_HOURS.near;
  if (leadDays <= FAR_DAYS) return TRUST_HOURS.mid;
  return TRUST_HOURS.far;
}

/** Widest window we ever need to fetch — narrowed per night after loading. */
const MAX_TRUST_HOURS = TRUST_HOURS.far;
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
  /**
   * Listing id → the owner's MOST RECENT answer covering this night, if it is
   * still inside that night's trust window.
   *
   * Most recent, not "any yes" and not "any no". Both directions matter:
   *
   * A "no" has to be read at all, or revocation does nothing. If a refusal only
   * removed the yes, the listing would fall to "unknown" — and a fresh iCal
   * would promote it straight back to available. The owner would have done
   * exactly what we asked and watched nothing happen, which is how you train
   * someone to stop bothering.
   *
   * But a "no" must not be permanent either. An owner whose guest cancels can
   * tell us it is free again, and that later yes has to win. Ordering by answer
   * time and taking the first hit gets both, and needs no special-casing.
   */
  answer: Map<string, { available: boolean; ageMs: number }>;
};

/** Raw signal rows, cacheable: plain JSON, no ages baked in, no date resolved. */
type SignalRows = {
  icalSynced: { id: string; at: string }[];
  checks: {
    external_property_id: string;
    status: string;
    responded_at: string;
    checkin: string | null;
    checkout: string | null;
  }[];
};

/** Busted by lib/cache.ts bustAvailabilitySignals() — keep the literal in step. */

/**
 * The two signal queries, cached for a minute and busted the moment an owner
 * answers.
 *
 * Uncached, every surface that calls getInventory — the grid, the greeting,
 * the corridor, the tonight world — ran both queries per request, so a single
 * app open paid for the same two queries four times over. The rows are cached
 * RAW: date-independent (constant key, widest trust window) with ages and
 * per-night trust applied afterwards, so one entry serves every date callers
 * ask about and never serves a stale clock.
 *
 * Sixty seconds is the CEILING on staleness, not the norm. The CRM already
 * pings `/api/platform/availability-replied` on every owner reply, and that
 * handler busts this tag — an owner's tap reaches every public surface within
 * seconds, and the cache only absorbs the traffic in between.
 */
const cachedSignalRows = unstable_cache(
  async (): Promise<SignalRows> => {
    const admin = createAdminClient();
    const tapCutoff = new Date(Date.now() - MAX_TRUST_HOURS * 3600_000).toISOString();

    const [props, checks] = await Promise.all([
      admin.from("external_properties").select("id, ical_synced_at"),
      // BOTH answers, not just the yeses. A "no" is a stronger signal than a
      // "yes" and has to be read, or revocation silently does nothing.
      admin
        .from("external_availability_checks")
        .select("external_property_id, status, responded_at, checkin, checkout")
        .in("status", ["available", "unavailable"])
        .gte("responded_at", tapCutoff)
        .order("responded_at", { ascending: false }),
    ]);

    return {
      icalSynced: ((props.data ?? []) as { id: string; ical_synced_at: string | null }[])
        .filter((r) => r.ical_synced_at)
        .map((r) => ({ id: r.id, at: r.ical_synced_at as string })),
      checks: (checks.data ?? []) as SignalRows["checks"],
    };
  },
  ["availability-signals"],
  { tags: ["availability-signals"], revalidate: 60 },
);

async function loadSignals(dateIso: string, leadDays: number): Promise<Signals> {
  const now = Date.now();
  const trustMs = trustHoursFor(leadDays) * 3600_000;
  const { icalSynced, checks } = await cachedSignalRows();

  const icalFresh = new Map<string, number>();
  for (const r of icalSynced) {
    const age = now - new Date(r.at).getTime();
    if (Number.isFinite(age) && age >= 0 && age < ICAL_FRESH_HOURS * 3600_000) icalFresh.set(r.id, age);
  }

  const answer = new Map<string, { available: boolean; ageMs: number }>();
  for (const r of checks) {
    // An answer speaks for the dates it was ASKED about and nothing else. An
    // owner who said "free this weekend" has said nothing whatsoever about next
    // Tuesday, and treating the answer as general is the same error this file
    // exists to remove, one layer down.
    if (!coversDate(r.checkin, r.checkout, dateIso)) continue;
    const age = now - new Date(r.responded_at).getTime();
    if (!Number.isFinite(age) || age < 0 || age > trustMs) continue;
    // Rows arrive newest-first, so the first hit IS the owner's latest word on
    // this night — whichever way it went.
    if (!answer.has(r.external_property_id)) {
      answer.set(r.external_property_id, { available: r.status === "available", ageMs: age });
    }
  }

  return { icalFresh, answer };
}

/**
 * The Asia/Karachi calendar date of a timestamp.
 *
 * `checkin`/`checkout` on a check are `timestamptz`, so they come back as UTC.
 * Slicing the first ten characters reads the UTC date, which is a different day
 * from the Pakistani one for any moment before 05:00 PKT — a check-in stored as
 * 00:30 PKT is 19:30Z the PREVIOUS day, and the range would silently start a
 * day early. Check-ins are normally 4pm so this rarely bites, but "rarely" is
 * how a wrong night gets sold.
 */
const pkDate = (iso: string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date(iso));

/** Today in Karachi. Local to this file so the trust ladder can measure lead
 *  time without importing the inventory module and creating a cycle. */
const todayIso = (): string => pkDate(new Date().toISOString());

/** Does a tap's asked-about range cover this date? Checkout is exclusive — the
 *  morning a guest leaves is a night the place is free again. */
function coversDate(checkin: string | null, checkout: string | null, dateIso: string): boolean {
  if (!checkin || !checkout) return false;
  return pkDate(checkin) <= dateIso && dateIso < pkDate(checkout);
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
  // How far out this night is, in whole days — picks the trust rung.
  const leadDays = Math.max(
    0,
    Math.round((Date.parse(`${dateIso}T00:00:00+05:00`) - Date.parse(`${todayIso()}T00:00:00+05:00`)) / 86_400_000),
  );
  // Nothing external in this market: every answer is already known, so don't
  // pay for the signal queries at all.
  const signals: Signals = externals.length
    ? await loadSignals(dateIso, leadDays)
    : { icalFresh: new Map(), answer: new Map() };

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
    // The owner's latest word outranks every other signal, including a calendar
    // that synced ten minutes ago — they know what their calendar has not caught
    // up with yet. See `Signals.answer`.
    const said = signals.answer.get(l.id);
    if (said && !said.available) {
      out.set(l.id, { state: "busy", instant: false });
      continue;
    }
    if (signals.icalFresh.has(l.id)) {
      out.set(l.id, { state: "confirmed", instant: true });
      continue;
    }
    if (said) {
      out.set(l.id, { state: "confirmed", instant: said.ageMs < INSTANT_HOURS * 3600_000 });
      continue;
    }
    out.set(l.id, { state: "unknown", instant: false });
  }
  return out;
}
