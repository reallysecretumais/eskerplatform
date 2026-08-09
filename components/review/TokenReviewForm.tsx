"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Sparkles } from "lucide-react";
import { StarRating } from "@/components/account/StarRating";
import { StarsDisplay } from "@/components/StarsDisplay";
import { submitTokenReview } from "@/app/review/actions";
import type { MyReview } from "@/lib/data/reviews";

/**
 * The tokened twin of the account ReviewForm — for guests who booked over
 * WhatsApp and have no website account. Two-part since Aug 2026: the booking
 * experience and the stay are rated separately (they credit different people
 * on the team). The written comment is optional — two star taps is a complete
 * review. Extra display-name field: the CRM saves whatever name the chat
 * happened to carry, so the guest decides how their name appears publicly.
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
  const [stayRating, setStayRating] = useState(existing?.stay_rating ?? existing?.rating ?? 0);
  const [bookingRating, setBookingRating] = useState(existing?.booking_experience_rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [name, setName] = useState(guestFirstName);
  const [location, setLocation] = useState(existing?.author_location ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function post() {
    setError(null);
    if (bookingRating < 1) return setError("Tap the stars to rate the booking experience.");
    if (stayRating < 1) return setError("Tap the stars to rate your stay.");
    start(async () => {
      const res = await submitTokenReview({ token, stayRating, bookingRating, body, name, location });
      if (res.ok) {
        setSaved({
          rating: stayRating,
          body: body.trim(),
          author_location: location.trim() || null,
          stay_rating: stayRating,
          booking_experience_rating: bookingRating,
        });
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
            <Check size={15} /> Your review is in — thank you
          </div>
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-ink">
            <Pencil size={13} /> Edit
          </button>
        </div>
        <div className="mt-3 space-y-1.5">
          {saved.booking_experience_rating != null && saved.booking_experience_rating > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="w-28 shrink-0 text-xs">Booking</span>
              <StarsDisplay value={saved.booking_experience_rating} size={14} />
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="w-28 shrink-0 text-xs">The stay</span>
            <StarsDisplay value={saved.stay_rating ?? saved.rating} size={14} />
            <span className="font-display text-sm font-semibold text-ink tabular-nums">
              {(saved.stay_rating ?? saved.rating).toFixed(2).replace(/\.?0+$/, "")}
            </span>
          </div>
        </div>
        {saved.body && <p className="mt-2 text-sm leading-relaxed text-ink">“{saved.body}”</p>}
      </div>
    );
  }

  // Edit / create view
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/50 px-5 py-3">
        <Sparkles size={16} className="text-gold-deep" />
        <span className="font-display text-base font-semibold tracking-tight text-ink">
          {saved ? "Edit your review" : "Two quick ratings"}
        </span>
      </div>

      <div className="p-5">
        <div className="flex w-full flex-col items-center gap-1 py-1">
          <div className="text-sm font-medium text-ink">How was the booking experience?</div>
          <div className="text-xs text-dim">Finding it, booking it, and how we communicated</div>
          <StarRating value={bookingRating} onChange={(v) => { setBookingRating(v); setError(null); }} />
        </div>

        <div className="mt-4 flex w-full flex-col items-center gap-1 border-t border-line py-1 pt-4">
          <div className="text-sm font-medium text-ink">How was your stay?</div>
          <div className="text-xs text-dim">The space, the comfort, the little touches</div>
          <StarRating value={stayRating} onChange={(v) => { setStayRating(v); setError(null); }} />
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="A few words, if you like — what made it special? (optional)"
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
            {pending ? "Sending…" : saved ? "Update review" : "Send ratings"}
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
