import { ok, notFound, guard } from "@/lib/app/api";
import { getListing, getAvailability, getListingHost, getBusyByProperty } from "@/lib/data/listings";
import { rangeConfidence } from "@/lib/data/confidence";
import { company } from "@/lib/contact";
import { crop, thumb } from "@/lib/img";
import { stayPath } from "@/lib/slug";
import { SITE_URL } from "@/lib/seo";
import { getReviews } from "@/lib/data/reviews";
import { getSlots, getBusyTimes } from "@/lib/data/slots";
import { getExternalBookability } from "@/lib/data/externalBooking";
import { advancePct } from "@/lib/payments";
import { isSlottedMode } from "@/lib/listings";
import { mapArea } from "@/lib/map";

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
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const GET = guard(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from");
  const to = sp.get("to");

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

  // The V3 app's Stay page asks with the guest's dates: open, on request
  // (an owner confirms first) or taken, by the same night-by-night rule as
  // /search, so a card and its stay page can never disagree.
  const rangeState =
    from && to && DAY.test(from) && DAY.test(to) && from < to
      ? ((await rangeConfidence([listing], from, to, await getBusyByProperty())).get(listing.id) ?? null)
      : null;

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
      /** The map's circle before booking (area, never the building), or null. */
      mapArea: mapArea(listing),
      /** The stay's page on the website, for Share — built by the one function that builds them. */
      url: `${SITE_URL}${stayPath(listing)}`,
      /** Standard times; the stay page and trip pass show these (website lib/contact.ts). */
      checkIn: company.checkIn,
      checkOut: company.checkOut,
      /** V3 crops at 3x: the Stay page's full-bleed photos, and a square thumbnail for trip cards. */
      media: {
        hero: (listing.photos ?? []).map((p) => crop(p, 1170, 1176, 74)),
        /** The full-screen gallery: each photo whole, its long edge 1600. */
        full: (listing.photos ?? []).map((p) => thumb(p, 1600, 80)),
        thumb: listing.photos?.[0] ? crop(listing.photos[0], 264, 264, 70) : null,
      },
    },
    /** Only when `from` and `to` are given: "open" | "request" | "taken". */
    rangeState,
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
