import { ok, guard, unauthorized, notFound, appAccount } from "@/lib/app/api";
import { getMyBooking } from "@/lib/auth";
import { guestCancelQuote } from "@/lib/payments";
import { GUEST_CANCELLABLE } from "@/lib/bookingStatus";
import { appTrip, paymentsInFlight, tripLocations } from "@/lib/app/trips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/trips/[id] — one booking, for the trip pass.
 *
 * Adds to the trip what the pass needs to act: whether the guest can cancel
 * it here, and exactly what they would get back if they did (the same
 * guestCancelQuote the cancel itself applies, so the number shown is the
 * number refunded; an unconfirmed transfer says the team checks it first).
 * `trip.location` is the exact place, once the trip is confirmed or staying.
 * The app persists this response, so the pass opens with no signal.
 */
export const GET = guard(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const account = await appAccount();
  if (!account) return unauthorized();
  const { id } = await params;

  // RLS on the guest's own session: someone else's booking reads as not found.
  const b = await getMyBooking(id);
  if (!b) return notFound("We couldn't find that booking.");
  const paying = await paymentsInFlight([b]);
  const trip = appTrip(b, paying.get(b.id), await tripLocations([b], paying));

  const cancellable = GUEST_CANCELLABLE.includes(b.status) && !!b.checkin && trip.state !== "hold_ended";
  const q = cancellable ? guestCancelQuote({ checkin: b.checkin!, advancePaid: b.advancePaid, status: b.status }) : null;

  return ok({
    trip,
    cancel: q ? { label: q.label, refund: q.refund, retained: q.retained, tier: q.tier, unverified: q.unverified } : null,
  });
});
