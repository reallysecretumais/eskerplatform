import Link from "next/link";
import type { ReactNode } from "react";
import { stayPath } from "@/lib/slug";
import { brand } from "@/lib/brand";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ConciergeSearch } from "@/components/ConciergeSearch";
import { CategoryShowcase } from "@/components/CategoryShowcase";
import { StayCard } from "@/components/StayCard";
import { getListings, getMarkets, slimListings, type PublicListing } from "@/lib/data/listings";
import { homeSections, categoryCounts, byStrength, MORE_SECTION_MAX, EXCLUSIVE_SECTION_MAX } from "@/lib/listings";
import { activeMarkets, byMarket, citiesText, liveCities } from "@/lib/geo";
import { guestPaymentSentence } from "@/lib/payments";
import { isSafepayConfigured } from "@/lib/safepay";
import { crop } from "@/lib/img";
import { getAccount } from "@/lib/auth";
import { getWebsiteAi } from "@/lib/settings";
import { JsonLd } from "@/components/JsonLd";
import { organizationLd, websiteLd } from "@/lib/seo";

// The homepage, from the Website board (esker-platform-app/design/live/
// Website.dc.html, 1440 wide). Everything a guest reads that could be a number,
// a city, a card or a category comes from the live listing window — the board's
// own figures are placeholders and never appear here.

const TRUST = ["Verified, managed stays", "Advance held until check-in", "Real people on WhatsApp"];

// "Pay the way you pay" reads the one list of methods that actually work
// (lib/payments.ts). The board's "Easypaisa, JazzCash, SadaPay or bank
// transfer" isn't true yet; the wallets appear here the day they go live.
function standardPoints(): { title: string; body: string }[] {
  return [
    { title: "Inspected and managed", body: "Every Exclusive stay is run by our own team." },
    { title: "Held until you're in", body: "Your advance is released at check-in, not before." },
    { title: "Pay the way you pay", body: `By ${guestPaymentSentence(isSafepayConfigured())}.` },
    { title: "Real people", body: "On WhatsApp before, during and after your stay." },
  ];
}

