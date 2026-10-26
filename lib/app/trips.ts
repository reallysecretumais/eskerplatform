import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { crop } from "@/lib/img";
import { company } from "@/lib/contact";
import type { MyBooking } from "@/lib/auth";
import { pkDay } from "@/lib/pkDate";

/**
 * A guest's booking, as the app's Trips and trip pass show it.
 *
 * `state` is decided HERE, once, from the CRM's status, the payment hold and
 * how the advance is being paid, so the app only maps a word to copy and can
 * never misread a status the CRM adds later (an unknown one is "confirmed",
 * the safe reading for anything past payment).
 *
 *   paying        card checkout opened, hold still running
 *   verifying     transfer screenshot sent, the team is checking it
 *   awaiting      unpaid with no payment started (hold still running)
 *   hold_ended    unpaid and the hold ran out: the dates are free again
 *   confirmed     paid, before check-in
 *   staying       checked in
 *   completed     checked out
 *   cancelled
 */
export type TripState = "paying" | "verifying" | "awaiting" | "hold_ended" | "confirmed" | "staying" | "completed" | "cancelled";

export type AppTrip = {
  id: string;
  listingId: string | null;
  title: string;
  area: string | null;
  /** The stay page's own hero crop, so it is usually already on the phone. */
  photo: string | null;
  checkin: string | null;
  checkout: string | null;
  nights: number | null;
  /** "2:00 PM" · "12:00 PM" — company-wide until stays carry their own. */
  checkInTime: string;
  checkOutTime: string;
  /** How many guests, when the booking says. */
  guests: number | null;
  amount: number;
  advancePaid: number;
  balance: number;
  /** A promo code taken off the check-in balance; amount and balance are after it. */
  promo: { code: string; discount: number } | null;
  state: TripState;
  /** ISO; only while an unpaid hold is running. */
  holdUntil: string | null;
  /** The EXACT place, for the pass's map and Directions: only once the trip is
   *  confirmed or the guest is staying; null otherwise (see tripLocations). */
  location: TripLocation | null;
};

export type TripLocation = { lat: number; lng: number; name: string | null; address: string | null; placeId: string | null };

const CONFIRMED = ["payment_collected", "handed_over", "awaiting_checkin", "needs_attention"];

/**
 * How each UNPAID booking's advance is being paid: a pending card checkout, or
 * a transfer screenshot waiting for the team. Read with the service role but
 * only for ids the guest's own session already returned (RLS), and only the
 * fact of a payment, never its proof.
 */
export async function paymentsInFlight(bookings: MyBooking[]): Promise<Map<string, "card" | "transfer">> {
  const unpaid = bookings.filter((b) => b.status === "awaiting_payment" && !b.holdEnded).map((b) => b.id);
  const out = new Map<string, "card" | "transfer">();
  if (!unpaid.length) return out;
  const admin = createAdminClient();
  const [cards, transfers] = await Promise.all([
    admin.from("gateway_payments").select("booking_id").in("booking_id", unpaid).eq("status", "pending"),
    admin.from("booking_payments").select("booking_id").in("booking_id", unpaid).not("proof_url", "is", null),
  ]);
  for (const r of cards.data ?? []) out.set(r.booking_id as string, "card");
  // A screenshot outranks an open card page: the guest switched to transfer.
  for (const r of transfers.data ?? []) out.set(r.booking_id as string, "transfer");
  return out;
}

export function tripState(b: MyBooking, paying: "card" | "transfer" | undefined): TripState {
  const s = b.status;
  if (s === "cancelled") return "cancelled";
  if (s === "checked_out" || s === "completed") return "completed";
  if (s === "currently_staying") return "staying";
  if (s === "awaiting_payment" || s === "in_progress") {
    if (b.holdEnded) return "hold_ended";
    if (paying === "transfer") return "verifying";
    if (paying === "card") return "paying";
    return "awaiting";
  }
  if (CONFIRMED.includes(s)) return "confirmed";
  return "confirmed";
}

/** Statuses that mean the stay is truly booked: confirmed, or the guest is in. */
const BOOKED = [...CONFIRMED, "currently_staying"];

/** May this trip see the exact building? Confirmed or staying, by state AND by
 *  a known booked status, so a status tripState doesn't know never shows it. */
const seesExact = (b: MyBooking, state: TripState) => (state === "confirmed" || state === "staying") && BOOKED.includes(b.status);

/**
 * The exact place of each booked trip's stay, keyed by listing id, from
 * phase97's `listing_locations` (staff-only by RLS; one row per property or
 * external listing, `listing_id` = whichever it is). Before a guest books,
 * only an area is public (founder, 26 Oct: an owner-listed building lets a
 * guest go around Esker), so this is read with the service role, and only for
 * trips that may see it. A stay with no location set, or a database without
 * phase97, gives no entry: the pass shows no map rather than failing.
 */
export async function tripLocations(bookings: MyBooking[], paying: Map<string, "card" | "transfer">): Promise<Map<string, TripLocation>> {
  const ids = [...new Set(bookings.filter((b) => seesExact(b, tripState(b, paying.get(b.id)))).map((b) => b.listing?.id).filter((id): id is string => !!id))];
  const out = new Map<string, TripLocation>();
  if (!ids.length) return out;
  const { data } = await createAdminClient()
    .from("listing_locations")
    .select("listing_id, latitude, longitude, place_name, address, place_id")
    .in("listing_id", ids);
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const lat = r.latitude as number | null;
    const lng = r.longitude as number | null;
    if (lat == null || lng == null) continue;
    out.set(r.listing_id as string, {
      lat,
      lng,
      name: (r.place_name as string | null) ?? null,
      address: (r.address as string | null) ?? null,
      placeId: (r.place_id as string | null) ?? null,
    });
  }
  return out;
}

export function appTrip(b: MyBooking, paying: "card" | "transfer" | undefined, located?: Map<string, TripLocation>): AppTrip {
  const photo = b.listing?.photos?.[0];
  const state = tripState(b, paying);
  return {
    id: b.id,
    listingId: b.listing?.id ?? null,
    title: b.listing?.title ?? "Your stay",
    area: b.listing?.area ?? null,
    photo: photo ? crop(photo, 1170, 1176, 74) : null,
    // Plain Pakistani days: the columns are timestamptz, and the app (and Pay)
    // work in "YYYY-MM-DD".
    checkin: b.checkin ? pkDay(b.checkin) : null,
    checkout: b.checkout ? pkDay(b.checkout) : null,
    nights: b.nights,
    checkInTime: company.checkIn,
    checkOutTime: company.checkOut,
    guests: b.guests,
    amount: b.amount,
    advancePaid: b.advancePaid,
    balance: b.balance,
    promo: b.promo,
    state,
    holdUntil: state === "paying" || state === "verifying" || state === "awaiting" ? b.holdUntil : null,
    location: seesExact(b, state) ? (located?.get(b.listing?.id ?? "") ?? null) : null,
  };
}
