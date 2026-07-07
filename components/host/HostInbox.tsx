"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, SendHorizonal, User } from "lucide-react";
import { subscribeAuthed } from "@/lib/supabase/realtime";
import { sendHostMessage, markHostThreadRead, loadHostThreadMessages } from "@/app/host/actions";
import type { HostThreadSummary } from "@/lib/data/host";
import type { ChatMessage } from "@/lib/data/chat";

// The host's inbox — same two-pane pattern as the guest inbox, from the host's
// perspective: guest bubbles left, the host's own replies right (gold). Live via
// the owner-scoped RLS realtime; sends go through the ownership-checked action.

const fmtWhen = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function HostInbox({ threads, firstMessages }: { threads: HostThreadSummary[]; firstMessages: ChatMessage[] }) {
  const [selected, setSelected] = useState<HostThreadSummary | null>(threads[0] ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(firstMessages);
  const [loading, setLoading] = useState(false);
  const [openOnMobile, setOpenOnMobile] = useState(false);
  const [reads, setReads] = useState<Set<string>>(new Set());

  const open = async (t: HostThreadSummary) => {
    setSelected(t);
    setOpenOnMobile(true);
    setReads((s) => new Set(s).add(t.conversationId));
    setLoading(true);
    setMessages(await loadHostThreadMessages(t.conversationId));
    setLoading(false);
  };

  if (threads.length === 0) {
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div>
          <User size={20} className="mx-auto text-dim" />
          <p className="mt-2 text-sm font-medium text-ink">No guest messages yet</p>
          <p className="mx-auto mt-1 max-w-[280px] text-xs text-muted">When a guest asks about one of your listings or books a stay, the conversation appears here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* Thread list */}
      <aside className={`${openOnMobile ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col overflow-y-auto border-line md:w-[300px] md:border-r`}>
        {threads.map((t) => {
          const active = selected?.conversationId === t.conversationId;
          const unread = t.unread > 0 && !reads.has(t.conversationId);
          return (
            <button
              key={t.conversationId}
              type="button"
              onClick={() => void open(t)}
              className={`flex items-center gap-3 border-b border-line px-4 py-3 text-left transition ${active ? "bg-surface-2" : "hover:bg-surface-2/60"}`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/15 font-display text-sm font-semibold text-gold-deep">
                {t.guestFirstName[0]?.toUpperCase() ?? "G"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{t.guestFirstName}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-dim">{fmtWhen(t.lastAt)}</span>
                </div>
                <div className="truncate text-[11px] text-dim">{t.listingTitle}</div>
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs text-muted">{t.lastPreview ?? "New conversation"}</span>
                  {unread && <span className="ml-auto grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold text-ink">{t.unread}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </aside>

      {/* Open thread */}
      <section className={`${openOnMobile ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {selected && (
          <>
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
              <button type="button" onClick={() => setOpenOnMobile(false)} className="rounded-md p-1 text-muted hover:text-ink md:hidden" aria-label="Back to inbox">
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{selected.guestFirstName}</div>
                <div className="truncate text-[11px] text-muted">{selected.listingTitle}</div>
              </div>
            </div>
            {loading ? (
              <div className="grid flex-1 place-items-center text-sm text-muted">Loading…</div>
            ) : (
              <HostThread key={selected.conversationId} conversationId={selected.conversationId} initialMessages={messages} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

function HostThread({ conversationId, initialMessages }: { conversationId: string; initialMessages: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set(initialMessages.map((m) => m.id)));

  const scrollDown = useCallback((smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  }, []);

  useEffect(() => scrollDown(false), [scrollDown]);

  // Live inserts (guest messages, system lines) via the owner-scoped RLS.
  useEffect(() => {
    return subscribeAuthed(`host-chat-${conversationId}`, (ch) =>
      ch.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          if (seen.current.has(m.id)) return;
          seen.current.add(m.id);
          setMessages((prev) => [...prev, m]);
          void markHostThreadRead(conversationId);
          setTimeout(() => scrollDown(), 30);
        },
      ),
    );
  }, [conversationId, scrollDown]);

  useEffect(() => {
    void markHostThreadRead(conversationId);
  }, [conversationId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");
    setBusy(true);

    const temp: ChatMessage = {
      id: `tmp-${Date.now()}`,
      direction: "outbound",
      sender_kind: "owner",
      type: "text",
      body: text,
      media_url: null,
      created_at: new Date().toISOString(),
    };
    seen.current.add(temp.id);
    setMessages((prev) => [...prev, temp]);
    setTimeout(() => scrollDown(), 30);

    const res = await sendHostMessage(conversationId, text);
    setBusy(false);
    if (!res.ok) setError(res.message);
  };

  const visible = dedupe(messages);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
        {visible.map((m) => {
          if (m.type === "system" || m.sender_kind === "system") {
            return (
              <div key={m.id} className="flex justify-center py-0.5">
                <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] text-dim">{m.body}</span>
              </div>
            );
          }
          const mine = m.direction === "outbound"; // host perspective
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${mine ? "rounded-br-md bg-gold/15 text-ink" : "rounded-bl-md border border-line bg-surface text-ink"}`}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <div className={`mt-0.5 text-[10px] ${mine ? "text-right" : ""} text-dim`}>{fmtTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <p className="px-4 pb-1 text-xs text-red">{error}</p>}

      <div className="border-t border-line px-3 pb-3 pt-2">
        <form onSubmit={submit} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1.5 focus-within:border-gold/50">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Reply to your guest…"
            aria-label="Reply to your guest"
            className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-dim"
          />
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send" className="rounded-lg bg-gold p-2 text-ink transition hover:brightness-105 disabled:opacity-40">
            <SendHorizonal size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

/** Drop realtime echoes of the optimistic host bubble (same body within 15s). */
function dedupe(list: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of list) {
    if (m.direction === "outbound" && !m.id.startsWith("tmp-")) {
      const i = out.findIndex(
        (p) => p.id.startsWith("tmp-") && p.body === m.body && Math.abs(new Date(p.created_at).getTime() - new Date(m.created_at).getTime()) < 15_000,
      );
      if (i >= 0) {
        out[i] = m;
        continue;
      }
    }
    out.push(m);
  }
  return out;
}
