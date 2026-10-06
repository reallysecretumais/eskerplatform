import { AREAS, PACKAGES, DEFAULT_PACKAGE, HERO_LISTING_ID, PROOF, type PackageId, type UnitType } from "@/lib/invest/config";
import { findArea, unitsOf } from "@/lib/invest/calc";
import { getListings } from "@/lib/data/listings";
import { crop } from "@/lib/img";

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** A selection from the URL, every part validated and defaulted — a mangled link
 *  still opens on a sensible projection rather than an error. */
export function readSelection(sp: SearchParams): { areaId: string; unit: UnitType; stake: number; pkg: PackageId } {
  const area = findArea(one(sp.area)) ?? AREAS.find((a) => a.id === "e11") ?? AREAS[0];
  const want = one(sp.unit) as UnitType;
  const unit: UnitType = area.units[want] ? want : area.units["2BHK"] ? "2BHK" : unitsOf(area)[0];
  const stake = one(sp.stake) === "50" ? 0.5 : 1;
  const pkg = (PACKAGES.find((p) => p.id === one(sp.pkg))?.id ?? DEFAULT_PACKAGE) as PackageId;
  return { areaId: area.id, unit, stake, pkg };
}

/**
 * Real Esker photographs from the live website listings (cover photo = the
 * one the team chose), resized by Supabase to the exact frame each slot shows.
 * Null when a listing is unpublished — the slot then shows its sand fill.
 */
export async function investPhotos() {
  const listings = await getListings().catch(() => []);
  const cover = (id: string) => listings.find((l) => l.id === id)?.photos?.[0] ?? null;
  const sized = (id: string, w: number, h: number, q = 74) => {
    const u = cover(id);
    return u ? crop(u, w, h, q) : null;
  };
  return {
    hero: sized(HERO_LISTING_ID, 880, 1174, 78),
    areas: Object.fromEntries(AREAS.map((a) => [a.id, sized(a.photoListingId, 344, 392)])),
    proof: PROOF.map((p) => sized(p.listingId, 960, 380)),
  };
}
