import { ok, guard, appAccount } from "@/lib/app/api";
import { getInventory, intentFilter } from "@/lib/data/inventory";
import { getMarkets, getHomeMarket, resolveMarket } from "@/lib/data/markets";
import { getMyBookings } from "@/lib/auth";
import { describeListing } from "@/lib/listings";
import { crop } from "@/lib/img";
import type { PublicListing } from "@/lib/data/listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/grid?market= — the entire home screen in ONE call.
 *
 * Tiles, counts, tile imagery, the Coming Soon band, and (when signed in) the
 * active trip. One request because the grid is a single composition: assembling
 * it from four calls would make tiles pop in at different times, which is the
 * opposite of the "lobby" it's meant to be.
 *
 * Every doorway is derived from live stock. A doorway with nothing behind it
 * does not render — the app never has to hide an empty promise.
 */

/**
 * Tile imagery, asked for at the SHAPE each doorway is drawn in.
 *
 * This carried the same fault the corridor did: a square `contain` box, which
 * spends most of its pixels on the axis the client then crops away. Measured on
 * the live grid, the hero was being served a 336×420 portrait to fill 667×499
 * real pixels — a 2× upscale on the largest thing on the screen — while a small
 * doorway a fifth of its area paid for the identical fetch.
 *
 * The hero gets its own frame because it is four times the area of the rest;
 * a small tile costs a fifth of what it did. The shapes themselves live on the
 * constants below and follow the app's mosaic.
 */
// DERIVED FROM THE APP'S LAYOUT, not chosen — the mosaic fills the screen
// height, so a doorway is ~1.3 portrait (124×164dp) and the hero ~254×334dp.
// The corridor taught this lesson twice: a frame that disagrees with the tile
// it fills is either an upscale (blur) or a stretch (cheap).
const HERO_TILE = { w: 620, h: 815, q: 72 };
const SMALL_TILE = { w: 340, h: 450, q: 62 };
/** The Exclusive cell: 2×1 in the mosaic, ~1.55 wide. At 42% opacity behind
 *  text, the one place lower quality genuinely cannot be seen. */
const BAND = { w: 640, h: 415, q: 60 };
const MONTAGE_MAX = 5;

function photosFor(listings: PublicListing[], size: "hero" | "sm" = "sm", leadPhoto = 0): string[] {
  const f = size === "hero" ? HERO_TILE : SMALL_TILE;
  const out: string[] = [];
  // One photo per property before a second from any — a montage of one room
  // photographed five ways is not a montage. `leadPhoto` shifts only the FIRST
  // one, for a doorway that had to reuse a property; see spreadLeads.
  for (const l of listings) {
    const photos = l.photos ?? [];
    const p = out.length === 0 ? photos[leadPhoto % Math.max(photos.length, 1)] ?? photos[0] : photos[0];
    if (p) out.push(crop(p, f.w, f.h, f.q));
    if (out.length >= MONTAGE_MAX) break;
  }
  return out;
}

/**
 * NO TWO DOORWAYS LEAD WITH THE SAME PROPERTY.
 *
 * Each tile builds its own photo list from its own listings, and `intentFilter`
 * preserves one shared strength order — so the strongest property led several
 * doorways at once. Measured live: All stays, Open tonight and Apartments all
 * opened with the identical photograph, and With a pool matched the Exclusive
 * band. Three distinct images across six surfaces, on the screen whose entire
 * job is to make seventeen properties feel like seventeen places.
 *
 * Greedy, in the order the guest reads them: the hero goes first and keeps the
 * strongest, then each following doorway rotates to the strongest property not
 * already leading somewhere else. Rotation rather than removal, so a doorway
 * keeps every one of its own properties — it just starts somewhere else, which
 * also means the montages stay distinct if they ever cycle.
 *
 * A NARROW CATEGORY MAY HAVE NO CHOICE. "Sleeps 6+" and "Apartments" overlap,
 * as do "With a pool" and Exclusive; once the wider doorway has claimed the only
 * property they share, there is nothing unclaimed left to rotate to. Rather than
 * repeat the photograph, such a doorway takes a DIFFERENT ROOM in the same
 * property — every listing carries several. Two cells then lead with the same
 * home and still look like two places, which is true and also better looking.
 * The corridor learned this same lesson when 18 tiles had to cover 17 stays.
 */
function spreadLeads(groups: { listings: PublicListing[]; leadPhoto?: number }[]): void {
  const led = new Map<string, number>();
  for (const g of groups) {
    const at = g.listings.findIndex((l) => !led.has(l.id) && l.photos?.length);
    if (at > 0) g.listings = [...g.listings.slice(at), ...g.listings.slice(0, at)];

    const lead = g.listings[0];
    if (!lead) continue;

    // How many doorways already lead with this property; that count IS the
    // photo to take, so the second sighting shows the second room.
    const taken = led.get(lead.id) ?? 0;
    g.leadPhoto = taken;
    led.set(lead.id, taken + 1);
  }
}

