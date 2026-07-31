import { brand } from "@/lib/brand";
import { company } from "@/lib/contact";
import { citiesText as joinCities } from "@/lib/geo";
import { support } from "@/lib/payments";
import { thumb, ogCrop } from "@/lib/img";
import { stayPath } from "@/lib/slug";
import type { PublicListing } from "@/lib/data/listings";

// Central SEO config. Re-skinnable: everything reads from `brand`. Set
// NEXT_PUBLIC_SITE_URL in prod (defaults to the live domain).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://eskerrentals.com").replace(/\/$/, "");
export const SITE_NAME = brand.name;
const CITIES = brand.launchCities.join(" & ");

// Site-wide title/description/keywords, parameterised on the LIVE cities (from
// lib/geo.liveCities over the live listings) so launching a market updates the
// SEO with zero deploys. No-arg = the static brand fallback — used only where
// listing data genuinely can't be loaded, and by the constants below.
export function defaultTitle(cities?: string[]): string {
  const where = cities?.length ? joinCities(cities) : CITIES;
  return `${brand.name} — Premium short stays in ${where}`;
}
export function defaultDesc(cities?: string[]): string {
  const where = cities?.length ? joinCities(cities) : CITIES;
  return (
    `Book premium, professionally managed short-stay apartments, penthouses and villas in ${where}. ` +
    `${brand.name}'s AI concierge understands English and Roman Urdu — describe your trip and book a verified, ${brand.exclusiveTier} stay in minutes. Local payments: ${brand.payments.join(", ")}.`
  );
}
export function keywords(cities?: string[]): string[] {
  const list = cities?.length ? cities : [...brand.launchCities];
  return [
    `short stay ${list[0]}`,
    `serviced apartments ${list[0]}`,
    `daily rental apartments ${joinCities(list)}`,
    `penthouse for rent ${list[0]}`,
    ...list.slice(1).map((c) => `vacation rental ${c}`),
    `${brand.name}`,
    `${brand.exclusiveTier}`,
  ];
}
// Static fallbacks (brand cities) — for surfaces with no data in reach.
export const DEFAULT_TITLE = defaultTitle();
export const DEFAULT_DESC = defaultDesc();
export const KEYWORDS = keywords();

export const absoluteUrl = (p: string) => `${SITE_URL}${p.startsWith("/") ? p : `/${p}`}`;

/** Best OG image for a listing (its lead photo), or the site default. Cropped
 *  to the 1200×630 share frame — see ogCrop. */
export function listingOgImage(listing: PublicListing): string {
  const first = listing.photos?.[0];
  return first ? ogCrop(first) : absoluteUrl("/opengraph-image");
}

// ── JSON-LD builders ─────────────────────────────────────────────────────────
export function organizationLd(cities?: string[]) {
  const served = cities?.length ? cities : [...brand.launchCities];
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: brand.name,
    description: defaultDesc(cities),
    url: SITE_URL,
    image: absoluteUrl("/opengraph-image"),
    priceRange: "₨₨",
    areaServed: served.map((c) => ({ "@type": "City", name: c })),
    // Real registered address + callable number (lib/contact.ts) — machine
    // readable so the business identity is verifiable, not just rendered text.
    address: {
      "@type": "PostalAddress",
      streetAddress: `${company.address.line1}, ${company.address.line2}`,
      addressLocality: company.address.city,
      addressCountry: "PK",
    },
    legalName: company.legalName,
    telephone: company.phone,
    email: support.email,
    sameAs: [] as string[], // add social profile URLs here
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand.name,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/stays?q={query}` },
      "query-input": "required name=query",
    },
  };
}

/**
 * A real, data-built sentence for a listing that has no written description —
 * used by BOTH the meta description and the structured data, so the two can
 * never disagree. Deliberately uses the phrasing Pakistani guests actually
 * search ("on a daily basis", "per night") rather than Western short-stay
 * vocabulary, and respects how the listing sells (a pool is per block, not
 * per night). Everything in it is true and comes from the database.
 */
export function listingSummary(l: PublicListing): string {
  const where = [l.area, l.city].filter(Boolean).join(", ");
  const cat = (l.category ?? "stay").toLowerCase();
  const bed = l.bedrooms ? `${l.bedrooms}-bedroom ` : "";
  const lead =
    l.booking_mode === "nightly"
      ? `${bed}${cat} for rent on a daily basis${where ? ` in ${where}` : ""}`
      : `${cat}${where ? ` in ${where}` : ""}, booked by the ${l.price_unit}`;
  const price = `From ₨${l.price.toLocaleString("en-PK")} per ${l.price_unit}`;
  const sleeps = l.capacity ? `, sleeps ${l.capacity}` : "";
  const amen = (l.amenities ?? []).slice(0, 3).join(", ");
  const exclusive = l.esker_exclusive ? ` ${brand.exclusiveTier} — professionally managed.` : "";
  return `${lead.charAt(0).toUpperCase()}${lead.slice(1)}. ${price}${sleeps}.${amen ? ` ${amen}.` : ""}${exclusive}`;
}

/** Schema.org type for a listing. Google's Product/merchant guidance does not
 *  cover rental accommodation — an honest Accommodation subtype is both more
 *  accurate and eligible for the right treatment. */
function accommodationType(category: string | null): string {
  const c = (category ?? "").toLowerCase();
  if (c.includes("apartment") || c.includes("penthouse") || c.includes("studio")) return "Apartment";
  if (c.includes("house") || c.includes("villa") || c.includes("farmhouse") || c.includes("cottage")) return "House";
  return "Accommodation";
}

export function listingLd(listing: PublicListing, rating?: { average: number; count: number } | null) {
  const url = absoluteUrl(stayPath(listing));
  return {
    "@context": "https://schema.org",
    "@type": accommodationType(listing.category),
    name: listing.title,
    // The listing's REAL geography — never a hardcoded city. A Murree listing
    // must say "in Mall Road, Murree", not ", Islamabad".
    description: listing.description || listingSummary(listing),
    url,
    image: (listing.photos ?? []).slice(0, 6).map((p) => thumb(p, 1200, 75)),
    ...(listing.area || listing.city
      ? {
          address: {
            "@type": "PostalAddress",
            ...(listing.area ? { addressLocality: listing.area } : {}),
            ...(listing.city ? { addressRegion: listing.city } : {}),
            addressCountry: "PK",
          },
          containedInPlace: { "@type": "Place", name: [listing.area, listing.city].filter(Boolean).join(", ") },
        }
      : {}),
    ...(listing.bedrooms ? { numberOfBedrooms: listing.bedrooms } : {}),
    ...(listing.capacity
      ? { occupancy: { "@type": "QuantitativeValue", maxValue: listing.capacity, unitText: "guests" } }
      : {}),
    amenityFeature: (listing.amenities ?? []).slice(0, 20).map((a) => ({
      "@type": "LocationFeatureSpecification",
      name: a,
      value: true,
    })),
    ...(rating && rating.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: String(rating.average), reviewCount: String(rating.count), bestRating: "5" } }
      : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "PKR",
      price: String(listing.price),
      // Honest about the unit: nightly stays vs day-use blocks vs hourly.
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: String(listing.price),
        priceCurrency: "PKR",
        unitText: listing.price_unit,
      },
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: brand.name },
    },
  };
}

/** A landing page: a real collection of listings, not a product. */
export function collectionLd(input: { title: string; description: string; path: string; listings: PublicListing[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.listings.length,
      itemListElement: input.listings.map((l, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(stayPath(l)),
        name: l.title,
      })),
    },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}
