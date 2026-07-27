import { ok, guard } from "@/lib/app/api";
import { getInventory } from "@/lib/data/inventory";
import { getMarkets, resolveMarket } from "@/lib/data/markets";
import { describeListing } from "@/lib/listings";
import { thumb } from "@/lib/img";
import type { PublicListing } from "@/lib/data/listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/corridor?market=&hour=&recent=id,id — the moving walls.
 *
 * Returns the curated image set for the cover's three columns, captioned and
 * pre-sized. The app renders; it never decides what a place is called or how
 * large to fetch it — both are decided once, here.
 *
 * Two sizes per image, and the small one is the whole performance strategy:
 * the ambient corridor (behind every other screen) renders the 48px variant at
 * full size and lets the GPU's bilinear filtering do the blurring. No blur
 * filter ever runs, so the walls keep moving on a low-end phone for almost
 * nothing — and each image costs ~1KB instead of ~40KB.
 */

/** Cover tiles. Side walls sit at an angle and are never seen sharp. */
const TILE_W = 340;
/** Ambient: small enough that upscaling IS the blur. */
const SOFT_W = 48;
/** Spec §2.2 — six per column, recycled, never grown. */
const PER_COLUMN = 6;

type Entry = {
  id: string;
  caption: string;
  area: string | null;
  city: string | null;
  exclusive: boolean;
  url: string;
  soft: string;
};

/** Strongest first: Exclusive, then photographed, then price. */
function byStrength(a: PublicListing, b: PublicListing): number {
  return (
    Number(b.esker_exclusive) - Number(a.esker_exclusive) ||
    (b.photos?.length ? 1 : 0) - (a.photos?.length ? 1 : 0) ||
    b.price - a.price
  );
}

/**
 * Deal listings into three columns, strongest work to the CENTRE.
 *
 * Two rules, both from spec §2.7:
 *  1. The centre column carries the strongest imagery — it's the only part of
 *     the corridor nothing covers, so whatever quality the cover has, it has
 *     there. Dealing centre-first each cycle gives it the 1st, 4th, 7th… best.
 *  2. No tile repeats the CAPTION of the tile above it, within a column or
 *     across the loop seam.
 *
 * Rule 2 used to compare property ids, which was the wrong thing to compare.
 * A guest doesn't see ids — they see a line of text, and five of the seventeen
 * properties read "1BHK Apartment" while four read "2BHK Apartment". Two
 * different Gulberg Greens flats stacked in the centre column therefore printed
 * the identical caption twice and looked like a rendering bug. Comparing the
 * rendered line subsumes the id check: the same property always reads the same.
 *
 * The pool CYCLES rather than truncating — with fewer than 18 photographed
 * properties we want three full columns, not three short ones.
 */
const DEAL_ORDER = [1, 0, 2] as const; // centre, left wall, right wall

/** The line a guest actually reads on a captioned tile: what it is, and where. */
function captionLine(l: PublicListing): string {
  return `${describeListing(l)}|${l.city ?? ""}`;
}

function deal(listings: PublicListing[]): PublicListing[][] {
  const cols: PublicListing[][] = [[], [], []];
  if (!listings.length) return cols;

  let taken = 0;
  for (let cycle = 0; cycle < PER_COLUMN; cycle++) {
    for (const target of DEAL_ORDER) {
      const col = cols[target];
      const above = col[col.length - 1];
      // The seam: on the last cycle, the tile we place loops round to sit
      // directly above the column's first tile, so it has a neighbour on both
      // sides and must clash with neither.
      const below = cycle === PER_COLUMN - 1 ? col[0] : undefined;

      // Walk forward for a pick that repeats neither neighbour. Bounded by the
      // pool size so a portfolio too small to satisfy the rule still deals a
      // full column rather than looping forever — a repeat is worse than a gap,
      // but a gap in the wall is worse than both.
      let chosen = taken;
      for (let probe = 0; probe < listings.length; probe++) {
        const cand = listings[(taken + probe) % listings.length];
        const line = captionLine(cand);
        if (above && captionLine(above) === line) continue;
        if (below && captionLine(below) === line) continue;
        chosen = taken + probe;
        break;
      }

      col.push(listings[chosen % listings.length]);
      taken = chosen + 1;
    }
  }
  return cols;
}

function toEntry(l: PublicListing, photoIndex = 0): Entry {
  const photo = l.photos?.[photoIndex] ?? l.photos?.[0] ?? "";
  return {
    id: l.id,
    caption: describeListing(l),
    area: l.area,
    city: l.city,
    exclusive: l.esker_exclusive,
    url: thumb(photo, TILE_W),
    soft: thumb(photo, SOFT_W, 40),
  };
}

export const GET = guard(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const requested = sp.get("market")?.trim() || null;
  // Ids the guest recently looked at, sent from the device only (never stored
  // server-side). The building quietly remembers where they lingered.
  const recent = (sp.get("recent") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const markets = await getMarkets();
  const market = resolveMarket(markets, requested);
  const inv = await getInventory(market?.slug ?? null);

  const photographed = inv.all.filter((l) => (l.photos?.length ?? 0) > 0);
  if (!photographed.length) {
    // The app falls back to its bundled images — the cover is never empty.
    return ok({ columns: [[], [], []], centre: 1, market: market?.slug ?? null });
  }

  const ranked = [...photographed].sort(byStrength);

  // The centre column is the one nothing covers, so it gets the strongest work —
  // led by anything the guest recently viewed, without ever labelling it as such.
  const lifted = [
    ...ranked.filter((l) => recent.includes(l.id)),
    ...ranked.filter((l) => !recent.includes(l.id)),
  ];

  const [left, centre, right] = deal(lifted);

  return ok({
    // Column order: left wall, centre (hero), right wall.
    columns: [left.map((l) => toEntry(l)), centre.map((l) => toEntry(l)), right.map((l) => toEntry(l))],
    centre: 1,
    market: market?.slug ?? null,
    // `hour` is accepted and deliberately unused for now: photo time-tags don't
    // exist as data yet, so serving "dusk at dusk" would be a guess. The contract
    // is here so the app needs no change the day the CRM can tag photography.
    timeMatched: false,
  });
});
