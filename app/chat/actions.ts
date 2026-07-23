"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyThread, getThreadMessages, getMyThreads, type ChatThread, type ChatMessage } from "@/lib/data/chat";
import { notifyChatEmail } from "@/lib/notifyChat";

// Guest chat actions. Reads are RLS-scoped (lib/data/chat.ts); ALL writes here go
// through the service role AFTER verifying the session account owns the thread —
// the same elevated pattern as the booking action. The guest browser itself has
// read-only DB access to exactly its own thread.
//
// Messaging is HUMAN-only: an Esker Support message routes straight to the CRM
// Unified Inbox ("Website" channel) for staff — no auto-AI reply. (The AI
// concierge stays on the property pages for pre-booking questions; staff still
// get the CRM's AI-draft assist on website threads.) Phase-3 host threads route
// to the host, with Esker overseeing.

type Admin = ReturnType<typeof createAdminClient>;

export type ChatResult = { ok: boolean; conversationId?: string; message?: string };

const MAX_LEN = 2000;

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Ring the team bell (in-app CRM notification for every active staff member). */
async function staffBell(admin: Admin, title: string, body: string | null) {
  try {
    const { data: staff } = await admin.from("users").select("id").eq("active", true);
    const rows = (staff ?? []).map((u: { id: string }) => ({
      user_id: u.id,
      type: "message",
      title,
      body,
      link: "/inquiries",
    }));
    if (rows.length) await admin.from("notifications").insert(rows);
  } catch {
    /* best-effort */
  }
}

type Convo = {
  id: string;
  account_id: string | null;
  owner_account_id: string | null;
  needs_human: boolean;
  property_id: string | null;
  booking_id: string | null;
  unreplied: boolean;
};

/** Load a conversation and verify the session account owns it. */
async function ownedConvo(admin: Admin, conversationId: string, accountId: string): Promise<Convo | null> {
  const { data } = await admin
    .from("conversations")
    .select("id, account_id, owner_account_id, needs_human, property_id, booking_id, unreplied")
    .eq("id", conversationId)
    .maybeSingle();
  const c = data as Convo | null;
  return c && c.account_id === accountId ? c : null;
}

async function insertSystemLine(admin: Admin, conversationId: string, text: string) {
  await admin.from("messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    channel: "website",
    type: "system",
    sender_kind: "system",
    body: text,
    status: "sent",
  });
}

export type ChatContext = { propertyId?: string; bookingId?: string };

/** Lazy thread load for the floating panel (RLS-scoped read). */
export async function loadThread(): Promise<ChatThread | null> {
  return getMyThread();
}

/** Who should answer a chat opened with this context: the Esker team, or the
 *  listing's host (comms_owner='owner' + a linked host account that isn't the
 *  guest themself). Resolved from the property, or the booking's property. */
async function routeFor(
  admin: Admin,
  accountId: string,
  context?: ChatContext,
): Promise<{ hostAccountId: string | null; propertyId: string | null }> {
  let propertyId = context?.propertyId ?? null;
  try {
    if (!propertyId && context?.bookingId) {
      const { data: b } = await admin.from("bookings").select("property_id, account_id").eq("id", context.bookingId).maybeSingle();
      if (b && b.account_id === accountId) propertyId = (b.property_id as string) ?? null;
    }
    if (!propertyId) return { hostAccountId: null, propertyId: null };
    const { data: p } = await admin
      .from("properties")
      .select("comms_owner, owner_account_id")
      .eq("id", propertyId)
      .maybeSingle();
    const host = p?.comms_owner === "owner" ? ((p.owner_account_id as string) ?? null) : null;
    return { hostAccountId: host && host !== accountId ? host : null, propertyId };
  } catch {
    return { hostAccountId: null, propertyId };
  }
}

/**
 * Find-or-create the right thread for this guest + context. Esker-handled
 * listings (and no-context chats) → the account's single Esker thread
 * (owner_account_id NULL). Self-listed host properties (comms_owner='owner') →
 * the guest↔host thread for that listing (owner_account_id = the host, one per
 * guest+listing). Attaches property/booking context either way.
 */
