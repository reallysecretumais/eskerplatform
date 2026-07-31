import type { Metadata } from "next";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { StayCard } from "@/components/StayCard";
import { ConciergeStream } from "@/components/ConciergeStream";
import { getListings, getMarkets, slimListings } from "@/lib/data/listings";
import { getAccount } from "@/lib/auth";
import { getWebsiteAi } from "@/lib/settings";
import { normalizeCategory } from "@/lib/listings";
import { activeMarkets, citiesText, liveCities } from "@/lib/geo";
import { brand } from "@/lib/brand";

type SP = { q?: string; area?: string; category?: string; amenity?: string; tier?: string; market?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  // Live cities, not the launch constant — a new market's first listing
  // updates this title on its own.
  const cities =
    citiesText(liveCities(await getListings(), await getMarkets())) || brand.launchCities.join(" & ");
  // Must mirror the page's own gate — otherwise, with AI search off, a ?q= URL
  // renders a browse page titled "Concierge search" and (worse) noindexed.
  const aiSearchOn = (await getWebsiteAi()).search.enabled;
  if (aiSearchOn && sp.q && sp.q.trim()) {
    // Don't index the (infinite) AI-search permutations; keep the canonical on /stays.
    return { title: "Concierge search", description: `Stays matching “${sp.q.trim()}”.`, robots: { index: false, follow: true }, alternates: { canonical: "/stays" } };
  }
  const exclusive = sp.tier === "exclusive";
  const marketName = sp.market ? (await getMarkets()).find((m) => m.slug === sp.market)?.name : undefined;
  return {
    title: exclusive ? `${brand.exclusiveTier} stays` : marketName ? `Stays in ${marketName}` : `Browse stays in ${cities}`,
    description: `${exclusive ? `${brand.exclusiveTier}: professionally managed, guaranteed-quality stays` : `All ${brand.name} stays — apartments, penthouses & villas`} in ${cities}. Filter by area, type, or amenities, or ask the AI concierge.`,
    alternates: { canonical: "/stays" },
  };
}

