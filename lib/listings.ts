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

/** Human date, e.g. "5 Jul 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** True if the text contains Urdu/Arabic script — used to pick the voice + RTL.
 *  The concierge writes Urdu replies in script, so this reliably tags them. */
export function isUrduText(s: string): boolean {
  return /[؀-ۿݐ-ݿ]/.test(s);
}
