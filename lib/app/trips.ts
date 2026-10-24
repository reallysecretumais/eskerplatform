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
};

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

export function appTrip(b: MyBooking, paying: "card" | "transfer" | undefined): AppTrip {
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
  };
}
