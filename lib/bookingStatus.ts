// Guest-facing booking status vocabulary — one source of truth for the account
// hub (overview, trips, detail, timeline). Maps the CRM's internal statuses to
// friendly labels + a tone token + a position on the guest journey.

export type StatusTone = "warning" | "info" | "positive" | "muted" | "danger";

export const STATUS_LABEL: Record<string, string> = {
  in_progress: "Pending",
  awaiting_payment: "Awaiting verification",
  payment_collected: "Payment confirmed",
  handed_over: "Confirmed",
  awaiting_checkin: "Confirmed",
  currently_staying: "Staying now",
  checked_out: "Completed",
  cancelled: "Cancelled",
  needs_attention: "Needs attention",
};

export const STATUS_TONE: Record<string, StatusTone> = {
  in_progress: "muted",
  awaiting_payment: "warning",
  payment_collected: "info",
  handed_over: "info",
  awaiting_checkin: "info",
  currently_staying: "positive",
  checked_out: "muted",
  cancelled: "danger",
  needs_attention: "danger",
};

// Tailwind classes per tone for the small glowing status dot.
export const TONE_DOT: Record<StatusTone, string> = {
  warning: "bg-orange shadow-[0_0_8px_var(--color-orange,#E89F5C)]",
  info: "bg-blue shadow-[0_0_8px_var(--color-blue,#5E89D8)]",
  positive: "bg-green shadow-[0_0_8px_var(--color-green,#3FB68B)]",
  muted: "bg-dim",
  danger: "bg-red shadow-[0_0_8px_var(--color-red,#E76F6F)]",
};

export const TONE_TEXT: Record<StatusTone, string> = {
  warning: "text-orange",
  info: "text-blue",
  positive: "text-green",
  muted: "text-muted",
  danger: "text-red",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}
export function statusTone(status: string): StatusTone {
  return STATUS_TONE[status] ?? "muted";
}

// Ordered guest journey for the timeline stepper. Each internal status maps to a
// step index; cancelled is handled separately by the UI.
export const JOURNEY: { key: string; label: string; statuses: string[] }[] = [
  { key: "booked", label: "Booked", statuses: ["in_progress", "awaiting_payment"] },
  { key: "paid", label: "Advance confirmed", statuses: ["payment_collected"] },
  { key: "ready", label: "Ready for check-in", statuses: ["handed_over", "awaiting_checkin"] },
  { key: "staying", label: "Staying", statuses: ["currently_staying"] },
  { key: "done", label: "Completed", statuses: ["checked_out"] },
];

/** Index of the current journey step for a status (0-based), or -1 if not on it. */
export function journeyIndex(status: string): number {
  return JOURNEY.findIndex((s) => s.statuses.includes(status));
}
