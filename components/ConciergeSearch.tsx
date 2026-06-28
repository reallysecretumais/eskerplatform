"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";

const CHIPS = ["Pool, sleeps 6, this weekend", "Ground floor for my parents", "Under ₨20k near Centaurus"];

// Concierge input shell. The AI isn't wired yet, but the interaction is built so
// it slots in cleanly: focus states, Roman-Urdu example placeholder, and example
// chips that PRE-FILL the input on tap. Later: simple query → filter the grid in
// place; complex query → transition to the search page.
export function ConciergeSearch() {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const fill = (c: string) => {
    setValue(c);
    inputRef.current?.focus();
  };

  // For now this routes to the results page with the text as a keyword search;
  // the real AI concierge slots in here later (in-place filter / smart routing).
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
          className="shrink-0 rounded-xl bg-gold px-5 py-2.5 text-sm font-medium text-ink transition hover:brightness-105"
        >
          Ask Esker
        </button>
      </form>

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
    </div>
  );
}
