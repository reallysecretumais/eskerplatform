import Link from "next/link";
import { ArrowRight, Building2, Plus, ShieldCheck, CalendarDays } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getHostStats, getHostIdVerified, getMyListings, getPayoutDetails, getHostBio, getHostAnalytics, type HostStay } from "@/lib/data/host";
import { HostIdVerify } from "@/components/host/HostIdVerify";
import { HostProfileCard } from "@/components/host/HostProfileCard";
import { HostAnalytics } from "@/components/host/HostAnalytics";
import { PayoutCard } from "@/components/host/PayoutCard";
import { ListingStatusBadge } from "@/components/host/ListingStatus";
import { StatusBadge } from "@/components/account/StatusBadge";
import { brand } from "@/lib/brand";
import { getListings, getMarkets } from "@/lib/data/listings";
import { citiesText, liveCities } from "@/lib/geo";
import { becomeHost } from "@/app/account/actions";
import { rs } from "@/lib/listings";

export const metadata = { title: "Hosting — Esker" };

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

export default async function HostHome() {
  const account = await requireAccount();
  if (!account.roles.includes("owner")) {
    // Live operating cities (launch fallback) — the pitch keeps itself current.
    const cities =
      citiesText(liveCities(await getListings(), await getMarkets())) || brand.launchCities.join(" & ");
    return <BecomeHost cities={cities} />;
  }

  const [stats, idVerified, listings, payout, bio, analytics] = await Promise.all([
    getHostStats(), getHostIdVerified(), getMyListings(), getPayoutDetails(), getHostBio(), getHostAnalytics(),
  ]);
  const ready = account.phoneVerified && idVerified;
  const firstName = account.name?.split(" ")[0] || "there";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="headline text-[30px] text-ink sm:text-[34px]">Hosting</h1>
          <p className="mt-1 text-sm text-muted">Welcome back, {firstName}.</p>
        </div>
        {ready && (
          <Link href="/host/listings/new" className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-warm transition-colors hover:bg-brand-pressed">
            <Plus size={15} /> New listing
          </Link>
        )}
      </div>

      {/* Verification gate — get both checks done before the first listing */}
      {!ready && (
        <div className="mt-6 space-y-4">
          <div className="rounded-[22px] bg-ice-tint p-5">
            <div className="flex items-center gap-2 text-base font-bold text-brand-ink">
              <ShieldCheck size={17} className="text-brand" /> Two quick steps before your first listing
            </div>
            <ol className="mt-3 space-y-2 text-sm">
              <Step done={account.phoneVerified} label="Verify your WhatsApp number" href={account.phoneVerified ? undefined : "/account/profile"} />
              <Step done={idVerified} label="Verify your CNIC (below)" />
            </ol>
          </div>
          {!idVerified && <HostIdVerify />}
        </div>
      )}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Listings" value={String(stats.listings)} sub={stats.listings ? `${stats.liveListings} live` : undefined} />
        <Stat label="Upcoming stays" value={String(stats.upcomingStays)} />
        <Stat label="This month" value={stats.monthValue ? rs(stats.monthValue) : "—"} sub={stats.monthCommission > 0 ? `Esker fee ${rs(stats.monthCommission)}` : undefined} />
      </div>

      {/* Listings snapshot */}
      {listings.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="headline text-2xl text-ink">Your listings</h2>
            <Link href="/host/listings" className="text-sm font-medium text-brand hover:text-brand-ink hover:underline">Manage all</Link>
          </div>
          <div className="space-y-3">
            {listings.slice(0, 3).map((l) => (
              <Link key={l.id} href={`/host/listings/${l.id}`} className="flex items-center gap-4 rounded-[22px] border border-line bg-surface p-3 transition hover:border-line-hi">
                <div className="h-14 shrink-0 overflow-hidden rounded-lg" style={{ width: 72, backgroundColor: "var(--color-surface-2)", backgroundImage: l.photos[0] ? `url(${l.photos[0]})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{l.title}</div>
                  <div className="text-xs text-muted">{[l.category, l.area].filter(Boolean).join(" · ")} · <span className="tnum">{rs(l.price)}</span> / night</div>
                </div>
                <ListingStatusBadge status={l.status} className="shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* How your listings are doing */}
      {analytics.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 headline text-2xl text-ink">How your listings are doing</h2>
          <HostAnalytics rows={analytics} />
        </section>
      )}

      {/* Upcoming stays */}
      <section className="mt-8">
        <h2 className="mb-3 headline text-2xl text-ink">Upcoming stays</h2>
        {stats.upcoming.length === 0 ? (
          <div className="rounded-[22px] border border-line bg-surface p-6 text-center text-sm text-muted">
            {listings.length === 0 ? "Your stays will appear here once your first listing is live." : "No upcoming stays yet — they'll appear here as guests book."}
          </div>
        ) : (
          <div className="space-y-3">
            {stats.upcoming.map((s) => (
              <StayRow key={s.id} s={s} />
            ))}
          </div>
        )}
      </section>

      {listings.length === 0 && ready && (
        <div className="mt-8 rounded-[22px] border border-line bg-surface p-8 text-center">
          <Building2 size={22} className="mx-auto text-brand" />
          <p className="mt-2 text-sm text-muted">You&apos;re verified and ready — list your first place.</p>
          <Link href="/host/listings/new" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-warm transition-colors hover:bg-brand-pressed">
            Create your listing <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* Your host profile (shown to guests) */}
      {ready && (
        <div className="mt-8">
          <HostProfileCard name={account.name} avatarUrl={account.avatarUrl} bio={bio} />
        </div>
      )}

      {/* Getting paid — optional, collapsed */}
      {ready && (
        <div className="mt-8">
          <PayoutCard initial={payout} />
        </div>
      )}
    </div>
  );
}

function Step({ done, label, href }: { done: boolean; label: string; href?: string }) {
  const inner = (
    <span className={`inline-flex items-center gap-2 ${done ? "text-green" : "text-ink"}`}>
      <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${done ? "bg-green/15 text-green" : "bg-surface-2 text-dim"}`}>{done ? "✓" : "•"}</span>
      {label}
      {href && !done && <ArrowRight size={13} className="text-brand" />}
    </span>
  );
  return <li>{href && !done ? <Link href={href} className="hover:underline">{inner}</Link> : inner}</li>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[22px] border border-line bg-surface p-4">
      <div className="tnum text-2xl font-bold text-ink">{value}</div>
      <div className="label mt-1 text-[10.5px] text-dim">{label}</div>
      {sub && <div className="tnum mt-0.5 text-[11px] text-dim">{sub}</div>}
    </div>
  );
}

function StayRow({ s }: { s: HostStay }) {
  return (
    <div className="flex items-center gap-4 rounded-[22px] border border-line bg-surface p-4">
      <CalendarDays size={18} className="shrink-0 text-dim" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{s.guestFirstName} · {s.listingTitle}</div>
        <div className="text-xs text-muted">
          <span className="tnum">{fmt(s.checkin)} – {fmt(s.checkout)}</span> · <span className="tnum">{s.nights ?? 0}</span> {s.nights === 1 ? "night" : "nights"} · <span className="tnum">{rs(s.amount)}</span>
        </div>
        <div className="mt-1"><StatusBadge status={s.status} /></div>
      </div>
    </div>
  );
}

function BecomeHost({ cities }: { cities: string }) {
  return (
    <div>
      <h1 className="headline text-[30px] text-ink sm:text-[34px]">Become an Esker host</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
        List your place with {brand.short} — free — and reach premium short-stay guests across {cities}.
        Same login you use now; switch between guest and host any time.
      </p>

      <ul className="mt-6 space-y-3">
        {[
          "Free to list — no charges to get started.",
          "You set your price, photos and description; we review and put it live.",
          "Guests book through Esker's trusted checkout — we verify every payment.",
        ].map((t) => (
          <li key={t} className="flex items-start gap-3 text-sm text-ink">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
            {t}
          </li>
        ))}
      </ul>

      <form action={becomeHost} className="mt-8">
        <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-warm transition-colors hover:bg-brand-pressed">
          Become a host <ArrowRight size={16} />
        </button>
      </form>
      <p className="mt-3 text-xs text-dim">This just unlocks your host space — nothing goes live until you add a listing and we approve it.</p>
    </div>
  );
}
