// Robust date formatting for the partner portal. Booking check-in/out are stored
// as full timestamps (timestamptz, e.g. "2026-07-10T07:29:00+00:00"); withdrawal
// and period fields may be plain "YYYY-MM-DD" dates. This parses either shape and
// renders the Asia/Karachi (PKT) calendar date, matching the CRM's convention.
export function pktDate(
  d: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
): string {
  if (!d) return "—";
  const iso = d.length <= 10 ? `${d}T00:00:00+05:00` : d;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-GB", { ...opts, timeZone: "Asia/Karachi" });
}