export async function ensureThread(context?: ChatContext): Promise<ChatResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Sign in to message us." };
  const admin = createAdminClient();

  // Must be a website account (staff who sign into the site don't get a thread).
  const { data: account } = await admin.from("accounts").select("id, name, email, phone").eq("id", accountId).maybeSingle();
  if (!account) return { ok: false, message: "Chat is available for guest accounts." };

  // Owner-comms routing (host listings) — decided up front so we open the right thread.
  const route = await routeFor(admin, accountId, context);

  // 1. The account's website contact (messaging identity in the shared inbox).
  let { data: contact } = await admin
    .from("contacts")
    .select("id, guest_id")
    .eq("channel", "website")
    .eq("external_id", accountId)
    .maybeSingle();
  if (!contact) {
    // Link to the CRM guest record by phone when one exists (same dedupe as booking).
    let guestId: string | null = null;
    if (account.phone) {
      const { data: g } = await admin.from("guests").select("id").eq("phone", account.phone).limit(1).maybeSingle();
      guestId = (g?.id as string) ?? null;
    }
    const { data: created, error } = await admin
      .from("contacts")
      .insert({
        channel: "website",
        external_id: accountId,
        display_name: account.name ?? account.email ?? "Guest",
        phone: account.phone ?? null,
        guest_id: guestId,
      })
      .select("id, guest_id")
      .single();
    if (error || !created) return { ok: false, message: "Could not start the chat. Please try again." };
    contact = created;
  }

  // 2. The conversation. Esker thread = one per account (owner_account_id NULL);
  //    host thread = one per guest+listing (owner_account_id = the host).
  const convoQuery = admin
    .from("conversations")
    .select("id, property_id, booking_id")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true })
    .limit(1);
  let { data: convo } = await (route.hostAccountId
    ? convoQuery.eq("owner_account_id", route.hostAccountId).eq("property_id", route.propertyId!)
    : convoQuery.is("owner_account_id", null)
  ).maybeSingle();
  if (!convo) {
    const { data: created, error } = await admin
      .from("conversations")
      .insert({
        contact_id: contact.id,
        channel: "website",
        status: "new",
        account_id: accountId,
        owner_account_id: route.hostAccountId,
        property_id: route.hostAccountId ? route.propertyId : null,
      })
      .select("id, property_id, booking_id")
      .single();
    if (error || !created) return { ok: false, message: "Could not start the chat. Please try again." };
    convo = created;
  }

  // 3. Context attach (best-effort; only when it changed, to avoid noise).
  try {
    if (context?.propertyId && context.propertyId !== convo.property_id) {
      const { data: listing } = await admin.from("public_listings").select("id, title").eq("id", context.propertyId).maybeSingle();
      if (listing) {
        await admin.from("conversations").update({ property_id: listing.id, updated_at: new Date().toISOString() }).eq("id", convo.id);
        await insertSystemLine(admin, convo.id as string, `Guest is viewing: ${listing.title}`);
      }
    }
    if (context?.bookingId && context.bookingId !== convo.booking_id) {
      const { data: bk } = await admin
        .from("bookings")
        .select("id, property_id, checkin, checkout, account_id, property:properties(name)")
        .eq("id", context.bookingId)
        .maybeSingle();
      const b = bk as unknown as { id: string; property_id: string | null; checkin: string | null; checkout: string | null; account_id: string | null; property: { name: string | null } | null } | null;
      if (b && b.account_id === accountId) {
        await admin
          .from("conversations")
          .update({ booking_id: b.id, property_id: b.property_id, updated_at: new Date().toISOString() })
          .eq("id", convo.id);
        const dates = b.checkin && b.checkout ? ` · ${b.checkin.slice(0, 10)} → ${b.checkout.slice(0, 10)}` : "";
        await insertSystemLine(admin, convo.id as string, `About booking: ${b.property?.name ?? "stay"}${dates}`);
      }
    }
  } catch {
    /* context is a nice-to-have — never blocks the chat */
  }

  return { ok: true, conversationId: convo.id as string };
}

