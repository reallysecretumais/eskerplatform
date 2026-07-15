import type { PartnerBooking } from "@/lib/data/partner";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// A read-only month occupancy calendar for the viewed month. Privacy-safe: it
// only shows which nights are booked (no guest identity). Pure server render —
// no client JS, nothing to hydrate. Arrival nights are marked solid; the rest of
// a stay is a lighter trail. Check-out mornings aren't nights, so they stay open.
export function BookingCalendar({ month, bookings }: { month: string; bookings: PartnerBooking[] }) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0=Sun
  const lead = (firstDow + 6) % 7; // Monday-first offset
  const todayStr = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10); // PKT today

  const ranges = bookings
    .filter((b) => b.checkin && b.checkout)
    .map((b) => ({ ci: b.checkin!.slice(0, 10), co: b.checkout!.slice(0, 10) }));

  const nights = bookings.reduce((s, b) => s + (Number.isFinite(b.nightsInMonth) ? b.nightsInMonth : 0), 0);

  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-dim">Calendar</div>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="tabular-nums">{nights} {nights === 1 ? "night" : "nights"} booked</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-gold-deep" /> Occupied</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-dim">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} className="h-9" />;
          const ds = `${month}-${String(d).padStart(2, "0")}`;
          let occupied = false;
          let isArrival = false;
          for (const r of ranges) {
            if (r.ci <= ds && ds < r.co) occupied = true;
            if (r.ci === ds) isArrival = true;
          }
          const isToday = ds === todayStr;
          const tone = occupied
            ? isArrival
              ? "bg-gold-deep font-medium text-white"
              : "bg-gold/20 text-ink"
            : "text-muted";
          return (
            <div
              key={d}
              className={`flex h-9 items-center justify-center rounded-lg text-[12.5px] tabular-nums ${tone} ${isToday ? "ring-1 ring-gold-deep" : ""}`}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}
