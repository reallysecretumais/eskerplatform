import "server-only";
import { createClient } from "@/lib/supabase/server";

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
  const reviews = data as Review[];
  const total = reviews.reduce((s, r) => s + r.rating, 0);
  const average = Math.round((total / reviews.length) * 10) / 10;
  return { reviews, summary: { average, count: reviews.length } };
}
