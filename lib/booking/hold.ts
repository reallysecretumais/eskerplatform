/**
 * THE DATE HOLD — how long an unpaid booking keeps its dates (app REBUILD_PLAN
 * D5, founder 2026-10-21). PURE, safe in client components, and the one place
 * the durations live: the website's createBooking and the app's Phase 2
 * booking routes both import it.
 *
 *   card      30 minutes  Safepay's checkout is minutes of work; a card hold
 *                          that outlives the guest's attention only keeps the
 *                          dates from someone who would actually pay.
 *   transfer  18 hours    a bank transfer needs the guest's banking app and
 *                          our team's eyes on the screenshot.
 *
 * HOW IT IS ENFORCED. The booking is STAMPED with its expiry (`bookings.
 * hold_until`, migration 24) when it is created, and everything that asks
 * "does this booking still block?" reads the stamp rather than recomputing a
 * duration: the public availability windows in SQL, and `blocksDates` below in
 * the booking core's clash check. So a change to a duration here never
 * re-times a hold already given, and SQL and TypeScript cannot disagree.
 *
 * Only UNPAID WEBSITE bookings expire (status awaiting_payment, source
 * Website). Staff holds, the CRM's own bookings and anything paid block until
 * they are cancelled, exactly as before.
 *
 * Rows created before migration 24 have no stamp and keep the old rule —
 * 18 hours from creation — via LEGACY_HOLD_MS, mirrored in the views'
 * `coalesce(hold_until, created_at + interval '18 hours')`.
 */

export type HoldMethod = "card" | "transfer";

export const HOLD_MINUTES: Record<HoldMethod, number> = {
  card: 30,
  transfer: 18 * 60,
};

/** Rows with no stamp (created before migration 24) expire as they always did. */
export const LEGACY_HOLD_MS = 18 * 60 * 60 * 1000;

/** The expiry to stamp on a new unpaid booking, as an ISO instant. */
export function holdUntil(method: HoldMethod, now: Date = new Date()): string {
  return new Date(now.getTime() + HOLD_MINUTES[method] * 60_000).toISOString();
}

/** "30 minutes" · "18 hours" — for the lines that tell a guest how long they have. */
export function holdLabel(method: HoldMethod): string {
  const m = HOLD_MINUTES[method];
  if (m % 60 !== 0) return `${m} minutes`;
  const h = m / 60;
  return `${h} ${h === 1 ? "hour" : "hours"}`;
}

type BookingRow = {
  status: string | null;
  source: string | null;
  created_at: string | null;
  hold_until?: string | null;
};

/** Is this an unpaid website booking, the only kind whose hold expires? */
export function isExpiringHold(b: Pick<BookingRow, "status" | "source">): boolean {
  return b.status === "awaiting_payment" && (b.source ?? "") === "Website";
}

/**
 * Does this (live, not-lost) booking still keep its dates from other guests?
 * The TypeScript twin of the availability views' hold clause.
 */
export function blocksDates(b: BookingRow, now: number = Date.now()): boolean {
  if (!isExpiringHold(b)) return true;
  const until = b.hold_until
    ? new Date(b.hold_until).getTime()
    : new Date(b.created_at ?? 0).getTime() + LEGACY_HOLD_MS;
  return until > now;
}
