"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancellationQuote } from "@/lib/payments";
import { sendEmail } from "@/lib/email";
import { toE164Pk } from "@/lib/otp";
import { issueOtp, checkOtp } from "@/lib/otpFlow";
import { notifyStaff } from "@/lib/notifyStaff";

export type ActionResult = { ok: boolean; message: string };

// Bookings a guest may still self-cancel (only before check-in).
const CANCELLABLE = ["awaiting_payment", "payment_collected", "handed_over", "awaiting_checkin"];
const DOC_BUCKET = "guest-docs";
const MAX_BYTES = 10 * 1024 * 1024;

const pkr = (n: number) => `₨${Math.round(n).toLocaleString("en-PK")}`;

function fileExt(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return (file.type.split("/")[1] || "jpg").toLowerCase();
}

// In-app staff alerts live in lib/notifyStaff.ts (shared with the external
// date-request flow).

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Self-grant the 'owner' role (RLS only permits guest/owner for one's own
// account; 'partner' is admin-granted and cannot be self-assigned).
export async function becomeHost() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("account_roles")
    .upsert({ account_id: user.id, role: "owner" }, { onConflict: "account_id,role", ignoreDuplicates: true });

  revalidatePath("/account");
}

// ── WhatsApp phone verification (OTP) ────────────────────────────────────────

// Same shape lib/otpFlow.ts returns — declared inline because a "use server"
// file may only export async functions (a type-only re-export breaks Turbopack).
export type OtpResult = { ok: boolean; message: string; devCode?: string };

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Send a WhatsApp OTP to the given number for the signed-in account.
 *  (Thin wrapper — the engine lives in lib/otpFlow.ts, shared with phone signup.) */
export async function sendPhoneOtp(rawPhone: string): Promise<OtpResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const e164 = toE164Pk(rawPhone);
  if (!e164) return { ok: false, message: "Enter a valid Pakistani mobile number." };

  return issueOtp(accountId, e164);
}

/** Verify the code the guest received; on success stamp the account verified.
 *  (Thin wrapper — the engine lives in lib/otpFlow.ts, shared with phone signup.) */
export async function verifyPhoneOtp(code: string): Promise<OtpResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const res = await checkOtp(accountId, code);
  if (res.ok) {
    revalidatePath("/account");
    revalidatePath("/account/profile");
  }
  return res;
}

// ── Profile ──────────────────────────────────────────────────────────────────

/** Update the account's display name + phone. Editing the phone here (not via OTP)
 *  un-verifies it, so the WhatsApp-verified badge always reflects a proven number. */
export async function updateProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in first." };

  const name = String(formData.get("name") || "").trim().slice(0, 80);
  const rawPhone = String(formData.get("phone") || "").trim();
  if (!name) return { ok: false, message: "Please enter your name." };

  const patch: Record<string, unknown> = { name };
  if (rawPhone) {
    const e164 = toE164Pk(rawPhone);
    if (!e164) return { ok: false, message: "Enter a valid Pakistani mobile number, or leave it blank." };
    // Read the current phone so we only reset verification when it actually changes.
    const { data: acct } = await supabase.from("accounts").select("phone").eq("id", user.id).maybeSingle();
    patch.phone = e164;
    if ((acct?.phone ?? null) !== e164) patch.phone_verified_at = null;
  } else {
    patch.phone = null;
    patch.phone_verified_at = null;
  }

  const { error } = await supabase.from("accounts").update(patch).eq("id", user.id);
  if (error) return { ok: false, message: "Could not save your profile. Please try again." };

  revalidatePath("/account");
  revalidatePath("/account/profile");
  return { ok: true, message: "Profile saved." };
}

// ── Profile picture (avatar) ─────────────────────────────────────────────────
// Public `avatars` bucket, uploaded via the service role (same pattern as
// guest-docs). One file per account (old ones are removed) so URLs never go stale.

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export async function updateAvatar(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) return { ok: false, message: "Please choose a photo." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "Please choose an image (JPG, PNG or WebP)." };
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, message: "That image is too large (max 5 MB)." };

  const admin = createAdminClient();

  // Clear any previous avatar files for this account (keep storage tidy + URLs fresh).
  const { data: old } = await admin.storage.from(AVATAR_BUCKET).list(accountId);
  if (old?.length) await admin.storage.from(AVATAR_BUCKET).remove(old.map((f) => `${accountId}/${f.name}`));

  const path = `${accountId}/avatar-${Date.now()}.${fileExt(file)}`;
  const up = await admin.storage.from(AVATAR_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) return { ok: false, message: "Couldn't upload your photo. Please try again." };

  const { data: pub } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const { error } = await admin.from("accounts").update({ avatar_url: pub.publicUrl }).eq("id", accountId);
  if (error) return { ok: false, message: "Couldn't save your photo. Please try again." };

  revalidatePath("/account");
  revalidatePath("/account/profile");
  return { ok: true, message: "Profile picture updated." };
}

