/**
 * The Asia/Karachi calendar date — PURE, safe in client components, and the one
 * helper for it.
 *
 * `bookings.checkin`/`checkout` are `timestamptz`, so they come back as full
 * instants ("2026-10-22T00:00:00+00:00", or 09:00Z for a CRM 2 PM check-in).
 * Code that treats them as "YYYY-MM-DD" breaks quietly: `${checkin}T00:00:00`
 * is an Invalid Date, which once made every guest self-cancel fall into the
 * non-refundable tier. Slicing the first ten characters reads the UTC day,
 * which is the previous Pakistani day for anything before 05:00 PKT.
 */
const FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" });

/** "2026-10-22" for a plain date or any timestamp; the Pakistani day it falls on. */
export function pkDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value.slice(0, 10) : FMT.format(d);
}

/** Today in Karachi, "YYYY-MM-DD". */
export function pkToday(now: Date = new Date()): string {
  return FMT.format(now);
}
