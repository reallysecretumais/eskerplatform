import { ok, guard } from "@/lib/app/api";
import { getInventory } from "@/lib/data/inventory";
import { cityKey, cityNodes } from "@/lib/app/cities";
import { appCard } from "@/lib/app/cards";
import { byStrength, normalizeCategory } from "@/lib/listings";
import { crop } from "@/lib/img";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/home?city= — the V3 Home (app board 02) in one call.
 * Replaces V2's /grid, /corridor and /greeting, which stay until the V2 app is
 * gone.
 *
 * Counts are the inventory's CONFIRMED-open numbers, the same ones the website
 * uses, so "8 open tonight" in the app and on the site can never disagree.
 * Stays nobody has confirmed are counted separately (`onRequestTonight`) and
 * never folded into the headline.
 */

/** The spec's four type tiles, in its order. A type with nothing in the city doesn't show. */
const TYPES = [
  { key: "penthouse", label: "Penthouses" },
  { key: "apartment", label: "Apartments" },
  { key: "farmhouse", label: "Farmhouses" },
  { key: "villa", label: "Villas" },
];

/** Cards in "Open tonight"; the rest are one tap away in "See all". */
const OPEN_TONIGHT_MAX = 10;

/** "Bahria Town (Phase 7-8)" → "Bahria Town": how a guest would type it. */
const spoken = (area: string) => area.replace(/\s*\(.*\)\s*/g, "").trim();

export const GET = guard(async (req: Request) => {
  const requested = cityKey(new URL(req.url).searchParams.get("city") ?? "");
  const inv = await getInventory(null);
  const cities = cityNodes(inv.all, inv.freeTonight);
  const city = cities.find((c) => c.key === requested) ?? cities.find((c) => c.stays > 0) ?? cities[0];

  const inCity = (l: { city: string | null }) => cityKey(l.city ?? "") === city.key;
  const all = inv.all.filter(inCity);
  const open = inv.freeTonight.filter(inCity).sort(byStrength);

  // Each type tile shows the city's own strongest stay of that type — always
  // bookable, always in the city the guest picked.
  const types = TYPES.flatMap((t) => {
    const ofType = all.filter((l) => l.category && normalizeCategory(l.category) === t.key).sort(byStrength);
    const lead = ofType.find((l) => l.photos?.length);
    return ofType.length && lead ? [{ key: t.key, label: t.label, count: ofType.length, photo: crop(lead.photos![0], 222, 222, 70) }] : [];
  });

  // The Ask Esker bar's example, written the way guests type and built from
  // what's really here, so the example itself is answerable.
  const hasPool = all.some((l) => (l.amenities ?? []).some((a) => a.toLowerCase().includes("pool")));
  const topArea = city.areas[0]?.area;
  const example = hasPool ? "Pool wala ghar, is weekend" : topArea ? `${spoken(topArea)}, 4 log, this Friday` : `${city.name}, 4 log, this Friday`;

  return ok({
    city: { key: city.key, name: city.name, stays: city.stays },
    openTonight: open.length,
    onRequestTonight: inv.onRequestTonight.filter(inCity).length,
    types,
    open: open.slice(0, OPEN_TONIGHT_MAX).map((l) => appCard(l, "open")),
    areas: city.areas.slice(0, 6),
    example,
  });
});
