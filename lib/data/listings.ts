import "server-only";
import sharp from "sharp";
import { unstable_cache } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { thumb } from "@/lib/img";

// Cookieless anon client for cacheable public reads (no per-request cookies, so
// the result can be cached + shared). Public listing data is the same for
// everyone and changes rarely (only when an admin edits/publishes in the CRM),
// so it's cached and busted on demand via the /api/revalidate webhook ("listings"
// tag). Availability is NOT cached — it must stay correct to the minute.
const anon = () => createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

// Live read of the public listing window (anon-safe; only public_listing = true
// rows, only safe columns). This is the single source the homepage reads from.

export type PublicListing = {
  id: string;
  title: string;
  area: string | null;
  category: string | null;
  type: string | null;
  bedrooms: number | null;
  capacity: number | null;
  price: number;
  description: string | null;
  amenities: string[] | null;
  photos: string[] | null;
  esker_exclusive: boolean;
  public_facts?: string | null; // public-safe facts for the concierge (parking, landmarks, rules…)
  card_photo?: string | null;   // the most landscape-shaped of the top photos (best in a wide card)
};

// The photo library is mostly portrait phone shots, and a wide card cover-crops a
// portrait heavily (it feels "cropped in"). For the CARD THUMBNAIL only, pick the
// widest (most landscape) of a listing's top photos — a landscape photo barely
// crops in a wide card. The property page still shows every photo in order.
//
// Orientation is read from a tiny 32px thumbnail (a few hundred bytes) so this is
// cheap; the decision is cached 24h per listing (busted with the "listings" tag),
// so in steady state it runs ~never. Any failure falls back to the lead photo —
// exactly today's behaviour, so there's zero regression risk.
async function photoRatio(url: string): Promise<number | null> {
  try {
    const res = await fetch(thumb(url, 32, 40), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    return meta.width && meta.height ? meta.width / meta.height : null;
  } catch {
    return null;
  }
}

async function bestCardPhoto(photos: string[]): Promise<string | null> {
  const pool = photos.slice(0, 12); // cap the measurement cost
  if (pool.length <= 1) return pool[0] ?? null;
  const ratios = await Promise.all(pool.map(photoRatio));
  // Keep the chosen lead when it already fits a wide card well (ratio ≥ 1.2).
  if (ratios[0] != null && ratios[0] >= 1.2) return pool[0];
  // Otherwise switch to the widest clearly-landscape photo anywhere in the set —
  // a small, well-composed landscape thumbnail beats a heavily-cropped portrait.
  let best: string | null = null;
  let bestRatio = 1.2;
  for (let i = 0; i < pool.length; i++) {
    const r = ratios[i];
    if (r != null && r >= bestRatio) {
      bestRatio = r;
      best = pool[i];
    }
  }
  return best ?? pool[0] ?? null;
}

function cardPhoto(id: string, photos: string[] | null): Promise<string | null> {
  const list = photos ?? [];
  return unstable_cache(() => bestCardPhoto(list), ["card-photo", id], { tags: ["listings"], revalidate: 86_400 })();
}

async function withCardPhotos(listings: PublicListing[]): Promise<PublicListing[]> {
  await Promise.all(listings.map(async (l) => (l.card_photo = await cardPhoto(l.id, l.photos))));
  return listings;
}

// What client components actually need to render a match card — nothing more.
// The AI catalog is built SERVER-side (/api/concierge), so shipping the full
// listings (descriptions, facts, every photo URL) to the browser was pure
// payload. Pass this slim projection to any "use client" component instead.
export type SlimListing = {
  id: string;
  title: string;
  area: string | null;
  category: string | null;
  price: number;
  esker_exclusive: boolean;
  photo: string | null; // lead photo only
};

export function slimListings(listings: PublicListing[]): SlimListing[] {
  return listings.map((l) => ({
    id: l.id,
    title: l.title,
    area: l.area,
    category: l.category,
    price: l.price,
    esker_exclusive: l.esker_exclusive,
    photo: l.card_photo ?? l.photos?.[0] ?? null,
  }));
}

const cachedListings = unstable_cache(
  async (): Promise<PublicListing[]> => {
    const { data, error } = await anon().from("public_listings").select("*");
    if (error) {
      console.error("[home] public_listings read failed:", error.message);
      return [];
    }
    return withCardPhotos((data ?? []) as PublicListing[]);
  },
  ["public-listings"],
  { tags: ["listings"], revalidate: 600 },
);

export async function getListings(): Promise<PublicListing[]> {
  return cachedListings();
}

/** A single public listing by id, or null if it isn't public / doesn't exist. */
const cachedListing = unstable_cache(
  async (id: string): Promise<PublicListing | null> => {
    const { data, error } = await anon().from("public_listings").select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error("[listing] read failed:", error.message);
      return null;
    }
    if (!data) return null;
    const listing = data as PublicListing;
    listing.card_photo = await cardPhoto(listing.id, listing.photos);
    return listing;
  },
  ["public-listing"],
  { tags: ["listings"], revalidate: 600 },
);

export async function getListing(id: string): Promise<PublicListing | null> {
  return cachedListing(id);
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
