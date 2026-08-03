import { ok, guard } from "@/lib/app/api";
import { getInventory } from "@/lib/data/inventory";
import { getMarkets, resolveMarket } from "@/lib/data/markets";
import { describeListing } from "@/lib/listings";
import { thumb, crop } from "@/lib/img";
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

/**
 * Cover tiles, asked for at the FRAME they are displayed in rather than fitted
 * inside a square box — see `crop()` for why the old square cost most of the
 * resolution before the pixels ever reached the phone.
 *
 * The hero column is 44% of the screen wide at a 0.265 tile height, so roughly
 * a 0.82 portrait; on a 1080p phone that is ~497×650 real pixels AFTER the
 * centre column's forward scale. 760×936 is ~1.5× that — the headroom that
 * separates "sharp" from "technically covered": the perspective transform
 * resamples every frame, the montage cross-fades between frames, and a 1:1
 * serve has nothing to lose to either. This column is the one thing on the
 * cover that nothing covers; it gets real margin (founder: the corridor
 * photographs "feel a little low quality" — a 1:1 serve at q76 was why).
 *
 * The walls are asked for less on purpose, and not only to save bytes: they sit
 * at 31°, dimmed behind a falloff, and never carry text. Serving them softer
 * than the centre is a depth-of-field cue we get for free, and it is the
 * cheapest way to make the hero look sharper than it is.
 */
const HERO = { w: 760, h: 936, q: 82 };
/**
 * The walls: sharp now, softened only by QUALITY, not by resolution.
 *
 * The previous numbers (250×310 q58) under-served the walls ~1.6× on purpose —
 * the theory was that an angled, dimmed, textless surface could wear the
 * upscale as depth-of-field and make the hero read sharper by contrast. The
 * founder looked at it and said the corridor photographs felt low quality
 * (2026-08-02) — the second time softness has been read as CHEAPNESS rather
 * than art, and his eyes outrank the theory both times. An upscale is not
 * bokeh; a lens blurs light, bilinear filtering smears pixels.
 *
 * So the walls are now served at their real displayed size (~390×520 on a
 * 1080p phone, before the 31° foreshortening REDUCES what's needed) and the
 * hero keeps its edge a subtler way: a quality step (q72 vs q82) and the
 * falloff it always had. Depth stays a suggestion instead of a defect.
 *
 * The FRAME still follows the column — 36% wide against a 0.221 tile height, a
 * 0.81 portrait. It has been landscape and back within a day because the wall
 * width moved twice; the lesson stands: this constant is DERIVED from the
 * app's layout, not chosen. Asking for the shape actually displayed is the
 * whole point of `crop()`, and a mismatch here re-introduces exactly the
 * stretch that made the corridor look cheap the FIRST time.
 */
const WALL = { w: 420, h: 520, q: 72 };
/**
 * How many photographs a hero tile cycles through. Every property has at least
 * three; two is what the corridor can afford to hold at hero resolution without
 * turning the cover into a megabyte. The point is that the centre column stops
 * being a slideshow OF properties and becomes a look INTO each one.
 */
const HERO_FRAMES = 2;
/**
 * The load-in placeholder, and its own size for a reason.
 *
 * The 48px ambient texture was pressed into this job and it was the wrong
 * number: 48px stretched across a 520px tile is an eleven-fold upscale, which
 * is not a soft blur but visible mosaic — "an ugly kind of blur that gets
 * resolved". 128px over the same tile is a four-fold upscale, which reads as
 * genuinely out of focus, and still costs about 3KB.
 *
 * The ambient build keeps 48px, where the extreme upscale IS the blur effect
 * and the tiny payload is the whole performance strategy. Same idea, two jobs,
 * two numbers.
 */
const BLUR_W = 128;
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
  /** The first frame. Kept as its own field so an older build keeps working. */
  url: string;
  /** Every frame this tile cycles through, `url` first. */
  urls: string[];
  /** Small-but-not-tiny frame shown while the real one loads. */
  blur: string;
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
 * properties we want three full columns, not three short ones. It must cycle
 * FAIRLY: every property earns a tile before any property gets a second one.
 * Resolving a caption clash by skipping forward past the clashing candidate
 * silently spends it, and the wall then shows thirteen of seventeen properties
 * while five appear twice — which is how the first version of this rule shipped.
 * So a clash SWAPS rather than skips: the acceptable candidate trades places
 * with the one in line, and nothing is ever consumed out of turn.
 */
