import "server-only";
import type { PublicListing } from "@/lib/data/listings";

/**
 * The cities the mobile app shows in "Pick a city" (app board 11), with the
 * one line of character each tile carries (app spec, "Multi-city").
 *
 * Copy only. Which cities have stays, and how many are open, always comes from
 * live listings, so a city launches the way it always has (CRM lib/cities.ts
 * → an area → a published listing) with zero deploys here. A live city
 * missing from this list still appears, in Cities, without a line. A city
 * listed here with no stays yet shows as "Coming soon"; the spec says keep
 * the tile, never hide it.
 */
export type CityGroup = "cities" | "hills";

export const CITY_COPY: { name: string; group: CityGroup; line: string }[] = [
  { name: "Islamabad", group: "cities", line: "Margalla on one side." },
  { name: "Rawalpindi", group: "cities", line: "The other twin." },
  { name: "Lahore", group: "cities", line: "Lahore, Lahore hai." },
  { name: "Karachi", group: "cities", line: "By the sea." },
  { name: "Murree", group: "hills", line: "Bring a jacket." },
  { name: "Nathiagali", group: "hills", line: "Pine all the way up." },
];

export type CityNode = {
  /** Lowercased name — the app's `city` parameter. */
  key: string;
  name: string;
  group: CityGroup;
  line: string | null;
  stays: number;
  /** CONFIRMED free tonight (the inventory's own count, never a guess). */
  openTonight: number;
  /** Areas with live stays, busiest first. */
  areas: { area: string; stays: number }[];
};

export const cityKey = (name: string) => name.trim().toLowerCase();

/** Every city the app can show, copy order first, then any live city the copy doesn't know yet. */
export function cityNodes(all: PublicListing[], freeTonight: PublicListing[]): CityNode[] {
  const names = [...CITY_COPY.map((c) => c.name)];
  for (const l of all) if (l.city && !names.some((n) => cityKey(n) === cityKey(l.city!))) names.push(l.city);

  return names.map((name) => {
    const copy = CITY_COPY.find((c) => cityKey(c.name) === cityKey(name));
    const here = all.filter((l) => cityKey(l.city ?? "") === cityKey(name));
    const areas = new Map<string, number>();
    for (const l of here) if (l.area) areas.set(l.area, (areas.get(l.area) ?? 0) + 1);
    return {
      key: cityKey(name),
      name,
      group: copy?.group ?? "cities",
      line: copy?.line ?? null,
      stays: here.length,
      openTonight: freeTonight.filter((l) => cityKey(l.city ?? "") === cityKey(name)).length,
      areas: [...areas.entries()].map(([area, stays]) => ({ area, stays })).sort((a, b) => b.stays - a.stays || a.area.localeCompare(b.area)),
    };
  });
}
