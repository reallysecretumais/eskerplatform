import type { PublicListing } from "@/lib/data/listings";

/** How far the true point can be from the area centre (phase97). */
const MAP_AREA_RADIUS_M = 350;

/**
 * The map's circle before booking: the AREA a stay is in, never the building
 * (founder, 26 Oct; 18 of 25 stays are owner-listed). Its centre is
 * public_listings' approx_lat/lng, offset 120–300 m from the true point, which
 * is always inside the circle. Null until a location is set in Esker OS.
 * The exact point reaches only the guest who booked (lib/app/trips.ts).
 * Drawn by the app (`mapArea` on its cards) and the stay page (AreaMap).
 */
export type MapArea = { lat: number; lng: number; radiusM: number };

export function mapArea(l: Pick<PublicListing, "approx_lat" | "approx_lng">): MapArea | null {
  if (l.approx_lat == null || l.approx_lng == null) return null;
  return { lat: l.approx_lat, lng: l.approx_lng, radiusM: MAP_AREA_RADIUS_M };
}
