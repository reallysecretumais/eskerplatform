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
  host_reply: string | null;
  stayed_on: string | null;
  created_at: string;
  /** 'guest' = website account · 'whatsapp' = tokened link from a WhatsApp
   *  booking (badged on the site) · 'curated' = staff-entered testimonial. */
  source: "curated" | "guest" | "whatsapp";
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

export type ReviewTokenBooking = {
  bookingId: string;
  guestId: string | null;
  checkin: string | null;
  checkout: string | null;
  guestFirstName: string;
  property: { id: string; name: string; area: string | null; photo: string | null };
};

/**
 * Resolve a public review link's token to its completed stay — the whole gate
 * for /review/[token]. Null = don't show a form (unknown token, stay not
 * finished yet, or a resold external stay that isn't our property to review).
 *
 * Reads via the service role — the token IS the authorisation (64-hex, minted
 * per booking by sendReviewRequest, delivered only to the guest's own
 * WhatsApp). Property comes from `properties`, not `public_listings`, so a
 * stay at a not-yet-published listing can still be reviewed.
 */
export async function getBookingForReviewToken(token: string): Promise<ReviewTokenBooking | null> {
  const clean = (token || "").trim();
  // Tokens are 64 hex chars; refuse anything else before touching the DB.
  if (!/^[0-9a-f]{64}$/i.test(clean)) return null;

  const admin = createAdminClient();
  const { data: b } = await admin
    .from("bookings")
    .select("id, status, checkin, checkout, property_id, is_external, guest_id, guest:guests(name)")
    .eq("review_token", clean)
    .maybeSingle();
  if (!b) return null;
  if (!["checked_out", "completed"].includes(String(b.status))) return null;
  if (b.is_external || !b.property_id) return null;

  const { data: p } = await admin
    .from("properties")
    .select("id, name, short_name, area, photos")
    .eq("id", b.property_id)
    .maybeSingle();
  if (!p) return null;

  const guest = (b as unknown as { guest: { name: string | null } | null }).guest;
  const rawName = (guest?.name ?? "").trim();
  // A CRM contact saved as a phone number is not a name to greet anyone by.
  const usable = /^[+\d][\d\s()+-]*$/.test(rawName) ? "" : rawName;
  const photos = (p.photos as string[] | null) ?? [];

  return {
    bookingId: b.id as string,
    guestId: (b.guest_id as string | null) ?? null,
    checkin: (b.checkin as string | null) ?? null,
    checkout: (b.checkout as string | null) ?? null,
    guestFirstName: usable.split(/\s+/)[0] ?? "",
    property: {
      id: p.id as string,
      name: ((p.short_name as string | null) || (p.name as string)) ?? "your Esker stay",
      area: (p.area as string | null) ?? null,
      photo: photos[0] ?? null,
    },
  };
}
