"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Sparkles } from "lucide-react";
import { ChatThread } from "@/components/chat/ChatThread";
import { loadThread, type ChatContext } from "@/app/chat/actions";
import type { ChatMessage } from "@/lib/data/chat";
import { brand } from "@/lib/brand";

// The floating chat entry — a quiet black bubble, bottom-right, on every page
// (except checkout, where nothing should compete with payment). Opens a
// slide-over panel hosting the shared ChatThread. Signed-out visitors get a
// warm sign-in card with a WhatsApp fallback.

// Pages can ask the launcher to open with context (e.g. "Message us about this
// place") by dispatching:  window.dispatchEvent(new CustomEvent("esker:chat", { detail: { propertyId } }))
export function ChatLauncher({ signedIn, initialUnread }: { signedIn: boolean; initialUnread: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [context, setContext] = useState<ChatContext | undefined>(undefined);
  const [thread, setThread] = useState<{ conversationId: string | null; messages: ChatMessage[] } | null>(null);
  const [loading, setLoading] = useState(false);

  // Entry points anywhere on the site can open the panel with context.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as ChatContext | undefined;
      setContext(detail);
      setOpen(true);
    };
    window.addEventListener("esker:chat", onOpen);
    return () => window.removeEventListener("esker:chat", onOpen);
  }, []);

  // Lazy-load the thread the first time the panel opens.
  useEffect(() => {
    if (!open || !signedIn || thread || loading) return;
    setLoading(true);
    void loadThread()
      .then((t) => setThread({ conversationId: t?.conversationId ?? null, messages: t?.messages ?? [] }))
      .finally(() => setLoading(false));
  }, [open, signedIn, thread, loading]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // Keep checkout + auth pages distraction-free; /messages already IS the chat.
  // (The post-booking confirmation page keeps it — that's a key entry point.)
  // /invest is the private investor page — a guest chat bubble has no place there.
  const p = pathname ?? "";
  if (/^\/(login|signup|auth|messages|invest)/.test(p) || /^\/book\/[^/]+\/?$/.test(p)) return null;
  // A stay page has its own fixed Reserve bar on phones; sit above it, not on it.
  const overBar = /^\/stays\/[^/]+\/?$/.test(p);

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Message ${brand.name}`}
          className={`fixed right-5 z-40 grid ${overBar ? "bottom-[92px] lg:bottom-5" : "bottom-5"} h-13 w-13 place-items-center rounded-full bg-ink text-warm shadow-lg shadow-black/25 transition hover:scale-105`}
          style={{ height: 52, width: 52 }}
        >
          <MessageCircle size={22} className="text-warm" />
          {unread > 0 && (
            <span className="tnum absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-warm shadow-[0_0_0_2px_var(--color-bg)]">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}

      {/* Slide-over panel */}
      {open && (
        <div className="voice-in fixed inset-0 z-50 flex items-end justify-end sm:items-stretch sm:p-5">
          <button type="button" aria-label="Close chat" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/25 sm:bg-transparent" />
          <div className="relative flex h-[86dvh] w-full flex-col overflow-hidden rounded-t-[22px] border border-line bg-bg shadow-2xl shadow-black/20 sm:ml-auto sm:h-auto sm:max-h-[640px] sm:w-[390px] sm:rounded-[22px]">
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-dark-line bg-ink px-4 py-3 text-warm">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-warm/10">
                <Sparkles size={15} className="text-ice" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{brand.name}</div>
                <div className="text-[11px] text-ash">Instant answers · the team is close behind</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-full p-1.5 text-ash transition hover:bg-warm/10 hover:text-warm">
                <X size={17} />
              </button>
            </div>

            {signedIn ? (
              loading || !thread ? (
                <div className="grid flex-1 place-items-center py-16 text-sm text-muted">Opening your chat…</div>
              ) : (
                <ChatThread initialConversationId={thread.conversationId} initialMessages={thread.messages} context={context} className="flex-1" />
              )
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <Sparkles size={22} className="text-brand" />
                <p className="text-sm font-medium text-ink">Message {brand.name}</p>
                <p className="max-w-[240px] text-xs text-muted">Sign in to chat — instant answers, and the team is always close behind.</p>
                <Link
                  href={`/login?next=${encodeURIComponent(pathname || "/")}`}
                  className="mt-1 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-warm transition hover:bg-brand-pressed"
                >
                  Sign in to start
                </Link>
                <a
                  href={`https://wa.me/${brand.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted underline-offset-2 transition hover:text-ink hover:underline"
                >
                  or message us on WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