export default async function StaysPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const account = await getAccount();

  // ── AI concierge mode ──────────────────────────────────────────
  // Gated on the CRM kill switch, so an existing ?q= link or bookmark falls
  // through to manual browse instead of bypassing the switch.
  const aiSearchOn = (await getWebsiteAi()).search.enabled;
  if (aiSearchOn && sp.q && sp.q.trim()) {
    const listings = await getListings();
    return (
      <main className="min-h-full pb-16">
        <SiteNav theme="light" account={account} />
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold-deep">
            <Sparkles size={14} /> AI concierge
          </div>
          <ConciergeStream query={sp.q} listings={slimListings(listings)} />
        </div>
      </main>
    );
  }

  // ── Manual browse / filter mode ────────────────────────────────
  const all = await getListings();

  // Markets: the top-level scope. The switcher appears ONLY when a second
  // market has live listings — until then this page renders exactly as before.
  const marketRows = await getMarkets();
  const activeMkts = activeMarkets(all, marketRows);
  const multiMarket = activeMkts.length >= 2;
  const fallbackSlug = marketRows[0]?.slug; // legacy null-market listings fold here (matches lib/geo)
  const marketSlugOf = (l: (typeof all)[number]) => l.market_slug ?? fallbackSlug;
  const selectedMarket = multiMarket ? activeMkts.find((m) => m.slug === sp.market) : undefined;

  // Everything below scopes to the selected market (when there is one):
  // results, the category pills, and the by-city area groups.
  const scoped = selectedMarket ? all.filter((l) => marketSlugOf(l) === selectedMarket.slug) : all;

  let results = scoped;
  if (sp.tier === "exclusive") results = results.filter((l) => l.esker_exclusive);
  if (sp.category) results = results.filter((l) => l.category && normalizeCategory(l.category) === normalizeCategory(sp.category!));
  if (sp.area) results = results.filter((l) => (l.area ?? "").toLowerCase() === sp.area!.toLowerCase());
  if (sp.amenity) results = results.filter((l) => (l.amenities ?? []).some((a) => a.toLowerCase().includes(sp.amenity!.toLowerCase())));

  // Preserved on the market pills so switching market keeps the guest's other
  // filters, and vice versa.
  const withMarket = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/stays?${s}` : "/stays";
  };
  const keepFilters = { category: sp.category, area: sp.area, tier: sp.tier, amenity: sp.amenity };

  // Areas grouped BY CITY, never a flat list — the location hierarchy is
  // market → city → area (Islamabad + Rawalpindi are one market). With one
  // market the city renders as a small header rather than a row of one pill.
  const byCity = new Map<string, string[]>();
  for (const l of scoped) {
    if (!l.area) continue;
    const key = l.city ?? "";
    const arr = byCity.get(key) ?? [];
    if (!arr.includes(l.area)) arr.push(l.area);
    byCity.set(key, arr);
  }
  const cityGroups = Array.from(byCity.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const categories = Array.from(new Set(scoped.map((l) => l.category).filter(Boolean))) as string[];
  const noFilter = !sp.category && !sp.area && !sp.tier;
  const heading =
    sp.tier === "exclusive" ? "Esker Exclusive" : sp.category ?? sp.area ?? (selectedMarket ? `Stays in ${selectedMarket.name}` : "All stays");

  // Unfiltered multi-market browse: group the grid one section per market so
  // two cities' inventories never shuffle together.
  const marketSections =
    multiMarket && !selectedMarket
      ? activeMkts.map((m) => ({ market: m, listings: results.filter((l) => marketSlugOf(l) === m.slug) })).filter((s) => s.listings.length > 0)
      : [];

  return (
    <main className="min-h-full pb-16">
      <SiteNav theme="light" account={account} />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{heading}</h1>

        <ConciergeBar />

        {/* Market switcher — only exists once a second market has live
            listings. Keeps the guest's other filters when switching. */}
        {multiMarket && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Pill label="All markets" href={withMarket(keepFilters)} active={!selectedMarket} />
            {activeMkts.map((m) => (
              <Pill key={m.slug} label={m.name} href={withMarket({ ...keepFilters, market: m.slug })} active={selectedMarket?.slug === m.slug} />
            ))}
          </div>
        )}

        <div className={`${multiMarket ? "mt-4" : "mt-6"} flex flex-wrap gap-2`}>
          <Pill label="All" href={withMarket({ market: selectedMarket?.slug })} active={noFilter} />
          {categories.map((c) => (
            <Pill key={c} label={c} href={withMarket({ market: selectedMarket?.slug, category: c })} active={!!sp.category && normalizeCategory(sp.category) === normalizeCategory(c)} />
          ))}
        </div>

        {/* Areas, grouped by city — the hierarchy is visible, so adding Lahore
            later is a data insert rather than a redesign. */}
        {cityGroups.map(([city, areas]) => (
          <div key={city || "unknown"} className="mt-4">
            {city && <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-dim">{city}</div>}
            <div className="flex flex-wrap gap-2">
              {areas.map((a) => (
                <Pill key={a} label={a} href={withMarket({ market: selectedMarket?.slug, area: a })} active={(sp.area ?? "").toLowerCase() === a.toLowerCase()} />
              ))}
            </div>
          </div>
        ))}

        <p className="mb-4 mt-6 text-sm text-muted">
          {results.length} {results.length === 1 ? "stay" : "stays"}
        </p>

        {marketSections.length > 0 ? (
          // Unfiltered multi-market browse: one section per market so two
          // cities' inventories never shuffle together in a single grid.
          marketSections.map(({ market, listings: mls }) => (
            <div key={market.slug} className="mb-8">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[11px] uppercase tracking-[0.18em] text-dim">{market.name}</h2>
                <Link href={withMarket({ ...keepFilters, market: market.slug })} className="text-xs text-muted hover:text-ink">
                  See all{noFilter && !sp.amenity ? ` ${market.count}` : ""}
                </Link>
              </div>
              <StaysGrid listings={mls} />
            </div>
          ))
        ) : results.length > 0 ? (
          <StaysGrid listings={results} />
        ) : (
          <div className="rounded-2xl border border-line bg-surface px-6 py-16 text-center">
            <p className="text-ink">No stays match that yet.</p>
            <Link href="/stays" className="mt-3 inline-block text-sm text-gold-deep hover:underline">View all stays</Link>
          </div>
        )}
      </div>
    </main>
  );
}

// Concierge text box — a server GET form so it works without JS and routes back
// into AI mode.
function ConciergeBar({ q = "" }: { q?: string }) {
  return (
    <form action="/stays" className="mt-5 flex max-w-xl items-center gap-2 rounded-xl border border-line bg-surface p-1.5 focus-within:border-gold/50">
      <Search size={17} className="ml-2 shrink-0 text-gold" />
      <input
        name="q"
        defaultValue={q}
        placeholder="Tell the concierge what you're looking for…"
        className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-ink outline-none placeholder:text-dim"
      />
      <button type="submit" className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-ink transition hover:brightness-105">
        Ask Esker
      </button>
    </form>
  );
}

/** The one results grid, shared by the sectioned (multi-market) and flat renders. */
function StaysGrid({ listings }: { listings: Awaited<ReturnType<typeof getListings>> }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((l) => (
        <StayCard key={l.id} title={l.title} category={l.category ?? "Stay"} area={l.area ?? ""} city={l.city} price={l.price} priceUnit={l.price_unit} exclusive={l.esker_exclusive} photo={l.photos?.[0] ?? undefined} href={`/stays/${l.id}`} />
      ))}
    </div>
  );
}

function Pill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${
        active ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:border-line-hi hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
