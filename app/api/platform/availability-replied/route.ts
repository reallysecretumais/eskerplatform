import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyChatEmail } from "@/lib/notifyChat";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// The CRM pings this when an apartment owner answers a website guest's
// request-to-book (Esker OS applyAvailabilityReply). We map the answer back to
// the guest via the checkId we stored in external_date_requests, then tell them:
//   available   → a message with a "Reserve these dates" link (the answer also
//                 authorises an instant booking for 48h — see hasAuthorizedRequest)
//   unavailable → a message + a nudge to similar stays
// plus the throttled guest email. Realtime + the nav badge pick it up for free.
//
// Auth is checked BEFORE the body is read, so a wrong secret / empty body can be
// probed without side effects.
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (d: string) =>
  new Date(`${d.slice(0, 10)}T00:00:00+05:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export async function POST(req: NextRequest) {
  const secret = process.env.PLATFORM_API_SECRET || process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get("x-esker-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { checkId?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
  }
  const { checkId, status } = body;
  if (!checkId || (status !== "available" && status !== "unavailable")) {
    return Response.json({ ok: false, message: "checkId and a valid status are required." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Find the guest's request by the CRM's checkId. Unknown = a check we never
  // recorded (e.g. a staff-only ask) — a clean no-op, not an error.
  const { data: reqRow } = await admin
    .from("external_date_requests")
    .select("id, account_id, external_property_id, checkin, checkout, notified_at")
    .eq("check_id", checkId)
    .maybeSingle();
  if (!reqRow) return Response.json({ ok: true, matched: false });
  if (reqRow.notified_at) return Response.json({ ok: true, matched: true, already: true }); // idempotent

  const now = new Date().toISOString();
  await admin.from("external_date_requests").update({ status, resolved_at: now }).eq("id", reqRow.id);

  const accountId = reqRow.account_id as string;
  const listingId = reqRow.external_property_id as string;
  const checkin = reqRow.checkin as string;
  const checkout = reqRow.checkout as string;

  const [{ data: account }, { data: listing }] = await Promise.all([
    admin.from("accounts").select("id, name, email, notify_email").eq("id", accountId).maybeSingle(),
    admin.from("public_listings").select("title, category").eq("id", listingId).maybeSingle(),
  ]);
  const title = (listing?.title as string) || "the apartment";
  const dates = `${fmt(checkin)}–${fmt(checkout)}`;

  const available = status === "available";
  const body_text = available
    ? `Good news — ${title} is available for ${dates}. ✅\n\nReserve these dates before they go: ${SITE_URL}/book/${listingId}?checkin=${checkin}&checkout=${checkout}`
    : `Sorry — ${title} isn't available for ${dates}.\n\nBrowse similar stays: ${SITE_URL}/stays${listing?.category ? `?category=${encodeURIComponent(listing.category as string)}` : ""}`;

  // The account's Esker Support thread (owner_account_id NULL). Find or create it,
  // then drop in a staff message — same shape a CRM staff reply would land in.
  const conversationId = await ensureEskerThread(admin, accountId, account);
  if (conversationId) {
    await admin.from("messages").insert({
      conversation_id: conversationId,
      direction: "outbound",
      channel: "website",
      type: "text",
      body: body_text,
      status: "sent",
      sender_kind: "staff",
    });
    await admin
      .from("conversations")
      .update({ last_message_at: now, last_message_preview: body_text.slice(0, 140), unreplied: false, updated_at: now })
      .eq("id", conversationId);

    // Email brings them back if they've left (throttled; no-op without an email).
    await notifyChatEmail({
      to: (account?.email as string) ?? null,
      name: (account?.name as string) ?? null,
      event: "chat_reply",
      conversationId,
      headline: available ? `${title} is available for ${dates}` : `Update on ${title}`,
      cta: "Open Messages",
      link: "/messages",
    });
  }

  await admin.from("external_date_requests").update({ notified_at: new Date().toISOString() }).eq("id", reqRow.id);
  return Response.json({ ok: true, matched: true });
}

type Admin = ReturnType<typeof createAdminClient>;

/** Find or create the account's Esker Support conversation (owner_account_id
 *  NULL) + its website contact. A no-session mirror of app/chat/actions ensureThread. */
async function ensureEskerThread(
  admin: Admin,
  accountId: string,
  account: { name?: string | null; email?: string | null } | null,
): Promise<string | null> {
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("account_id", accountId)
    .is("owner_account_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;

  // Need the account's website contact first.
  let { data: contact } = await admin
    .from("contacts")
    .select("id")
    .eq("channel", "website")
    .eq("external_id", accountId)
    .maybeSingle();
  if (!contact) {
    const { data: created } = await admin
      .from("contacts")
      .insert({ channel: "website", external_id: accountId, display_name: account?.name ?? account?.email ?? "Guest" })
      .select("id")
      .single();
    contact = created ?? null;
  }
  if (!contact) return null;

  const { data: convo } = await admin
    .from("conversations")
    .insert({ contact_id: contact.id, channel: "website", status: "new", account_id: accountId, owner_account_id: null })
    .select("id")
    .single();
  return (convo?.id as string) ?? null;
}
