import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyId } from "@/lib/ai/idcheck";
import { advanceAmount, advanceLabel } from "@/lib/payments";
import { createSafepayCheckout, isSafepayConfigured } from "@/lib/safepay";
import { SITE_URL } from "@/lib/seo";
import { notifyBookingReceived } from "@/lib/notifyGuest";
import { capiEvent } from "@/lib/analytics";
import { getExternalBookability, hasAuthorizedRequest, refreshExternalCalendar } from "@/lib/data/externalBooking";
import { blocksDates, holdUntil, isExpiringHold } from "@/lib/booking/hold";
import { rs } from "@/lib/listings";
import { toE164Pk } from "@/lib/otp";

/**
 * THE BOOKING CORE — the one place a guest's booking is made, for the website's
 * checkout form (app/book/actions.ts) and the app's POST /api/app/v1/bookings
 * alike. The two callers only differ in how they read their input and where
 * Safepay sends the guest afterwards, so the price, the advance, every clash
 * check, the ID rule and the date hold cannot drift apart between them.
 *
 * Callers resolve WHO is booking (the signed-in account, or none for a website
 * guest checkout) and pass it in; nothing here reads a session.
 */

const ACTIVE = ["awaiting_payment", "payment_collected", "handed_over", "awaiting_checkin", "currently_staying", "needs_attention"];
// How long an unpaid booking keeps its dates (30 min card, 18 h transfer) is
// decided once, in lib/booking/hold.ts, and stamped on the row as hold_until.
const BUCKET = "guest-docs";
const MAX_BYTES = 10 * 1024 * 1024;

/** The app schemes Safepay's return page may open (app.config.ts variants). */
const APP_SCHEMES = ["esker", "eskerpreview", "eskerdev"];

export type BookingChannel = "website" | "app";

export type CreateBookingInput = {
  propertyId: string;
  checkin: string;
  checkout: string;
  name: string;
  phone: string;
  email: string;
  /** "card" = Safepay's hosted checkout, no screenshot; "transfer" = bank transfer + screenshot. */
  payMethod: "card" | "transfer";
  proof: File | null;
  idFront: File | null;
  idBack: File | null;
  docType: "cnic" | "passport";
  /** The signed-in account, or null (website guest checkout). */
  accountId: string | null;
  channel: BookingChannel;
  /** App only: which build's scheme the payment return page opens. */
  appScheme?: string;
};

/**
 * `code` is a stable machine string the app switches on; `message` is safe to
 * show a guest as-is. The website reads only `message`.
 */
export type BookingErrorCode =
  | "unavailable"
  | "dates_invalid"
  | "request_first"
  | "check_failed"
  | "dates_taken"
  | "details_required"
  | "proof_required"
  | "proof_too_large"
  | "id_required"
  | "id_too_large"
  | "id_rejected"
  | "upload_failed"
  | "card_unavailable"
  | "payment_failed"
  | "booking_failed";

export type BookingResult = {
  ok: boolean;
  bookingId?: string;
  message?: string;
  code?: BookingErrorCode;
  /** Safepay path: the hosted-checkout URL the client must open. The booking
   *  exists (awaiting_payment) and the CRM webhook settles it; an abandoned
   *  checkout releases its dates when its 30-minute card hold ends. */
  checkoutUrl?: string;
  /** When these dates go back on sale if no money arrives (ISO). */
  holdUntil?: string;
};

const fail = (code: BookingErrorCode, message: string): BookingResult => ({ ok: false, code, message });

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

/**
 * WhatsApp sign-up gives an account a placeholder name ("Guest") and an email
 * that never receives mail (wa<E164>@guest.eskerrentals.com, see
 * app/auth/phone/actions.ts). Neither belongs on a booking: staff would see a
 * guest called "Guest", and the confirmation would go nowhere. Read them as
 * "not given", so the guest is asked instead.
 */
export function realName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n.toLowerCase() === "guest" ? "" : n;
}

export function realEmail(email: string | null | undefined): string {
  const e = (email ?? "").trim();
  return /@guest\.eskerrentals\.com$/i.test(e) ? "" : e;
}

/**
 * Is an ID already on file for this phone? The first booking with Esker needs
 * one (CNIC front + back, or a passport page); later bookings don't. The app
 * asks this before its Pay step so it only asks for an ID when one is needed.
 */
