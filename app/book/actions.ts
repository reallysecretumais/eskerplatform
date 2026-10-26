"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyId, type IdSide } from "@/lib/ai/idcheck";
import { notifyStaff } from "@/lib/notifyStaff";
// The result type lives with the core (lib/booking/create.ts): a "use server"
// file may only export async functions, and a re-exported type breaks the build.
import { createBookingCore, isOwnLiveHold, releaseCardHold, type BookingResult, type ReleaseResult } from "@/lib/booking/create";
import { CARD_HOLD_COOKIE, CARD_HOLD_MINUTES } from "@/lib/booking/hold";
import { getListing } from "@/lib/data/listings";
import { quote, isQuoteError, withPromo } from "@/lib/quote";
import { judgePromo } from "@/lib/promo";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * The website's checkout form. Everything that decides a booking (price,
 * advance, clash checks, the ID rule, the date hold, Safepay) lives in the
 * booking core, lib/booking/create.ts, which the app's booking route calls
 * too — this only reads the form and who is signed in.
 */
export async function createBooking(formData: FormData): Promise<BookingResult> {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  const result = await createBookingCore({
    propertyId: String(formData.get("propertyId") || ""),
    checkin: String(formData.get("checkin") || ""),
    checkout: String(formData.get("checkout") || ""),
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
    // "safepay" = Safepay's hosted card checkout, no screenshot; anything
    // else is the bank-transfer + screenshot flow.
    payMethod: String(formData.get("pay_method") || "") === "safepay" ? "card" : "transfer",
    proof: formData.get("proof") as File | null,
    idFront: formData.get("cnicFront") as File | null,
    idBack: formData.get("cnicBack") as File | null,
    docType: String(formData.get("docType") || "cnic") === "passport" ? "passport" : "cnic",
    promo: String(formData.get("promo") || ""),
    // Guest checkout allowed: null books without an account (the core gives
    // one to anyone who leaves an email).
    accountId: user?.id ?? null,
    channel: "website",
  });
  // A card checkout is about to open: remember it in this browser, so coming
  // back unpaid gives the dates back at once (releaseCheckoutHold).
  if (result.ok && result.checkoutUrl && result.bookingId) {
    (await cookies()).set(CARD_HOLD_COOKIE, result.bookingId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CARD_HOLD_MINUTES * 60,
    });
  }
  return result;
}

/**
 * The guest is back at checkout from Safepay without paying (its cancel link,
 * or Back): release their card hold now rather than in 30 minutes. Only the
 * booking this browser opened (CARD_HOLD_COOKIE) can be released, and only if
 * Safepay says it's unpaid; "paid" sends the guest to their confirmation.
 */
export async function releaseCheckoutHold(bookingId: string): Promise<ReleaseResult> {
  const jar = await cookies();
  if (!bookingId || jar.get(CARD_HOLD_COOKIE)?.value !== bookingId) return "not_found";
  const r = await releaseCardHold(bookingId, null);
  // Done with it either way, except when Safepay couldn't be asked: then the
  // hold stands, and a later visit may try again.
  if (r !== "unknown") jar.delete(CARD_HOLD_COOKIE);
  return r;
}

export type PromoCheckResult = { ok: true; code: string; discount: number; balance: number } | { ok: false; error: string; message: string };

/**
 * Checkout's Apply: judge a promo code for this stay and the phone the
 * checkout books with (lib/promo.ts; the SQL's own refusal line comes back).
 * Nothing is reserved: createBooking judges it again, and the database once
 * more as the booking is saved.
 */
export async function checkPromo(formData: FormData): Promise<PromoCheckResult> {
  const code = String(formData.get("promo") || "").trim();
  const propertyId = String(formData.get("propertyId") || "");
  const checkin = String(formData.get("checkin") || "");
  const checkout = String(formData.get("checkout") || "");
  const resume = String(formData.get("resume") || "");
  if (!code) return { ok: false, error: "promo_unknown", message: "Code not recognised" };

  const listing = await getListing(propertyId);
  if (!listing) return { ok: false, error: "unavailable", message: "This place isn't available to book." };
  const priced = quote({ mode: "nightly", price: listing.price, exclusive: listing.esker_exclusive, checkin, checkout });
  if (isQuoteError(priced)) return { ok: false, error: priced.error, message: priced.message };

  // The guest's own card hold on these nights (back from Safepay) is the
  // booking this one would replace; it doesn't make them a returning guest.
  const own = resume && (await isOwnLiveHold(resume, propertyId, checkin, checkout)) ? resume : null;
  const verdict = await judgePromo({ code, phone: String(formData.get("phone") || ""), quote: priced, bookingId: own });
  if (!verdict.ok) return { ok: false, error: verdict.error, message: verdict.message };
  const q = withPromo(priced, verdict.promo);
  return { ok: true, code: verdict.promo.code, discount: q.promo?.discount ?? 0, balance: q.balance };
}

export type RequestDatesResult = { ok: boolean; message: string; pending?: boolean };

