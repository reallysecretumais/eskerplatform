import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { requireAccount, getMyBookings, type MyBooking } from "@/lib/auth";
import { NextTripCard } from "@/components/account/NextTripCard";
import { StatusBadge } from "@/components/account/StatusBadge";
import { Avatar } from "@/components/account/Avatar";
import { thumb } from "@/lib/img";

export const metadata = { title: "Your account — Esker" };

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;
const isPast = (b: MyBooking) => b.status === "checked_out" || b.status === "cancelled";

export default async function AccountOverview() {
  const account = await requireAccount();
  const bookings = await getMyBookings();

  const upcoming = bookings.filter((b) => !isPast(b)).sort((a, b) => (a.checkin ?? "").localeCompare(b.checkin ?? ""));
  const past = bookings.filter(isPast);
  const nights = bookings.filter((b) => b.status === "checked_out").reduce((n, b) => n + (b.nights ?? 0), 0);
  const next = upcoming[0];
  const firstName = account.name?.split(" ")[0] || "there";

  return (
    <div>
      <div className="flex items-center gap-4">
        <Avatar name={account.name} src={account.avatarUrl} size={52} className="shrink-0" />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Hi {firstName}</h1>
          <p className="mt-0.5 text-sm text-muted">Here&apos;s everything about your Esker stays, in one place.</p>
        </div>
      </div>

      {/* Verify nudge */}
      {!account.phoneVerified && (
        <Link href="/account/profile" className="mt-5 flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 transition hover:bg-gold/10">
          <ShieldCheck size={18} className="text-gold-deep" />
          <span className="text-sm text-ink">Verify your WhatsApp number for faster check-in and updates.</span>
          <ArrowRight size={15} className="ml-auto text-gold-deep" />
        </Link>
      )}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Upcoming" value={String(upcoming.length)} />
        <Stat label="Completed" value={String(past.filter((b) => b.status === "checked_out").length)} />
        <Stat label="Nights stayed" value={String(nights)} />
      </div>

      {bookings.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {next && (
            <section className="mt-8">
              <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">Your next stay</h2>
              <NextTripCard booking={next} />
            </section>
          )}

          {upcoming.length > 1 && (
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold tracking-tight text-ink">More upcoming</h2>
                <Link href="/account/trips" className="text-sm text-gold-deep hover:underline">All trips</Link>
              </div>
              <div className="space-y-3">
                {upcoming.slice(1, 4).map((b) => (
                  <CompactRow key={b.id} b={b} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Past stays</h2>
                {past.length > 3 && <Link href="/account/trips" className="text-sm text-gold-deep hover:underline">See all</Link>}
              </div>
              <div className="space-y-3">
                {past.slice(0, 3).map((b) => (
                  <CompactRow key={b.id} b={b} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="font-display text-2xl font-semibold text-ink tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wider text-dim">{label}</div>
    </div>
  );
}

function CompactRow({ b }: { b: MyBooking }) {
  const photo = b.listing?.photos?.[0];
  return (
    <Link href={`/account/bookings/${b.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 transition hover:border-line-hi">
      <div className="h-14 shrink-0 overflow-hidden rounded-lg" style={{ width: 72, backgroundColor: "#e7e1d6", backgroundImage: photo ? `url(${thumb(photo, 240, 65)})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{b.listing?.title ?? "Your stay"}</div>
        <div className="text-xs text-muted">{fmt(b.checkin)} – {fmt(b.checkout)} · {pkr(b.amount)}</div>
        <div className="mt-1"><StatusBadge status={b.status} /></div>
      </div>
      {b.balance > 0 && !isPast(b) && <span className="shrink-0 text-xs font-medium text-gold-deep tabular-nums">{pkr(b.balance)} due</span>}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
      <p className="text-sm text-muted">You have no bookings yet.</p>
      <Link href="/stays" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90">
        Browse stays <ArrowRight size={15} />
      </Link>
    </div>
  );
}
