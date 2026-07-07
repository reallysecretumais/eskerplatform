"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Sparkles, SendHorizonal } from "lucide-react";
import { subscribeAuthed } from "@/lib/supabase/realtime";
import { sendGuestMessage, markThreadRead, ensureThread, type ChatContext } from "@/app/chat/actions";
import type { ChatMessage } from "@/lib/data/chat";
import { brand } from "@/lib/brand";

// The shared chat engine — used by both the floating panel and /messages.
// Guest bubbles right (gold-tinted); Esker replies left, labeled "Esker AI" ✨
// or "Esker team"; system lines centered and subtle. New messages arrive live
// over Supabase realtime (RLS-scoped to this guest's thread).

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function ChatThread({
  initialConversationId,
  initialMessages,
  context,
  className = "",
}: {
  initialConversationId: string | null;
  initialMessages: ChatMessage[];
  context?: ChatContext;
  className?: string;
}) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false); // waiting on the AI / send round-trip
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set(initialMessages.map((m) => m.id)));

  const scrollDown = useCallback((smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  }, []);

  useEffect(() => scrollDown(false), [scrollDown]);

  // When opened WITH context (property/booking), ensure the thread now so the
  // team sees what it's about. With no context we create lazily on first send —
  // so merely opening the inbox never spawns empty threads.
  useEffect(() => {
    if (!context) return;
    void ensureThread(context).then((r) => {
      if (r.ok && r.conversationId) setConversationId(r.conversationId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live updates: every new row in this conversation (AI, team, system).
  useEffect(() => {
    if (!conversationId) return;
    return subscribeAuthed(`chat-${conversationId}`, (ch) =>
      ch.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          if (seen.current.has(m.id)) return;
          seen.current.add(m.id);
          setMessages((prev) => [...prev, m]);
          if (m.direction === "outbound") setBusy(false);
          void markThreadRead(conversationId);
          setTimeout(() => scrollDown(), 30);
        },
      ),
    );
  }, [conversationId, scrollDown]);

  // Opening the thread clears the unread dot.
  useEffect(() => {
    if (conversationId) void markThreadRead(conversationId);
  }, [conversationId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");
    setBusy(true);

    // Optimistic guest bubble (replaced by the realtime row via `seen` de-dupe
    // being id-based — the optimistic one uses a temp id and stays; realtime
    // inserts for our OWN message are skipped by body+time proximity below).
    const temp: ChatMessage = {
      id: `tmp-${Date.now()}`,
      direction: "inbound",
      sender_kind: "guest",
      type: "text",
      body: text,
      media_url: null,
      created_at: new Date().toISOString(),
    };
    seen.current.add(temp.id);
    setMessages((prev) => [...prev, temp]);
    setTimeout(() => scrollDown(), 30);

    let convId = conversationId;
    if (!convId) {
      const r = await ensureThread(context);
      if (!r.ok || !r.conversationId) {
        setBusy(false);
        setError(r.message ?? "Could not start the chat.");
        return;
      }
      convId = r.conversationId;
      setConversationId(convId);
    }

    const res = await sendGuestMessage(convId, text);
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? "Could not send — please try again.");
      return;
    }
    // Human-only: the team replies from the CRM inbox; it arrives here live.
  };

  // Realtime also delivers our OWN inserted guest rows — drop near-duplicates of
  // the optimistic bubble (same body within 15s) so nothing shows twice.
  const visible = dedupe(messages);

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {/* Thread */}
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
        {visible.length === 0 && (
          <div className="py-8 text-center">
            <Sparkles size={20} className="mx-auto text-gold" />
            <p className="mt-2 text-sm font-medium text-ink">Message {brand.name} Support</p>
            <p className="mx-auto mt-1 max-w-[250px] text-xs text-muted">
              Ask about a stay, your booking, or anything else — our team replies right here, usually within a few hours.
            </p>
          </div>
        )}

        {visible.map((m) => {
          if (m.type === "system" || m.sender_kind === "system") {
            return (
              <div key={m.id} className="flex justify-center py-0.5">
                <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] text-dim">{m.body}</span>
              </div>
            );
          }
          const mine = m.direction === "inbound";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  mine ? "rounded-br-md bg-gold/15 text-ink" : "rounded-bl-md border border-line bg-surface text-ink"
                }`}
              >
                {!mine && (
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gold-deep">
                    {m.sender_kind === "ai" ? (
                      <>
                        <Sparkles size={10} /> {brand.name} AI
                      </>
                    ) : m.sender_kind === "owner" ? (
                      <>Your host</>
                    ) : (
                      <>{brand.name} team</>
                    )}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <div className={`mt-0.5 text-[10px] ${mine ? "text-right" : ""} text-dim`}>{fmtTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {error && <p className="px-4 pb-1 text-xs text-red">{error}</p>}

      {/* Composer */}
      <div className="border-t border-line px-3 pb-3 pt-2">
        <form onSubmit={submit} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1.5 focus-within:border-gold/50">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Write a message…"
            aria-label="Write a message"
            className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-dim"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            aria-label="Send"
            className="rounded-lg bg-gold p-2 text-ink transition hover:brightness-105 disabled:opacity-40"
          >
            <SendHorizonal size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

/** Drop realtime echoes of optimistic guest bubbles (same body within 15s). */
function dedupe(list: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of list) {
    if (m.direction === "inbound" && !m.id.startsWith("tmp-")) {
      const i = out.findIndex(
        (p) =>
          p.id.startsWith("tmp-") &&
          p.body === m.body &&
          Math.abs(new Date(p.created_at).getTime() - new Date(m.created_at).getTime()) < 15_000,
      );
      if (i >= 0) {
        out[i] = m; // real row replaces the optimistic one
        continue;
      }
    }
    out.push(m);
  }
  return out;
}