export async function removeAvatar(): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const admin = createAdminClient();
  const { data: old } = await admin.storage.from(AVATAR_BUCKET).list(accountId);
  if (old?.length) await admin.storage.from(AVATAR_BUCKET).remove(old.map((f) => `${accountId}/${f.name}`));
  await admin.from("accounts").update({ avatar_url: null }).eq("id", accountId);

  revalidatePath("/account");
  revalidatePath("/account/profile");
  return { ok: true, message: "Profile picture removed." };
}

// ── Preferences ──────────────────────────────────────────────────────────────

export async function updatePreferences(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in first." };

  const language = String(formData.get("language") || "en") === "ur" ? "ur" : "en";
  const { error } = await supabase
    .from("accounts")
    .update({
      notify_email: formData.get("notify_email") != null,
      notify_whatsapp: formData.get("notify_whatsapp") != null,
      language,
    })
    .eq("id", user.id);
  if (error) return { ok: false, message: "Could not save your preferences. Please try again." };

  revalidatePath("/account/preferences");
  return { ok: true, message: "Preferences saved." };
}

// ── Security ─────────────────────────────────────────────────────────────────

export async function changePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in first." };

  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 8) return { ok: false, message: "Use at least 8 characters." };
  if (password !== confirm) return { ok: false, message: "The two passwords don't match." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Password updated." };
}

// ── Cancel a booking (guest self-service) ────────────────────────────────────

export type CancelResult = ActionResult & { refund?: number; retained?: number };

/** Guest self-cancel. Mirrors the CRM's cancelBooking money logic exactly so the
 *  ledger stays honest: the policy refund is logged as a NEGATIVE payment, the kept
 *  amount becomes `cancel_fee`, and staff are alerted to actually send the refund.
 *  Only a pre-check-in booking the account owns can be cancelled here. */
export async function cancelMyBooking(bookingId: string): Promise<CancelResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const admin = createAdminClient();
  const { data: b } = await admin
    .from("bookings")
    .select("id, account_id, property_id, checkin, status, advance_paid, notes")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b || b.account_id !== accountId) return { ok: false, message: "Booking not found." };
  if (!CANCELLABLE.includes(String(b.status))) {
    return { ok: false, message: "This booking can no longer be cancelled online — please message us." };
  }
  if (!b.checkin) return { ok: false, message: "This booking can't be cancelled online — please message us." };

  const collected = Math.max(0, Math.round(Number(b.advance_paid) || 0));
  const quote = cancellationQuote(String(b.checkin), collected);
  const refund = Math.min(quote.refund, collected);
  const retained = collected - refund;

  // Negative payment → the recompute trigger drops advance_paid to the retained fee.
  if (refund > 0) {
    await admin.from("booking_payments").insert({
      booking_id: bookingId,
      amount: -refund,
      note: "Website cancellation refund (guest self-cancel)",
    });
  }

  const stamp = new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi" });
  const note = `${b.notes ? `${b.notes}\n` : ""}Cancelled by guest via website (${stamp}). Policy: ${quote.tier}. Refund due ${pkr(refund)}, retained ${pkr(retained)}. ${refund > 0 ? "Send the refund to the guest." : "No refund due."}`;
  const { error } = await admin
    .from("bookings")
    .update({ status: "cancelled", cancel_fee: retained, notes: note })
    .eq("id", bookingId);
  if (error) return { ok: false, message: "Could not cancel the booking. Please try again." };

  // Alert staff (and email the guest, best-effort).
  const { data: listing } = await admin.from("public_listings").select("title").eq("id", b.property_id).maybeSingle();
  const title = String(listing?.title ?? "a stay");
  await notifyStaff(admin, {
    title: `Website cancellation — ${title}`,
    body: refund > 0 ? `Guest cancelled · refund ${pkr(refund)} to send (kept ${pkr(retained)})` : `Guest cancelled · no refund due`,
    link: `/bookings/${bookingId}`,
  });

  try {
    const { data: acct } = await admin.from("accounts").select("email, name, notify_email").eq("id", accountId).maybeSingle();
    if (acct?.email && acct.notify_email !== false) {
      const line = refund > 0 ? `We'll refund ${pkr(refund)} to your original payment method within 5–7 working days.` : `As per our policy, no refund applies to this cancellation.`;
      await sendEmail({
        to: acct.email,
        subject: `Your Esker booking is cancelled — ${title}`,
        html: `<p>Hi ${acct.name || "there"},</p><p>Your booking for <strong>${title}</strong> has been cancelled. ${line}</p><p>If this wasn't you or you have any questions, just reply or message us in your account.</p><p>— Esker Rentals</p>`,
        text: `Your booking for ${title} has been cancelled. ${line}`,
      });
    }
  } catch {
    /* best-effort */
  }

  revalidatePath("/account");
  revalidatePath("/account/trips");
  revalidatePath(`/account/bookings/${bookingId}`);
  return { ok: true, message: quote.label, refund, retained };
}

