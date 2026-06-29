import "server-only";
import { createClient } from "@/lib/supabase/server";

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
};

export async function getListings(): Promise<PublicListing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("public_listings").select("*");
  if (error) {
    console.error("[home] public_listings read failed:", error.message);
    return [];
  }
  return (data ?? []) as PublicListing[];
}

/** A single public listing by id, or null if it isn't public / doesn't exist. */
export async function getListing(id: string): Promise<PublicListing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("public_listings").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[listing] read failed:", error.message);
    return null;
  }
  return (data as PublicListing) ?? null;
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
