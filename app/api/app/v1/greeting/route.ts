import { ok, guard, appAccount } from "@/lib/app/api";
import { getInventory, poolsFreeTonight } from "@/lib/data/inventory";
import { buildGreeting, type GreetingInput } from "@/lib/data/greeting";
import { getMyBookings } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/greeting?market= — the cover's salutation and its one true line.
 *
 * Public: a signed-out guest gets the portfolio's truth. Signed in with a
 * booking, they get their own — which is what makes the trip-aware cover work,
 * and it's computed here so the app never has to decide what's interesting.
 */
export const GET = guard(async (req: Request) => {
  const market = new URL(req.url).searchParams.get("market")?.trim() || null;

  const [inv, account] = await Promise.all([getInventory(market), appAccount()]);

  let trip: GreetingInput["trip"] = null;
  let firstName: string | null = null;

  if (account) {
    const bookings = await getMyBookings();
    const now = Date.now();

    // The nearest booking that hasn't finished. Statuses that mean "this isn't
    // happening" are excluded so a cancelled stay never greets anyone.
    const live = bookings
      .filter((b) => !["cancelled", "checked_out", "lost"].includes(b.status))
      .filter((b) => b.checkout && new Date(`${b.checkout}T12:00:00+05:00`).getTime() >= now)
      .sort((a, b) => (a.checkin ?? "").localeCompare(b.checkin ?? ""))[0];

    if (live?.checkin) {
      const startsAt = new Date(`${live.checkin}T16:00:00+05:00`).getTime();
      const startsInHours = (startsAt - now) / 3_600_000;
      const listing = inv.all.find((l) => l.id === live.listing?.id);

      trip = {
        startsInHours,
        staying: startsInHours <= 0,
        property: {
          bedrooms: listing?.bedrooms ?? null,
          category: listing?.category ?? live.listing?.category ?? null,
          area: listing?.area ?? live.listing?.area ?? null,
        },
        checkinTime: "4pm",
      };
      // The first-name rule (build plan §6.2): a name is used only when there's
      // a real relationship. buildGreeting enforces it; we just supply it.
      firstName = account.name?.trim().split(/\s+/)[0] || null;
    }
  }

  const greeting = await buildGreeting({
    firstName,
    trip,
    tonight: {
      free: inv.counts.tonight,
      pools: poolsFreeTonight(inv),
      exclusives: inv.counts.exclusivesTonight,
    },
  });

  return ok({
    ...greeting,
    // The app uses this to decide where "pull up" goes: the key, or the grid.
    hasTrip: Boolean(trip),
    staying: Boolean(trip?.staying),
  });
});
