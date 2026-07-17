"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Sparkles } from "lucide-react";
import { StarRating } from "@/components/account/StarRating";
import { StarsDisplay } from "@/components/StarsDisplay";
import { submitTokenReview } from "@/app/review/actions";
import type { MyReview } from "@/lib/data/reviews";

/**
 * The tokened twin of the account ReviewForm — for guests who booked over
 * WhatsApp and have no website account. Extra display-name field: the CRM saves
 * whatever name the chat happened to carry, so the guest decides how their name
 * appears next to a public review.
 */
export function TokenReviewForm({
  token,
  guestFirstName,
  existing,
}: {
  token: string;
  guestFirstName: string;
  existing: MyReview | null;
}) {
  const [editing, setEditing] = useState(existing === null);
  const [saved, setSaved] = useState<MyReview | null>(existing);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [name, setName] = useState(guestFirstName);
  const [location, setLocation] = useState(existing?.author_location ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function post() {
    setError(null);
    if (rating < 1) return setError("Tap the stars to rate your stay.");
    if (body.trim().length < 3) return setError("Please write a few words about your stay.");
    start(async () => {
      const res = await submitTokenReview({ token, rating, body, name, location });
      if (res.ok) {
        setSaved({ rating, body: body.trim(), author_location: location.trim() || null });
        setEditing(false);
      } else {
        setError(res.message);
      }
    });
  }

  // Saved view
  if (!editing && saved) {
    return (
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/[0.07] to-transparent p-5">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-sm font-medium text-green">
            <Check size={15} /> Your review is live — thank you
          </div>
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-ink">
            <Pencil size={13} /> Edit
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <StarsDisplay value={saved.rating} size={16} />
          <span className="font-display text-sm font-semibold text-ink tabular-nums">{saved.rating.toFixed(2).replace(/\.?0+$/, "")}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink">“{saved.body}”</p>
      </div>
    );
  }

  // Edit / create view
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/50 px-5 py-3">
        <Sparkles size={16} className="text-gold-deep" />
        <span className="font-display text-base font-semibold tracking-tight text-ink">
          {saved ? "Edit your review" : "How was your stay?"}
        </span>
      </div>

      <div className="p-5">
        <div className="flex flex-col items-center gap-1 py-2">
          <StarRating value={rating} onChange={(v) => { setRating(v); setError(null); }} />
          <span className="mt-1 text-xs text-dim">Tap or drag · fine as 4.5 or 4.75</span>
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="What made it special? The space, the location, the little touches…"
          className="mt-4 w-full resize-none rounded-xl border border-line bg-bg/40 px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/50"
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Your name — shown with the review"
            className="w-full rounded-xl border border-line bg-bg/40 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/50"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={60}
            placeholder="Your city (optional)"
            className="w-full rounded-xl border border-line bg-bg/40 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/50"
          />
        </div>

        {error && <p className="mt-3 text-sm text-red">{error}</p>}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={post}
            disabled={pending}
            className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Posting…" : saved ? "Update review" : "Post review"}
          </button>
          {saved && (
            <button type="button" onClick={() => { setEditing(false); setError(null); }} className="text-sm text-muted transition hover:text-ink">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
