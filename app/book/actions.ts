"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyId } from "@/lib/ai/idcheck";
import { advanceAmount } from "@/lib/payments";
import { notifyBookingReceived } from "@/lib/notifyGuest";

const ACTIVE = ["awaiting_payment", "payment_collected", "handed_over", "awaiting_checkin", "currently_staying", "needs_attention"];
// Unpaid WEBSITE holds free their dates after this long (matches the
// public_availability view), so an abandoned checkout never locks a property.
const HOLD_HOURS = 18;
const BUCKET = "guest-docs";
const MAX_BYTES = 10 * 1024 * 1024;

export type BookingResult = { ok: boolean; bookingId?: string; message?: string };

function ext(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return (file.type.split("/")[1] || "jpg").toLowerCase();
}

function nightsBetween(checkin: string, checkout: string): number {
  const ci = new Date(`${checkin}T00:00:00`);
  const co = new Date(`${checkout}T00:00:00`);
  return Math.round((co.getTime() - ci.getTime()) / 86_400_000);
}

export async function createBooking(formData: FormData): Promise<BookingResult> {
  const propertyId = String(formData.get("propertyId") || "");
  const checkin = String(formData.get("checkin") || "");
  const checkout = String(formData.get("checkout") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const proof = formData.get("proof") as File | null;
  const cnicFront = formData.get("cnicFront") as File | null;
  const cnicBack = formData.get("cnicBack") as File | null;

  // Who's booking (optional — guest checkout allowed).
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  const accountId = user?.id ?? null;

  const admin = createAdminClient();

  // 1. Property must exist and be PUBLIC (read the public window).
  const { data: listing } = await admin.from("public_listings").select("id, title, price, area, category, esker_exclusive").eq("id", propertyId).maybeSingle();
  if (!listing) return { ok: false, message: "This place isn't available to book." };

  // 2. Dates.
  const today = new Date().toISOString().slice(0, 10);
  if (!checkin || !checkout || checkin < today || checkout <= checkin) {
    return { ok: false, message: "Please pick valid check-in and check-out dates." };
  }
  const nights = nightsBetween(checkin, checkout);
  if (nights < 1) return { ok: false, message: "Your stay must be at least one night." };
  const price = Number(listing.price) || 0;
  const amount = Math.round(price * nights);
  const exclusive = Boolean((listing as { esker_exclusive?: boolean }).esker_exclusive);
  const advance = advanceAmount(amount, exclusive);
  const balance = amount - advance;

  // 3. No double-booking. (An unpaid WEBSITE hold older than HOLD_HOURS no
  //    longer blocks — its dates have auto-released.)
  const { data: clashes } = await admin
    .from("bookings")
    .select("id, status, source, created_at")
    .eq("property_id", propertyId)
    .is("lost_reason", null)
    .in("status", ACTIVE)
    .lt("checkin", checkout)
    .gt("checkout", checkin);
  const holdCutoff = Date.now() - HOLD_HOURS * 3600 * 1000;
  const realClash = (clashes ?? []).some((c) =>
    c.status === "awaiting_payment" && c.source === "Website"
      ? new Date(c.created_at as string).getTime() > holdCutoff
      : true,
  );
  if (realClash) return { ok: false, message: "Sorry — those dates were just taken. Please pick others." };

  // 4. Guest details + proof.
  if (!name || !phone) return { ok: false, message: "Please enter your name and phone number." };
  if (!proof || proof.size === 0) return { ok: false, message: "Please upload your payment screenshot." };
  if (proof.size > MAX_BYTES) return { ok: false, message: "That screenshot is too large (max 10 MB)." };

  // 5. Find or create the guest (by phone). CNIC required only on first booking.
  const { data: existing } = await admin.from("guests").select("id, cnic_front_url").eq("phone", phone).limit(1).maybeSingle();
  let guestId = existing?.id as string | undefined;
  const cnicOnFile = Boolean(existing?.cnic_front_url);

  if (!guestId) {
    const { data: g, error: gErr } = await admin
      .from("guests")
      .insert({ name, phone, lead_source: "Website" })
      .select("id")
      .single();
    if (gErr || !g) return { ok: false, message: "Could not start your booking. Please try again." };
    guestId = g.id;
  }

  let idNote = "";
  if (!cnicOnFile) {
    if (!cnicFront || cnicFront.size === 0 || !cnicBack || cnicBack.size === 0) {
      return { ok: false, message: "Please add your CNIC or passport (front and back) — only needed for your first booking with Esker." };
    }
    if (cnicFront.size > MAX_BYTES || cnicBack.size > MAX_BYTES) return { ok: false, message: "ID images are too large (max 10 MB each)." };

    // AI vision: is it a real CNIC/passport, readable, valid format, NOT expired?
    const idCheck = await verifyId(cnicFront);
    if (!idCheck.ok) return { ok: false, message: idCheck.message };
    idNote = ` ID (AI-checked, NADRA pending): ${idCheck.docType ?? "id"} ${idCheck.number ?? "?"}${idCheck.name ? `, ${idCheck.name}` : ""}${idCheck.expiry ? `, expiry ${idCheck.expiry}` : ""}.`;

    const frontPath = `${guestId}/cnic-front-${Date.now()}.${ext(cnicFront)}`;
    const backPath = `${guestId}/cnic-back-${Date.now()}.${ext(cnicBack)}`;
    const up1 = await admin.storage.from(BUCKET).upload(frontPath, cnicFront, { contentType: cnicFront.type, upsert: false });
    const up2 = await admin.storage.from(BUCKET).upload(backPath, cnicBack, { contentType: cnicBack.type, upsert: false });
    if (up1.error || up2.error) return { ok: false, message: "Couldn't upload your ID. Please try again." };
    await admin.from("guests").update({ cnic_front_url: frontPath, cnic_back_url: backPath }).eq("id", guestId);
  }

  // 6. Create the booking (awaiting team verification of the screenshot).
  const note = `Website booking — ${exclusive ? "50%" : "25%"} advance ₨${advance.toLocaleString("en-PK")} of ₨${amount.toLocaleString("en-PK")} (balance ₨${balance.toLocaleString("en-PK")} due at check-in). Verify the payment screenshot.${email ? ` Email: ${email}.` : ""}${idNote}`;
  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .insert({
      guest_id: guestId,
      account_id: accountId,
      property_id: propertyId,
      checkin,
      checkout,
      nights,
      rate_at_booking: price,
      amount,
      status: "awaiting_payment",
      payment_status: "partial",
      source: "Website",
      notes: note,
    })
    .select("id")
    .single();
  if (bErr || !booking) return { ok: false, message: "Could not create your booking. Please try again." };

  // 7. Record the advance + its proof screenshot. The CRM's recompute trigger
  //    sets advance_paid + payment_status; the team verifies the proof to confirm.
  const proofPath = `payments/${booking.id}/pay-${Date.now()}.${ext(proof)}`;
  const upP = await admin.storage.from(BUCKET).upload(proofPath, proof, { contentType: proof.type, upsert: false });
  if (!upP.error) {
    await admin.from("booking_payments").insert({
      booking_id: booking.id,
      amount: advance,
      proof_url: proofPath,
      note: `Website advance (${exclusive ? "50%" : "25%"}) — verify this screenshot.`,
    });
  }

  // 8. Notify the guest (email now; WhatsApp queued for the inbox) + the team.
  await notifyBookingReceived({
    bookingId: booking.id,
    guestId: guestId!,
    guestName: name,
    email: email || undefined,
    phone,
    propertyId,
    propertyTitle: String(listing.title ?? "your stay"),
    area: (listing as { area?: string | null }).area ?? null,
    category: (listing as { category?: string | null }).category ?? null,
    checkin,
    checkout,
    nights,
    total: amount,
    advance,
    balance,
  });

  return { ok: true, bookingId: booking.id };
}
