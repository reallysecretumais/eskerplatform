import { Star, ShieldCheck } from "lucide-react";
import { brand } from "@/lib/brand";
import type { Review, RatingSummary } from "@/lib/data/reviews";

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(value) ? "fill-gold text-gold" : "text-line-hi"} strokeWidth={1.5} />
      ))}
    </span>
  );
}

const fmtStay = (d: string | null) => (d ? `Stayed ${new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : "");

export function Reviews({ reviews, summary, exclusive }: { reviews: Review[]; summary: RatingSummary | null; exclusive: boolean }) {
  if (!summary || reviews.length === 0) {
    // Cold start — lean on the Esker Exclusive guarantee instead of an empty state.
    if (!exclusive) return null;
    return (
      <section className="border-t border-line pt-8">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Guest confidence</h2>
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-line bg-surface-2/50 p-4">
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-gold" strokeWidth={1.5} />
          <p className="text-sm text-muted">
            This is an <span className="font-medium text-ink">{brand.exclusiveTier}</span> stay — personally inspected and managed by Esker to a guaranteed standard, with fast local support throughout your visit.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-line pt-8">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">What guests say</h2>
        <span className="inline-flex items-center gap-1.5 text-sm">
          <Stars value={summary.average} />
          <span className="font-medium text-ink tnum">{summary.average.toFixed(1)}</span>
          <span className="text-muted">· {summary.count} {summary.count === 1 ? "review" : "reviews"}</span>
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {reviews.map((r) => (
          <figure key={r.id} className="rounded-2xl border border-line bg-surface p-4">
            <Stars value={r.rating} size={13} />
            <blockquote className="mt-2 text-sm leading-relaxed text-ink">“{r.body}”</blockquote>
            <figcaption className="mt-3 text-xs text-muted">
              <span className="font-medium text-ink">{r.author_name}</span>
              {r.author_location ? ` · ${r.author_location}` : ""}
              {fmtStay(r.stayed_on) ? ` · ${fmtStay(r.stayed_on)}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
