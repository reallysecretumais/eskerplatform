import { ok, guard, unauthorized, appAccount } from "@/lib/app/api";
import { getMyBookings } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { crop } from "@/lib/img";
import { appTrip, paymentsInFlight } from "@/lib/app/trips";
import { pkDay } from "@/lib/pkDate";
import { guestTitle } from "@/lib/listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/trips — the signed-in guest's bookings and open date requests.
 *
 *   trips     every booking (lib/app/trips.ts decides each one's `state`),
 *             newest check-in first; the app splits Upcoming and Past
 *   requests  dates asked of an owner in the last 14 days that haven't
 *             become a booking: "pending" while we wait, "available" once the
 *             owner said yes (the guest can now book them), "unavailable"
 *
 * Reads on the guest's own session (RLS), the same as the website's Trips.
 */
const REQUEST_DAYS = 14;

export const GET = guard(async () => {
  const account = await appAccount();
  if (!account) return unauthorized();

  const supabase = await createClient();
  const since = new Date(Date.now() - REQUEST_DAYS * 86_400_000).toISOString();
  const [bookings, { data: asked }] = await Promise.all([
    getMyBookings(),
    supabase
      .from("external_date_requests")
      .select("id, external_property_id, checkin, checkout, status, created_at")
      .eq("account_id", account.id)
      .in("status", ["pending", "available", "unavailable"])
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
  ]);
  const paying = await paymentsInFlight(bookings);

  // A request the guest has since booked is a trip, not a request.
  // Bookings carry timestamps, requests plain days: compare Pakistani days.
  const booked = new Set(
    bookings
      .filter((b) => b.status !== "cancelled" && b.checkin && b.checkout)
      .map((b) => `${b.listing?.id}|${pkDay(b.checkin!)}|${pkDay(b.checkout!)}`),
  );
  const open = (asked ?? []).filter((r) => !booked.has(`${r.external_property_id}|${r.checkin}|${r.checkout}`));
  // One answer per stay and dates: the newest ask wins.
  const seen = new Set<string>();
  const requests = open.filter((r) => {
    const k = `${r.external_property_id}|${r.checkin}|${r.checkout}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const ids = [...new Set(requests.map((r) => r.external_property_id as string))];
  const { data: listings } = ids.length
    ? await supabase.from("public_listings").select("id, title, area, photos").in("id", ids)
    : { data: [] as { id: string; title: string; area: string | null; photos: string[] | null }[] };
  const byId = new Map((listings ?? []).map((l) => [l.id as string, { ...l, title: guestTitle(l.title as string) }]));

  return ok({
    trips: bookings.map((b) => appTrip(b, paying.get(b.id))),
    requests: requests.map((r) => {
      const l = byId.get(r.external_property_id as string);
      const photo = l?.photos?.[0];
      return {
        id: r.id as string,
        listingId: r.external_property_id as string,
        title: (l?.title as string | undefined) ?? "Your stay",
        area: (l?.area as string | null | undefined) ?? null,
        photo: photo ? crop(photo, 1170, 1176, 74) : null,
        checkin: r.checkin as string,
        checkout: r.checkout as string,
        status: r.status as "pending" | "available" | "unavailable",
        askedAt: r.created_at as string,
      };
    }),
  });
});
