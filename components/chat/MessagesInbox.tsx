"use client";

import { useState } from "react";
import { Sparkles, Home, ArrowLeft } from "lucide-react";
import { ChatThread } from "@/components/chat/ChatThread";
import { loadThreadMessages } from "@/app/chat/actions";
import type { ThreadSummary, ChatMessage } from "@/lib/data/chat";

// The guest's inbox: a list of conversations (Esker Support + one per host they've
// messaged) on the left, the open thread on the right. Contact numbers are never
// shown — everyone talks in-app. Fast: threads load lazily on select; the open
// thread streams live via ChatThread's realtime subscription.

const fmtWhen = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const keyOf = (t: ThreadSummary) => t.conversationId ?? `new-${t.kind}`;

export function MessagesInbox({ threads, firstMessages }: { threads: ThreadSummary[]; firstMessages: ChatMessage[] }) {
  const [selected, setSelected] = useState<ThreadSummary>(threads[0]);
  const [messages, setMessages] = useState<ChatMessage[]>(firstMessages);
  const [loading, setLoading] = useState(false);
  const [openOnMobile, setOpenOnMobile] = useState(false);
  const [reads, setReads] = useState<Set<string>>(new Set()); // locally-cleared unread dots

  const open = async (t: ThreadSummary) => {
    setSelected(t);
    setOpenOnMobile(true);
    setReads((s) => new Set(s).add(keyOf(t)));
    if (!t.conversationId) {
      setMessages([]);
      return;
    }
    if (t.conversationId === threads[0]?.conversationId) {
      setMessages(firstMessages);
      return;
    }
    setLoading(true);
    const msgs = await loadThreadMessages(t.conversationId);
    setMessages(msgs);
    setLoading(false);
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* Thread list */}
      <aside className={`${openOnMobile ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col overflow-y-auto border-line md:w-[300px] md:border-r`}>
        {threads.map((t) => {
          const active = keyOf(selected) === keyOf(t);
          const unread = t.unread > 0 && !reads.has(keyOf(t));
          return (
            <button
              key={keyOf(t)}
              type="button"
              onClick={() => void open(t)}
              className={`flex items-center gap-3 border-b border-line px-4 py-3 text-left transition ${active ? "bg-surface-2" : "hover:bg-surface-2/60"}`}
            >
              <ThreadAvatar kind={t.kind} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{t.title}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-dim">{fmtWhen(t.lastAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs text-muted">{t.lastPreview ?? (t.kind === "esker" ? "Ask us anything" : "Message the host")}</span>
                  {unread && <span className="ml-auto grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold text-ink">{t.unread}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </aside>

      {/* Open thread */}
      <section className={`${openOnMobile ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
          <button type="button" onClick={() => setOpenOnMobile(false)} className="rounded-md p-1 text-muted hover:text-ink md:hidden" aria-label="Back to inbox">
            <ArrowLeft size={18} />
          </button>
          <ThreadAvatar kind={selected.kind} small />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{selected.title}</div>
            {selected.subtitle && <div className="truncate text-[11px] text-muted">{selected.subtitle}</div>}
          </div>
        </div>

        {loading ? (
          <div className="grid flex-1 place-items-center text-sm text-muted">Loading…</div>
        ) : (
          <ChatThread key={keyOf(selected)} initialConversationId={selected.conversationId} initialMessages={messages} className="min-h-0 flex-1" />
        )}
      </section>
    </div>
  );
}

function ThreadAvatar({ kind, small }: { kind: "esker" | "host"; small?: boolean }) {
  const s = small ? 30 : 38;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full"
      style={{ height: s, width: s, background: kind === "esker" ? "rgba(201,168,76,0.16)" : "rgba(33,31,26,0.08)" }}
    >
      {kind === "esker" ? <Sparkles size={small ? 14 : 17} className="text-gold-deep" /> : <Home size={small ? 14 : 17} className="text-ink" />}
    </span>
  );
}