const DEAL_ORDER = [1, 0, 2] as const; // centre, left wall, right wall

/** The line a guest actually reads on a captioned tile: what it is, and where. */
function captionLine(l: PublicListing): string {
  return `${describeListing(l)}|${l.city ?? ""}`;
}

function deal(listings: PublicListing[]): PublicListing[][] {
  const cols: PublicListing[][] = [[], [], []];
  if (!listings.length) return cols;

  // A working copy: clashes reorder the queue, they never shorten it.
  const pool = [...listings];
  let taken = 0;

  for (let cycle = 0; cycle < PER_COLUMN; cycle++) {
    for (const target of DEAL_ORDER) {
      const col = cols[target];
      const above = col[col.length - 1];
      // The seam: on the last cycle, the tile we place loops round to sit
      // directly above the column's first tile, so it has a neighbour on both
      // sides and must clash with neither.
      const below = cycle === PER_COLUMN - 1 ? col[0] : undefined;

      const base = taken % pool.length;
      // Look down the queue for the first candidate that repeats neither
      // neighbour, testing every one. If the portfolio is too small for any to
      // qualify, take the one whose turn it is: a repeated caption is bad, and a
      // hole in the wall is worse.
      let pick = base;
      for (let probe = 0; probe < pool.length; probe++) {
        const at = (base + probe) % pool.length;
        const line = captionLine(pool[at]);
        if (above && captionLine(above) === line) continue;
        if (below && captionLine(below) === line) continue;
        pick = at;
        break;
      }

      // Swap the chosen one into its place in line. The candidate it displaces
      // keeps its turn later in the cycle instead of being thrown away.
      if (pick !== base) {
        const held = pool[base];
        pool[base] = pool[pick];
        pool[pick] = held;
      }

      col.push(pool[base]);
      taken++;
    }
  }
  return cols;
}

function toEntry(l: PublicListing, photoIndex = 0, role: "hero" | "wall" = "wall"): Entry {
  const photos = l.photos ?? [];
  const photo = photos[photoIndex] ?? photos[0] ?? "";
  const frame = role === "hero" ? HERO : WALL;

  // A hero tile cycles; a wall shows one frame and stays put. Starting at this
  // tile's own photoIndex means the two sightings of a property that has to
  // appear twice never run the same pair in the same order.
  // Walls cycle too (founder, 2026-07-28). They cost 7KB a frame at 230px, so
  // the whole corridor breathing is cheaper than one sharp hero tile.
  const frames =
    photos.length > 1
      ? Array.from({ length: Math.min(HERO_FRAMES, photos.length) }, (_, k) => photos[(photoIndex + k) % photos.length])
      : [photo];

  return {
    id: l.id,
    caption: describeListing(l),
    area: l.area,
    city: l.city,
    exclusive: l.esker_exclusive,
    url: crop(photo, frame.w, frame.h, frame.q),
    urls: frames.map((p) => crop(p, frame.w, frame.h, frame.q)),
    blur: crop(photo, BLUR_W, Math.round((BLUR_W * frame.h) / frame.w), 40),
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

  /**
   * Eighteen tiles, seventeen properties — someone has to appear twice, and if
   * both tiles carry photo[0] the wall shows the same photograph in two places
   * at once. Every property has at least three photos, so the second sighting
   * costs nothing but an index.
   *
   * The CENTRE is numbered first on purpose: the hero column is the one nothing
   * covers, so it always gets a property's strongest (first) photograph, and any
   * second sighting is pushed out to a wall.
   */
  const seen = new Map<string, number>();
  const entry = (role: "hero" | "wall") => (l: PublicListing): Entry => {
    const n = seen.get(l.id) ?? 0;
    seen.set(l.id, n + 1);
    return toEntry(l, n, role);
  };
  const centreEntries = centre.map(entry("hero"));
  const leftEntries = left.map(entry("wall"));
  const rightEntries = right.map(entry("wall"));

  return ok({
    // Column order: left wall, centre (hero), right wall.
    columns: [leftEntries, centreEntries, rightEntries],
    centre: 1,
    market: market?.slug ?? null,
    // `hour` is accepted and deliberately unused for now: photo time-tags don't
    // exist as data yet, so serving "dusk at dusk" would be a guess. The contract
    // is here so the app needs no change the day the CRM can tag photography.
    timeMatched: false,
  });
});
