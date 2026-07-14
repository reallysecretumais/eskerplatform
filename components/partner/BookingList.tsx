import { CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/account/StatusBadge";
import type { PartnerBooking } from "@/lib/data/partner";
import { pktDate } from "@/lib/partnerFormat";

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;
const fmt = (d: string | null) => pktDate(d);

// The month's bookings — dates, nights, amount, status. Guest identity is never
// shown (privacy): no names, CNIC, or payment proofs.
export function BookingList({ bookings }: { bookings: PartnerBooking[] }) {
  if (bookings.length === 0) {
    return <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">No bookings for this month.</div>;
  }
  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <div key={b.id} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
          <CalendarDays size={18} className="shrink-0 text-dim" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">
              {fmt(b.checkin)} – {fmt(b.checkout)}
              <span className="text-muted"> · {b.nights ?? 0} {b.nights === 1 ? "night" : "nights"}</span>
            </div>
            <div className="mt-1"><StatusBadge status={b.status} /></div>
          </div>
          <div className="shrink-0 font-display text-sm font-semibold text-ink tabular-nums">{pkr(b.amount)}</div>
        </div>
      ))}
    </div>
  );
}
