"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getBookingForReviewToken } from "@/lib/data/reviews";

export type ActionResult = { ok: boolean; message: string };

export type TokenReviewInput = {
  token: string;
  rating: number;
  body: string;
  name?: string;
  location?: string;
};

/**
 * Review a completed stay via its WhatsApp review link — the account-less twin
 * of `submitReview` (app/account/actions.ts). The TOKEN is re-validated here on
 * every submit; a bookingId from the client is never trusted. Same rules:
 * quarter-step 1–5 rating, 3–2000 char body, one review per stay
 * (insert-or-update), publishes instantly with source 'whatsapp' so the site
 * badges it "From WhatsApp booking". Staff can hide any review from the CRM.
 */
export async function submitTokenReview(input: TokenReviewInput): Promise<ActionResult> {
  const stay = await getBookingForReviewToken(String(input.token || ""));
  if (!stay) return { ok: false, message: "This review link isn't valid any more." };

  const rating = Math.round((Number(input.rating) || 0) / 0.25) * 0.25;
  if (rating < 1 || rating > 5) return { ok: false, message: "Please pick a rating between 1 and 5 stars." };
  const body = String(input.body || "").trim();
  if (body.length < 3) return { ok: false, message: "Please write a few words about your stay." };
  if (body.length > 2000) return { ok: false, message: "That review is a little long — please shorten it." };
  const location = String(input.location || "").trim().slice(0, 60) || null;

  // The guest chooses their display name — CRM contact names are whatever the
  // rep saved mid-chat, which is not always something to publish.
  const authorName = String(input.name || "").trim().slice(0, 60) || stay.guestFirstName || "Esker guest";

  const admin = createAdminClient();
  const row = {
    property_id: stay.property.id,
    guest_id: stay.guestId,
    booking_id: stay.bookingId,
    author_name: authorName,
    author_location: location,
    rating,
    body,
    source: "whatsapp",
    status: "published",
    stayed_on: stay.checkin,
  };

  // One review per stay: update if it exists, else insert.
  const { data: existing } = await admin.from("reviews").select("id").eq("booking_id", stay.bookingId).maybeSingle();
  const res = existing?.id
    ? await admin.from("reviews").update(row).eq("id", existing.id)
    : await admin.from("reviews").insert(row);
  if (res.error) return { ok: false, message: "Couldn't save your review — please try again." };

  return { ok: true, message: "Thank you — your review is live." };
}
