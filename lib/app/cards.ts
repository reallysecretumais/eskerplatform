import "server-only";
import { crop } from "@/lib/img";
import type { PublicListing } from "@/lib/data/listings";
import type { RangeState } from "@/lib/data/confidence";
import { mapArea, type MapArea } from "@/lib/map";

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
