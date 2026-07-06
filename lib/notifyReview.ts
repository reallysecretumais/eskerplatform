import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { reviewRequestEmail } from "@/lib/emailTemplates";
import { SITE_URL } from "@/lib/seo";

// Gentle post-stay review nudge for ONE completed booking: email now (Titan) +
// WhatsApp queued into the guest_messages outbox (the CRM inbox delivers it when
// WA is live, via a to-be-approved `review_request` template). Marks the booking
// so it's never nudged twice. Everything is best-effort and never throws.

export type ReviewNudgeResult = { ok: boolean; emailed: boolean; queuedWhatsapp: boolean; reason?: string };

const pretty = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

export async function sendReviewRequest(bookingId: string): Promise<ReviewNudgeResult> {
  const admin = createAdminClient();

  const { data: b } = await admin
    .from("bookings")
    .select("id, account_id, guest_id, property_id, status, review_requested_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b) return { ok: false, emailed: false, queuedWhatsapp: false, reason: "not found" };
  if (b.status !== "checked_out") return { ok: false, emailed: false, queuedWhatsapp: false, reason: "not completed" };
  if (b.review_requested_at) return { ok: true, emailed: false, queuedWhatsapp: false, reason: "already sent" };

  const [{ data: listing }, { data: acct }, { data: guest }] = await Promise.all([
    admin.from("public_listings").select("title, area, category").eq("id", b.property_id).maybeSingle(),
    b.account_id ? admin.from("accounts").select("email, name, notify_email, notify_whatsapp").eq("id", b.account_id).maybeSingle() : Promise.resolve({ data: null }),
    b.guest_id ? admin.from("guests").select("name, phone").eq("id", b.guest_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const propertyTitle = String(listing?.title ?? "your Esker stay");
  const locationLabel = pretty([listing?.category, listing?.area]) || "Islamabad";
  const guestName = (acct?.name || guest?.name || "").trim() || "there";

  // Deep link to the booking's "Rate your stay" card. For account holders we mint a
  // one-tap magic link so they land straight in (best-effort); otherwise the plain
  // URL (they'll sign in).
  const target = `/account/bookings/${b.id}`;
  let reviewLink = `${SITE_URL}${target}`;
  const email = acct?.email || null;
  if (email) {
    try {
      const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: reviewLink } });
      if (link?.properties?.action_link) reviewLink = link.properties.action_link;
    } catch {
      /* keep the plain link */
    }
  }

  let emailed = false;
  let queuedWhatsapp = false;

  // 1. Email now (only if the guest hasn't opted out).
  if (email && acct?.notify_email !== false) {
    try {
      const mail = reviewRequestEmail({ guestName, propertyTitle, locationLabel, reviewLink });
      const r = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
      emailed = r.ok;
      await admin.from("guest_messages").insert({
        booking_id: b.id,
        channel: "email",
        event: "review_request",
        recipient: email,
        status: r.ok ? "sent" : "failed",
        error: r.ok ? null : r.error ?? null,
        sent_at: r.ok ? new Date().toISOString() : null,
        payload: { subject: mail.subject },
      });
    } catch {
      /* best-effort */
    }
  }

  // 2. WhatsApp queued for the CRM inbox sender (needs an approved `review_request`
  //    template once WA is live). Skipped if the guest opted out of WhatsApp.
  const phone = guest?.phone || null;
  if (phone && acct?.notify_whatsapp !== false) {
    try {
      await admin.from("guest_messages").insert({
        booking_id: b.id,
        channel: "whatsapp",
        event: "review_request",
        recipient: phone,
        status: "pending",
        payload: {
          template: "review_request",
          vars: { guest_name: guestName, property: propertyTitle, review_link: `${SITE_URL}${target}` },
        },
      });
      queuedWhatsapp = true;
    } catch {
      /* best-effort */
    }
  }

  // 3. Mark it done so the dispatcher never nudges this stay again.
  await admin.from("bookings").update({ review_requested_at: new Date().toISOString() }).eq("id", b.id);

  return { ok: true, emailed, queuedWhatsapp };
}
