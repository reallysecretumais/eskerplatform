import "server-only";
import { unstable_cache } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unitForCategory } from "@/lib/listings";
import type { MarketRow } from "@/lib/geo";
import { parseStayKey, matchesKey } from "@/lib/slug";

// Cookieless anon client for cacheable public reads (no per-request cookies, so
// the result can be cached + shared). Public listing data is the same for
// everyone and changes rarely (only when an admin edits/publishes in the CRM),
// so it's cached and busted on demand via the /api/revalidate webhook ("listings"
// tag). Availability is NOT cached — it must stay correct to the minute.
const anon = () => createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

// Live read of the public listing window (anon-safe; only public_listing = true
// rows, only safe columns). This is the single source the homepage reads from.

/** How a listing sells. Comes from the DB (`category_modes` → `public_listings`),
 *  never derived client-side, so the website and the mobile app can never
 *  disagree about how the same thing is booked. `session` is reserved for
 *  experiences and is not built yet. */
export type BookingMode = "nightly" | "blocks" | "hourly" | "session";

export type PublicListing = {
  id: string;
  title: string;
  /** Fine location inside a market, e.g. "Bahria Phase 7". */
  area: string | null;
  /** The truth-teller — always shown in labels so a Rawalpindi stay reads
   *  honestly even while the guest browses the Islamabad · Rawalpindi market. */
  city: string | null;
  /** The metro a guest selects, e.g. "Islamabad · Rawalpindi". */
  market: string | null;
  market_slug: string | null;
  category: string | null;
  /** Set by category via `category_modes`. Drives step one of booking only. */
  booking_mode: BookingMode;
  /** The word after the price: night | block | hour. Never hardcode a unit. */
  price_unit: string;
  type: string | null;
  bedrooms: number | null;
  capacity: number | null;
  /** Mode-correct: per night, cheapest block ("from"), or per hour. */
  price: number;
  description: string | null;
  amenities: string[] | null;
  photos: string[] | null;
  /** One optional walkthrough video. Null = none. Never a member of `photos` —
   *  the image transform CDN errors on a video URL. */
  video_url: string | null;
  esker_exclusive: boolean;
  public_facts?: string | null; // public-safe facts for the concierge (parking, landmarks, rules…)
  /** Which table the listing came from. 'external' = resale inventory Esker
   *  sources from another owner. Drives AVAILABILITY + BOOKING logic only —
   *  guests must never see a difference (founder decision), so never render it. */
  source?: "esker" | "external";
};

// To ask whether a listing sells time-of-day rather than nights, use
// `isSlottedMode(listing.booking_mode)` from `@/lib/listings` — that is the ONE
// definition, and it lives there because this module is server-only while client
// components need the same answer. Do not add a listing-shaped wrapper here.

/** External (resale) units live in `external_properties`, so a booking on one
 *  sets external_property_id (property_id stays NULL) and Esker pays the owner. */
export const isExternal = (l: Pick<PublicListing, "source">) => l.source === "external";

export type ListingHost = { firstName: string; avatarUrl: string | null; since: number | null; bio: string | null };

/** The public "Hosted by …" identity for a listing — ONLY for self-listed (host)
 *  places, and only ever safe fields (first name, avatar, join-year, bio). Never
 *  for Esker/managed/partner listings. Service-role read of columns the public
 *  view doesn't expose; returns null when there's no host to show. */
