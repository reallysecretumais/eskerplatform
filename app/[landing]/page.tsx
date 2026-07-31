import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { StayCard } from "@/components/StayCard";
import { JsonLd } from "@/components/JsonLd";
import { EskerLogo } from "@/components/EskerLogo";
import { getListings } from "@/lib/data/listings";
import { getAccount } from "@/lib/auth";
import { findLanding, landingPages, relatedLandings } from "@/lib/landings";
import { collectionLd, breadcrumbLd } from "@/lib/seo";
import { stayPath } from "@/lib/slug";
import { formatPrice } from "@/lib/listings";
import { brand } from "@/lib/brand";

// SEO landing pages (/short-stay-f-10-f-11-islamabad, /penthouses-islamabad …).
// This is a single catch-all at the root, so every real route above it wins;
// anything that isn't a live landing slug 404s. The set of valid slugs comes
// from live inventory + curated copy — see lib/landings.ts.

type Params = { params: Promise<{ landing: string }> };

// Pre-render the known pages at build time; the rest 404 (dynamicParams off
// would break new pages appearing between deploys, so it stays on).
export async function generateStaticParams() {
  const pages = landingPages(await getListings().catch(() => []));
  return pages.map((p) => ({ landing: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { landing } = await params;
  const page = findLanding(landing, await getListings());
  if (!page) return { title: "Not found" };
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/${page.slug}` },
    openGraph: { type: "website", title: page.metaTitle, description: page.metaDescription, url: `/${page.slug}` },
  };
}

export default async function LandingPage({ params }: Params) {
  const { landing } = await params;
  const listings = await getListings();
  const page = findLanding(landing, listings);
  if (!page) notFound();

  const account = await getAccount();
  const related = relatedLandings(page, listings);
  const from = Math.min(...page.listings.map((l) => l.price));
  const { amount, unit } = formatPrice(from, page.listings[0].price_unit);

  // Amenities shared by most of the set — a real, data-derived summary rather
  // than a marketing list.
  const counts = new Map<string, number>();
  for (const l of page.listings) for (const a of l.amenities ?? []) counts.set(a, (counts.get(a) ?? 0) + 1);
  const common = [...counts.entries()]
    .filter(([, n]) => n >= Math.ceil(page.listings.length / 2))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([a]) => a);

  return (
    <main className="min-h-full pb-16">
      <JsonLd
        data={[
          collectionLd({ title: page.metaTitle, description: page.metaDescription, path: `/${page.slug}`, listings: page.listings }),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Stays", path: "/stays" },
            { name: page.heading, path: `/${page.slug}` },
          ]),
        ]}
      />
      <SiteNav theme="light" account={account} />

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Breadcrumb — visible, matching the JSON-LD trail */}
        <nav aria-label="Breadcrumb" className="text-xs text-dim">
          <Link href="/" className="hover:text-ink">Home</Link>
          <span className="px-1.5">/</span>
          <Link href="/stays" className="hover:text-ink">Stays</Link>
          {page.city && (
            <>
              <span className="px-1.5">/</span>
              <span className="text-muted">{page.city}</span>
            </>
          )}
        </nav>

        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">{page.heading}</h1>

        {/* Live facts — always true because they're computed, never written */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
          <span>
            <strong className="text-ink tnum">{page.listings.length}</strong> {page.listings.length === 1 ? "stay" : "stays"} available
          </span>
          <span>
            From <strong className="text-ink tnum">{amount}</strong> per {unit}
          </span>
          {page.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} className="text-gold" /> {page.area ? `${page.area}, ${page.city}` : page.city}
            </span>
          )}
        </div>

        {/* Curated intro — the reason this page is allowed to exist */}
        <div className="mt-6 max-w-3xl space-y-3.5 text-[15px] leading-relaxed text-muted">
          {page.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {common.length > 0 && (
          <p className="mt-5 max-w-3xl text-sm text-dim">
            <span className="text-muted">Standard across these stays:</span> {common.join(" · ")}
          </p>
        )}

        {/* The listings */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {page.listings.map((l) => (
            <StayCard
              key={l.id}
              title={l.title}
              category={l.category ?? "Stay"}
              area={l.area ?? ""}
              city={l.city}
              price={l.price}
              priceUnit={l.price_unit}
              exclusive={l.esker_exclusive}
              photo={l.photos?.[0] ?? undefined}
              href={stayPath(l)}
            />
          ))}
        </div>

        {/* Cross-links: every landing page is one click from its siblings, so
            none of them is an orphan and crawl depth stays shallow. */}
        {related.length > 0 && (
          <section className="mt-12 border-t border-line pt-8">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Keep looking</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/${r.slug}`}
                  className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-muted transition hover:border-line-hi hover:text-ink"
                >
                  {r.heading}
                </Link>
              ))}
              <Link
                href="/stays"
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-muted transition hover:border-line-hi hover:text-ink"
              >
                All stays <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        )}
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted">
          <EskerLogo className="text-ink" />
          <p className="mt-2 text-xs text-dim">{brand.tagline}</p>
        </div>
      </footer>
    </main>
  );
}
