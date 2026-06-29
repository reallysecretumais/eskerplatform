import Link from "next/link";
import { Sparkles, ShieldCheck, Star, Clock, Wallet, Headphones, ArrowRight } from "lucide-react";
import { brand } from "@/lib/brand";
import { SiteNav } from "@/components/SiteNav";
import { ConciergeSearch } from "@/components/ConciergeSearch";
import { CategoryShowcase } from "@/components/CategoryShowcase";
import { StayCard } from "@/components/StayCard";
import { HeroCollage } from "@/components/HeroCollage";
import { getListings, pickCollagePhotos } from "@/lib/data/listings";
import { getAccount } from "@/lib/auth";

// Homepage — now reads LIVE from the database (public_listings). Real photos
// lead the cross-fading hero; real Esker Exclusive listings sell the inventory.
// Renders gracefully when there are few/no public listings yet.

const TRUST = [
  { Icon: ShieldCheck, text: "Verified, managed stays" },
  { Icon: Star, text: "Esker Exclusive guarantee" },
  { Icon: Clock, text: "Fast local support" },
];

const WHY = [
  { Icon: ShieldCheck, title: "Professionally managed", body: "Every Esker Exclusive stay is inspected and run to a guaranteed standard." },
  { Icon: Wallet, title: "Easy local payment", body: "Pay the way you already do — Easypaisa, JazzCash, or bank transfer." },
  { Icon: Headphones, title: "Real human support", body: "Quick, friendly help before, during, and after your stay." },
];

export default async function HomePage() {
  const listings = await getListings();
  const collagePhotos = pickCollagePhotos(listings, 8, 18);
  const account = await getAccount();

  // Showcase the best first: Exclusive, then those with photos, then priciest.
  const featured = [...listings].sort(
    (a, b) =>
      Number(b.esker_exclusive) - Number(a.esker_exclusive) ||
      (b.photos?.length ? 1 : 0) - (a.photos?.length ? 1 : 0) ||
      b.price - a.price,
  );

  return (
    <main className="min-h-full">
      {/* ── Hero: concierge fused with cross-fading real photography ── */}
      <section className="relative isolate flex min-h-[92vh] flex-col overflow-hidden bg-ink text-white">
        {/* Living photo-wall of the property's top photos */}
        <HeroCollage photos={collagePhotos} />

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
          <SiteNav account={account} />

          <div className="rise mx-auto my-auto max-w-2xl py-12 text-center">
            <div className="mb-5 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.22em] text-gold">
              <Sparkles size={14} />
              AI concierge
            </div>
            <h1 className="font-display text-[2.1rem] font-semibold leading-[1.1] tracking-tight drop-shadow-sm sm:text-5xl lg:text-6xl">
              Where would you like to stay?
            </h1>
            <p className="mx-auto mt-4 max-w-md text-white/80">
              Describe it in your own words — even in Roman Urdu. We&apos;ll find
              the right place from real, available stays.
            </p>

            <div className="mt-8">
              <ConciergeSearch listings={listings} />
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/75">
              {TRUST.map(({ Icon, text }) => (
                <span key={text} className="inline-flex items-center gap-1.5">
                  <Icon size={14} className="text-gold" /> {text}
                </span>
              ))}
            </div>

            <p className="mt-5 text-xs text-white/65">
              Now in {brand.launchCities.join(" & ")} · {brand.expansionNote}
            </p>
          </div>
        </div>
      </section>

      {/* ── Esker Exclusive — real listings from the DB ───────────── */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-12 pt-16">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{brand.exclusiveTier}</h2>
            <Link href="/stays" className="flex items-center gap-1 text-sm text-muted hover:text-ink">
              Explore all stays <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {featured.map((l) => (
              <StayCard
                key={l.id}
                title={l.title}
                category={l.category ?? "Stay"}
                area={l.area ?? ""}
                price={l.price}
                exclusive={l.esker_exclusive}
                photo={l.photos?.[0] ?? undefined}
                href={`/stays/${l.id}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Browse by category — visual showcase ──────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-14 pt-4">
        <h2 className="mb-5 font-display text-2xl font-semibold tracking-tight text-ink">Browse by category</h2>
        <CategoryShowcase />
      </section>

      {/* ── Why Esker — trust strip ──────────────────────────────── */}
      <section className="border-y border-line bg-surface-2/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-12 sm:grid-cols-3">
          {WHY.map(({ Icon, title, body }) => (
            <div key={title} className="flex gap-3.5">
              <Icon size={22} className="mt-0.5 shrink-0 text-gold" strokeWidth={1.5} />
              <div>
                <div className="text-sm font-medium text-ink">{title}</div>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-display text-lg font-bold tracking-tight text-ink">{brand.name}</span>
            <p className="mt-1">{brand.tagline}</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/stays" className="hover:text-ink">Browse all stays</Link>
            <Link href="/stays?tier=exclusive" className="hover:text-ink">{brand.exclusiveTier}</Link>
            <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
            <Link href="/legal/cancellation" className="hover:text-ink">Cancellation</Link>
            <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
