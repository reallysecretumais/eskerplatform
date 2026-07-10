"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Send } from "lucide-react";
import { submitListing } from "@/app/host/actions";
import type { SubmitChecklist } from "@/app/host/actions";
import { MIN_LISTING_PHOTOS } from "@/lib/hostConstants";

// The draft's "Submit for review" bar: a live checklist + the submit button
// (enabled only when everything's in place). Server re-validates on submit.
export function SubmitBar({ listingId, checklist }: { listingId: string; checklist: SubmitChecklist }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  const submit = () =>
    start(async () => {
      setMsg(null);
      const res = await submitListing(listingId);
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) router.refresh();
    });

  const items: { done: boolean; label: string }[] = [
    { done: checklist.title, label: "Title" },
    { done: checklist.description, label: "Description" },
    { done: checklist.price, label: "Nightly price" },
    { done: checklist.photos, label: `${MIN_LISTING_PHOTOS}+ photos` },
  ];

  return (
    <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/[0.07] to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-display text-base font-semibold tracking-tight text-ink">Ready to go live?</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {items.map((it) => (
              <span key={it.label} className={`inline-flex items-center gap-1.5 text-xs ${it.done ? "text-green" : "text-dim"}`}>
                <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] ${it.done ? "bg-green/15" : "bg-surface-2"}`}>
                  {it.done ? <Check size={10} /> : "•"}
                </span>
                {it.label}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !checklist.ready}
          className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
        >
          <Send size={15} /> {pending ? "Submitting…" : "Submit for review"}
        </button>
      </div>
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green" : "text-red"}`}>{msg.text}</p>}
    </div>
  );
}
