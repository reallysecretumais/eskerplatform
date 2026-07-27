import "server-only";
import { getListings, getBusyByProperty, type PublicListing } from "@/lib/data/listings";

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
  /** Free for tonight. */
  freeTonight: PublicListing[];
  counts: {
    total: number;
    tonight: number;
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

  const freeTonight = all.filter((l) => !(busy.get(l.id) ?? []).some((r) => coversDate(r, date)));

  const byCategory: Record<string, number> = {};
  for (const l of all) {
    if (!l.category) continue;
    const key = l.category.toLowerCase();
    byCategory[key] = (byCategory[key] ?? 0) + 1;
  }

  return {
    all,
    freeTonight,
    counts: {
      total: all.length,
      tonight: freeTonight.length,
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
