import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Review = {
  id: string;
  property_id: string;
  author_name: string;
  author_location: string | null;
  rating: number;
  body: string;
  stayed_on: string | null;
  created_at: string;
};

export type RatingSummary = { average: number; count: number };

/** Published reviews for a listing (newest first) + an aggregate summary. */
export async function getReviews(propertyId: string): Promise<{ reviews: Review[]; summary: RatingSummary | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_reviews")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });
  if (error || !data || data.length === 0) return { reviews: [], summary: null };
  // Postgres numeric can arrive as a string — coerce so maths + stars are exact.
  const reviews = (data as Review[]).map((r) => ({ ...r, rating: Number(r.rating) }));
  const total = reviews.reduce((s, r) => s + r.rating, 0);
  const average = Math.round((total / reviews.length) * 10) / 10;
  return { reviews, summary: { average, count: reviews.length } };
}

export type MyReview = { rating: number; body: string; author_location: string | null };

/** The guest's own review for a booking, to prefill/edit. Reviews are staff-RLS,
 *  so this reads via the service role — call ONLY for a booking the account owns
 *  (booking ownership is already enforced by getMyBooking on the page). */
export async function getMyReview(bookingId: string): Promise<MyReview | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("reviews").select("rating, body, author_location").eq("booking_id", bookingId).maybeSingle();
  if (!data) return null;
  return { rating: Number(data.rating), body: data.body, author_location: data.author_location };
}
