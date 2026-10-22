import { Eye, MessageCircle, CalendarCheck } from "lucide-react";
import type { ListingAnalytics } from "@/lib/data/host";

// Compact per-listing performance rows for the host dashboard: 30-day views (with
// all-time), inquiries (guest chats), and bookings.
export function HostAnalytics({ rows }: { rows: ListingAnalytics[] }) {
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.listingId} className="flex items-center gap-4 rounded-[22px] border border-line bg-surface p-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{r.title}</div>
            <div className="label text-[10.5px] text-dim">{r.status === "live" ? "Live" : r.status}</div>
          </div>
          <Metric icon={<Eye size={14} />} value={r.views30} label="views · 30d" sub={r.views > r.views30 ? `${r.views} all-time` : undefined} />
          <Metric icon={<MessageCircle size={14} />} value={r.inquiries} label={r.inquiries === 1 ? "inquiry" : "inquiries"} />
          <Metric icon={<CalendarCheck size={14} />} value={r.bookings} label={r.bookings === 1 ? "booking" : "bookings"} />
        </div>
      ))}
    </div>
  );
}

function Metric({ icon, value, label, sub }: { icon: React.ReactNode; value: number; label: string; sub?: string }) {
  return (
    <div className="shrink-0 text-center">
      <div className="tnum flex items-center justify-center gap-1 text-lg font-bold text-ink">
        <span className="text-brand">{icon}</span>
        {value}
      </div>
      <div className="label text-[9.5px] text-dim">{label}</div>
      {sub && <div className="tnum text-[10px] text-dim">{sub}</div>}
    </div>
  );
}
