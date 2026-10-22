"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Mic, Search } from "lucide-react";
import type { SlimListing } from "@/lib/data/listings";
import { unlockAudio } from "@/lib/voiceAudio";

// The voice overlay is heavy (mic, audio, animation) and only needed on demand,
// so it's loaded lazily — the hero stays light and fast on first paint.
const VoiceConcierge = dynamic(() => import("@/components/VoiceConcierge").then((m) => m.VoiceConcierge), { ssr: false });

// Example prompts, in the guest's own words (BUILD_REFERENCE "Voice and copy").
const CHIPS = ["Pool, sleeps 6, this weekend", "Ground floor for my parents", "Under Rs 20k near Centaurus"];

const chip =
  "inline-flex h-[38px] items-center rounded-full px-4 text-sm font-semibold text-warm shadow-[inset_0_0_0_1.5px_rgba(244,243,239,0.45)] transition-colors hover:bg-warm/10";

// The Ask Esker field from the Website board: type OR speak. Typing routes to
// the results page; the mic opens the full-screen voice concierge (English or
// Urdu, hands-free). Both are CRM kill-switchable.
export function ConciergeSearch({
  listings = [],
  aiEnabled = true,
  voiceEnabled = true,
}: {
  listings?: SlimListing[];
  /** AI search off (CRM kill switch) → the hero falls back to real browsing
   *  rather than vanishing; this is the most-visited page's only search. */
  aiEnabled?: boolean;
  voiceEnabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const fill = (c: string) => {
    setValue(c);
    inputRef.current?.focus();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/stays?q=${encodeURIComponent(q)}` : "/stays");
  };

  const openVoice = () => {
    void unlockAudio();
    setVoiceOpen(true);
  };

  // ── AI search switched off → browse, don't disappear ─────────────────────
  if (!aiEnabled) {
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <Link
          href="/stays"
          className="inline-flex h-[58px] items-center gap-2.5 rounded-full bg-brand px-7 text-base font-bold text-warm transition-colors hover:bg-brand-pressed"
        >
          Browse all stays <ArrowRight size={18} className="text-ice" />
        </Link>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link href="/stays?tier=exclusive" className={chip}>
            Esker Exclusive
          </Link>
          <Link href="/stays" className={chip}>
            Filter by area &amp; type
          </Link>
          {voiceEnabled && (
            <button type="button" onClick={openVoice} className={`${chip} gap-2`}>
              <Mic size={16} className="text-ice" /> Speak to Esker
            </button>
          )}
        </div>
        {voiceOpen && <VoiceConcierge listings={listings} onClose={() => setVoiceOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <form
        onSubmit={submit}
        className="box-border flex h-[66px] w-full max-w-[640px] items-center gap-3 rounded-full bg-warm pl-6 pr-[9px] text-left text-ink focus-within:shadow-[0_0_0_3px_var(--color-ice)]"
      >
        <Search size={20} strokeWidth={2} className="shrink-0" aria-hidden />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Mujhe F-7 mein 2 din ke liye apartment chahiye…"
          aria-label="Describe the stay you're looking for"
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-dim"
        />
        {voiceEnabled && (
          <button
            type="button"
            onClick={openVoice}
            aria-label="Speak to Esker — English or Urdu"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-brand transition-colors hover:bg-ice-tint"
          >
            <Mic size={20} strokeWidth={2} />
          </button>
        )}
        <button
          type="submit"
          aria-label="Ask Esker"
          className="inline-flex h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-brand text-[15px] font-bold text-warm transition-colors hover:bg-brand-pressed max-sm:w-12 sm:px-[22px]"
        >
          <span className="max-sm:hidden">Ask Esker</span>
          <ArrowRight size={20} className="text-ice sm:hidden" aria-hidden />
        </button>
      </form>

      <div className="flex flex-wrap justify-center gap-2.5">
        {CHIPS.map((c) => (
          <button key={c} type="button" onClick={() => fill(c)} className={chip}>
            {c}
          </button>
        ))}
      </div>

      {voiceOpen && <VoiceConcierge listings={listings} onClose={() => setVoiceOpen(false)} />}
    </div>
  );
}
