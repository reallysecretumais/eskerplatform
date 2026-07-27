import { ok, guard, appAccount } from "@/lib/app/api";
import { getInventory, intentFilter } from "@/lib/data/inventory";
import { getMarkets, getHomeMarket, resolveMarket } from "@/lib/data/markets";
import { getMyBookings } from "@/lib/auth";
import { describeListing } from "@/lib/listings";
import { thumb } from "@/lib/img";
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

/** Tile imagery: 3–5 photos per doorway, pre-sized. Grid tiles are small. */
const TILE_W = 420;
const MONTAGE_MAX = 5;

function photosFor(listings: PublicListing[]): string[] {
  const out: string[] = [];
  // One photo per property before a second from any — a montage of one room
  // photographed five ways is not a montage.
  for (const l of listings) {
    const p = l.photos?.[0];
    if (p) out.push(thumb(p, TILE_W));
    if (out.length >= MONTAGE_MAX) break;
  }
  return out;
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

  const tiles = candidates
    .filter((t) => t.count > 0) // a doorway with nothing behind it doesn't render
    .map((t) => ({
      key: t.key,
      label: t.label,
      size: t.size,
      count: t.count,
      photos: photosFor(t.listings),
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
          photos: photosFor(intentFilter(inv.all, "exclusive")),
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
