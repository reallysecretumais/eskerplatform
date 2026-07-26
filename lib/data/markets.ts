import "server-only";
import { unstable_cache } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The geography hierarchy: market → city → area (see the app plan §4.5).
 *
 * The MARKET is the only level a guest selects — Islamabad + Rawalpindi are one
 * market because a guest browsing Islamabad happily takes a Bahria stay 30
 * minutes away. The CITY is the truth-teller shown in labels. The AREA is the
 * fine filter.
 *
 * Areas are derived from LIVE LISTINGS, not from the `locations` table, so an
 * area with nothing bookable in it never appears as an empty filter. Markets
 * come from the table (a market can legitimately exist the day before its first
 * listing goes live).
 */

const anon = () =>
  createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

export type AreaNode = { area: string; city: string | null; stays: number };
export type MarketNode = {
  slug: string;
  name: string;
  /** Cities inside this market, in label order — e.g. ["Islamabad","Rawalpindi"]. */
  cities: string[];
  areas: AreaNode[];
  stays: number;
};

/** Markets with live inventory, each with its cities and areas. Cached like
 *  listings and busted by the same `listings` tag when the CRM publishes. */
export const getMarkets = unstable_cache(
  async (): Promise<MarketNode[]> => {
    const db = anon();
    const [{ data: markets, error: mErr }, { data: listings, error: lErr }] = await Promise.all([
      db.from("markets").select("slug,name,sort_order,active").eq("active", true).order("sort_order"),
      db.from("public_listings").select("market_slug,market,city,area"),
    ]);

    if (lErr) {
      console.error("[markets] listings read failed:", lErr.message);
      return [];
    }
    // Pre-migration (or a read failure) → no market data. Callers treat an empty
    // list as "geography not available yet" and fall back to a flat area list,
    // rather than rendering an empty picker.
    if (mErr) console.error("[markets] markets read failed:", mErr.message);

    type Row = { market_slug: string | null; market: string | null; city: string | null; area: string | null };
    const rows = (listings ?? []) as Row[];

    const bySlug = new Map<string, MarketNode>();
    for (const m of markets ?? []) {
      bySlug.set(m.slug as string, { slug: m.slug as string, name: m.name as string, cities: [], areas: [], stays: 0 });
    }

    for (const r of rows) {
      if (!r.market_slug) continue; // listing with no location set yet
      let node = bySlug.get(r.market_slug);
      if (!node) {
        // A listing pointing at a market row we couldn't read — keep the guest's
        // view working using the name the view already gave us.
        node = { slug: r.market_slug, name: r.market ?? r.market_slug, cities: [], areas: [], stays: 0 };
        bySlug.set(r.market_slug, node);
      }
      node.stays++;
      if (r.city && !node.cities.includes(r.city)) node.cities.push(r.city);
      if (r.area) {
        const existing = node.areas.find((a) => a.area === r.area);
        if (existing) existing.stays++;
        else node.areas.push({ area: r.area, city: r.city ?? null, stays: 1 });
      }
    }

    return Array.from(bySlug.values())
      .filter((m) => m.stays > 0) // never offer a market a guest can't book in
      .map((m) => ({
        ...m,
        cities: m.cities.sort((a, b) => a.localeCompare(b)),
        areas: m.areas.sort((a, b) => (a.city ?? "").localeCompare(b.city ?? "") || a.area.localeCompare(b.area)),
      }));
  },
  ["app-markets"],
  { tags: ["listings"], revalidate: 600 },
);

/** The market a guest should land in when they have no stored preference: their
 *  saved `home_market` if it's still live, else the first (lowest sort_order). */
export function resolveMarket(markets: MarketNode[], preferred?: string | null): MarketNode | null {
  if (!markets.length) return null;
  return markets.find((m) => m.slug === preferred) ?? markets[0];
}

/**
 * The guest's saved home market, read separately from `getAccount()` ON PURPOSE.
 *
 * `accounts.home_market` only exists after migration 18 runs. Adding the column
 * to getAccount's select list would make that query fail wholesale until then —
 * which would log every website guest in as a nameless bare account. Keeping it
 * here means a missing column costs one null and nothing else.
 */
export async function getHomeMarket(accountId: string): Promise<string | null> {
  // Session-scoped client: RLS lets an account read only its OWN row, which is
  // exactly the guarantee we want (the cookieless anon client would read nothing).
  const supabase = await createClient();
  const { data, error } = await supabase.from("accounts").select("home_market").eq("id", accountId).maybeSingle();
  if (error) return null; // column not migrated yet, or not readable — both mean "unset"
  return ((data as { home_market?: string | null } | null)?.home_market) ?? null;
}

/** Remember the market the guest is browsing. Silently no-ops before migration
 *  18 adds the column — a preference failing to save must never block browsing. */
export async function setHomeMarket(accountId: string, slug: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ home_market: slug }).eq("id", accountId);
  if (error) {
    console.error("[markets] home_market save failed:", error.message);
    return false;
  }
  return true;
}
