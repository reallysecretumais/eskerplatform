import { ok, notFound, guard } from "@/lib/app/api";
import { getListing, getAvailability, getListingHost } from "@/lib/data/listings";
import { getReviews } from "@/lib/data/reviews";
import { getSlots, getBusyTimes } from "@/lib/data/slots";
import { getExternalBookability } from "@/lib/data/externalBooking";
import { advancePct } from "@/lib/payments";
import { isSlottedMode } from "@/lib/listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/listings/:id — everything the stay screen renders, in ONE call.
 *
 * One round-trip is deliberate: on a slow mobile connection, four sequential
 * requests is the difference between a screen that opens and one that stutters.
 * The pieces are fetched in parallel and each degrades independently — a reviews
 * hiccup must not blank the stay.
 *
 * Public (no auth). Every source here is already a public, RLS-gated window, so
 * nothing internal can appear: no cost/margin on resale units, no caretaker, no
 * access codes, no other guests.
 */
export const GET = guard(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const listing = await getListing(id);
  // Not public, unpublished, paused, or nonexistent — all indistinguishable to a
  // guest on purpose (never leak that a private listing exists).
  if (!listing) return notFound("That stay isn't available.");

  const slotted = isSlottedMode(listing.booking_mode);

  const [busyDates, reviews, host, slots, busyTimes, bookability] = await Promise.all([
    getAvailability(id),
    getReviews(id),
    getListingHost(id),
    slotted ? getSlots(id) : Promise.resolve([]),
    slotted ? getBusyTimes(id) : Promise.resolve([]),
    // Resale inventory whose owner calendar is stale can't be instant-sold; we
    // ask the owner first. Esker-run stock is always instant.
    listing.source === "external" ? getExternalBookability(id) : Promise.resolve({ mode: "instant" as const }),
  ]);

  return ok({
    listing: {
      id: listing.id,
      title: listing.title,
      area: listing.area,
      city: listing.city,
      market: listing.market,
      marketSlug: listing.market_slug,
      category: listing.category,
      bookingMode: listing.booking_mode,
      priceUnit: listing.price_unit,
      price: listing.price,
      type: listing.type,
      bedrooms: listing.bedrooms,
      capacity: listing.capacity,
      description: listing.description,
      amenities: listing.amenities ?? [],
      photos: listing.photos ?? [],
      publicFacts: listing.public_facts ?? null,
      exclusive: listing.esker_exclusive,
    },
    // How this stay can be taken right now, and what it costs to hold it.
    booking: {
      mode: listing.booking_mode,
      /** "instant" | "request" — request means we confirm with the owner first. */
      flow: bookability.mode,
      advancePct: advancePct(listing.esker_exclusive),
    },
    availability: {
      /** Nightly: taken date ranges (end is exclusive, like a checkout). */
      busyDates,
      /** Slotted: the block menu + taken time ranges. Empty for nightly stays. */
      slots,
      busyTimes,
    },
    reviews: { summary: reviews.summary, items: reviews.reviews },
    /** Only ever present for self-listed (host) places, and only safe fields. */
    host,
  });
});
