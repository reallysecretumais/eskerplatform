import { ok, guard } from "@/lib/app/api";
import { getListings } from "@/lib/data/listings";
import { getInventory } from "@/lib/data/inventory";
import { normalizeCategory, describeListing } from "@/lib/listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/listings — the browse/search feed.
 *
 * Query: market, area, city, category, amenity, tier=exclusive, mode, q, limit.
 * Public (no auth). Reads the SAME cached `getListings()` the website uses, so
 * the app and the site can never show different inventory or prices.
 *
 * Filtering happens here rather than in the app because the app must never hold
 * the whole catalogue to answer "pools in Islamabad" — and because the ordering
 * (Exclusive first, then photographed, then price) is a business rule that
 * belongs on the server where both faces share it.
 */
export const GET = guard(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const market = sp.get("market")?.trim();
  const area = sp.get("area")?.trim().toLowerCase();
  const city = sp.get("city")?.trim().toLowerCase();
  const category = sp.get("category")?.trim();
  const amenity = sp.get("amenity")?.trim().toLowerCase();
  const mode = sp.get("mode")?.trim();
  const exclusiveOnly = sp.get("tier") === "exclusive";
  const q = sp.get("q")?.trim().toLowerCase();
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 60, 1), 120);
  // The grid's intent doorways. Availability-aware, so they must be resolved
  // where availability lives — never guessed by the client.
  const openTonight = sp.get("openTonight") === "1";
  const minSleeps = Number(sp.get("minSleeps")) || 0;
  const amenityPool = sp.get("intent") === "pool";

  // One pipeline for filters, ordering and card shape — the tonight world runs
  // it twice (confirmed and on-request) and the two sections must never drift.
  const refine = (input: typeof rows0) => {
    let rows = input;
    if (market) rows = rows.filter((l) => l.market_slug === market);
    if (city) rows = rows.filter((l) => (l.city ?? "").toLowerCase() === city);
    if (area) rows = rows.filter((l) => (l.area ?? "").toLowerCase() === area);
    if (category) rows = rows.filter((l) => l.category && normalizeCategory(l.category) === normalizeCategory(category));
    if (mode) rows = rows.filter((l) => l.booking_mode === mode);
    if (exclusiveOnly) rows = rows.filter((l) => l.esker_exclusive);
    if (minSleeps) rows = rows.filter((l) => (l.capacity ?? 0) >= minSleeps);
    if (amenityPool) rows = rows.filter((l) => (l.amenities ?? []).some((a) => a.toLowerCase().includes("pool")));
    if (amenity) rows = rows.filter((l) => (l.amenities ?? []).some((a) => a.toLowerCase().includes(amenity)));
    if (q) {
      rows = rows.filter((l) =>
        [l.title, l.area, l.city, l.category, l.description].some((v) => (v ?? "").toLowerCase().includes(q)),
      );
    }
    // Strongest first — identical rule to the website's homepage ordering.
    return [...rows].sort(
      (a, b) =>
        Number(b.esker_exclusive) - Number(a.esker_exclusive) ||
        (b.photos?.length ? 1 : 0) - (a.photos?.length ? 1 : 0) ||
        b.price - a.price,
    );
  };

  // Cards only need this much; detail comes from /listings/:id. Keeping the
  // feed lean is what makes browsing fast on Pakistani mobile data.
  const card = (l: (typeof rows0)[number]) => ({
    id: l.id,
    title: l.title,
    // What the place IS — generated once here so the app and the website can
    // never describe the same listing differently.
    caption: describeListing(l),
    area: l.area,
    city: l.city,
    market: l.market,
    marketSlug: l.market_slug,
    category: l.category,
    bookingMode: l.booking_mode,
    price: l.price,
    priceUnit: l.price_unit,
    bedrooms: l.bedrooms,
    capacity: l.capacity,
    exclusive: l.esker_exclusive,
    photos: (l.photos ?? []).slice(0, 6),
  });

  const inv = openTonight ? await getInventory(market ?? null) : null;
  const rows0 = inv ? inv.freeTonight : await getListings();
  const sorted = refine(rows0);

  /**
   * The tonight world's second shelf: not booked as far as we know, but nobody
   * has confirmed it — externals with no synced calendar and no fresh owner
   * answer. Sent as its OWN list rather than mixed in, because the two mean
   * different things and the app draws a divider between them ("N more on
   * request"). A guest asking about one of these is what triggers the owner ask
   * that turns unknown into confirmed — this section is the demand engine, not
   * an apology.
   */
  const onRequest = inv ? refine(inv.onRequestTonight) : [];

  return ok({
    total: sorted.length,
    listings: sorted.slice(0, limit).map(card),
    ...(openTonight ? { onRequest: onRequest.slice(0, limit).map(card) } : {}),
  });
});
