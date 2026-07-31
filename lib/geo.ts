/**
 * Market geography helpers — PURE functions, safe in client components.
 *
 * The hierarchy is market → city → area (see supabase/18_geography.sql): a
 * market is a metro a guest would happily travel within for one trip
 * (Islamabad + Rawalpindi are ONE market; Murree arrives as its own). The DB is
 * the source of truth; these helpers only derive UI facts from what is LIVE.
 *
 * The whole multi-market UI keys off `activeMarkets(...).length >= 2` — with a
 * single live market every surface renders exactly as it always has, and the
 * switcher/sections/copy appear on their own the day a second market's first
 * listing goes live. Launching a city is a data event, never a deploy.
 */

/** A `markets` table row as read by lib/data/listings.getMarkets(). */
export type MarketRow = { slug: string; name: string; sort_order: number };

/** The slice of a listing these helpers need. */
type GeoListing = { market_slug: string | null; city?: string | null };

export type ActiveMarket = { slug: string; name: string; count: number };

/**
 * Markets that actually have live listings, in `sort_order`, with counts.
 * Legacy listings with no market fold into the FIRST market rather than
 * vanishing (every real area belongs to the launch market anyway).
 */
export function activeMarkets(listings: GeoListing[], markets: MarketRow[]): ActiveMarket[] {
  const ordered = [...markets].sort((a, b) => a.sort_order - b.sort_order);
  const fallback = ordered[0]?.slug;
  const counts = new Map<string, number>();
  for (const l of listings) {
    const slug = l.market_slug ?? fallback;
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return ordered
    .filter((m) => (counts.get(m.slug) ?? 0) > 0)
    .map((m) => ({ slug: m.slug, name: m.name, count: counts.get(m.slug)! }));
}

/**
 * Cities that have live listings, ordered by market order then first
 * appearance — e.g. ["Islamabad", "Rawalpindi"] today, + "Murree" the day its
 * first listing publishes. Feeds every "Now in …" / SEO string.
 */
export function liveCities(listings: GeoListing[], markets: MarketRow[]): string[] {
  const order = new Map<string, number>();
  [...markets]
    .sort((a, b) => a.sort_order - b.sort_order)
    .forEach((m, i) => order.set(m.slug, i));
  const fallback = markets.length ? [...order.entries()].sort((a, b) => a[1] - b[1])[0][0] : undefined;

  const seen = new Map<string, number>(); // city → market rank at first sighting
  for (const l of listings) {
    const city = l.city?.trim();
    if (!city || seen.has(city)) continue;
    seen.set(city, order.get(l.market_slug ?? fallback ?? "") ?? Number.MAX_SAFE_INTEGER);
  }
  return [...seen.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([city]) => city);
}

/** "Islamabad & Rawalpindi" · "Islamabad, Rawalpindi & Murree". */
export function citiesText(cities: string[]): string {
  if (cities.length === 0) return "";
  if (cities.length === 1) return cities[0];
  return `${cities.slice(0, -1).join(", ")} & ${cities[cities.length - 1]}`;
}

/**
 * One-line human description of the live markets and their cities, for the AI
 * concierge prompt — e.g. "Islamabad · Rawalpindi (cities: Islamabad,
 * Rawalpindi); Murree (cities: Murree)". Empty string when nothing is live.
 */
export function describeMarkets(listings: GeoListing[], markets: MarketRow[]): string {
  const active = activeMarkets(listings, markets);
  if (!active.length) return "";
  const fallback = [...markets].sort((a, b) => a.sort_order - b.sort_order)[0]?.slug;
  return active
    .map((m) => {
      const cities = [
        ...new Set(
          listings
            .filter((l) => (l.market_slug ?? fallback) === m.slug)
            .map((l) => l.city?.trim())
            .filter((c): c is string => !!c),
        ),
      ];
      return `${m.name}${cities.length ? ` (cities: ${cities.join(", ")})` : ""}`;
    })
    .join("; ");
}

/** Group listings into per-market buckets (market order), for section renders.
 *  Null-market legacy listings fold into the first market, matching
 *  activeMarkets. Only call when you already know there are ≥2 active markets. */
export function byMarket<T extends GeoListing>(listings: T[], markets: MarketRow[]): { market: ActiveMarket; listings: T[] }[] {
  const active = activeMarkets(listings, markets);
  const fallback = [...markets].sort((a, b) => a.sort_order - b.sort_order)[0]?.slug;
  return active.map((m) => ({
    market: m,
    listings: listings.filter((l) => (l.market_slug ?? fallback) === m.slug),
  }));
}
