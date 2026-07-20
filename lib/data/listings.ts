import "server-only";
import { unstable_cache } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  /** Which table the listing came from. 'external' = resale inventory Esker
   *  sources from another owner. Drives AVAILABILITY + BOOKING logic only —
   *  guests must never see a difference (founder decision), so never render it. */
  source?: "esker" | "external";
};

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
    photo: l.photos?.[0] ?? null,
  }));
}

const cachedListings = unstable_cache(
  async (): Promise<PublicListing[]> => {
    const { data, error } = await anon().from("public_listings").select("*");
    if (error) {
      console.error("[home] public_listings read failed:", error.message);
      return [];
    }
    return (data ?? []) as PublicListing[];
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
    return (data as PublicListing) ?? null;
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
