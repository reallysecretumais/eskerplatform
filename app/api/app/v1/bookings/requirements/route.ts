import { ok, fail, guard, unauthorized, appAccount } from "@/lib/app/api";
import { bookingPath, idOnFile, realEmail, realName } from "@/lib/booking/create";
import { holdLabel } from "@/lib/booking/hold";
import { isSafepayConfigured } from "@/lib/safepay";
import { getBankAccounts, toWireAccounts } from "@/lib/data/bankAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/bookings/requirements?listingId=&checkin=&checkout=
 *
 * What the app must ask this guest before it can book these nights, decided by
 * the same code that will take the booking:
 *
 *   path        "book" | "request" — the booking core's own gate, so the app
 *               never shows Pay for dates the core would refuse
 *   idNeeded    first booking with Esker: an ID photo comes with it
 *   name        the account's real name, when it has one (else the app asks)
 *   methods     card only while Safepay is configured; transfer always
 *   holds       how long each method keeps the dates ("30 minutes")
 *   bankAccounts  where a transfer goes, from the CRM's Settings
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const GET = guard(async (req: Request) => {
  const account = await appAccount();
  if (!account) return unauthorized();
  const sp = new URL(req.url).searchParams;
  const listingId = sp.get("listingId") ?? "";
  const checkin = sp.get("checkin") ?? "";
  const checkout = sp.get("checkout") ?? "";
  if (!listingId) return fail("listing_required", "Which stay are you booking?");
  if (!DAY.test(checkin) || !DAY.test(checkout) || checkout <= checkin) {
    return fail("dates_invalid", "Please pick valid check-in and check-out dates.");
  }

  const [path, hasId, accounts] = await Promise.all([
    bookingPath(listingId, account.id, checkin, checkout),
    idOnFile(account.phone ?? ""),
    getBankAccounts(),
  ]);

  return ok({
    path,
    idNeeded: !hasId,
    // Null when sign-up left only a placeholder, so the app asks.
    name: realName(account.name) || null,
    email: realEmail(account.email) || null,
    methods: { card: isSafepayConfigured(), transfer: true },
    holds: { card: holdLabel("card"), transfer: holdLabel("transfer") },
    bankAccounts: toWireAccounts(accounts),
  });
});
