/**
 * THE DATE HOLD — how long an unpaid booking keeps its dates (app REBUILD_PLAN
 * D5, founder 2026-10-21; transfer rule changed 2026-10-22). PURE, safe in
 * client components, and the one place the rule lives: the booking core
 * (lib/booking/create.ts) imports it for the website and the app alike.
 *
 *   card      30 minutes   Safepay's checkout is minutes of work; a card hold
 *                           that outlives the guest's attention only keeps the
 *                           dates from someone who would actually pay.
 *   transfer  until the    the guest has already sent the money and its
 *             team acts     screenshot. The team confirms within 30 minutes
 *                           (founder, 22 Oct: "make sure the booking doesn't
 *                           vanish if the rep or I am late"), so the hold runs
 *                           to the end of the stay and only verifying or
 *                           cancelling it ends it. Every transfer booking
 *                           carries its screenshot (the core refuses one
 *                           without), so this never holds dates for nothing.
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

/** How long a card checkout holds the dates. */
export const CARD_HOLD_MINUTES = 30;

/**
 * The website's proof that a card checkout is this browser's own: an httpOnly
 * cookie holding the booking id, set when the checkout opens and living as
 * long as its hold. A guest who comes back from Safepay unpaid (its cancel
 * button, or simply Back) releases their dates at once instead of waiting
 * out the 30 minutes (founder, 24 Oct). The app does the same through
 * POST /api/app/v1/trips/[id]/release.
 */
export const CARD_HOLD_COOKIE = "esker_card_hold";

/** The team's promise for checking a transfer screenshot (D7). */
export const TRANSFER_CONFIRM_MINUTES = 30;

/** Rows with no stamp (created before migration 24) expire as they always did. */
export const LEGACY_HOLD_MS = 18 * 60 * 60 * 1000;

/**
 * The expiry to stamp on a new unpaid booking, as an ISO instant. A transfer
 * holds to its check-out (12:00 PM PKT that day): past then the dates are
 * history, and before then only the team releases them.
 */
export function holdUntil(method: HoldMethod, checkout: string, now: Date = new Date()): string {
  if (method === "transfer") return new Date(`${checkout}T12:00:00+05:00`).toISOString();
  return new Date(now.getTime() + CARD_HOLD_MINUTES * 60_000).toISOString();
}

/** "30 minutes" — for the lines that tell a guest how long they have. */
export function minutesLabel(m: number): string {
  if (m % 60 !== 0) return `${m} minutes`;
  const h = m / 60;
  return `${h} ${h === 1 ? "hour" : "hours"}`;
}

/** What a guest is told about each method's hold, in one line each. */
export const HOLD_LINE: Record<HoldMethod, string> = {
  card: `We hold your dates for ${minutesLabel(CARD_HOLD_MINUTES)} while you pay.`,
  transfer: `We confirm transfers within ${minutesLabel(TRANSFER_CONFIRM_MINUTES)}, and your dates stay held until we do.`,
};

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
