import { ok, fail, guard, readJson, unauthorized, appAccount } from "@/lib/app/api";
import { getListing } from "@/lib/data/listings";
import { createClient } from "@/lib/supabase/server";
import { createBookingCore, realEmail, realName, type BookingErrorCode } from "@/lib/booking/create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/app/v1/bookings — book a nightly stay from the app.
 *
 * The website's booking core (lib/booking/create.ts) does all of it: price,
 * advance, every clash check, the first-booking ID rule, the date hold and
 * Safepay. This route only says who is booking (the signed-in guest, whose
 * phone is already verified) and reads the app's body.
 *
 * Body: JSON, or multipart/form-data when photos ride along:
 *   listingId, checkin, checkout       the stay and the nights
 *   payMethod   "card" | "transfer"
 *   name?, email?                      the account's own are used when absent
 *   scheme?     the build's URL scheme, so the payment page reopens THIS app
 *   guests?     how many are coming (stored as guest_count)
 *   docType?    "cnic" | "passport"    first booking only, with
 *   idFront?, idBack?                  the ID photos (files)
 *   proof?                             transfer screenshot (file)
 *   promo?      a promo code; a refusal is fail(<promo_*>, <the SQL's line>), 409
 *
 * → { bookingId, checkoutUrl?, holdUntil }  the app opens checkoutUrl for a card.
 */

const STATUS: Partial<Record<BookingErrorCode, number>> = {
  unavailable: 404,
  dates_taken: 409,
  request_first: 409,
  already_booked: 409,
  check_failed: 503,
  payment_failed: 502,
  booking_failed: 503,
  upload_failed: 503,
};

type Fields = Record<string, string | File | undefined>;

async function readBody(req: Request): Promise<Fields | null> {
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const out: Fields = {};
      form.forEach((v, k) => {
        out[k] = v;
      });
      return out;
    } catch {
      return null;
    }
  }
  return readJson<Fields>(req);
}

const text = (v: string | File | undefined) => (typeof v === "string" ? v.trim() : "");
const file = (v: string | File | undefined) => (v && typeof v !== "string" && v.size > 0 ? v : null);

export const POST = guard(async (req: Request) => {
  const account = await appAccount();
  if (!account) return unauthorized();
  // The app signs in by WhatsApp code, so this is always set; an account made on
  // the website by email alone has to verify a phone first.
  if (!account.phone || !account.phoneVerified) {
    return fail("phone_required", "Please confirm your phone number to book.", 403);
  }

  const body = await readBody(req);
  if (!body) return fail("bad_request", "Something was missing from that booking. Please try again.");
  const listingId = text(body.listingId);
  if (!listingId) return fail("listing_required", "Which stay are you booking?");

  // Nightly only: day-use and hourly stays book on the website for now.
  const listing = await getListing(listingId);
  if (!listing) return fail("unavailable", "This place isn't available to book.", 404);
  if (listing.booking_mode !== "nightly") return fail("mode_unsupported", "This stay books on our website for now.");

  const name = text(body.name) || realName(account.name);
  // Remember a name typed at booking, so the next booking doesn't ask again.
  if (name && !realName(account.name)) {
    const supabase = await createClient();
    await supabase.from("accounts").update({ name }).eq("id", account.id);
  }

  const result = await createBookingCore({
    propertyId: listingId,
    checkin: text(body.checkin),
    checkout: text(body.checkout),
    name,
    phone: account.phone,
    email: realEmail(text(body.email)) || realEmail(account.email),
    payMethod: text(body.payMethod) === "card" ? "card" : "transfer",
    proof: file(body.proof),
    idFront: file(body.idFront),
    idBack: file(body.idBack),
    docType: text(body.docType) === "passport" ? "passport" : "cnic",
    accountId: account.id,
    channel: "app",
    appScheme: text(body.scheme),
    guests: Number(text(body.guests)) || undefined,
    promo: text(body.promo),
  });

  if (!result.ok) {
    const code = result.code ?? "booking_failed";
    // A refused promo code is a 409 like a clash; failing to check one isn't.
    const status = code === "promo_check_failed" ? 503 : code.startsWith("promo_") ? 409 : (STATUS[code] ?? 400);
    return fail(code, result.message ?? "Could not create your booking. Please try again.", status);
  }
  return ok({ bookingId: result.bookingId, checkoutUrl: result.checkoutUrl ?? null, holdUntil: result.holdUntil ?? null });
});
