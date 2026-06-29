import { brand } from "@/lib/brand";
import { thumb } from "@/lib/img";
import type { PublicListing } from "@/lib/data/listings";

// Central SEO config. Re-skinnable: everything reads from `brand`. Set
// NEXT_PUBLIC_SITE_URL in prod (defaults to the live domain).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://eskerrentals.com").replace(/\/$/, "");
export const SITE_NAME = brand.name;
const CITIES = brand.launchCities.join(" & ");

export const DEFAULT_TITLE = `${brand.name} — Premium short stays in ${CITIES}`;
export const DEFAULT_DESC =
  `Book premium, professionally managed short-stay apartments, penthouses and villas in ${CITIES}. ` +
  `${brand.name}'s AI concierge understands English and Roman Urdu — describe your trip and book a verified, ${brand.exclusiveTier} stay in minutes. Local payments: ${brand.payments.join(", ")}.`;

export const KEYWORDS = [
  `short stay ${brand.launchCities[0]}`,
  `serviced apartments ${brand.launchCities[0]}`,
  `daily rental apartments ${CITIES}`,
  `penthouse for rent ${brand.launchCities[0]}`,
  `vacation rental ${brand.launchCities[1] ?? ""}`.trim(),
  `${brand.name}`,
  `${brand.exclusiveTier}`,
];

export const absoluteUrl = (p: string) => `${SITE_URL}${p.startsWith("/") ? p : `/${p}`}`;

/** Best OG image for a listing (its lead photo), or the site default. */
export function listingOgImage(listing: PublicListing): string {
  const first = listing.photos?.[0];
  return first ? thumb(first, 1200, 75) : absoluteUrl("/opengraph-image");
}

// ── JSON-LD builders ─────────────────────────────────────────────────────────
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: brand.name,
    description: DEFAULT_DESC,
    url: SITE_URL,
    image: absoluteUrl("/opengraph-image"),
    priceRange: "₨₨",
    areaServed: brand.launchCities.map((c) => ({ "@type": "City", name: c })),
    address: { "@type": "PostalAddress", addressLocality: brand.launchCities[0], addressCountry: "PK" },
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

export function listingLd(listing: PublicListing) {
  const url = absoluteUrl(`/stays/${listing.id}`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description || `${listing.category ?? "Stay"} in ${listing.area ?? brand.launchCities[0]}, ${brand.launchCities[0]}.`,
    image: (listing.photos ?? []).slice(0, 6).map((p) => thumb(p, 1200, 75)),
    category: listing.category ?? "Short stay",
    brand: { "@type": "Brand", name: brand.name },
    additionalProperty: (listing.amenities ?? []).slice(0, 12).map((a) => ({ "@type": "PropertyValue", name: a })),
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