export async function idOnFile(rawPhone: string): Promise<boolean> {
  const phone = toE164Pk(rawPhone) ?? rawPhone.trim();
  if (!phone) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("guests").select("cnic_front_url").eq("phone", phone).limit(1).maybeSingle();
  return Boolean(data?.cnic_front_url);
}

/**
 * "book" or "request" for an EXTERNAL (resale) unit: a fresh iCal sync, or the
 * owner's own "available" answer for these EXACT dates (within the 48h trust
 * window), lets it be booked; otherwise the owner is asked first. Without the
 * second path, a guest the owner just approved would loop back into a request.
 * Esker-run stock is always "book".
 */
async function externalPath(listingId: string, accountId: string | null, checkin: string, checkout: string): Promise<"book" | "request"> {
  const bookability = await getExternalBookability(listingId);
  if (bookability.mode === "instant") return "book";
  const ownerApproved = !!accountId && (await hasAuthorizedRequest(accountId, listingId, checkin, checkout));
  return ownerApproved ? "book" : "request";
}

/**
 * How this guest can take these dates right now — the same gate the core
 * enforces, so the app never shows Pay for dates the core would refuse.
 */
export async function bookingPath(listingId: string, accountId: string | null, checkin: string, checkout: string): Promise<"book" | "request"> {
  const admin = createAdminClient();
  const { data } = await admin.from("public_listings").select("source").eq("id", listingId).maybeSingle();
  return (data as { source?: string } | null)?.source === "external" ? externalPath(listingId, accountId, checkin, checkout) : "book";
}

