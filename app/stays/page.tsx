import type { Metadata } from "next";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { StayCard } from "@/components/StayCard";
import { ConciergeStream } from "@/components/ConciergeStream";
import { getListings, slimListings } from "@/lib/data/listings";
import { getAccount } from "@/lib/auth";
import { getWebsiteAi } from "@/lib/settings";
import { normalizeCategory } from "@/lib/listings";
import { brand } from "@/lib/brand";

type SP = { q?: string; area?: string; category?: string; amenity?: string; tier?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const cities = brand.launchCities.join(" & ");
  // Must mirror the page's own gate — otherwise, with AI search off, a ?q= URL
  // renders a browse page titled "Concierge search" and (worse) noindexed.
  const aiSearchOn = (await getWebsiteAi()).search.enabled;
  if (aiSearchOn && sp.q && sp.q.trim()) {
    // Don't index the (infinite) AI-search permutations; keep the canonical on /stays.
    return { title: "Concierge search", description: `Stays matching “${sp.q.trim()}”.`, robots: { index: false, follow: true }, alternates: { canonical: "/stays" } };
  }
  const exclusive = sp.tier === "exclusive";
  return {
    title: exclusive ? `${brand.exclusiveTier} stays` : `Browse stays in ${cities}`,
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

  let results = all;
  if (sp.tier === "exclusive") results = results.filter((l) => l.esker_exclusive);
  if (sp.category) results = results.filter((l) => l.category && normalizeCategory(l.category) === normalizeCategory(sp.category!));
  if (sp.area) results = results.filter((l) => (l.area ?? "").toLowerCase() === sp.area!.toLowerCase());
  if (sp.amenity) results = results.filter((l) => (l.amenities ?? []).some((a) => a.toLowerCase().includes(sp.amenity!.toLowerCase())));

  const areas = Array.from(new Set(all.map((l) => l.area).filter(Boolean))) as string[];
  const categories = Array.from(new Set(all.map((l) => l.category).filter(Boolean))) as string[];
  const noFilter = !sp.category && !sp.area && !sp.tier;
  const heading = sp.tier === "exclusive" ? "Esker Exclusive" : sp.category ?? sp.area ?? "All stays";

  return (
    <main className="min-h-full pb-16">
      <SiteNav theme="light" account={account} />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{heading}</h1>

        <ConciergeBar />

        <div className="mt-6 flex flex-wrap gap-2">
          <Pill label="All" href="/stays" active={noFilter} />
          {categories.map((c) => (
            <Pill key={c} label={c} href={`/stays?category=${encodeURIComponent(c)}`} active={!!sp.category && normalizeCategory(sp.category) === normalizeCategory(c)} />
          ))}
          {areas.map((a) => (
            <Pill key={a} label={a} href={`/stays?area=${encodeURIComponent(a)}`} active={(sp.area ?? "").toLowerCase() === a.toLowerCase()} />
          ))}
        </div>

        <p className="mb-4 mt-6 text-sm text-muted">
          {results.length} {results.length === 1 ? "stay" : "stays"}
        </p>

        {results.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {results.map((l) => (
              <StayCard key={l.id} title={l.title} category={l.category ?? "Stay"} area={l.area ?? ""} price={l.price} exclusive={l.esker_exclusive} photo={l.photos?.[0] ?? undefined} href={`/stays/${l.id}`} />
            ))}
          </div>
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
