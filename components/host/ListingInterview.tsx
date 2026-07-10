"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Sparkles, SendHorizonal, MapPin, BedDouble, Users, Banknote } from "lucide-react";
import { interviewTurn } from "@/app/host/actions";
import { PhotoStep } from "@/components/host/PhotoStep";
import { INTERVIEW_OPENER, type InterviewFields, type ChatMsg } from "@/lib/ai/hostInterviewShared";

// The AI listing interview: a chat on the left, and the listing literally
// writing itself on the right (gold pulse as each detail lands). On completion
// the server has already created the draft — we play a short "assembling" beat
// and reveal the photo step right here (photos are the approval gate).

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;

export function ListingInterview() {
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", content: INTERVIEW_OPENER }]);
  const [known, setKnown] = useState<InterviewFields>({});
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [photoStepId, setPhotoStepId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || assembling) return;
    setError(null);
    setInput("");
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);

    const res = await interviewTurn(next.slice(1), known); // opener is injected server-side
    setBusy(false);

    if (!res.ok) {
      setError(res.message ?? "Something went wrong — try again.");
      return;
    }

    if (res.reply) setMessages((prev) => [...prev, { role: "assistant", content: res.reply! }]);

    if (res.known) {
      // Pulse whatever just landed or changed.
      const changed = new Set<string>();
      for (const k of Object.keys(res.known) as (keyof InterviewFields)[]) {
        if (JSON.stringify(res.known[k]) !== JSON.stringify(known[k])) changed.add(k);
      }
      setKnown(res.known);
      if (changed.size) {
        setFresh(changed);
        setTimeout(() => setFresh(new Set()), 1600);
      }
    }

    if (res.done && res.draftId) {
      setAssembling(true);
      const id = res.draftId;
      setTimeout(() => setPhotoStepId(id), 1600);
    }
  };

  // Interview done → reveal the emphatic photo step right here.
  if (photoStepId) {
    return (
      <div>
        <div className="mb-4 rounded-2xl border border-green/30 bg-green/5 p-4 text-sm text-green">
          Your listing is drafted ✨ — now let&apos;s make it shine with photos.
        </div>
        <PhotoStep draftId={photoStepId} />
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {/* Chat */}
      <div className="flex h-[62dvh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <Sparkles size={15} className="text-gold-deep" />
          <span className="text-sm font-semibold text-ink">Listing assistant</span>
          <span className="ml-auto text-[11px] text-dim">~2 minutes</span>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === "user" ? "rounded-br-md bg-gold/15 text-ink" : "rounded-bl-md border border-line bg-bg/40 text-ink"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-line bg-bg/40 px-4 py-2.5">
                <span className="inline-flex gap-1">
                  <Dot delay="0ms" /> <Dot delay="150ms" /> <Dot delay="300ms" />
                </span>
              </div>
            </div>
          )}
          {assembling && (
            <div className="flex justify-center py-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold-deep">
                <Sparkles size={14} className="animate-pulse" /> Assembling your listing…
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <p className="px-4 pb-1 text-xs text-red">
            {error}{" "}
            <Link href="/host/listings/new/manual" className="underline">Use the form instead</Link>
          </p>
        )}

        <div className="border-t border-line px-3 pb-3 pt-2">
          <form onSubmit={submit} className="flex items-center gap-2 rounded-xl border border-line bg-bg/40 p-1.5 focus-within:border-gold/50">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell me about your place…"
              aria-label="Your answer"
              disabled={assembling}
              className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-dim"
            />
            <button type="submit" disabled={!input.trim() || busy || assembling} aria-label="Send" className="rounded-lg bg-gold p-2 text-ink transition hover:brightness-105 disabled:opacity-40">
              <SendHorizonal size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* Live preview — the listing writing itself */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line bg-surface-2/50 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-dim">
            Your listing — building live
          </div>
          <div className="space-y-3 p-4">
            <Pulse on={fresh.has("title")}>
              {known.title ? (
                <div className="font-display text-base font-semibold leading-snug text-ink">{known.title}</div>
              ) : (
                <div className="space-y-1.5">
                  <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-2" />
                  <div className="h-3.5 w-3/5 animate-pulse rounded bg-surface-2" />
                </div>
              )}
            </Pulse>

            <div className="flex flex-wrap gap-1.5">
              <Chip icon={<Sparkles size={11} />} on={fresh.has("category")} value={known.category} placeholder="Category" />
              <Chip icon={<MapPin size={11} />} on={fresh.has("area")} value={known.area} placeholder="Area" />
              <Chip icon={<BedDouble size={11} />} on={fresh.has("bedrooms")} value={known.bedrooms != null ? `${known.bedrooms === 0 ? "Studio" : `${known.bedrooms} bed`}` : undefined} placeholder="Beds" />
              <Chip icon={<Users size={11} />} on={fresh.has("capacity")} value={known.capacity != null ? `Sleeps ${known.capacity}` : undefined} placeholder="Sleeps" />
            </div>

            <Pulse on={fresh.has("price")}>
              {known.price ? (
                <div className="font-display text-lg font-semibold text-gold-deep tabular-nums">
                  {pkr(known.price)}<span className="text-xs font-normal text-dim"> / night</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs text-dim"><Banknote size={12} /> Price — we&apos;ll get there</div>
              )}
            </Pulse>

            {(known.amenities?.length ?? 0) > 0 && (
              <Pulse on={fresh.has("amenities")}>
                <div className="flex flex-wrap gap-1">
                  {known.amenities!.slice(0, 8).map((a) => (
                    <span key={a} className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold-deep">{a}</span>
                  ))}
                  {known.amenities!.length > 8 && <span className="text-[10px] text-dim">+{known.amenities!.length - 8}</span>}
                </div>
              </Pulse>
            )}

            <Pulse on={fresh.has("description")}>
              {known.description ? (
                <p className="text-xs leading-relaxed text-muted">{known.description}</p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <div className="h-2 w-full animate-pulse rounded bg-surface-2" />
                  <div className="h-2 w-11/12 animate-pulse rounded bg-surface-2" />
                  <div className="h-2 w-3/4 animate-pulse rounded bg-surface-2" />
                </div>
              )}
            </Pulse>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-dim">Everything stays editable before you submit.</p>
      </aside>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-dim" style={{ animationDelay: delay }} />;
}

function Pulse({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg transition-all duration-700 ${on ? "bg-gold/10 shadow-[0_0_0_1.5px_var(--color-gold,#c9a84c)] p-1.5 -m-1.5" : ""}`}>
      {children}
    </div>
  );
}

function Chip({ icon, on, value, placeholder }: { icon: React.ReactNode; on: boolean; value?: string; placeholder: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-all duration-700 ${
        value ? (on ? "border-gold bg-gold/15 text-gold-deep" : "border-gold/30 bg-gold/5 text-gold-deep") : "border-line text-dim"
      }`}
    >
      {icon} {value ?? placeholder}
    </span>
  );
}