export async function createBookingCore(input: CreateBookingInput): Promise<BookingResult> {
  const { propertyId, checkin, checkout, proof, idFront: cnicFront, idBack: cnicBack, docType, channel } = input;
  const name = input.name.trim();
  // Guests are matched by phone, and the CRM files them as 923xxxxxxxxx; a
  // typed "0332 …" would miss a returning guest and ask for their ID again.
  const phone = toE164Pk(input.phone) ?? input.phone.trim();
  const email = input.email.trim();
  let accountId = input.accountId;
  let accountMagicLink: string | null = null;

  // Server-gated on keys so a forged form value can't invent a checkout on an
  // unconfigured env. The website falls back to the bank-transfer + screenshot
  // flow (as it always has); the app asked for a card explicitly and is told.
  const viaSafepay = input.payMethod === "card" && isSafepayConfigured();
  if (input.payMethod === "card" && !viaSafepay && channel === "app") {
    return fail("card_unavailable", "Card payments aren't available just now. Please pay by bank transfer.");
  }

  const admin = createAdminClient();

  // 1. Property must exist and be PUBLIC (read the public window). `source` tells
  //    us whether this is an Esker-run property or EXTERNAL (resale) inventory
  //    Esker sources from another owner — the two book against different columns
  //    (external rows live in `external_properties`, so property_id must be NULL).
  const { data: listing } = await admin.from("public_listings").select("id, title, price, area, category, esker_exclusive, source").eq("id", propertyId).maybeSingle();
  if (!listing) return fail("unavailable", "This place isn't available to book.");
  const isExternal = (listing as { source?: string }).source === "external";

  // 2. Dates.
  const today = new Date().toISOString().slice(0, 10);
  if (!checkin || !checkout || checkin < today || checkout <= checkin) {
    return fail("dates_invalid", "Please pick valid check-in and check-out dates.");
  }
  const nights = nightsBetween(checkin, checkout);
  if (nights < 1) return fail("dates_invalid", "Your stay must be at least one night.");

  // 2b. SAFETY GATE — never take money for an external (resale) unit whose owner
  //     calendar we can't currently see. Esker doesn't control that calendar, so
  //     without a fresh sync those dates may already be sold. Enforced HERE (not
  //     just in the UI) so no request path can bypass it.
  if (isExternal && (await externalPath(propertyId, accountId, checkin, checkout)) === "request") {
    return fail(
      "request_first",
      "We need to confirm these dates with the owner before taking payment. Please request them and we'll come back to you shortly.",
    );
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

  // 3. No double-booking. An unpaid WEBSITE hold whose time is up no longer
  //    blocks (lib/booking/hold.ts — the same rule the public windows apply).
  const clashBase = admin
    .from("bookings")
    .select("id, status, source, created_at, hold_until, account_id, guest_id")
    .is("lost_reason", null)
    .in("status", ACTIVE)
    .lt("checkin", checkout)
    .gt("checkout", checkin);
  const { data: clashes, error: clashErr } = await (isExternal
    ? clashBase.eq("external_property_id", propertyId)
    : clashBase.eq("property_id", propertyId));
  // A clash check that couldn't run is not a clear calendar. Fail closed.
  if (clashErr) {
    console.error("[book] clash check failed:", clashErr.message);
    return fail("check_failed", "We couldn't check these dates just now. Please try again in a moment.");
  }

  // The guest's OWN unpaid hold on these nights is not a clash. A guest who
  // backs out of the card page and comes back to pay by transfer would
  // otherwise be told their own dates were "just taken". A hold that belongs
  // to an account matches only that signed-in account; one made without an
  // account matches the guest by phone. The new booking replaces it (step 6).
  const { data: phoneGuest } = phone
    ? await admin.from("guests").select("id").eq("phone", phone).limit(1).maybeSingle()
    : { data: null };
  type Clash = { id: string; status: string; source: string | null; created_at: string; hold_until: string | null; account_id: string | null; guest_id: string | null };
  const isMine = (c: Clash) =>
    isExpiringHold(c) && (c.account_id ? c.account_id === accountId : !!phoneGuest && c.guest_id === phoneGuest.id);
  const rows = (clashes ?? []) as Clash[];
  const myHolds = rows.filter(isMine).map((c) => c.id);
  const realClash = rows.some((c) => !isMine(c) && blocksDates(c));
  if (realClash) return fail("dates_taken", "Sorry — those dates were just taken. Please pick others.");

  if (isExternal) {
    // Money is about to move, so re-read the owner's calendar first rather than
    // trusting a copy that may be hours old. Best-effort: if the pull fails we
    // fall through to the rows we already have, which still block.
    await refreshExternalCalendar(propertyId);

    // The OWNER's own calendar, cached by the CRM's iCal sync. Stale rows still
    // block: hiding a date that's actually free is far cheaper than double-selling
    // one on a calendar Esker doesn't control. `ends` is exclusive, so a stay
    // starting exactly when another ends is NOT a clash.
    //
    // The bounds MUST be anchored to PKT midnight. These rows hold PKT
    // midnights as instants (a 4–6 Sep block is stored 03T19:00Z → 05T19:00Z),
    // and a bare "2026-09-05" is read by Postgres as UTC midnight — five hours
    // adrift, which over-blocked a stay ending exactly when a block began.
    // The same confusion, read the other way, is what let the public
    // availability window publish every owner block a day early (phase91).
    const { data: busy, error: busyErr } = await admin
      .from("external_ical_busy")
      .select("id")
      .eq("external_property_id", propertyId)
      .lt("starts", `${checkout}T00:00:00+05:00`)
      .gt("ends", `${checkin}T00:00:00+05:00`)
      .limit(1);
    if (busyErr) {
      console.error("[book] owner calendar check failed:", busyErr.message);
      return fail("check_failed", "We couldn't check these dates just now. Please try again in a moment.");
    }
    if (busy && busy.length > 0) {
      return fail("dates_taken", "Sorry — those dates were just taken. Please pick others.");
    }
  } else {
    // Host-blocked dates (self-listed places): treated exactly like bookings.
    const { data: blocked, error: blockErr } = await admin
      .from("property_blocks")
      .select("id")
      .eq("property_id", propertyId)
      .lt("start_date", checkout)
      .gt("end_date", checkin)
      .limit(1);
    if (blockErr) {
      console.error("[book] host block check failed:", blockErr.message);
      return fail("check_failed", "We couldn't check these dates just now. Please try again in a moment.");
    }
    if (blocked && blocked.length > 0) {
      return fail("dates_taken", "Sorry — the host has those dates unavailable. Please pick others.");
    }
  }

  // 4. Guest details + proof.
  if (!name || !phone) return fail("details_required", "Please enter your name and phone number.");
  if (!viaSafepay) {
    if (!proof || proof.size === 0) return fail("proof_required", "Please upload your payment screenshot.");
    if (proof.size > MAX_BYTES) return fail("proof_too_large", "That screenshot is too large (max 10 MB).");
  }

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

  let idNote = "";
  if (!cnicOnFile) {
    // A passport is a single data page; a CNIC has a front and a back. Checked
    // BEFORE the guest row is created, so a missing ID leaves nothing behind.
    const needBack = docType === "cnic";
    if (!cnicFront || cnicFront.size === 0 || (needBack && (!cnicBack || cnicBack.size === 0))) {
      return fail(
        "id_required",
        needBack
          ? "Please add your CNIC (front and back) — only needed for your first booking with Esker."
          : "Please add your passport (the photo/data page) — only needed for your first booking with Esker.",
      );
    }
    if (cnicFront.size > MAX_BYTES || (needBack && cnicBack && cnicBack.size > MAX_BYTES)) {
      return fail("id_too_large", "ID images are too large (max 10 MB each).");
    }

    // AI vision: is it a real CNIC/passport, readable, valid format, NOT expired?
    const idCheck = await verifyId(cnicFront);
    if (!idCheck.ok) return fail("id_rejected", idCheck.message ?? "We couldn't read that ID. Please try a clearer photo.");
    idNote = ` ID (AI-checked, NADRA pending): ${idCheck.docType ?? docType} ${idCheck.number ?? "?"}${idCheck.name ? `, ${idCheck.name}` : ""}${idCheck.expiry ? `, expiry ${idCheck.expiry}` : ""}.`;
  }

  if (!guestId) {
    const { data: g, error: gErr } = await admin
      .from("guests")
      .insert({ name, phone, lead_source: "Website" })
      .select("id")
      .single();
    if (gErr || !g) return fail("booking_failed", "Could not start your booking. Please try again.");
    guestId = g.id;
  }

  if (!cnicOnFile && cnicFront) {
    const needBack = docType === "cnic";
    const frontPath = `${guestId}/${docType}-front-${Date.now()}.${ext(cnicFront)}`;
    const up1 = await admin.storage.from(BUCKET).upload(frontPath, cnicFront, { contentType: cnicFront.type, upsert: false });
    if (up1.error) return fail("upload_failed", "Couldn't upload your ID. Please try again.");

    let backPath: string | null = null;
    if (needBack && cnicBack) {
      const bp = `${guestId}/${docType}-back-${Date.now()}.${ext(cnicBack)}`;
      const up2 = await admin.storage.from(BUCKET).upload(bp, cnicBack, { contentType: cnicBack.type, upsert: false });
      if (up2.error) return fail("upload_failed", "Couldn't upload your ID. Please try again.");
      backPath = bp;
    }
    await admin.from("guests").update({ cnic_front_url: frontPath, cnic_back_url: backPath }).eq("id", guestId);
  }

  // 6. Create the booking (screenshot path: awaiting team verification;
  //    Safepay path: awaiting the gateway webhook, which settles it hands-free).
  //    It replaces any earlier unpaid hold of this guest's on these nights, so
  //    one guest never holds the same dates twice. Paid rows are never touched
  //    (isMine only matches awaiting_payment website holds); a late card
  //    payment on the old one moves it out of awaiting_payment, and it blocks
  //    again on its own.
  if (myHolds.length) {
    await admin.from("bookings").update({ hold_until: new Date().toISOString() }).in("id", myHolds);
  }
  const hold = holdUntil(viaSafepay ? "card" : "transfer");
  const note = `${channel === "app" ? "App" : "Website"} booking — ${advanceLabel(amount, exclusive)} advance ${rs(advance)} of ${rs(amount)} (balance ${rs(balance)} due at check-in). ${
    viaSafepay ? "Paying by Safepay — confirms automatically when the gateway settles." : "Verify the payment screenshot."
  }${email ? ` Email: ${email}.` : ""}${idNote}`;
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
      // The CHANNEL, not the inventory type — `is_external` marks resale. App
      // bookings are 'Website' too: it preserves ad/channel attribution AND arms
      // the unpaid-hold release, which keys on source = 'Website'. The note
      // above says which of the two it came from.
      source: "Website",
      // When these dates go back on sale if no money arrives (D5): 30 minutes
      // for a card checkout, 18 hours for a bank transfer.
      hold_until: hold,
      notes: note,
    })
    .select("id")
    .single();
  if (bErr || !booking) return fail("booking_failed", "Could not create your booking. Please try again.");

  // 7. Payment.
  //    Safepay: mint the hosted checkout NOW (booking id in tracker metadata is
  //    how the CRM webhook finds it) and hand the URL back for the redirect —
  //    no ledger row yet; the webhook writes it when money actually moves. If
  //    minting fails, the booking still exists and the guest is guided to the
  //    screenshot fallback rather than losing their dates.
  //    Screenshot: record the advance + proof for the team to verify (as ever).
  let checkoutUrl: string | undefined;
  if (viaSafepay) {
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://eskerrentals.com").replace(/\/$/, "");
    // ANCHOR-first (same shape as chat pay-links): the checkout's metadata
    // carries a gateway_payments row, not the booking id — one uniform settle
    // path in the CRM webhook, and the anchor records property + amount for
    // the reconciliation view. Website anchors are born WITH their booking.
    const { data: anchor, error: anchorErr } = await admin
      .from("gateway_payments")
      .insert({
        booking_id: booking.id,
        amount: advance,
        status: "pending",
        gateway: "safepay",
        source: "website",
        property_label: String(listing.title ?? "your stay"),
        ...(isExternal ? { external_property_id: propertyId } : { property_id: propertyId }),
      })
      .select("id")
      .single();
    if (anchorErr || !anchor) {
      return fail("payment_failed", "Couldn't start the payment — please try again, or pay by bank transfer.");
    }
    // The app's guest comes back through /pay/app, which reopens the app on
    // this trip; the website's comes back to its confirmation page, or to
    // checkout with the same dates (carrying this booking so the page
    // recognises the guest's own hold and offers the other method).
    const scheme = APP_SCHEMES.includes(input.appScheme ?? "") ? input.appScheme! : "esker";
    const appReturn = (state: "done" | "cancelled") => `${site}/pay/app?b=${booking.id}&s=${scheme}&state=${state}`;
    const gateway = await createSafepayCheckout({
      amountPkr: advance,
      bookingId: anchor.id, // metadata order_id = the anchor
      redirectUrl: channel === "app" ? appReturn("done") : `${site}/book/${propertyId}/confirmation?b=${booking.id}&via=safepay`,
      cancelUrl: channel === "app" ? appReturn("cancelled") : `${site}/book/${propertyId}?checkin=${checkin}&checkout=${checkout}&resume=${booking.id}`,
    });
    if (!gateway.ok) {
      return fail("payment_failed", `${gateway.message} You can also pay by bank transfer instead.`);
    }
    await admin.from("gateway_payments").update({ tracker: gateway.tracker }).eq("id", anchor.id);
    checkoutUrl = gateway.url;
  } else {
    const proofPath = `payments/${booking.id}/pay-${Date.now()}.${ext(proof!)}`;
    const upP = await admin.storage.from(BUCKET).upload(proofPath, proof!, { contentType: proof!.type, upsert: false });
    if (!upP.error) {
      await admin.from("booking_payments").insert({
        booking_id: booking.id,
        amount: advance,
        proof_url: proofPath,
        note: `${channel === "app" ? "App" : "Website"} advance (${exclusive ? "50%" : "25%"}) — verify this screenshot.`,
      });
    }
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
    // Card checkout: the guest has a payment URL and has paid NOTHING. Suppress
    // everything addressed to them until the money lands; the team alert still
    // fires, worded as "checkout opened".
    awaitingPayment: viaSafepay,
  });

  // 9. Meta Conversions API — server-side Purchase.
  //    NOT for a card checkout. Reporting a Purchase the moment a payment page
  //    opens tells Meta a sale happened that may never happen: it corrupts ROAS,
  //    inflates reported revenue, and trains the optimiser toward people who
  //    abandon checkouts. The CRM fires the real Purchase from
  //    firePurchaseIfEligible when the gateway actually settles, so firing here
  //    too would double-count even the ones that DO pay.
  if (!viaSafepay) {
    await capiEvent("Purchase", { email: email || null, phone, value: advance, currency: "PKR", contentIds: [propertyId] });
  }

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

  return { ok: true, bookingId: booking.id, checkoutUrl, holdUntil: hold };
}