export const GET = guard(async (req: Request) => {
  const requested = new URL(req.url).searchParams.get("market")?.trim() || null;

  const [markets, account] = await Promise.all([getMarkets(), appAccount()]);
  const home = account ? await getHomeMarket(account.id) : null;
  const market = resolveMarket(markets, requested ?? home);
  const inv = await getInventory(market?.slug ?? null);

  const c = inv.counts;

  // ── Doorways ─────────────────────────────────────────────────────────────
  // Order matters: the everything-door leads, then the two highest-intent ways
  // in, then types. Each carries its own photography.
  const candidates = [
    { key: "all", label: "All stays", size: "hero" as const, count: c.total, listings: inv.all },
    { key: "tonight", label: "Open tonight", size: "sm" as const, count: c.tonight, listings: inv.freeTonight },
    { key: "pool", label: "With a pool", size: "sm" as const, count: c.pools, listings: intentFilter(inv.all, "pool") },
    ...Object.entries(c.byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        // "Penthouse" → "Penthouses". The DB stores the singular kind.
        label: `${key.charAt(0).toUpperCase()}${key.slice(1)}s`,
        size: "sm" as const,
        count,
        listings: intentFilter(inv.all, key),
      })),
    { key: "sleeps6", label: "Sleeps 6+", size: "sm" as const, count: c.sleeps6, listings: intentFilter(inv.all, "sleeps6") },
  ];

  // A doorway with nothing behind it doesn't render.
  const live: (typeof candidates[number] & { leadPhoto?: number })[] = candidates.filter((t) => t.count > 0);
  // The Exclusive band draws from the same pool, so it takes part in the same
  // spread — it was leading with the identical photograph as "With a pool".
  const exclusiveGroup: { listings: PublicListing[]; leadPhoto?: number } = {
    listings: intentFilter(inv.all, "exclusive"),
  };
  spreadLeads([...live, exclusiveGroup]);

  const tiles = live
    .map((t) => ({
      key: t.key,
      label: t.label,
      size: t.size,
      count: t.count,
      photos: photosFor(t.listings, t.size, t.leadPhoto),
      // Only the hero speaks a full sentence (spec §5.2) — every other tile is
      // a name alone, so the app receives no subtitle to be tempted by.
      subtitle:
        t.key === "all"
          ? c.tonight > 0
            ? `${c.total} properties · ${c.tonight} open tonight`
            : `${c.total} properties · fully booked tonight`
          : null,
    }));

  // ── Esker Exclusive: its own band, spanning everything ───────────────────
  const exclusive =
    c.exclusives > 0
      ? {
          key: "exclusive",
          label: "Esker Exclusive",
          subtitle: "Inspected and managed by us",
          count: c.exclusives,
          // The band is wide and short — 4.5:1, nothing like a doorway — so it
          // gets its own frame. It also sits at 42% opacity behind text, which
          // is the one place a lower quality genuinely cannot be seen.
          photos: exclusiveGroup.listings
            .slice(0, 1)
            .map((l) => {
              const ph = l.photos ?? [];
              const pick = ph[(exclusiveGroup.leadPhoto ?? 0) % Math.max(ph.length, 1)] ?? ph[0];
              return crop(pick ?? "", BAND.w, BAND.h, BAND.q);
            })
            .filter(Boolean),
        }
      : null;

  // ── The active trip (the grid's hero becomes their stay) ─────────────────
  let trip: {
    bookingId: string;
    caption: string;
    area: string | null;
    city: string | null;
    checkinLabel: string;
    photos: string[];
    staying: boolean;
  } | null = null;

  if (account) {
    const now = Date.now();
    const live = (await getMyBookings())
      .filter((b) => !["cancelled", "checked_out", "lost"].includes(b.status))
      .filter((b) => b.checkout && new Date(`${b.checkout}T12:00:00+05:00`).getTime() >= now)
      .sort((a, b) => (a.checkin ?? "").localeCompare(b.checkin ?? ""))[0];

    if (live?.listing) {
      const l = inv.all.find((x) => x.id === live.listing?.id);
      const startsAt = live.checkin ? new Date(`${live.checkin}T16:00:00+05:00`).getTime() : now;
      const staying = startsAt <= now;
      const days = Math.ceil((startsAt - now) / 86_400_000);

      trip = {
        bookingId: live.id,
        caption: l ? describeListing(l) : (live.listing.category ?? "Your stay"),
        area: l?.area ?? live.listing.area ?? null,
        city: l?.city ?? null,
        checkinLabel: staying
          ? "You're staying now"
          : days <= 0
            ? "Check in today · 4pm"
            : days === 1
              ? "Check in tomorrow · 4pm"
              : `Check in in ${days} days`,
        photos: l ? photosFor([l]) : [],
        staying,
      };
    }
  }

  return ok({
    market: market ? { slug: market.slug, name: market.name, cities: market.cities } : null,
    markets: markets.map((m) => ({ slug: m.slug, name: m.name, stays: m.stays })),
    tiles,
    exclusive,
    trip,
    // Growth signal, not clutter (spec §5.4). A category graduates into `tiles`
    // the moment it has stock, and disappears from here — the layout absorbs
    // growth with no redesign.
    comingSoon: ["Pools", "Villas", "Farmhouses", "Spaces"].filter(
      (name) => !c.byCategory[name.toLowerCase().replace(/s$/, "")],
    ),
  });
});
