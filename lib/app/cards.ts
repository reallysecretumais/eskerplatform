import "server-only";
import { crop } from "@/lib/img";
import type { PublicListing } from "@/lib/data/listings";
import type { RangeState } from "@/lib/data/confidence";

/**
 * The stay card the V3 app draws on Home and Results, in one shape.
 *
 * Photos are cropped to the exact frame each card fills (lib/img.ts, `crop`):
 * a frame that disagrees with the box it fills is either an upscale (blur) or
 * wasted bytes. At 3× for the sharpest phones:
 *   cover   Home's "Open tonight" card, 300 × 176pt
 *   photos  Results' swipeable card, 350 × 262pt, at most five
 *
 * Whether a stay is Esker's own or resold is never sent (founder decision:
 * guests must never see a difference). The app gets `availability` only.
 */
/** How far the true point can be from the area centre (phase97). */
export const MAP_AREA_RADIUS_M = 350;

/**
 * The map's circle before booking: the AREA a stay is in, never the building
 * (founder, 26 Oct; 18 of 25 stays are owner-listed). Its centre is
 * public_listings' approx_lat/lng, offset 120–300 m from the true point, which
 * is always inside the circle. Null until a location is set in Esker OS.
 * The exact point reaches only the guest who booked (lib/app/trips.ts).
 */
export type MapArea = { lat: number; lng: number; radiusM: number };

export function mapArea(l: PublicListing): MapArea | null {
  if (l.approx_lat == null || l.approx_lng == null) return null;
  return { lat: l.approx_lat, lng: l.approx_lng, radiusM: MAP_AREA_RADIUS_M };
}

export type AppCard = {
  id: string;
  title: string;
  /** The area's name, e.g. "B-17". The map's circle is `mapArea`. */
  area: string | null;
  city: string | null;
  category: string | null;
  bedrooms: number | null;
  /** Null when unknown; never 0 (a 0 in the data means "not set"). */
  capacity: number | null;
  price: number;
  priceUnit: string;
  exclusive: boolean;
  amenities: string[];
  cover: string | null;
  photos: string[];
  availability: RangeState;
  mapArea: MapArea | null;
};

const MAX_CARD_PHOTOS = 5;

export function appCard(l: PublicListing, availability: RangeState): AppCard {
  const photos = l.photos ?? [];
  return {
    id: l.id,
    title: l.title,
    area: l.area,
    city: l.city,
    category: l.category,
    bedrooms: l.bedrooms,
    capacity: l.capacity && l.capacity > 0 ? l.capacity : null,
    price: l.price,
    priceUnit: l.price_unit,
    exclusive: l.esker_exclusive,
    amenities: l.amenities ?? [],
    cover: photos[0] ? crop(photos[0], 900, 528, 72) : null,
    photos: photos.slice(0, MAX_CARD_PHOTOS).map((p) => crop(p, 1050, 786, 72)),
    availability,
    mapArea: mapArea(l),
  };
}
