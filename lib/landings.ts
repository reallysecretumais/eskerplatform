/**
 * SEO landing pages — derived from LIVE inventory, never hand-maintained.
 *
 * The whole point: a guest searching "apartments for rent in F-10 on daily
 * basis" has no page to land on if the only URLs are the homepage, /stays and
 * individual listings. These pages fill that gap — and they appear and
 * disappear on their own as inventory changes, so nobody has to remember to
 * build one.
 *
 * TWO GATES, both required, because thin near-duplicate pages are how
 * programmatic SEO usually fails (and Google is decisive about it):
 *   1. MIN_LISTINGS real listings must match. Two stays is not a collection.
 *   2. Curated copy must exist for the slug in lib/landingCopy.ts. Without a
 *      genuine, specific intro a page is just the area name swapped into a
 *      template — worse than not existing.
 *
 * So inventory growth ADDS pages by itself (E-11's page appears the moment its
 * third listing publishes — provided its copy is written), and a page that
 * drops below the threshold stops being generated rather than rotting.
 */
import type { PublicListing } from "@/lib/data/listings";
import { slugify } from "@/lib/slug";
import { LANDING_COPY } from "@/lib/landingCopy";

/** Below this a "collection" page isn't a collection. */
export const MIN_LISTINGS = 3;

export type LandingKind = "area" | "category" | "amenity";

export type LandingPage = {
  slug: string;
  kind: LandingKind;
  /** On-page H1. */
  heading: string;
  metaTitle: string;
  metaDescription: string;
  /** Curated paragraphs — the reason this page is allowed to exist. */
  intro: string[];
  listings: PublicListing[];
  /** For cross-linking + breadcrumbs. */
  area?: string;
  city?: string;
  category?: string;
};

type Candidate = Omit<LandingPage, "intro" | "metaTitle" | "metaDescription"> & {
  metaTitleFor: (n: number, from: number) => string;
  metaDescriptionFor: (n: number, from: number) => string;
};

/** "Apartment" → "Apartments". Only ever used on category names. */
function plural(word: string): string {
  const w = word.trim();
  if (!w) return w;
  if (/(s|x|z|ch|sh)$/i.test(w)) return `${w}es`;
  if (/[^aeiou]y$/i.test(w)) return `${w.slice(0, -1)}ies`;
  return `${w}s`;
}

const money = (n: number) => `₨${n.toLocaleString("en-PK")}`;
const cheapest = (ls: PublicListing[]) => Math.min(...ls.map((l) => l.price));

/**
 * Amenity landing pages worth having — a curated list, NOT every amenity.
 * "Fast WiFi" is on all 19 listings; a page for it would be a duplicate of
 * /stays. These are the ones people actually search as a deciding feature.
 */
const AMENITY_INTENTS: { match: string; label: string; urlWord: string }[] = [
  { match: "private pool", label: "private pool", urlWord: "private-pool" },
  { match: "jacuzzi", label: "jacuzzi", urlWord: "jacuzzi" },
  { match: "projector", label: "projector", urlWord: "cinema" },
];

