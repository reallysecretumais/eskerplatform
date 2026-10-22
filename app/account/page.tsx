import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { requireAccount, getMyBookings, type MyBooking } from "@/lib/auth";
import { NextTripCard } from "@/components/account/NextTripCard";
import { StatusBadge } from "@/components/account/StatusBadge";
import { Avatar } from "@/components/account/Avatar";
import { thumb } from "@/lib/img";
import { rs } from "@/lib/listings";

export const metadata = { title: "Your account — Esker" };

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
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
          <h1 className="headline text-[34px] text-ink">Hi {firstName}</h1>
          <p className="mt-0.5 text-sm text-muted">Here&apos;s everything about your Esker stays, in one place.</p>
        </div>
      </div>

      {/* Verify nudge */}
      {!account.phoneVerified && (
        <Link href="/account/profile" className="mt-5 flex items-center gap-3 rounded-[22px] bg-ice-tint px-4 py-3 transition hover:bg-ice-band">
          <ShieldCheck size={18} className="text-brand-ink" />
          <span className="text-sm text-brand-ink">Verify your WhatsApp number for faster check-in and updates.</span>
          <ArrowRight size={15} className="ml-auto text-brand-ink" />
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
              <h2 className="mb-3 headline text-2xl text-ink">Your next stay</h2>
              <NextTripCard booking={next} />
            </section>
          )}

          {upcoming.length > 1 && (
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="headline text-2xl text-ink">More upcoming</h2>
                <Link href="/account/trips" className="text-sm font-semibold text-brand hover:text-brand-ink">All trips</Link>
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
                <h2 className="headline text-2xl text-ink">Past stays</h2>
                {past.length > 3 && <Link href="/account/trips" className="text-sm font-semibold text-brand hover:text-brand-ink">See all</Link>}
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
    <div className="rounded-[22px] border border-line bg-surface p-4">
      <div className="tnum text-2xl font-bold text-ink">{value}</div>
      <div className="label mt-1 text-[11px] text-dim">{label}</div>
    </div>
  );
}

function CompactRow({ b }: { b: MyBooking }) {
  const photo = b.listing?.photos?.[0];
  return (
    <Link href={`/account/bookings/${b.id}`} className="flex items-center gap-4 rounded-[22px] border border-line bg-surface p-3 transition hover:border-line-hi">
      <div className="h-14 shrink-0 overflow-hidden rounded-xl bg-surface-2" style={{ width: 72, backgroundImage: photo ? `url(${thumb(photo, 240, 65)})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{b.listing?.title ?? "Your stay"}</div>
        <div className="tnum text-xs text-muted">{fmt(b.checkin)} – {fmt(b.checkout)} · {rs(b.amount)}</div>
        <div className="mt-1"><StatusBadge status={b.status} /></div>
      </div>
      {b.balance > 0 && !isPast(b) && <span className="tnum shrink-0 text-xs font-semibold text-brand">{rs(b.balance)} due</span>}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 rounded-[22px] border border-line bg-surface p-8 text-center">
      <p className="text-sm text-muted">You have no bookings yet.</p>
      <Link href="/stays" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-warm transition hover:bg-brand-pressed">
        Browse stays <ArrowRight size={15} />
      </Link>
    </div>
  );
}
