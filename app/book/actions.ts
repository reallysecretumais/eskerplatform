"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyId, type IdSide } from "@/lib/ai/idcheck";
import { advanceAmount, advanceLabel } from "@/lib/payments";
import { SITE_URL } from "@/lib/seo";
import { notifyBookingReceived } from "@/lib/notifyGuest";
import { capiEvent } from "@/lib/analytics";
import { getExternalBookability } from "@/lib/data/externalBooking";

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

// Ensure the booker has a website account so they can track the booking + chat.
// Reuses an existing account (by email) or creates one via the service role (the
// `handle_new_user` trigger files it under `accounts`, never staff). Returns a
// time-limited magic link so guest-checkout users get in without a password.
// Best-effort: an email is required to be reachable; any failure → no account,
// and the booking proceeds unaffected.
async function ensureGuestAccount(
  admin: ReturnType<typeof createAdminClient>,
  info: { email: string; phone: string; name: string },
): Promise<{ accountId: string | null; magicLink: string | null }> {
  const email = info.email.trim();
  if (!email) return { accountId: null, magicLink: null };
  try {
    const { data: existing } = await admin.from("accounts").select("id").ilike("email", email).maybeSingle();
    let id = existing?.id as string | undefined;
    if (!id) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { account_type: "guest", name: info.name },
      });
      if (error || !created?.user) return { accountId: null, magicLink: null };
      id = created.user.id;
    }
    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${SITE_URL}/account` },
    });
    return { accountId: id, magicLink: link?.properties?.action_link ?? null };
  } catch {
    return { accountId: null, magicLink: null };
  }
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
  const docType = String(formData.get("docType") || "cnic") === "passport" ? "passport" : "cnic";

  // Who's booking (optional — guest checkout allowed).
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  let accountId = user?.id ?? null;
  let accountMagicLink: string | null = null;

  const admin = createAdminClient();

  // 1. Property must exist and be PUBLIC (read the public window). `source` tells
  //    us whether this is an Esker-run property or EXTERNAL (resale) inventory
  //    Esker sources from another owner — the two book against different columns
  //    (external rows live in `external_properties`, so property_id must be NULL).
  const { data: listing } = await admin.from("public_listings").select("id, title, price, area, category, esker_exclusive, source").eq("id", propertyId).maybeSingle();
  if (!listing) return { ok: false, message: "This place isn't available to book." };
  const isExternal = (listing as { source?: string }).source === "external";

  // 2. Dates.
  const today = new Date().toISOString().slice(0, 10);
  if (!checkin || !checkout || checkin < today || checkout <= checkin) {
    return { ok: false, message: "Please pick valid check-in and check-out dates." };
  }
  const nights = nightsBetween(checkin, checkout);
  if (nights < 1) return { ok: false, message: "Your stay must be at least one night." };

  // 2b. SAFETY GATE — never take money for an external (resale) unit whose owner
  //     calendar we can't currently see. Esker doesn't control that calendar, so
  //     without a fresh sync those dates may already be sold. Enforced HERE (not
  //     just in the UI) so no request path can bypass it.
  if (isExternal) {
    const bookability = await getExternalBookability(propertyId);
    if (bookability.mode !== "instant") {
      return {
        ok: false,
        message: "We need to confirm these dates with the owner before taking payment. Please request them and we'll come back to you shortly.",
      };
    }
  }
  const price = Number(listing.price) || 0;
  const amount = Math.round(price * nights);
  const exclusive = Boolean((listing as { esker_exclusive?: boolean }).esker_exclusive);
  const advance = advanceAmount(amount, exclusive);
  const balance = amount - advance;

  // What Esker pays the owner for this stay, SNAPSHOTTED now (whole-stay total,
  // like the CRM's staff flow) so a later change to the owner's rate never
  // rewrites this booking's margin. Read server-side only — `typical_cost` is
  // deliberately absent from the public view because it reveals our margin.
  let externalCost: number | null = null;
  if (isExternal) {
    const { data: ext } = await admin.from("external_properties").select("typical_cost").eq("id", propertyId).maybeSingle();
    externalCost = Math.round((Number(ext?.typical_cost) || 0) * nights);
  }

  // 3. No double-booking. (An unpaid WEBSITE hold older than HOLD_HOURS no
  //    longer blocks — its dates have auto-released.)
  const clashBase = admin
    .from("bookings")
    .select("id, status, source, created_at")
    .is("lost_reason", null)
    .in("status", ACTIVE)
    .lt("checkin", checkout)
    .gt("checkout", checkin);
  const { data: clashes } = await (isExternal
    ? clashBase.eq("external_property_id", propertyId)
    : clashBase.eq("property_id", propertyId));
  const holdCutoff = Date.now() - HOLD_HOURS * 3600 * 1000;
  const realClash = (clashes ?? []).some((c) =>
    c.status === "awaiting_payment" && c.source === "Website"
      ? new Date(c.created_at as string).getTime() > holdCutoff
      : true,
  );
  if (realClash) return { ok: false, message: "Sorry — those dates were just taken. Please pick others." };

  if (isExternal) {
    // The OWNER's own calendar, cached by the CRM's iCal sync. Stale rows still
    // block: hiding a date that's actually free is far cheaper than double-selling
    // one on a calendar Esker doesn't control. `ends` is exclusive, so a stay
    // starting exactly when another ends is NOT a clash.
    const { data: busy } = await admin
      .from("external_ical_busy")
      .select("id")
      .eq("external_property_id", propertyId)
      .lt("starts", checkout)
      .gt("ends", checkin)
      .limit(1);
    if (busy && busy.length > 0) {
      return { ok: false, message: "Sorry — those dates were just taken. Please pick others." };
    }
  } else {
    // Host-blocked dates (self-listed places): treated exactly like bookings.
    const { data: blocked } = await admin
      .from("property_blocks")
      .select("id")
      .eq("property_id", propertyId)
      .lt("start_date", checkout)
      .gt("end_date", checkin)
      .limit(1);
    if (blocked && blocked.length > 0) {
      return { ok: false, message: "Sorry — the host has those dates unavailable. Please pick others." };
    }
  }

  // 4. Guest details + proof.
  if (!name || !phone) return { ok: false, message: "Please enter your name and phone number." };
  if (!proof || proof.size === 0) return { ok: false, message: "Please upload your payment screenshot." };
  if (proof.size > MAX_BYTES) return { ok: false, message: "That screenshot is too large (max 10 MB)." };

  // 4b. Give every booker an account (if not already signed in) so they can track
  //     this booking and message us. Best-effort: needs an email to be reachable;
  //     never blocks the booking.
  if (!accountId) {
    const prov = await ensureGuestAccount(admin, { email, phone, name });
    accountId = prov.accountId;
    accountMagicLink = prov.magicLink;
  }

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
    // A passport is a single data page; a CNIC has a front and a back.
    const needBack = docType === "cnic";
    if (!cnicFront || cnicFront.size === 0 || (needBack && (!cnicBack || cnicBack.size === 0))) {
      return {
        ok: false,
        message: needBack
          ? "Please add your CNIC (front and back) — only needed for your first booking with Esker."
          : "Please add your passport (the photo/data page) — only needed for your first booking with Esker.",
      };
    }
    if (cnicFront.size > MAX_BYTES || (needBack && cnicBack && cnicBack.size > MAX_BYTES)) {
      return { ok: false, message: "ID images are too large (max 10 MB each)." };
    }

    // AI vision: is it a real CNIC/passport, readable, valid format, NOT expired?
    const idCheck = await verifyId(cnicFront);
    if (!idCheck.ok) return { ok: false, message: idCheck.message };
    idNote = ` ID (AI-checked, NADRA pending): ${idCheck.docType ?? docType} ${idCheck.number ?? "?"}${idCheck.name ? `, ${idCheck.name}` : ""}${idCheck.expiry ? `, expiry ${idCheck.expiry}` : ""}.`;

    const frontPath = `${guestId}/${docType}-front-${Date.now()}.${ext(cnicFront)}`;
    const up1 = await admin.storage.from(BUCKET).upload(frontPath, cnicFront, { contentType: cnicFront.type, upsert: false });
    if (up1.error) return { ok: false, message: "Couldn't upload your ID. Please try again." };

    let backPath: string | null = null;
    if (needBack && cnicBack) {
      const bp = `${guestId}/${docType}-back-${Date.now()}.${ext(cnicBack)}`;
      const up2 = await admin.storage.from(BUCKET).upload(bp, cnicBack, { contentType: cnicBack.type, upsert: false });
      if (up2.error) return { ok: false, message: "Couldn't upload your ID. Please try again." };
      backPath = bp;
    }
    await admin.from("guests").update({ cnic_front_url: frontPath, cnic_back_url: backPath }).eq("id", guestId);
  }

  // 6. Create the booking (awaiting team verification of the screenshot).
  const note = `Website booking — ${advanceLabel(amount, exclusive)} advance ₨${advance.toLocaleString("en-PK")} of ₨${amount.toLocaleString("en-PK")} (balance ₨${balance.toLocaleString("en-PK")} due at check-in). Verify the payment screenshot.${email ? ` Email: ${email}.` : ""}${idNote}`;
  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .insert({
      guest_id: guestId,
      account_id: accountId,
      // External (resale) units live in `external_properties`, so property_id
      // MUST stay null; `cost` is what Esker pays the owner and drives margin
      // everywhere in the CRM.
      ...(isExternal
        ? { property_id: null, external_property_id: propertyId, is_external: true, cost: externalCost }
        : { property_id: propertyId }),
      checkin,
      checkout,
      nights,
      // Per-NIGHT guest price. `rate_at_booking` is NOT NULL DEFAULT 0, so
      // leaving it unset silently yields 0 and breaks invoices (x0 bug).
      rate_at_booking: price,
      amount,
      status: "awaiting_payment",
      payment_status: "partial",
      // The CHANNEL, not the inventory type — `is_external` marks resale. Keeping
      // this 'Website' preserves ad/channel attribution AND arms the 18h
      // unpaid-hold auto-release, which keys on source = 'Website'.
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
    // null for external units — their id is NOT a `properties` row, and these
    // notification/outbox rows carry a property_id that references it.
    propertyId: isExternal ? null : propertyId,
    propertyTitle: String(listing.title ?? "your stay"),
    area: (listing as { area?: string | null }).area ?? null,
    category: (listing as { category?: string | null }).category ?? null,
    checkin,
    checkout,
    nights,
    total: amount,
    advance,
    balance,
    accountLink: accountMagicLink,
  });

  // 9. Meta Conversions API — server-side Purchase (no-op until CAPI is configured).
  await capiEvent("Purchase", { email: email || null, phone, value: advance, currency: "PKR", contentIds: [propertyId] });

  // 10. If the guest has a chat thread, tie this booking to it so the team sees
  //     exactly what the conversation is about. Best-effort — never blocks.
  if (accountId) {
    try {
      const { data: convo } = await admin
        .from("conversations")
        .select("id")
        .eq("account_id", accountId)
        .is("owner_account_id", null)
        .limit(1)
        .maybeSingle();
      if (convo) {
        await admin
          .from("conversations")
          .update({ booking_id: booking.id, property_id: isExternal ? null : propertyId, updated_at: new Date().toISOString() })
          .eq("id", convo.id);
        await admin.from("messages").insert({
          conversation_id: convo.id,
          direction: "outbound",
          channel: "website",
          type: "system",
          sender_kind: "system",
          body: `Booked: ${listing.title} · ${checkin} → ${checkout}`,
          status: "sent",
        });
      }
    } catch {
      /* best-effort */
    }
  }

  return { ok: true, bookingId: booking.id };
}

export type RequestDatesResult = { ok: boolean; message: string; pending?: boolean };

/**
 * Request-to-book for an EXTERNAL (resale) unit we can't instant-sell — no owner
 * calendar, or a stale sync. Fires the CRM's existing WhatsApp owner-ask (the
 * same one staff use), which logs to the Support thread and records a row in
 * `external_availability_checks`. Esker follows up with the guest from the inbox
 * once the owner answers — we never take money before that.
 *
 * An account is required (founder decision) so we have someone to come back to.
 * The CRM dedupes to one fresh pending ask per property per 24h.
 */
export async function requestExternalDates(formData: FormData): Promise<RequestDatesResult> {
  const listingId = String(formData.get("propertyId") || "");
  const checkin = String(formData.get("checkin") || "");
  const checkout = String(formData.get("checkout") || "");

  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return { ok: false, message: "Please sign in first — we'll message you as soon as the owner confirms these dates." };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (!checkin || !checkout || checkin < today || checkout <= checkin) {
    return { ok: false, message: "Please pick valid check-in and check-out dates." };
  }

  // Must be a genuinely published EXTERNAL listing (read through the public window).
  const admin = createAdminClient();
  const { data: listing } = await admin.from("public_listings").select("id, source").eq("id", listingId).maybeSingle();
  if (!listing || (listing as { source?: string }).source !== "external") {
    return { ok: false, message: "This place isn't available to request." };
  }

  const base = (process.env.CRM_URL || "https://os.eskerrentals.com").replace(/\/$/, "");
  const secret = process.env.PLATFORM_API_SECRET || process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.error("[external-ask] no PLATFORM_API_SECRET/REVALIDATE_SECRET configured");
    return { ok: false, message: "We couldn't send that request just now. Please message us and we'll confirm for you." };
  }

  try {
    // PKT check-in 2pm / check-out 12pm, matching how the CRM records stays.
    const res = await fetch(`${base}/api/platform/external-ask`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-esker-secret": secret },
      body: JSON.stringify({
        externalPropertyId: listingId,
        checkin: `${checkin}T14:00:00+05:00`,
        checkout: `${checkout}T12:00:00+05:00`,
      }),
      cache: "no-store",
    });
    const out = (await res.json().catch(() => null)) as
      | { ok?: boolean; message?: string; checkId?: string; manualFallback?: boolean }
      | null;

    if (!res.ok || !out?.ok) {
      // The CRM returns ok:false for "already asked in the last 24h" — that's a
      // fine outcome for the guest, the question is already with the owner.
      return { ok: true, pending: true, message: "We're already checking these dates with the owner — we'll come back to you shortly." };
    }
    if (out.manualFallback) {
      return { ok: true, pending: true, message: "Request received — the team is confirming these dates with the owner and will message you shortly." };
    }
    return { ok: true, pending: true, message: "Request sent. We're confirming these dates with the owner and will message you as soon as we hear back." };
  } catch (e) {
    console.error("[external-ask] failed:", e);
    return { ok: false, message: "We couldn't send that request just now. Please message us and we'll confirm for you." };
  }
}

export type IdCheckResult = { ok: boolean; message?: string };

// Real-time ID check for the checkout form: each ID image (CNIC front/back, or a
// passport data page) is validated the moment it's picked, so an unreadable/
// expired/non-ID image is rejected immediately — the guest re-uploads before
// finishing, never after. `createBooking` re-runs the front check server-side as
// the backstop.
export async function verifyIdUpload(formData: FormData): Promise<IdCheckResult> {
  const file = formData.get("file") as File | null;
  const side: IdSide = String(formData.get("side") || "front") === "back" ? "back" : "front";
  if (!file || file.size === 0) return { ok: false, message: "Please choose a clear photo of your ID." };
  if (file.size > MAX_BYTES) return { ok: false, message: "That image is too large (max 10 MB)." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "Please upload a photo (JPG or PNG)." };
  const res = await verifyId(file, side);
  return res.ok ? { ok: true } : { ok: false, message: res.message };
}
