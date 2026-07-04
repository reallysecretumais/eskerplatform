"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Sparkles, Search } from "lucide-react";
import type { SlimListing } from "@/lib/data/listings";
import { StayCard } from "@/components/StayCard";

type Turn = { role: "user" | "assistant"; content: string };
type Match = SlimListing & { why?: string };

// Split the streamed reply from its machine tail. Format:
//   <prose>\nSTAYS: id1, id2\nWHY: id1: reason; id2: reason   (WHY optional)
function parseTail(full: string): { text: string; ids: string[]; why: Map<string, string> } {
  const sIdx = full.indexOf("STAYS:");
  const text = (sIdx >= 0 ? full.slice(0, sIdx) : full).trim();
  const why = new Map<string, string>();
  let idsPart = "";
  if (sIdx >= 0) {
    const after = full.slice(sIdx + 6);
    const wIdx = after.indexOf("WHY:");
    idsPart = wIdx >= 0 ? after.slice(0, wIdx) : after;
    if (wIdx >= 0) {
      for (const seg of after.slice(wIdx + 4).split(";")) {
        const [id, reason] = seg.split(/:(.+)/); // "id: reason" (reason may contain colons)
        if (id?.trim() && reason?.trim()) why.set(id.trim(), reason.trim());
      }
    }
  }
  const ids = idsPart.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  return { text, ids, why };
}

// One-tap follow-ups shown under the results — refinement without typing.
const REFINE_CHIPS = ["Cheaper", "Add a pool", "Bigger place", "Different area"];

// The concierge presented as a premium results experience (not a chat popup):
// an elegant streamed reply + your real stays as big cards (each with a short
// "why it matches" line), with a refine bar that keeps the conversation context
// under the hood.
export function ConciergeStream({ query, listings }: { query: string; listings: SlimListing[] }) {
  const byId = new Map(listings.map((l) => [l.id, l]));
  const [history, setHistory] = useState<Turn[]>([]);
  const [asked, setAsked] = useState<string[]>([]);
  const [reply, setReply] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [busy, setBusy] = useState(false);
  const [refine, setRefine] = useState("");
  const started = useRef(false);

  const ask = async (text: string, base: Turn[]) => {
    const hist: Turn[] = [...base, { role: "user", content: text }];
    setHistory(hist);
    setAsked((a) => [...a, text]);
    setBusy(true);
    setReply("");
    setMatches([]);

    let full = "";
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: hist }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        const idx = full.indexOf("STAYS:");
        setReply((idx >= 0 ? full.slice(0, idx) : full).trim());
      }
      const { text, ids, why } = parseTail(full);
      setReply(text || "Here's what I found for you.");
      setMatches(
        ids
          .map((id): Match | null => {
            const l = byId.get(id);
            return l ? { ...l, why: why.get(id) } : null;
          })
          .filter((l): l is Match => l !== null),
      );
      setHistory([...hist, { role: "assistant", content: text }]);
    } catch {
      setReply("Sorry — I had trouble just now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void ask(query, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitRefine = (e: FormEvent) => {
    e.preventDefault();
    const q = refine.trim();
    if (!q || busy) return;
    setRefine("");
    void ask(q, history);
  };

  return (
    <div>
      {/* Refinement trail */}
      {asked.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {asked.map((a, i) => (
            <span key={i} className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">{a}</span>
          ))}
        </div>
      )}

      {/* Concierge reply — elegant, streamed (not a chat bubble) */}
      <div className="flex items-start gap-3 border-l-2 border-gold pl-4">
        <p className="font-display text-lg font-medium leading-relaxed tracking-tight text-ink sm:text-xl">
          {reply || (busy ? "Finding your stay" : "")}
          {busy && <span className="ml-0.5 animate-pulse text-gold">▍</span>}
        </p>
      </div>

      {/* Refine bar */}
      <form onSubmit={submitRefine} className="mt-6 flex max-w-xl items-center gap-2 rounded-xl border border-line bg-surface p-1.5 focus-within:border-gold/50">
        <Search size={17} className="ml-2 shrink-0 text-gold" />
        <input
          value={refine}
          onChange={(e) => setRefine(e.target.value)}
          placeholder="Refine — 'cheaper', 'add a pool', 'for 6 guests'…"
          className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-ink outline-none placeholder:text-dim"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-ink transition hover:brightness-105 disabled:opacity-50">
          Ask
        </button>
      </form>

      {/* Results */}
      {matches.length > 0 ? (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {matches.map((l) => (
              <div key={l.id}>
                <StayCard title={l.title} category={l.category ?? "Stay"} area={l.area ?? ""} price={l.price} exclusive={l.esker_exclusive} photo={l.photo ?? undefined} href={`/stays/${l.id}`} />
                {l.why && (
                  <p className="mt-1.5 flex items-start gap-1 px-1 text-xs text-gold-deep">
                    <Sparkles size={12} className="mt-0.5 shrink-0" /> {l.why}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* One-tap refinements — natural follow-ups without typing */}
          <div className="mt-6 flex flex-wrap gap-2">
            {REFINE_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={busy}
                onClick={() => void ask(c, history)}
                className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs text-muted transition hover:border-gold/40 hover:text-ink disabled:opacity-50"
              >
                {c}
              </button>
            ))}
          </div>
        </>
      ) : busy ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="aspect-[4/5] animate-pulse bg-surface-2" />
              <div className="space-y-2 p-3.5">
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-surface-2" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      ) : reply ? (
        <p className="mt-8 text-sm text-muted">
          Try refining above, or <a href="/stays" className="text-gold-deep hover:underline">browse all stays</a>.
        </p>
      ) : null}
    </div>
  );
}