/**
 * Request-to-book for an EXTERNAL (resale) unit we can't instant-sell — no owner
 * calendar, or a stale sync. Fires the CRM's existing WhatsApp owner-ask (the
 * same one staff use), which logs to the Support thread and records a row in
 * `external_availability_checks`. Esker follows up with the guest from the inbox
 * once the owner answers — we never take money before that.
 *
 * An account is required (founder decision) so we have someone to come back to.
 * The CRM dedupes to one fresh pending ask per property per 24h.
 */
export async function requestExternalDates(formData: FormData): Promise<RequestDatesResult> {
  const listingId = String(formData.get("propertyId") || "");
  const checkin = String(formData.get("checkin") || "");
  const checkout = String(formData.get("checkout") || "");

  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return { ok: false, message: "Please sign in first — we'll message you as soon as the owner confirms these dates." };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (!checkin || !checkout || checkin < today || checkout <= checkin) {
    return { ok: false, message: "Please pick valid check-in and check-out dates." };
  }

  // Must be a genuinely published EXTERNAL listing (read through the public window).
  const admin = createAdminClient();
  const { data: listing } = await admin.from("public_listings").select("id, title, source").eq("id", listingId).maybeSingle();
  if (!listing || (listing as { source?: string }).source !== "external") {
    return { ok: false, message: "This place isn't available to request." };
  }

  const base = (process.env.CRM_URL || "https://os.eskerrentals.com").replace(/\/$/, "");
  const secret = process.env.PLATFORM_API_SECRET || process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.error("[external-ask] no PLATFORM_API_SECRET/REVALIDATE_SECRET configured");
    return { ok: false, message: "We couldn't send that request just now. Please message us and we'll confirm for you." };
  }

  try {
    // PKT check-in 2pm / check-out 12pm, matching how the CRM records stays.
    const res = await fetch(`${base}/api/platform/external-ask`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-esker-secret": secret },
      body: JSON.stringify({
        externalPropertyId: listingId,
        checkin: `${checkin}T14:00:00+05:00`,
        checkout: `${checkout}T12:00:00+05:00`,
      }),
      cache: "no-store",
    });
    const out = (await res.json().catch(() => null)) as
      | { ok?: boolean; message?: string; checkId?: string; manualFallback?: boolean }
      | null;

    // Staff must know WHO asked — the owner thread shows the question but not
    // the guest. Fires on every outcome incl. the 24h dedupe ("already asked"),
    // where no new Support message appears at all. Best-effort.
    try {
      const { data: acc } = await admin.from("accounts").select("name, phone, email").eq("id", user.id).maybeSingle();
      const who = [acc?.name, acc?.phone, acc?.email].filter(Boolean).join(" · ") || "a website guest";
      await notifyStaff(admin, {
        type: "message",
        title: "Website date request",
        body: `${who} asked for ${(listing as { title?: string }).title ?? "an external stay"} · ${checkin} → ${checkout}. Reply once the owner confirms.`,
        link: "/inquiries",
      });
    } catch {
      /* best-effort */
    }

    // Durable record of this request, keyed by the CRM's checkId — this is how
    // the /api/platform/availability-replied ping maps the owner's answer back to
    // THIS guest, and how an "available" answer later authorises their booking.
    // Only when we got a fresh checkId (a brand-new ask); an "already asked" reply
    // has no new check to attach to.
    if (out?.checkId) {
      try {
        await admin.from("external_date_requests").insert({
          account_id: user.id,
          external_property_id: listingId,
          checkin,
          checkout,
          check_id: out.checkId,
        });
      } catch (e) {
        console.error("[external-ask] could not record request:", e);
      }
    }

    if (!res.ok || !out?.ok) {
      // The CRM returns ok:false for "already asked in the last 24h" — that's a
      // fine outcome for the guest, the question is already with the owner.
      return { ok: true, pending: true, message: "We're already checking these dates with the owner — we'll come back to you shortly." };
    }
    if (out.manualFallback) {
      return { ok: true, pending: true, message: "Request received — the team is confirming these dates with the owner and will message you shortly." };
    }
    return { ok: true, pending: true, message: "Request sent. We're confirming these dates with the owner and will message you as soon as we hear back." };
  } catch (e) {
    console.error("[external-ask] failed:", e);
    return { ok: false, message: "We couldn't send that request just now. Please message us and we'll confirm for you." };
  }
}

export type IdCheckResult = { ok: boolean; message?: string };

// Real-time ID check for the checkout form: each ID image (CNIC front/back, or a
// passport data page) is validated the moment it's picked, so an unreadable/
// expired/non-ID image is rejected immediately — the guest re-uploads before
// finishing, never after. `createBooking` re-runs the front check server-side as
// the backstop.
export async function verifyIdUpload(formData: FormData): Promise<IdCheckResult> {
  const file = formData.get("file") as File | null;
  const side: IdSide = String(formData.get("side") || "front") === "back" ? "back" : "front";
  if (!file || file.size === 0) return { ok: false, message: "Please choose a clear photo of your ID." };
  if (file.size > MAX_BYTES) return { ok: false, message: "That image is too large (max 10 MB)." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "Please upload a photo (JPG or PNG)." };
  const res = await verifyId(file, side);
  return res.ok ? { ok: true } : { ok: false, message: res.message };
}
