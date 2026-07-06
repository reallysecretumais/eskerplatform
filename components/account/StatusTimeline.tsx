import { Check, X } from "lucide-react";
import { JOURNEY, journeyIndex } from "@/lib/bookingStatus";

// Vertical status stepper for a booking's guest journey. Cancelled short-circuits
// to a single clear "Cancelled" state.
export function StatusTimeline({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red/30 bg-red/5 px-4 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red/15 text-red">
          <X size={14} />
        </span>
        <span className="text-sm font-medium text-red">This booking was cancelled</span>
      </div>
    );
  }

  const current = Math.max(0, journeyIndex(status));

  return (
    <ol className="relative">
      {JOURNEY.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const isLast = i === JOURNEY.length - 1;
        return (
          <li key={step.key} className="flex gap-3 pb-5 last:pb-0">
            <div className="relative flex flex-col items-center">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  done ? "bg-green/15 text-green" : active ? "bg-gold/15 text-gold-deep ring-2 ring-gold/30" : "bg-surface-2 text-dim"
                }`}
              >
                {done ? <Check size={13} /> : active ? <span className="h-1.5 w-1.5 rounded-full bg-gold-deep" /> : i + 1}
              </span>
              {!isLast && <span className={`mt-1 w-px flex-1 ${done ? "bg-green/40" : "bg-line"}`} />}
            </div>
            <div className={`pt-0.5 text-sm ${active ? "font-medium text-ink" : done ? "text-muted" : "text-dim"}`}>{step.label}</div>
          </li>
        );
      })}
    </ol>
  );
}
