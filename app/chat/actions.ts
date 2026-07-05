"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyThread, getThreadMessages, type ChatThread, type ChatMessage } from "@/lib/data/chat";

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

/**
 * Find-or-create the guest's Esker thread (one per account; owner_account_id
 * NULL). Attaches property/booking context when the chat is opened from a
 * property page / booking so the team instantly knows what it's about.
 *
 * Phase-3 seam: for a `comms_owner = 'owner'` (self-listed host) property this
 * will route to the guest↔owner thread instead — no host listings exist yet, so
 * every conversation today is the Esker thread.
 */
export async function ensureThread(context?: ChatContext): Promise<ChatResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Sign in to message us." };
  const admin = createAdminClient();

  // Must be a website account (staff who sign into the site don't get a thread).
  const { data: account } = await admin.from("accounts").select("id, name, email, phone").eq("id", accountId).maybeSingle();
  if (!account) return { ok: false, message: "Chat is available for guest accounts." };

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

  // 2. The Esker conversation (one per account; owner_account_id NULL).
  let { data: convo } = await admin
    .from("conversations")
    .select("id, property_id, booking_id")
    .eq("account_id", accountId)
    .is("owner_account_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!convo) {
    const { data: created, error } = await admin
      .from("conversations")
      .insert({ contact_id: contact.id, channel: "website", status: "new", account_id: accountId })
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

  // Ring the team once per burst (a chatty guest shouldn't spam the bell). Staff
  // reply from the CRM inbox; the reply flows back here over realtime.
  if (!wasUnreplied) await staffBell(admin, "New website message", text.slice(0, 120));

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

/** Load one thread's messages for the inbox (RLS guarantees it's the caller's). */
export async function loadThreadMessages(conversationId: string): Promise<ChatMessage[]> {
  const accountId = await sessionUserId();
  if (!accountId) return [];
  return getThreadMessages(conversationId);
}
