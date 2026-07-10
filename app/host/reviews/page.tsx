import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getHostReviews, type HostReview } from "@/lib/data/host";
import { StarsDisplay } from "@/components/StarsDisplay";
import { ReviewReply } from "@/components/host/ReviewReply";

export const metadata = { title: "Reviews — Esker" };

const fmtStay = (d: string | null) => (d ? `Stayed ${new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : "");

export default async function HostReviewsPage() {
  const account = await requireAccount();
  if (!account.roles.includes("owner")) redirect("/host");
  const { reviews, average, count } = await getHostReviews();

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Reviews</h1>
        {count > 0 && (
          <span className="inline-flex items-center gap-2 text-sm">
            <StarsDisplay value={average} size={15} />
            <span className="font-medium text-ink tabular-nums">{average.toFixed(1)}</span>
            <span className="text-muted">· {count} {count === 1 ? "review" : "reviews"}</span>
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">What guests said about your places. A warm reply shows future guests you care.</p>

      {reviews.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-8 text-center">
          <Star size={20} className="mx-auto text-dim" />
          <p className="mt-2 text-sm text-muted">No reviews yet — they&apos;ll appear here after guests complete their stays.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {reviews.map((r) => (
            <ReviewCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ r }: { r: HostReview }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StarsDisplay value={r.rating} size={14} />
          <span className="text-sm font-medium text-ink tabular-nums">{r.rating.toFixed(2).replace(/\.?0+$/, "")}</span>
        </div>
        <span className="truncate text-xs text-dim">{r.listingTitle}</span>
      </div>
      <blockquote className="mt-2 text-sm leading-relaxed text-ink">“{r.body}”</blockquote>
      <div className="mt-2 text-xs text-muted">
        <span className="font-medium text-ink">{r.authorName}</span>
        {r.authorLocation ? ` · ${r.authorLocation}` : ""}
        {fmtStay(r.stayedOn) ? ` · ${fmtStay(r.stayedOn)}` : ""}
        {r.status !== "published" && <span className="ml-1 text-dim">· ({r.status})</span>}
      </div>
      <ReviewReply reviewId={r.id} initial={r.hostReply} />
    </article>
  );
}
