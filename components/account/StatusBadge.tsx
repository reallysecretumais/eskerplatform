import { statusLabel, statusTone, TONE_DOT, TONE_TEXT } from "@/lib/bookingStatus";

// Small glowing-dot status pill — quiet, premium, not a loud badge.
export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const tone = statusTone(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${TONE_TEXT[tone]} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />
      {statusLabel(status)}
    </span>
  );
}
