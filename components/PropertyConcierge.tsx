"use client";

import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import type { PublicListing } from "@/lib/data/listings";
import { StayCard } from "@/components/StayCard";

const SUGGEST = ["Is there parking?", "Good for families?", "What's nearby?", "Check-in time?"];

type QA = { q: string; a: string; matches: PublicListing[] };

// The property page's "Ask about this place" — answers about THIS listing from
// its public data + facts (streamed), and surfaces similar live stays for
// "find me something like this but…". Retrieval-first and public-safe.
export function PropertyConcierge({ property, listings }: { property: PublicListing; listings: PublicListing[] }) {
  const byId = new Map(listings.map((l) => [l.id, l]));
  const [thread, setThread] = useState<QA[]>([]);
  const [pendingQ, setPendingQ] = useState("");
  const [partial, setPartial] = useState("");
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");

  const context = `The guest is viewing this listing: "${property.title}" — ${property.category ?? "stay"} in ${property.area ?? ""} (id: ${property.id}). Answer questions about THIS place using its details and facts. For "find me something like this" requests, recommend from the OTHER listings.`;

  const ask = async (q: string) => {
    setPendingQ(q);
    setInput("");
    setBusy(true);
    setPartial("");

    const msgs = thread.flatMap((t) => [
      { role: "user", content: t.q },
      { role: "assistant", content: t.a },
    ]);
    msgs.push({ role: "user", content: q });

    let full = "";
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, context }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        const idx = full.indexOf("STAYS:");
        setPartial((idx >= 0 ? full.slice(0, idx) : full).trim());
      }
      const idx = full.indexOf("STAYS:");
      const a = (idx >= 0 ? full.slice(0, idx) : full).trim();
      const ids = idx >= 0 ? full.slice(idx + 6).split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) : [];
      const matches = ids
        .map((id) => byId.get(id))
        .filter((l): l is PublicListing => Boolean(l))
        .filter((l) => l.id !== property.id);
      setThread((t) => [...t, { q, a: a || "Here you go.", matches }]);
    } catch {
      setThread((t) => [...t, { q, a: "Sorry — I had trouble just now. Please try again.", matches: [] }]);
    } finally {
      setBusy(false);
      setPartial("");
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    void ask(q);
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-gold" />
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">Ask about this place</h2>
      </div>
      <p className="mt-1 text-sm text-muted">Instant answers — parking, check-in, family-friendly, what&apos;s nearby. Even in Roman Urdu.</p>

      {(thread.length > 0 || busy) && (
        <div className="mt-4 space-y-4">
          {thread.map((t, i) => (
            <div key={i}>
              <div className="text-xs font-medium text-dim">{t.q}</div>
              <p className="mt-1 text-[15px] leading-relaxed text-ink">{t.a}</p>
              {t.matches.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {t.matches.map((l) => (
                    <StayCard key={l.id} title={l.title} category={l.category ?? "Stay"} area={l.area ?? ""} price={l.price} exclusive={l.esker_exclusive} photo={l.photos?.[0] ?? undefined} href={`/stays/${l.id}`} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div>
              <div className="text-xs font-medium text-dim">{pendingQ}</div>
              <p className="mt-1 text-[15px] leading-relaxed text-ink">
                {partial}
                <span className="ml-0.5 animate-pulse text-gold">▍</span>
              </p>
            </div>
          )}
        </div>
      )}

      {thread.length === 0 && !busy && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGEST.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-line bg-bg px-3.5 py-1.5 text-xs text-muted transition hover:border-gold/40 hover:text-ink">
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-bg p-1.5 focus-within:border-gold/50">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about this place…"
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-dim"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-ink transition hover:brightness-105 disabled:opacity-50">
          Ask
        </button>
      </form>
    </section>
  );
}
