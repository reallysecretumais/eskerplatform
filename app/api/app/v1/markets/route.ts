import { ok, fail, guard, appAccount, readJson, unauthorized } from "@/lib/app/api";
import { getMarkets, getHomeMarket, setHomeMarket } from "@/lib/data/markets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/markets — the geography the app renders its market picker and
 * area filters from: market → city → area, with a stay count at each level.
 *
 * Public (no auth). When the caller IS signed in we also return their saved home
 * market, so the app can lead with the right place without a second round-trip.
 */
export const GET = guard(async () => {
  const [markets, account] = await Promise.all([getMarkets(), appAccount()]);
  const homeMarket = account ? await getHomeMarket(account.id) : null;
  return ok({ markets, homeMarket });
});

/**
 * PUT /api/app/v1/markets — remember the market the guest switched to.
 * Body: { slug }. Rejects a slug that isn't a live market, so a stale app build
 * can't pin someone to a market we've retired.
 */
export const PUT = guard(async (req: Request) => {
  const account = await appAccount();
  if (!account) return unauthorized();

  const body = await readJson<{ slug?: string }>(req);
  const slug = body?.slug?.trim();
  if (!slug) return fail("slug_required", "Which market should we remember?");

  const markets = await getMarkets();
  if (!markets.some((m) => m.slug === slug)) {
    return fail("unknown_market", "We're not in that market yet.", 404);
  }

  const saved = await setHomeMarket(account.id, slug);
  return ok({ saved, slug });
});
