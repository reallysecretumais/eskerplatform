import { ok, fail, guard } from "@/lib/app/api";
import { getBusyByProperty, isExternal, type PublicListing } from "@/lib/data/listings";
import { getInventory } from "@/lib/data/inventory";
import { rangeConfidence, type RangeState } from "@/lib/data/confidence";
import { cityKey } from "@/lib/app/cities";
import { appCard } from "@/lib/app/cards";
import { byStrength, normalizeCategory } from "@/lib/listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/search — the V3 Results feed (app board 04).
 *
 * Query (all optional):
 *   city, area           where (city is the app's selection; area narrows it)
 *   type                 penthouse | apartment | farmhouse | villa
 *   pool=1, exclusive=1  intents
 *   from, to             YYYY-MM-DD check-in / check-out (checkout-exclusive)
 *   guests               at least this many sleep there
 *   bedrooms             at least this many
 *   minPrice, maxPrice   per night
 *   sort                 recommended (default) | price_asc | price_desc
 *
 * Every matching stay is returned with its availability for the dates, so
 * nothing is hidden and nothing pretends (app REBUILD_PLAN):
 *   open      confirmed for every night
 *   request   nothing booked, but an owner confirms first (D1)
 *   taken     booked for those dates
 * Without dates, `availability` says only how the stay books: instantly
 * ("open") or on the owner's word ("request").
 *
 * Open first, then on request, then taken; within each, the shared strength
 * order (or price, when asked). A separate route rather than a change to
 * /listings: the V2 app still reads that shape until V3 replaces it.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RANK: Record<RangeState, number> = { open: 0, request: 1, taken: 2 };

export const GET = guard(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const city = sp.get("city") ? cityKey(sp.get("city")!) : null;
  const area = sp.get("area")?.trim().toLowerCase() || null;
  const type = sp.get("type")?.trim() || null;
  const pool = sp.get("pool") === "1";
  const exclusive = sp.get("exclusive") === "1";
  const from = sp.get("from");
  const to = sp.get("to");
  const guests = Number(sp.get("guests")) || 0;
  const bedrooms = Number(sp.get("bedrooms")) || 0;
  const minPrice = Number(sp.get("minPrice")) || 0;
  const maxPrice = Number(sp.get("maxPrice")) || 0;
  const sort = sp.get("sort") ?? "recommended";

  const dated = !!(from || to);
  if (dated && !(from && to && DAY.test(from) && DAY.test(to) && from < to)) {
    return fail("bad_dates", "Pick a check-in day before the check-out day.");
  }

  const inv = await getInventory(null);
  let rows: PublicListing[] = inv.all;
  if (city) rows = rows.filter((l) => cityKey(l.city ?? "") === city);
  if (area) rows = rows.filter((l) => (l.area ?? "").toLowerCase() === area);
  if (type) rows = rows.filter((l) => l.category && normalizeCategory(l.category) === normalizeCategory(type));
  if (pool) rows = rows.filter((l) => (l.amenities ?? []).some((a) => a.toLowerCase().includes("pool")));
  if (exclusive) rows = rows.filter((l) => l.esker_exclusive);
  // A stay whose capacity isn't recorded stays in (it may well fit), but one
  // that's known to be too small doesn't.
  if (guests) rows = rows.filter((l) => !(l.capacity && l.capacity > 0 && l.capacity < guests));
  if (bedrooms) rows = rows.filter((l) => (l.bedrooms ?? 0) >= bedrooms);
  if (minPrice) rows = rows.filter((l) => l.price >= minPrice);
  if (maxPrice) rows = rows.filter((l) => l.price <= maxPrice);

  const availability: Map<string, RangeState> = dated
    ? await rangeConfidence(rows, from!, to!, await getBusyByProperty())
    : new Map(rows.map((l) => [l.id, !isExternal(l) || inv.confidence.get(l.id)?.state === "confirmed" ? ("open" as const) : ("request" as const)]));

  const order = (a: PublicListing, b: PublicListing) =>
    RANK[availability.get(a.id) ?? "request"] - RANK[availability.get(b.id) ?? "request"] ||
    // Known to fit before "fit unknown", when the guest gave a party size.
    (guests ? Number(!a.capacity) - Number(!b.capacity) : 0) ||
    (sort === "price_asc" ? a.price - b.price : sort === "price_desc" ? b.price - a.price : byStrength(a, b));

  const stays = [...rows].sort(order).map((l) => appCard(l, availability.get(l.id) ?? "request"));
  return ok({
    total: stays.length,
    open: stays.filter((s) => s.availability === "open").length,
    stays,
  });
});
