import type { MetadataRoute } from "next";
import { getListings } from "@/lib/data/listings";
import { landingPages } from "@/lib/landings";
import { stayPath } from "@/lib/slug";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600; // refresh hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const listings = await getListings().catch(() => []);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/stays`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/cancellation`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/service-delivery`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Canonical slug URLs only — never the legacy uuid paths (those 301).
  const listingPages: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${SITE_URL}${stayPath(l)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // SEO landing pages appear/disappear with inventory (lib/landings.ts), so the
  // sitemap tracks them automatically — nothing to remember on a new area.
  const landings: MetadataRoute.Sitemap = landingPages(listings).map((p) => ({
    url: `${SITE_URL}/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticPages, ...landings, ...listingPages];
}
