import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { getMyBookings, type MyBooking } from "@/lib/auth";
import { StatusBadge } from "@/components/account/StatusBadge";
import { thumb } from "@/lib/img";

export const metadata = { title: "Your trips — Esker" };

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;
const isPast = (b: MyBooking) => b.status === "checked_out" || b.status === "cancelled";

export default async function TripsPage() {
  const bookings = await getMyBookings();
  const upcoming = bookings.filter((b) => !isPast(b)).sort((a, b) => (a.checkin ?? "").localeCompare(b.checkin ?? ""));
  const past = bookings.filter(isPast);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Your trips</h1>

      {bookings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-sm text-muted">No bookings yet.</p>
          <Link href="/stays" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90">
            Browse stays <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <>
          <Section title="Upcoming" rows={upcoming} empty="No upcoming stays." />
          <Section title="Past" rows={past} empty="No past stays yet." />
        </>
      )}
    </div>
  );
}

function Section({ title, rows, empty }: { title: string; rows: MyBooking[]; empty: string }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-dim">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <Row key={b.id} b={b} />
          ))}
        </div>
      )}
    </section>
  );
}

function Row({ b }: { b: MyBooking }) {
  const photo = b.listing?.photos?.[0];
  const loc = [b.listing?.category, b.listing?.area].filter(Boolean).join(" · ");
  return (
    <Link href={`/account/bookings/${b.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 transition hover:border-line-hi">
      <div className="h-16 shrink-0 overflow-hidden rounded-lg" style={{ width: 88, backgroundColor: "#e7e1d6", backgroundImage: photo ? `url(${thumb(photo, 280, 65)})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{b.listing?.title ?? "Your stay"}</div>
        {loc && <div className="truncate text-xs text-dim">{loc}</div>}
        <div className="text-xs text-muted">{fmt(b.checkin)} – {fmt(b.checkout)} · {pkr(b.amount)}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge status={b.status} />
          {b.status === "checked_out" && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gold-deep">
              <Star size={12} className="fill-gold text-gold" /> Rate your stay
            </span>
          )}
        </div>
      </div>
      {b.balance > 0 && !isPast(b) && (
        <div className="shrink-0 text-right">
          <div className="text-[11px] uppercase tracking-wider text-dim">Balance</div>
          <div className="font-display text-sm font-semibold text-gold-deep tabular-nums">{pkr(b.balance)}</div>
        </div>
      )}
    </Link>
  );
}
