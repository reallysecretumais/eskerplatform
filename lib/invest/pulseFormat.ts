/**
 * The live line's shape and its wording — pure, so the client component that
 * renders it can import this while `lib/invest/pulse.ts` stays server-only.
 */
export type Pulse = { lastBookingAt: string | null; inboundMessages7d: number };

/** "47 minutes ago", "2 hours ago", "yesterday". */
export function ago(iso: string, now = Date.now()): string {
  const mins = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