export async function getListingHost(propertyId: string): Promise<ListingHost | null> {
  const admin = createAdminClient();
  const { data: prop } = await admin
    .from("properties")
    .select("owner_relationship, owner_account_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!prop || prop.owner_relationship !== "host" || !prop.owner_account_id) return null;

  const { data: acc } = await admin
    .from("accounts")
    .select("name, avatar_url, created_at, host_bio")
    .eq("id", prop.owner_account_id as string)
    .maybeSingle();
  if (!acc) return null;

  return {
    firstName: (acc.name as string | null)?.trim().split(/\s+/)[0] || "Your host",
    avatarUrl: (acc.avatar_url as string | null) ?? null,
    since: acc.created_at ? new Date(acc.created_at as string).getFullYear() : null,
    bio: (acc.host_bio as string | null) ?? null,
  };
}

// What client components actually need to render a match card — nothing more.
// The AI catalog is built SERVER-side (/api/concierge), so shipping the full
// listings (descriptions, facts, every photo URL) to the browser was pure
// payload. Pass this slim projection to any "use client" component instead.
export type SlimListing = {
  id: string;
  title: string;
  area: string | null;
  city: string | null;
  category: string | null;
  price: number;
  /** Carried so a card never renders a bare number or the wrong unit. */
  price_unit: string;
  booking_mode: BookingMode;
  esker_exclusive: boolean;
  photo: string | null; // lead photo only
};

export function slimListings(listings: PublicListing[]): SlimListing[] {
  return listings.map((l) => ({
    id: l.id,
    title: l.title,
    area: l.area,
    city: l.city,
    category: l.category,
    price: l.price,
    price_unit: l.price_unit,
    booking_mode: l.booking_mode,
    esker_exclusive: l.esker_exclusive,
    photo: l.photos?.[0] ?? null,
  }));
}

// Deploy-order safety: this code and the DB migration (18/19) can land in either
// order. Before the migrations run, `public_listings` simply doesn't return the
// geography/mode columns, so we fill them from the category — the same rule the
// migration itself seeds. After the migrations, the DB's answer always wins.
// Without this, a code-first deploy would render "₨35,000 / undefined".
function normalizeListing(row: Record<string, unknown>): PublicListing {
  const category = (row.category as string | null) ?? null;
  const fallback = unitForCategory(category ?? "");
  return {
    ...(row as PublicListing),
    city: (row.city as string | null) ?? null,
    market: (row.market as string | null) ?? null,
    market_slug: (row.market_slug as string | null) ?? null,
    // Same deploy-order safety: null until migration 21 adds it to the view.
    video_url: (row.video_url as string | null) ?? null,
    booking_mode: (row.booking_mode as BookingMode | null) ?? fallback.mode,
    price_unit: (row.price_unit as string | null) ?? fallback.unit,
  };
}

const cachedListings = unstable_cache(
  async (): Promise<PublicListing[]> => {
    const { data, error } = await anon().from("public_listings").select("*");
    if (error) {
      console.error("[home] public_listings read failed:", error.message);
      return [];
    }
    return (data ?? []).map(normalizeListing);
  },
  ["public-listings"],
  { tags: ["listings"], revalidate: 600 },
);

export async function getListings(): Promise<PublicListing[]> {
  return cachedListings();
}

// Markets (market → city → area; see supabase/18_geography.sql). Public
// catalogue data like listings: cached, shared, busted by the same "listings"
// tag when the CRM pings /api/revalidate. Pair with lib/geo.ts (activeMarkets,
// liveCities…) which reduce these to the ones that actually have live listings.
const cachedMarkets = unstable_cache(
  async (): Promise<MarketRow[]> => {
    const { data, error } = await anon()
      .from("markets")
      .select("slug,name,sort_order")
      .eq("active", true)
      .order("sort_order");
    if (error) {
      console.error("[markets] read failed:", error.message);
      return [];
    }
    return (data ?? []) as MarketRow[];
  },
  ["public-markets"],
  { tags: ["listings"], revalidate: 600 },
);

export async function getMarkets(): Promise<MarketRow[]> {
  return cachedMarkets();
}

/** A single public listing by id, or null if it isn't public / doesn't exist. */
const cachedListing = unstable_cache(
  async (id: string): Promise<PublicListing | null> => {
    const { data, error } = await anon().from("public_listings").select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error("[listing] read failed:", error.message);
      return null;
    }
    return data ? normalizeListing(data) : null;
  },
  ["public-listing"],
  { tags: ["listings"], revalidate: 600 },
);

export async function getListing(id: string): Promise<PublicListing | null> {
  return cachedListing(id);
}

/**
 * Resolve a `/stays/[id]` route param, which is either a legacy bare uuid or a
 * slug ending in the listing's 8-char key (see lib/slug.ts). The key branch
 * matches in memory over the already-cached list, so it costs no extra query.
 * Returns null for a param that can't be parsed OR a listing that isn't public.
 */
export async function findListingByParam(param: string): Promise<PublicListing | null> {
  const parsed = parseStayKey(param);
  if (!parsed) return null;
  if (parsed.kind === "uuid") return getListing(parsed.id);
  const all = await getListings();
  return all.find((l) => matchesKey(l.id, parsed.key)) ?? null;
}

export type BusyRange = { start_date: string; end_date: string };

/** Booked date ranges for ALL public listings, grouped by property id (one query).
 *  Feeds the concierge so it only recommends places free for the guest's dates. */
export async function getBusyByProperty(): Promise<Map<string, BusyRange[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_availability")
    .select("property_id,start_date,end_date")
    .order("start_date");
  const map = new Map<string, BusyRange[]>();
  if (error) {
    console.error("[availability] all read failed:", error.message);
    return map;
  }
  for (const row of (data ?? []) as { property_id: string; start_date: string; end_date: string }[]) {
    const arr = map.get(row.property_id) ?? [];
    arr.push({ start_date: row.start_date, end_date: row.end_date });
    map.set(row.property_id, arr);
  }
  return map;
}

/** Busy date ranges (no PII) for a listing, from the public availability window. */
export async function getAvailability(id: string): Promise<BusyRange[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_availability")
    .select("start_date,end_date")
    .eq("property_id", id)
    .order("start_date");
  if (error) {
    console.error("[availability] read failed:", error.message);
    return [];
  }
  return (data ?? []) as BusyRange[];
}

/**
 * Photos for the hero photo-wall. Takes the top `perProperty` photos of each
 * property (the first ones are the best), interleaved round-robin across
 * properties for variety, capped at `max`.
 */
export function pickCollagePhotos(listings: PublicListing[], perProperty = 6, max = 12): string[] {
  const lists = listings.map((l) => (l.photos ?? []).slice(0, perProperty));
  const out: string[] = [];
  let row = 0;
  let added = true;
  while (out.length < max && added) {
    added = false;
    for (const arr of lists) {
      if (arr[row]) {
        out.push(arr[row]);
        added = true;
        if (out.length >= max) break;
      }
    }
    row++;
  }
  return out;
}