/**
 * Guest sends a message. HUMAN-only: the message lands in the CRM Unified Inbox
 * ("Website" channel) and the staff bell rings once per burst — no auto-AI reply.
 * Realtime delivers the staff reply back to the guest. (Phase-3 owner threads
 * behave the same, notifying the host.)
 */
export async function sendGuestMessage(conversationId: string, body: string): Promise<ChatResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Sign in to message us." };
  const text = body.trim().slice(0, MAX_LEN);
  if (!text) return { ok: false, message: "Write a message first." };

  const admin = createAdminClient();
  const convo = await ownedConvo(admin, conversationId, accountId);
  if (!convo) return { ok: false, message: "Conversation not found." };

  const now = new Date().toISOString();
  const { error: insErr } = await admin.from("messages").insert({
    conversation_id: convo.id,
    direction: "inbound",
    channel: "website",
    type: "text",
    body: text,
    status: "received",
    sender_kind: "guest",
    sender_account_id: accountId,
  });
  if (insErr) return { ok: false, message: "Could not send. Please try again." };

  const wasUnreplied = convo.unreplied;
  await admin
    .from("conversations")
    .update({ last_inbound_at: now, last_message_at: now, last_message_preview: text.slice(0, 140), unreplied: true, updated_at: now })
    .eq("id", convo.id);

  // Notify the right responder, once per burst (a chatty guest shouldn't spam).
  if (!wasUnreplied) {
    if (convo.owner_account_id) {
      // Host thread → email the host (their inbox lives at /host/messages).
      try {
        const [{ data: host }, { data: listing }] = await Promise.all([
          admin.from("accounts").select("email, name, notify_email").eq("id", convo.owner_account_id).maybeSingle(),
          convo.property_id ? admin.from("properties").select("public_title, name").eq("id", convo.property_id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        if (host?.email && host.notify_email !== false) {
          const title = (listing?.public_title as string) || (listing?.name as string) || "your listing";
          await notifyChatEmail({
            to: host.email as string,
            name: (host.name as string) ?? null,
            event: "chat_msg_host",
            conversationId: convo.id,
            headline: `A guest messaged you about ${title}`,
            cta: "Reply in your host inbox",
            link: "/host/messages",
          });
        }
      } catch {
        /* best-effort */
      }
    } else {
      // Esker thread → staff bell; staff reply from the CRM inbox.
      await staffBell(admin, "New website message", text.slice(0, 120));
    }
  }

  revalidatePath("/messages");
  return { ok: true, conversationId: convo.id };
}

/** (Phase 3) On a host thread, pull Esker in. Kept for the owner-comms seam. */
export async function requestHuman(conversationId: string): Promise<ChatResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Sign in first." };
  const admin = createAdminClient();
  const convo = await ownedConvo(admin, conversationId, accountId);
  if (!convo) return { ok: false, message: "Conversation not found." };

  await admin
    .from("conversations")
    .update({ needs_human: true, unreplied: true, updated_at: new Date().toISOString() })
    .eq("id", convo.id);
  await insertSystemLine(admin, convo.id, "The team has been notified — they'll reply right here.");
  await staffBell(admin, "Website guest asked for the team", null);
  revalidatePath("/messages");
  return { ok: true, conversationId: convo.id };
}

/** Clear the guest-side unread dot. */
export async function markThreadRead(conversationId: string): Promise<ChatResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false };
  const admin = createAdminClient();
  const convo = await ownedConvo(admin, conversationId, accountId);
  if (!convo) return { ok: false };
  await admin.from("conversations").update({ guest_last_read_at: new Date().toISOString() }).eq("id", convo.id);
  return { ok: true, conversationId: convo.id };
}

/** Total unread across the guest's threads — drives the nav badge. 0 when
 *  signed out. */
export async function unreadCount(): Promise<number> {
  const threads = await getMyThreads();
  return threads.reduce((n, t) => n + (t.unread || 0), 0);
}

/** Load one thread's messages for the inbox (RLS guarantees it's the caller's). */
export async function loadThreadMessages(conversationId: string): Promise<ChatMessage[]> {
  const accountId = await sessionUserId();
  if (!accountId) return [];
  return getThreadMessages(conversationId);
}
