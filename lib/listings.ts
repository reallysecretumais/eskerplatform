// Mixed inventory books in different ways. Price must be labeled by booking
// type or it erodes trust (a slot-booked pool showing "/night" is wrong).
// For now the unit is derived from the category; later the listing can carry an
// explicit booking_type field that this reads instead.

export type BookingUnit = "night" | "slot" | "hour";

export function unitForCategory(category: string): BookingUnit {
  const c = category.toLowerCase();
  if (c.includes("pool")) return "slot"; // swimming pools — day-use / slot
  if (c.includes("content")) return "hour"; // content spaces — hourly
  return "night"; // apartments, penthouses, villas, farmhouses
}

const NF = new Intl.NumberFormat("en-PK");

/** Returns the formatted amount + the unit word, e.g. { amount: "₨31,000", unit: "night" }. */
export function formatPrice(price: number, unit: BookingUnit): { amount: string; unit: string } {
  return { amount: `₨${NF.format(price)}`, unit };
}

/** Loose category match key (handles plural showcase labels vs singular `kind`). */
export function normalizeCategory(s: string): string {
  return s.trim().toLowerCase().replace(/s$/, "");
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
