import { brand } from "@/lib/brand";
import { company } from "@/lib/contact";
import { citiesText as joinCities } from "@/lib/geo";
import { support } from "@/lib/payments";
import { thumb } from "@/lib/img";
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

/** Best OG image for a listing (its lead photo), or the site default. */
export function listingOgImage(listing: PublicListing): string {
  const first = listing.photos?.[0];
  return first ? thumb(first, 1200, 75) : absoluteUrl("/opengraph-image");
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

export function listingLd(listing: PublicListing, rating?: { average: number; count: number } | null) {
  const url = absoluteUrl(`/stays/${listing.id}`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    // The listing's REAL geography — never a hardcoded city. A Murree listing
    // must say "in Mall Road, Murree", not ", Islamabad".
    description:
      listing.description ||
      `${listing.category ?? "Stay"} in ${[listing.area, listing.city].filter(Boolean).join(", ") || "Pakistan"}.`,
    image: (listing.photos ?? []).slice(0, 6).map((p) => thumb(p, 1200, 75)),
    category: listing.category ?? "Short stay",
    brand: { "@type": "Brand", name: brand.name },
    additionalProperty: (listing.amenities ?? []).slice(0, 12).map((a) => ({ "@type": "PropertyValue", name: a })),
    ...(rating && rating.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: String(rating.average), reviewCount: String(rating.count), bestRating: "5" } }
      : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "PKR",
      price: String(listing.price),
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: brand.name },
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
