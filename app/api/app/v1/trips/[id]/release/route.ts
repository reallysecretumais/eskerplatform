import { ok, fail, guard, unauthorized, appAccount } from "@/lib/app/api";
import { releaseCardHold } from "@/lib/booking/create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/app/v1/trips/[id]/release — the guest backed out of the card
 * checkout: their dates go back on sale now, not in 30 minutes
 * (lib/booking/create.ts, releaseCardHold).
 *
 * → { released: true }                    Safepay says unpaid: the dates are free again
 * → { released: false, paid: true }       paid after all (here, or at Safepay): show the trip
 * → { released: false, paid: false }      Safepay couldn't be asked (the 30-minute hold
 *                                         ends on its own), or it was cancelled meanwhile
 * → 404                                   not this guest's card booking
 */
export const POST = guard(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const account = await appAccount();
  if (!account) return unauthorized();
  const { id } = await params;
  const r = await releaseCardHold(id, account.id);
  if (r === "released") return ok({ released: true, paid: false });
  if (r === "paid") return ok({ released: false, paid: true });
  if (r === "unknown" || r === "gone") return ok({ released: false, paid: false });
  return fail("not_found", "We couldn't find that payment.", 404);
});
