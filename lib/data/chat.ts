import "server-only";
import { createClient } from "@/lib/supabase/server";

// The guest's chat, read with the SESSION client under the account-scoped RLS
// from phase24 (conversations.account_id = auth.uid()) — a guest sees ONLY their
// own threads. Writes happen in app/chat/actions.ts via the service role after
// ownership checks. Contact numbers are never exposed here (in-app comms only).

export type ChatMessage = {
  id: string;
  direction: "inbound" | "outbound";
  sender_kind: string | null; // guest | staff | ai | owner | system
  type: string;
  body: string | null;
  media_url: string | null;
  created_at: string;
};

/** One row in the guest's inbox list. `conversationId` is null for the virtual
 *  "Esker Support" entry shown before their first message. */
export type ThreadSummary = {
  conversationId: string | null;
  kind: "esker" | "host";
  title: string; // "Esker Support" or the stay/host name
  subtitle: string | null; // property context (Esker threads) / null
  lastPreview: string | null;
  lastAt: string | null;
  unread: number;
  needsHuman: boolean;
};

export type ChatThread = {
  conversationId: string;
  needsHuman: boolean;
  unread: number;
  messages: ChatMessage[];
};

async function meAndClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

/** The signed-in account's Esker thread (owner_account_id NULL), or null. Used
 *  by the floating support panel. */
export async function getMyThread(): Promise<ChatThread | null> {
  const { supabase, userId } = await meAndClient();
  if (!userId) return null;

  const { data: convo } = await supabase
    .from("conversations")
    .select("id, needs_human, guest_last_read_at")
    .eq("account_id", userId)
    .is("owner_account_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!convo) return null;

  const messages = await getThreadMessages(convo.id as string);
  const lastRead = convo.guest_last_read_at ? new Date(convo.guest_last_read_at as string).getTime() : 0;
  const unread = messages.filter((m) => m.direction === "outbound" && new Date(m.created_at).getTime() > lastRead).length;
  return { conversationId: convo.id as string, needsHuman: Boolean(convo.needs_human), unread, messages };
}

/** Messages for one thread (RLS guarantees it's the caller's). */
export async function getThreadMessages(conversationId: string): Promise<ChatMessage[]> {
  const { supabase } = await meAndClient();
  const { data } = await supabase
    .from("messages")
    .select("id, direction, sender_kind, type, body, media_url, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(300);
  return (data ?? []) as ChatMessage[];
}

/** All of the guest's threads for the inbox — Esker Support + one per host they've
 *  messaged (Phase 3) — newest first, each with an unread count. Always includes
 *  an "Esker Support" entry (virtual until their first message). */
export async function getMyThreads(): Promise<ThreadSummary[]> {
  const { supabase, userId } = await meAndClient();
  if (!userId) return [];

  const { data: convos } = await supabase
    .from("conversations")
    .select("id, owner_account_id, needs_human, last_message_preview, last_message_at, guest_last_read_at, property_id, created_at")
    .eq("account_id", userId)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const rows = (convos ?? []) as {
    id: string; owner_account_id: string | null; needs_human: boolean;
    last_message_preview: string | null; last_message_at: string | null;
    guest_last_read_at: string | null; property_id: string | null; created_at: string;
  }[];

  // Unread per thread: outbound messages newer than that thread's last-read.
  const unreadBy = new Map<string, number>();
  if (rows.length) {
    const { data: outbound } = await supabase
      .from("messages")
      .select("conversation_id, created_at")
      .in("conversation_id", rows.map((r) => r.id))
      .eq("direction", "outbound");
    const lastRead = new Map(rows.map((r) => [r.id, r.guest_last_read_at ? new Date(r.guest_last_read_at).getTime() : 0]));
    for (const m of (outbound ?? []) as { conversation_id: string; created_at: string }[]) {
      if (new Date(m.created_at).getTime() > (lastRead.get(m.conversation_id) ?? 0)) {
        unreadBy.set(m.conversation_id, (unreadBy.get(m.conversation_id) ?? 0) + 1);
      }
    }
  }

  // Resolve stay titles (public + safe) for host threads + Esker-thread context.
  const propIds = [...new Set(rows.map((r) => r.property_id).filter(Boolean))] as string[];
  const titles = new Map<string, string>();
  if (propIds.length) {
    const { data: listings } = await supabase.from("public_listings").select("id, title").in("id", propIds);
    for (const l of (listings ?? []) as { id: string; title: string }[]) titles.set(l.id, l.title);
  }

  const threads: ThreadSummary[] = rows.map((r) => {
    const isHost = Boolean(r.owner_account_id);
    return {
      conversationId: r.id,
      kind: isHost ? "host" : "esker",
      title: isHost ? (r.property_id ? (titles.get(r.property_id) ?? "Host") : "Host") : "Esker Support",
      subtitle: isHost ? null : r.property_id ? (titles.get(r.property_id) ?? null) : null,
      lastPreview: r.last_message_preview,
      lastAt: r.last_message_at,
      unread: unreadBy.get(r.id) ?? 0,
      needsHuman: r.needs_human,
    };
  });

  // Always offer Esker Support at the top (virtual until the first message).
  if (!threads.some((t) => t.kind === "esker")) {
    threads.unshift({ conversationId: null, kind: "esker", title: "Esker Support", subtitle: null, lastPreview: null, lastAt: null, unread: 0, needsHuman: false });
  }
  return threads;
}

/** Total unread across all threads — the floating launcher / nav dot. Lean: two
 *  small queries, no title resolution (runs on every page for signed-in guests). */
export async function getMyUnreadCount(): Promise<number> {
  const { supabase, userId } = await meAndClient();
  if (!userId) return 0;
  const { data: convos } = await supabase.from("conversations").select("id, guest_last_read_at").eq("account_id", userId);
  const rows = (convos ?? []) as { id: string; guest_last_read_at: string | null }[];
  if (!rows.length) return 0;
  const { data: outbound } = await supabase
    .from("messages")
    .select("conversation_id, created_at")
    .in("conversation_id", rows.map((r) => r.id))
    .eq("direction", "outbound");
  const lastRead = new Map(rows.map((r) => [r.id, r.guest_last_read_at ? new Date(r.guest_last_read_at).getTime() : 0]));
  return ((outbound ?? []) as { conversation_id: string; created_at: string }[]).filter((m) => new Date(m.created_at).getTime() > (lastRead.get(m.conversation_id) ?? 0)).length;
}