/** Every page the live data COULD support, before the copy gate. */
function candidates(listings: PublicListing[]): Candidate[] {
  const out: Candidate[] = [];
  const live = listings.filter((l) => l.area || l.city);

  // ── Area pages: the highest-intent local search there is ──────────────
  const areaKeys = new Map<string, { area: string; city: string }>();
  for (const l of live) {
    if (!l.area || !l.city) continue;
    areaKeys.set(`${l.area}|${l.city}`, { area: l.area, city: l.city });
  }
  for (const { area, city } of areaKeys.values()) {
    const matched = live.filter((l) => l.area === area && l.city === city);
    out.push({
      slug: `short-stay-${slugify(`${area} ${city}`)}`,
      kind: "area",
      area,
      city,
      heading: `Short stay apartments in ${area}, ${city}`,
      listings: matched,
      metaTitleFor: (n) => `${n} short stay apartments in ${area}, ${city} — daily rent`,
      metaDescriptionFor: (n, from) =>
        `${n} furnished short-stay ${n === 1 ? "apartment" : "apartments"} for rent on a daily basis in ${area}, ${city}. From ${money(from)} per night — verified, professionally managed, book online or on WhatsApp.`,
    });
  }

  // ── Category × city ───────────────────────────────────────────────────
  const catKeys = new Map<string, { category: string; city: string }>();
  for (const l of live) {
    if (!l.category || !l.city) continue;
    catKeys.set(`${l.category}|${l.city}`, { category: l.category, city: l.city });
  }
  for (const { category, city } of catKeys.values()) {
    const matched = live.filter((l) => l.category === category && l.city === city);
    const plur = plural(category);
    out.push({
      slug: slugify(`${plur} ${city}`),
      kind: "category",
      category,
      city,
      heading: `${plur} for rent in ${city}`,
      listings: matched,
      metaTitleFor: (n) => `${plur} for rent in ${city} — ${n} daily-basis stays`,
      metaDescriptionFor: (n, from) =>
        `${n} furnished ${plur.toLowerCase()} for rent on a daily basis in ${city}. From ${money(from)} per night — real photos, live availability, professionally managed by Esker.`,
    });
  }

  // ── Amenity intent (curated) ──────────────────────────────────────────
  for (const intent of AMENITY_INTENTS) {
    const cities = new Set(live.map((l) => l.city).filter(Boolean) as string[]);
    for (const city of cities) {
      const matched = live.filter(
        (l) => l.city === city && (l.amenities ?? []).some((a) => a.toLowerCase().includes(intent.match)),
      );
      out.push({
        slug: slugify(`stays with ${intent.urlWord} ${city}`),
        kind: "amenity",
        city,
        heading: `Stays with a ${intent.label} in ${city}`,
        listings: matched,
        metaTitleFor: (n) => `${n} stays with a ${intent.label} in ${city} — book by the night`,
        metaDescriptionFor: (n, from) =>
          `${n} short-stay ${n === 1 ? "property" : "properties"} with a ${intent.label} in ${city}, from ${money(from)} per night. Verified photos and live availability.`,
      });
    }
  }

  return out;
}

/** The pages that actually ship: enough listings AND real curated copy. */
export function landingPages(listings: PublicListing[]): LandingPage[] {
  return candidates(listings)
    .filter((c) => c.listings.length >= MIN_LISTINGS && LANDING_COPY[c.slug]?.length)
    .map((c) => {
      const from = cheapest(c.listings);
      return {
        slug: c.slug,
        kind: c.kind,
        heading: c.heading,
        metaTitle: c.metaTitleFor(c.listings.length, from),
        metaDescription: c.metaDescriptionFor(c.listings.length, from),
        intro: LANDING_COPY[c.slug],
        listings: [...c.listings].sort((a, b) => a.price - b.price),
        area: c.area,
        city: c.city,
        category: c.category,
      };
    });
}

export function findLanding(slug: string, listings: PublicListing[]): LandingPage | null {
  return landingPages(listings).find((p) => p.slug === slug) ?? null;
}

/** The area page for a listing, if one exists — used for breadcrumbs and the
 *  "more stays nearby" link on a listing page. */
export function areaLandingFor(listing: PublicListing, listings: PublicListing[]): LandingPage | null {
  if (!listing.area || !listing.city) return null;
  return (
    landingPages(listings).find((p) => p.kind === "area" && p.area === listing.area && p.city === listing.city) ?? null
  );
}

/** Sibling pages to cross-link from a landing page (never itself). */
export function relatedLandings(page: LandingPage, listings: PublicListing[], max = 6): LandingPage[] {
  const all = landingPages(listings).filter((p) => p.slug !== page.slug);
  // Same city first — a Rawalpindi page shouldn't lead with Islamabad links.
  return all
    .sort((a, b) => Number(b.city === page.city) - Number(a.city === page.city) || b.listings.length - a.listings.length)
    .slice(0, max);
}
