"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getBookingForReviewToken } from "@/lib/data/reviews";

export type ActionResult = { ok: boolean; message: string };

export type TokenReviewInput = {
  token: string;
  /** "How was your stay?" — the headline rating, pays the GRM's review bonus. */
  stayRating: number;
  /** "How was the booking experience?" — pays the closer's review bonus. */
  bookingRating: number;
  body?: string;
  name?: string;
  location?: string;
};

const quarter = (n: unknown) => Math.round((Number(n) || 0) / 0.25) * 0.25;

/**
 * Review a completed stay via its WhatsApp review link — the account-less twin
 * of `submitReview` (app/account/actions.ts). The TOKEN is re-validated here on
 * every submit; a bookingId from the client is never trusted.
 *
 * Two-part since the incentive framework (Aug 2026): stay rating + booking-
 * experience rating, both quarter-step 1–5. `rating` (the site's overall) is
 * set = stay rating, so display and averages keep working unchanged. The
 * written comment is now OPTIONAL — a star-only review saves as status
 * 'pending' (real feedback, pays incentives, but the site never renders an
 * empty quote; staff can publish it from the CRM if they wish). One review per
 * stay (insert-or-update); staff can hide any review from the CRM.
 */
export async function submitTokenReview(input: TokenReviewInput): Promise<ActionResult> {
  const stay = await getBookingForReviewToken(String(input.token || ""));
  if (!stay) return { ok: false, message: "This review link isn't valid any more." };

  const stayRating = quarter(input.stayRating);
  const bookingRating = quarter(input.bookingRating);
  if (stayRating < 1 || stayRating > 5) return { ok: false, message: "Please rate your stay between 1 and 5 stars." };
  if (bookingRating < 1 || bookingRating > 5)
    return { ok: false, message: "Please rate the booking experience between 1 and 5 stars." };

  const body = String(input.body || "").trim();
  if (body.length > 2000) return { ok: false, message: "That review is a little long — please shorten it." };
  const location = String(input.location || "").trim().slice(0, 60) || null;

  // The guest chooses their display name — CRM contact names are whatever the
  // rep saved mid-chat, which is not always something to publish.
  const authorName = String(input.name || "").trim().slice(0, 60) || stay.guestFirstName || "Esker guest";

  const admin = createAdminClient();
  // One review per stay: update if it exists — but a review staff HID stays
  // hidden through a guest edit (editing must not be a resurface loophole).
  const { data: existing } = await admin
    .from("reviews")
    .select("id, status")
    .eq("booking_id", stay.bookingId)
    .maybeSingle();
  const keepHidden = existing?.status === "hidden";
  const base = {
    property_id: stay.property.id,
    guest_id: stay.guestId,
    booking_id: stay.bookingId,
    author_name: authorName,
    author_location: location,
    rating: stayRating, // the site's overall = the stay
    body,
    source: "whatsapp",
    // Founder decision (Aug 2026): NOTHING guest-submitted publishes instantly.
    // Every review lands as 'pending' and goes live only when staff approve it
    // in the CRM (Team → Reviews queue). A staff-hidden review stays hidden.
    status: keepHidden ? "hidden" : "pending",
    stayed_on: stay.checkin,
  };
  const twoPart = { ...base, stay_rating: stayRating, booking_experience_rating: bookingRating };

  // If the two-part migration hasn't run yet, step down to the legacy shape
  // rather than fail the guest's submit over a deploy-order detail.
  const write = async (row: Record<string, unknown>) =>
    existing?.id ? admin.from("reviews").update(row).eq("id", existing.id) : admin.from("reviews").insert(row);

  let res = await write(twoPart);
  if (res.error) res = await write(base);
  if (res.error) return { ok: false, message: "Couldn't save your review — please try again." };

  if (!keepHidden) {
    const { notifyReviewPending } = await import("@/lib/notifyReviewPending");
    void notifyReviewPending(stay.property.name, stayRating);
  }
  return { ok: true, message: "Thank you — your review is in. It appears on the site once our team publishes it." };
}
