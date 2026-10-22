import { ok, fail, guard, readJson, unauthorized, appAccount } from "@/lib/app/api";
import { requestExternalDates } from "@/app/book/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/app/v1/bookings/request — ask the owner for these dates.
 *
 * For a stay Esker can't sell instantly (an owner's calendar we can't see
 * fresh). The website's own request action does it: the CRM's WhatsApp owner
 * ask, the staff alert, and the record that later lets this guest book once
 * the owner says yes. It reads the guest from the app's Bearer token.
 *
 * Body: { listingId, checkin, checkout } → { pending: true, message }
 */
export const POST = guard(async (req: Request) => {
  const account = await appAccount();
  if (!account) return unauthorized();
  const body = await readJson<{ listingId?: string; checkin?: string; checkout?: string }>(req);
  if (!body?.listingId) return fail("listing_required", "Which stay are you asking about?");

  const form = new FormData();
  form.set("propertyId", body.listingId);
  form.set("checkin", body.checkin ?? "");
  form.set("checkout", body.checkout ?? "");
  const result = await requestExternalDates(form);

  if (!result.ok) return fail("request_failed", result.message, 400);
  return ok({ pending: true, message: result.message });
});
