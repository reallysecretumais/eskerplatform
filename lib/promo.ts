import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { promoBasis, type Quote, type QuotePromo } from "@/lib/quote";

/**
 * PROMO CODES — the website's and the app's door to `promo_check()`, the one
 * judge of a code for every channel (CRM `supabase/phase96_promo_codes.sql`).
 *
 * A promo is money off what the guest pays AT CHECK-IN; the advance never
 * changes. The SQL decides everything: case and spaces in the code, "first
 * booking" by phone, uses, dates, and the guest-facing `message`, which is
 * shown as-is so every surface says the same thing. It runs on the service
 * role only: a guest's session could otherwise probe whether a phone has booked.
 *
 * A booking that carries a code is judged again by the database as it is
 * saved (`trg_bookings_promo_guard`, under a lock on the code), so the last
 * use of a capped code can't be taken twice. `promoRaceRefusal` reads that.
 */

export type PromoErrorCode =
  | "promo_unknown"
  | "promo_expired"
  | "promo_not_started"
  | "promo_first_only"
  | "promo_used_up"
  | "promo_needs_phone"
  | "promo_nothing_due"
  | "promo_discount_mismatch"
  | "promo_check_failed";

export type PromoRefusal = { error: PromoErrorCode; message: string };
export type JudgedPromo = QuotePromo & { id: string };
export type PromoVerdict = { ok: true; promo: JudgedPromo } | ({ ok: false } & PromoRefusal);

/**
 * Judge `code` for this guest's stay. `phone` is the number the booking uses
 * (any format; the SQL normalises it). `bookingId` is a booking this one
 * replaces, which never counts against it: the guest's own unpaid hold on
 * the same nights.
 */
export async function judgePromo(input: { code: string; phone: string | null; quote: Quote; bookingId?: string | null }): Promise<PromoVerdict> {
  const { subtotal, owed } = promoBasis(input.quote);
  const { data, error } = await createAdminClient().rpc("promo_check", {
    p_code: input.code,
    p_phone: input.phone || null,
    p_subtotal: subtotal,
    p_owed: owed,
    p_booking: input.bookingId ?? null,
  });
  if (error || !data) {
    console.error("[promo] promo_check failed:", error?.message ?? "no answer");
    return { ok: false, error: "promo_check_failed", message: "We couldn't check that code just now. Please try again." };
  }
  const r = data as { ok: boolean; promo_id?: string; code?: string; discount?: number; error?: PromoErrorCode; message?: string };
  if (r.ok && r.promo_id && r.code && r.discount) return { ok: true, promo: { id: r.promo_id, code: r.code, discount: r.discount } };
  return { ok: false, error: r.error ?? "promo_unknown", message: r.message ?? "Code not recognised" };
}

/**
 * The booking guard's refusal, from a failed insert: SQLSTATE P0001 with the
 * guest line as `message` and the reason as `hint` (a race for the last use,
 * or a second first booking). Anything else isn't a promo refusal.
 */
export function promoRaceRefusal(err: { code?: string; message?: string; hint?: string | null } | null): PromoRefusal | null {
  if (err?.code !== "P0001" || !err.hint?.startsWith("promo_")) return null;
  return { error: err.hint as PromoErrorCode, message: err.message || "Code not recognised" };
}
