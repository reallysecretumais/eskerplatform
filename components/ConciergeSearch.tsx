"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MessageCircle, Mic } from "lucide-react";
import type { SlimListing } from "@/lib/data/listings";
import { unlockAudio } from "@/lib/voiceAudio";

// The voice overlay is heavy (mic, audio, animation) and only needed on demand,
// so it's loaded lazily — the hero stays light and fast on first paint.
const VoiceConcierge = dynamic(() => import("@/components/VoiceConcierge").then((m) => m.VoiceConcierge), { ssr: false });

const CHIPS = ["Pool, sleeps 6, this weekend", "Ground floor for my parents", "Under ₨20k near Centaurus"];

// Concierge input shell: type OR speak. The text box routes to the results page;
// the mic opens the full-screen voice concierge (English or Urdu, hands-free).
export function ConciergeSearch({ listings = [] }: { listings?: SlimListing[] }) {
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

  return (
    <div className="mx-auto max-w-xl">
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow-2xl shadow-black/50 ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-gold/50"
      >
        <MessageCircle size={18} className="ml-2 shrink-0 text-gold" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="mujhe F-7 mein 2 din ke liye apartment chahiye…"
          aria-label="Tell the concierge what you're looking for"
          className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-[15px] text-ink outline-none placeholder:text-dim"
        />
        <button
          type="submit"
          className="shimmer shrink-0 rounded-xl bg-gold px-5 py-2.5 text-sm font-medium text-ink transition hover:brightness-105"
        >
          Ask Esker
        </button>
      </form>

      {/* Voice entry — the signature moment */}
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => {
            void unlockAudio(); // unlock audio inside the gesture so replies play
            setVoiceOpen(true);
          }}
          className="group inline-flex items-center gap-2.5 rounded-full border border-gold/40 bg-white/10 py-2.5 pl-2.5 pr-5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20"
        >
          <span className="relative grid h-8 w-8 place-items-center rounded-full bg-gold text-ink">
            <span className="absolute inset-0 animate-ping rounded-full bg-gold/50 [animation-duration:2.2s]" />
            <Mic size={16} className="relative" />
          </span>
          Speak to Esker — <span className="text-gold">English or Urdu</span>
        </button>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => fill(c)}
            className="rounded-full border border-white/40 bg-black/10 px-3.5 py-1.5 text-xs text-white/90 backdrop-blur-sm transition hover:bg-white/15"
          >
            {c}
          </button>
        ))}
      </div>

      {voiceOpen && <VoiceConcierge listings={listings} onClose={() => setVoiceOpen(false)} />}
    </div>
  );
}