// ── Interim balance payment (bank transfer + screenshot) ─────────────────────
// Records the balance the same way the booking flow records the advance: a
// booking_payments row + proof the team verifies in the CRM. Replaced by the
// Safepay "Pay now" path later, behind lib/payments/provider.ts.

export async function submitBalancePayment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const bookingId = String(formData.get("bookingId") || "");
  const proof = formData.get("proof") as File | null;
  if (!proof || proof.size === 0) return { ok: false, message: "Please upload your payment screenshot." };
  if (proof.size > MAX_BYTES) return { ok: false, message: "That screenshot is too large (max 10 MB)." };

  const admin = createAdminClient();
  const { data: b } = await admin
    .from("bookings")
    .select("id, account_id, amount, advance_paid, status, property_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b || b.account_id !== accountId) return { ok: false, message: "Booking not found." };
  const balance = Math.max(0, Math.round(Number(b.amount) || 0) - Math.round(Number(b.advance_paid) || 0));
  if (balance <= 0) return { ok: false, message: "This booking is already fully paid." };
  if (["cancelled", "checked_out"].includes(String(b.status))) {
    return { ok: false, message: "This booking can't take a payment right now." };
  }

  const path = `payments/${bookingId}/balance-${Date.now()}.${fileExt(proof)}`;
  const up = await admin.storage.from(DOC_BUCKET).upload(path, proof, { contentType: proof.type, upsert: false });
  if (up.error) return { ok: false, message: "Couldn't upload your screenshot. Please try again." };

  await admin.from("booking_payments").insert({
    booking_id: bookingId,
    amount: balance,
    proof_url: path,
    note: "Website balance payment — verify this screenshot.",
  });

  const { data: listing } = await admin.from("public_listings").select("title").eq("id", b.property_id).maybeSingle();
  await notifyStaff(admin, {
    title: `Balance payment uploaded — ${String(listing?.title ?? "a stay")}`,
    body: `Guest uploaded ${pkr(balance)} balance proof — verify it`,
    link: `/bookings/${bookingId}`,
  });

  revalidatePath("/account");
  revalidatePath(`/account/bookings/${bookingId}`);
  return { ok: true, message: "Thanks — we've received your screenshot and will confirm shortly." };
}

// ── Guest review for a completed stay ────────────────────────────────────────
// Publishes instantly (source 'guest', status 'published'); staff can hide in the
// CRM. Only a checked-out booking the account owns can be reviewed; one review per
// stay (upserted by booking_id). Ratings are 1–5 in 0.25 steps.

export type ReviewInput = { bookingId: string; rating: number; body: string; location?: string };

export async function submitReview(input: ReviewInput): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const rating = Math.round((Number(input.rating) || 0) / 0.25) * 0.25;
  if (rating < 1 || rating > 5) return { ok: false, message: "Please pick a rating between 1 and 5 stars." };
  const body = String(input.body || "").trim();
  if (body.length < 3) return { ok: false, message: "Please write a few words about your stay." };
  if (body.length > 2000) return { ok: false, message: "That review is a little long — please shorten it." };
  const location = String(input.location || "").trim().slice(0, 60) || null;

  const admin = createAdminClient();
  const { data: b } = await admin
    .from("bookings")
    .select("id, account_id, status, property_id, guest_id, checkin")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!b || b.account_id !== accountId) return { ok: false, message: "Booking not found." };
  if (b.status !== "checked_out") return { ok: false, message: "You can review a stay once it's completed." };

  const { data: acct } = await admin.from("accounts").select("name").eq("id", accountId).maybeSingle();
  const authorName = (acct?.name || "").trim() || "Esker guest";

  const row = {
    property_id: b.property_id,
    guest_id: b.guest_id,
    booking_id: b.id,
    author_name: authorName,
    author_location: location,
    rating,
    body,
    source: "guest",
    status: "published",
    stayed_on: b.checkin,
  };

  // One review per stay: update if it exists, else insert.
  const { data: existing } = await admin.from("reviews").select("id").eq("booking_id", b.id).maybeSingle();
  const res = existing?.id
    ? await admin.from("reviews").update(row).eq("id", existing.id)
    : await admin.from("reviews").insert(row);
  if (res.error) return { ok: false, message: "Could not save your review. Please try again." };

  revalidatePath(`/account/bookings/${b.id}`);
  revalidatePath(`/stays/${b.property_id}`);
  return { ok: true, message: existing?.id ? "Your review is updated." : "Thanks — your review is live!" };
}
