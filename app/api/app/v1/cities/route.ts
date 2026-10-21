import { ok, guard } from "@/lib/app/api";
import { getInventory } from "@/lib/data/inventory";
import { cityNodes } from "@/lib/app/cities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/cities — "Pick a city" (app board 11) and Ask any city.
 *
 * Every city the app knows: the spec's six with their one line of character,
 * plus any live city the copy doesn't know yet. Each carries its live stay
 * count, how many are CONFIRMED open tonight, and its areas. A city with no
 * stays is still listed (the app marks it "Coming soon"; spec: never hide it).
 */
export const GET = guard(async () => {
  const inv = await getInventory(null);
  return ok({ cities: cityNodes(inv.all, inv.freeTonight) });
});
