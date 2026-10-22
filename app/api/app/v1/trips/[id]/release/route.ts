import { ok, fail, guard, unauthorized, appAccount } from "@/lib/app/api";
import { releaseCardHold } from "@/lib/booking/create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/app/v1/trips/[id]/release — the guest backed out of the card
 * checkout: their dates go back on sale now, not in 30 minutes
 * (lib/booking/create.ts, releaseCardHold).
 *
 * → { released: true }                    the dates are free again
 * → { released: false, paid: true }       Safepay settled it after all: show the trip
 * → 404                                   not this guest's card booking
 */
export const POST = guard(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const account = await appAccount();
  if (!account) return unauthorized();
  const { id } = await params;
  const r = await releaseCardHold(id, account.id);
  if (r === "released") return ok({ released: true, paid: false });
  if (r === "paid") return ok({ released: false, paid: true });
  return fail("not_found", "We couldn't find that payment.", 404);
});