export default async function HomePage() {
  const [listings, markets, account, ai] = await Promise.all([getListings(), getMarkets(), getAccount(), getWebsiteAi()]);
  const slim = slimListings(listings); // client components get only what cards need

  // Every stay is shown. While inventory is small that's ONE grid; it upgrades
  // itself to "Esker Exclusive" + the rest once there's enough stock. See
  // lib/listings.ts homeSections.
  const sections = homeSections(listings);
  const counts = categoryCounts(listings);

  // Geography is DATA: the cities line and the section layout derive from the
  // markets that actually have live listings. A second market's first listing
  // switches the grid to one section per market — zero deploys.
  const liveCityNames = liveCities(listings, markets);
  const cities = citiesText(liveCityNames) || brand.launchCities.join(" & ");
  const marketGroups = activeMarkets(listings, markets).length >= 2 ? byMarket(sections.all, markets) : [];

  // The hero's three photos: the strongest stays' lead shots, Exclusives first.
  const heroPhotos = [...listings]
    .sort(byStrength)
    .map((l) => l.photos?.[0])
    .filter((p): p is string => !!p)
    .slice(0, 3);

  // Footer quick links: the board's Farmhouses link, for whichever categories
  // actually have stays (plural labels, as the category tiles use).
  const liveCategories = [...new Set(listings.map((l) => l.category).filter((c): c is string => !!c))]
    .filter((c) => !/^apartment|^penthouse/i.test(c))
    .map((c) => (c.endsWith("s") ? c : `${c}s`));

  return (
    <main className="min-h-full">
      <JsonLd data={[organizationLd(liveCityNames.length ? liveCityNames : undefined), websiteLd()]} />

      {/* ── Hero: the only place text sits on a photo, under a 68% black overlay ── */}
      <section className="relative overflow-hidden bg-ink text-warm">
        <div className="absolute inset-0 flex" aria-hidden>
          {heroPhotos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase transforms are the image CDN
            <img
              key={p}
              src={crop(p, 720, 1000, 60)}
              alt=""
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
              className={`block h-full min-w-0 flex-1 object-cover ${i > 0 ? "max-sm:hidden" : ""}`}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-ink/[0.68]" aria-hidden />

        <div className="relative mx-auto max-w-[1248px] px-5 sm:px-6">
          <SiteNav account={account} />
          <div className="flex flex-col items-center gap-6 pb-20 pt-14 text-center sm:pb-24 sm:pt-[92px]">
            <span className="label flex items-center gap-2 text-xs text-ice">
              <span className="h-[7px] w-[7px] rounded-full bg-ice" aria-hidden />
              AI concierge · English or Roman Urdu
            </span>
            <h1 className="headline stretch-82 max-w-[900px] text-[clamp(48px,8vw,104px)] leading-[0.9] tracking-[-0.03em] [text-wrap:balance]">
              Where would you like to <span className="text-ice">stay?</span>
            </h1>
            <p className="max-w-[520px] text-lg leading-normal text-veil">
              Describe it in your own words. We&apos;ll find the right place from real, available stays.
            </p>
            <ConciergeSearch listings={slim} aiEnabled={ai.search.enabled} voiceEnabled={ai.voice.enabled} />
            <ul className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-veil">
              {TRUST.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-ice" aria-hidden>
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Stays — every live listing from the DB ── */}
      {marketGroups.length >= 2 ? (
        // Multi-market: one section per market, in market order — a guest
        // planning Murree never wades through Islamabad stays.
        marketGroups.map(({ market, listings: mls }) => (
          <Section
            key={market.slug}
            title={<>Stays in {market.name}</>}
            link={{ href: `/stays?market=${encodeURIComponent(market.slug)}`, label: `See all ${market.count}` }}
          >
            <StayGrid listings={mls.slice(0, MORE_SECTION_MAX)} />
          </Section>
        ))
      ) : sections.mode === "unified" ? (
        sections.all.length > 0 && (
          <Section title={<>Our stays in {cities}</>} link={{ href: "/stays", label: "Explore all stays" }}>
            <StayGrid listings={sections.all} />
          </Section>
        )
      ) : (
        <>
          <Section
            title={
              <>
                Esker <span className="text-brand">{brand.exclusiveTier.replace(/^Esker /, "")}</span>
              </>
            }
            lead="Personally inspected and managed by Esker to one standard."
            link={{ href: "/stays?tier=exclusive", label: "See all" }}
            large
          >
            <div className="grid gap-x-6 gap-y-10 md:grid-cols-2">
              {sections.exclusive.slice(0, EXCLUSIVE_SECTION_MAX).map((l) => (
                <Card key={l.id} listing={l} size="feature" />
              ))}
            </div>
          </Section>
          <Section title={<>More stays in {cities}</>} link={{ href: "/stays", label: "Explore all stays" }}>
            <StayGrid listings={sections.rest.slice(0, MORE_SECTION_MAX)} />
          </Section>
        </>
      )}

      {/* ── The Esker Standard ── */}
      <section className="mx-auto mt-24 max-w-[1248px] px-5 sm:px-6">
        <div className="flex flex-wrap items-start gap-12 rounded-[36px] bg-brand p-[clamp(28px,5vw,64px)] text-warm">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <span className="label text-xs text-ice">The Esker Standard</span>
            <h2 className="headline stretch-82 text-[clamp(36px,4.4vw,60px)] leading-[0.92]">
              Places don&apos;t travel. <span className="text-ice">A standard does.</span>
            </h2>
          </div>
          <div className="grid min-w-0 flex-[1_1_420px] gap-x-8 gap-y-7 sm:grid-cols-2">
            {standardPoints().map((p) => (
              <div key={p.title} className="flex flex-col gap-2">
                <span className="h-[1.5px] w-10 bg-ice" aria-hidden />
                <span className="text-lg font-bold">{p.title}</span>
                <span className="text-[15px] leading-[1.45] text-ice-soft">{p.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Browse by category ── */}
      <section className="mx-auto flex max-w-[1248px] flex-col gap-7 px-5 pt-24 sm:px-6">
        <h2 className="headline text-[clamp(30px,3.4vw,42px)] tracking-[-0.02em]">
          Browse by <span className="text-brand">category</span>
        </h2>
        <CategoryShowcase counts={counts} />
      </section>

      <div className="mt-[110px]">
        <SiteFooter cities={liveCityNames} categories={liveCategories} />
      </div>
    </main>
  );
}

/** A homepage section head from the board: headline (+ lead) left, link right. */
function Section({
  title,
  lead,
  link,
  large = false,
  children,
}: {
  title: ReactNode;
  lead?: string;
  link: { href: string; label: string };
  large?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto flex max-w-[1248px] flex-col gap-7 px-5 pt-[72px] sm:px-6 sm:pt-[88px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2
            className={`headline ${large ? "text-[clamp(34px,4vw,52px)]" : "text-[clamp(30px,3.4vw,42px)] tracking-[-0.02em]"}`}
          >
            {title}
          </h2>
          {lead && <p className="text-base leading-normal text-muted">{lead}</p>}
        </div>
        <Link href={link.href} className="text-[15px] font-bold text-brand hover:text-brand-ink">
          {link.label} →
        </Link>
      </div>
      {children}
    </section>
  );
}

/** The 3-across grid, used by every non-Exclusive section so they can never drift apart. */
function StayGrid({ listings }: { listings: PublicListing[] }) {
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((l) => (
        <Card key={l.id} listing={l} size="standard" />
      ))}
    </div>
  );
}

function Card({ listing: l, size }: { listing: PublicListing; size: "feature" | "standard" }) {
  return (
    <StayCard
      title={l.title}
      category={l.category ?? "Stay"}
      area={l.area ?? ""}
      city={l.city}
      price={l.price}
      priceUnit={l.price_unit}
      exclusive={l.esker_exclusive}
      photo={l.photos?.[0] ?? undefined}
      href={stayPath(l)}
      size={size}
    />
  );
}
