import { ok, fail, guard, unauthorized, appAccount } from "@/lib/app/api";
import { cancelMyBooking } from "@/app/account/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/app/v1/trips/[id]/cancel — the guest cancels their own booking.
 *
 * Decision D7: the website's self-cancel, called as it is — the same refund
 * tiers, the same ledger entries (a refund is a negative payment, the kept
 * amount is cancel_fee), the same staff alert and email — so the app and the
 * website can never disagree about what a cancellation gives back.
 *
 * → { cancelled: true, message, refund, retained }
 */
export const POST = guard(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const account = await appAccount();
  if (!account) return unauthorized();
  const { id } = await params;

  const result = await cancelMyBooking(id);
  if (!result.ok) return fail("cancel_failed", result.message ?? "Could not cancel the booking. Please try again.", 400);
  return ok({ cancelled: true, message: result.message ?? "", refund: result.refund ?? 0, retained: result.retained ?? 0 });
});
