// Mixed inventory books in different ways. Price must be labeled by booking
// type or it erodes trust (a slot-booked pool showing "/night" is wrong).
//
// THE MODE IS DECIDED BY CATEGORY, and the DATABASE is the referee: the
// `category_modes` table is surfaced on `public_listings` as booking_mode +
// price_unit, so the website and the mobile app read the same answer and cannot
// diverge. Read `listing.booking_mode` / `listing.price_unit` — do NOT call this
// helper in new code. It exists only as the deploy-order fallback used by
// lib/data/listings.ts before migration 19 has run (and for the rare caller that
// has a category string but no listing row).

export type BookingUnit = "night" | "block" | "hour" | "session";
export type BookingModeName = "nightly" | "blocks" | "hourly" | "session";

/** Fallback mapping — must stay identical to the `category_modes` seed in
 *  supabase/19_bookable.sql. If you change one, change both. */
export function unitForCategory(category: string): { mode: BookingModeName; unit: BookingUnit } {
  const c = category.toLowerCase();
  if (c.includes("pool")) return { mode: "blocks", unit: "block" }; // swimming pools — day-use blocks
  if (c.includes("content")) return { mode: "hourly", unit: "hour" }; // content spaces — hourly
  return { mode: "nightly", unit: "night" }; // apartments, penthouses, villas, farmhouses
}

const NF = new Intl.NumberFormat("en-PK");

/** Returns the formatted amount + the unit word, e.g. { amount: "₨31,000", unit: "night" }.
 *  Pass `listing.price_unit` straight through — never a hardcoded unit. */
export function formatPrice(price: number, unit: string): { amount: string; unit: string } {
  return { amount: `₨${NF.format(price)}`, unit };
}

/** True when a mode sells time-of-day rather than nights (blocks or hourly).
 *  Slotted listings show a "from" price and a block/hour picker, not a range. */
export function isSlottedMode(mode: string): boolean {
  return mode === "blocks" || mode === "hourly";
}

/** Loose category match key (handles plural showcase labels vs singular `kind`). */
export function normalizeCategory(s: string): string {
  return s.trim().toLowerCase().replace(/s$/, "");
}

// ── What a place IS ──────────────────────────────────────────────────────────

/**
 * The one-line description of a listing: `2BHK Penthouse`, `Studio Penthouse`,
 * `Swimming Pool`.
 *
 * Used on the app's corridor captions and property cards, and by the website
 * wherever a listing needs describing. **Generated, never hand-written** — every
 * new property describes itself correctly the day it's published, and there is
 * no second set of names to maintain.
 *
 * Deliberately NOT the property's name. "Park Towers" is internal shorthand and
 * means nothing to a first-time guest; "1BHK Apartment" tells them what it is.
 *
 * `notation` is market-scoped. BHK is the South Asian (and Gulf) vernacular and
 * is Esker's own vocabulary — the properties are literally named "E-11 2BHK
 * Luxury Penthouse". It would read as jargon in Europe, so a future market can
 * pass `bedrooms` instead without touching a caller.
 */
export type BedroomNotation = "bhk" | "bedrooms";

export function describeListing(
  listing: { bedrooms?: number | null; category?: string | null },
  notation: BedroomNotation = "bhk",
): string {
  const category = (listing.category ?? "").trim();
  if (!category) return "";

  // Types where a bedroom count is meaningless carry no prefix at all. Without
  // this a swimming pool reads "0BHK Swimming Pool", which is exactly the sort
  // of thing that ships when the rule isn't written down.
  const { mode } = unitForCategory(category);
  if (mode !== "nightly") return category;

  const beds = listing.bedrooms;
  if (beds == null) return category;
  // A studio is a kind of home, not zero of something.
  if (beds <= 0) return `Studio ${category}`;

  return notation === "bhk" ? `${beds}BHK ${category}` : `${beds}-bedroom ${category.toLowerCase()}`;
}

// ── Homepage composition ─────────────────────────────────────────────────────
// Both helpers are pure and run over the already-cached `getListings()` result,
// so the homepage costs no extra query and updates itself when the CRM busts the
// "listings" cache on publish.

/** How many live stays per category, keyed by `normalizeCategory` — so the
 *  showcase's plural labels ("Apartments") match the data's singular kind
 *  ("Apartment"). A category missing here has no stock yet. */
export function categoryCounts(listings: { category: string | null }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of listings) {
    if (!l.category) continue;
    const key = normalizeCategory(l.category);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

// Below this many stays the homepage shows ONE grid — splitting a handful of
// listings into two headed sections makes the page look emptier, not richer.
// At/above it the Exclusive tier gets its own section (needs enough Exclusives
// to fill a row, else that section looks like an accident).
const SPLIT_AT = 10;
const MIN_EXCLUSIVE_FOR_SECTION = 2;
/** Cap on the second section once split; the rest live behind "Explore all stays". */
export const MORE_SECTION_MAX = 6;

export type HomeSections<T> = {
  mode: "unified" | "split";
  all: T[]; // everything, sorted (what "unified" renders)
  exclusive: T[];
  rest: T[];
};

/** Strongest first: Esker Exclusive → has photos → higher price. */
function byStrength<T extends { esker_exclusive: boolean; photos: string[] | null; price: number }>(a: T, b: T) {
  return (
    Number(b.esker_exclusive) - Number(a.esker_exclusive) ||
    (b.photos?.length ? 1 : 0) - (a.photos?.length ? 1 : 0) ||
    b.price - a.price
  );
}

/**
 * How the homepage should group its stays. Small inventory → one grid showing
 * everything (nothing hidden); once there's enough stock it upgrades itself to
 * "Esker Exclusive" + the rest, with no code change.
 */
export function homeSections<T extends { esker_exclusive: boolean; photos: string[] | null; price: number }>(
  listings: T[],
): HomeSections<T> {
  const all = [...listings].sort(byStrength);
  const exclusive = all.filter((l) => l.esker_exclusive);
  const rest = all.filter((l) => !l.esker_exclusive);
  const mode = all.length >= SPLIT_AT && exclusive.length >= MIN_EXCLUSIVE_FOR_SECTION ? "split" : "unified";
  return { mode, all, exclusive, rest };
}

/** Human date, e.g. "5 Jul 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** True if the text contains Urdu/Arabic script — used to pick the voice + RTL.
 *  The concierge writes Urdu replies in script, so this reliably tags them. */
export function isUrduText(s: string): boolean {
  return /[؀-ۿݐ-ݿ]/.test(s);
}
