import "server-only";
import { getListings, getBusyByProperty, type PublicListing } from "@/lib/data/listings";
import { confidenceFor, type ListingConfidence } from "@/lib/data/confidence";

/**
 * Availability-aware inventory: what's actually free, and how much of it.
 *
 * ONE home for these counts because three surfaces need the same numbers and
 * they must never disagree — the cover's greeting ("4 open tonight"), the grid's
 * hero sentence and its intent doorways, and the world views' honest endings.
 * If the greeting says four and the grid shows three, the whole
 * nothing-in-this-app-pretends principle collapses.
 */

/** Local (Asia/Karachi) calendar date, as YYYY-MM-DD. */
export function todayPk(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(now);
}

/** True when a busy range covers `date`. Ranges are half-open: end is exclusive,
 *  exactly like a checkout — a stay ending today frees the room today. */
function coversDate(range: { start_date: string; end_date: string }, date: string): boolean {
  return range.start_date <= date && date < range.end_date;
}

const hasPool = (l: PublicListing) =>
  (l.amenities ?? []).some((a) => a.toLowerCase().includes("pool"));

export type Inventory = {
  /** Every published listing in the market. */
  all: PublicListing[];
  /**
   * CONFIRMED free for tonight — stock we can stand behind, and the only thing
   * any public count is allowed to be built from.
   *
   * This used to mean "no busy row covers tonight", which is the truth for a
   * stay Esker runs and a guess for a resold unit whose owner never linked a
   * calendar. Silence from a calendar we don't hold is not availability. That
   * conflation is why the app announced "17 open tonight" out of twenty.
   */
  freeTonight: PublicListing[];
  /**
   * Not booked as far as we know, but nobody has confirmed it — externals with
   * no synced calendar and no recent owner answer.
   *
   * These are NOT hidden. They appear wherever they belong wearing "on
   * request", and a guest tapping one is what triggers the owner ask that turns
   * an unknown into a confirmed. Real demand is a far better trigger than a
   * nightly cron pestering every owner about nights nobody wants.
   */
  onRequestTonight: PublicListing[];
  /** Booking confidence per listing id for tonight — see `lib/data/confidence`. */
  confidence: Map<string, ListingConfidence>;
  counts: {
    total: number;
    /** CONFIRMED free tonight. The number the greeting and the doorway say. */
    tonight: number;
    /** Unconfirmed but unbooked — the "N more on request" line. */
    onRequest: number;
    pools: number;
    sleeps6: number;
    exclusives: number;
    /** Free tonight AND Esker Exclusive — what the greeting's exclusive line means. */
    exclusivesTonight: number;
    /** Per category, keyed by the lowercased category name. */
    byCategory: Record<string, number>;
  };
};

/**
 * The market's inventory with tonight's availability applied.
 *
 * Reads the cached listing window and the (deliberately uncached) availability
 * window — availability must stay correct to the minute, listings need not.
 */
export async function getInventory(marketSlug?: string | null, now = new Date()): Promise<Inventory> {
  const [listings, busy] = await Promise.all([getListings(), getBusyByProperty()]);
  const date = todayPk(now);

  const all = marketSlug ? listings.filter((l) => l.market_slug === marketSlug) : listings;

  const isBusy = (l: PublicListing) => (busy.get(l.id) ?? []).some((r) => coversDate(r, date));
  const confidence = await confidenceFor(all, date, isBusy);

  // Split, rather than filter. What used to be one bucket is genuinely two, and
  // keeping them apart at the source is what stops a caller downstream quietly
  // re-merging them and putting the guess back into the headline.
  const freeTonight = all.filter((l) => confidence.get(l.id)?.state === "confirmed");
  const onRequestTonight = all.filter((l) => confidence.get(l.id)?.state === "unknown");

  const byCategory: Record<string, number> = {};
  for (const l of all) {
    if (!l.category) continue;
    const key = l.category.toLowerCase();
    byCategory[key] = (byCategory[key] ?? 0) + 1;
  }

  return {
    all,
    freeTonight,
    onRequestTonight,
    confidence,
    counts: {
      total: all.length,
      tonight: freeTonight.length,
      onRequest: onRequestTonight.length,
      pools: all.filter(hasPool).length,
      // "Sleeps 6+" is a real trip type (the group weekend), not a filter chip.
      sleeps6: all.filter((l) => (l.capacity ?? 0) >= 6).length,
      exclusives: all.filter((l) => l.esker_exclusive).length,
      exclusivesTonight: freeTonight.filter((l) => l.esker_exclusive).length,
      byCategory,
    },
  };
}

/** Pools free tonight — the greeting's "two pools are glowing" is this number. */
export function poolsFreeTonight(inv: Inventory): number {
  return inv.freeTonight.filter(hasPool).length;
}

/** The intents the grid offers as doorways, resolved against live stock. */
export function intentFilter(listings: PublicListing[], key: string): PublicListing[] {
  switch (key) {
    case "tonight":
      return listings; // caller passes freeTonight
    case "pool":
      return listings.filter(hasPool);
    case "sleeps6":
      return listings.filter((l) => (l.capacity ?? 0) >= 6);
    case "exclusive":
      return listings.filter((l) => l.esker_exclusive);
    case "all":
      return listings;
    default:
      // A category doorway (penthouse, apartment, …).
      return listings.filter((l) => (l.category ?? "").toLowerCase() === key);
  }
}
