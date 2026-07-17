import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, CalendarDays } from "lucide-react";
import { getBookingForReviewToken, getMyReview } from "@/lib/data/reviews";
import { TokenReviewForm } from "@/components/review/TokenReviewForm";
import { thumb } from "@/lib/img";
import { brand } from "@/lib/brand";

// A per-guest link delivered over WhatsApp — never index it.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Rate your stay — Esker",
  robots: { index: false, follow: false },
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

/**
 * Public review page for WhatsApp bookings (no account, no login) — the link's
 * 64-hex token IS the authorisation; getBookingForReviewToken is the whole
 * gate. Website-account guests review from /account/bookings/[id] instead.
 */
export default async function ReviewByTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const stay = await getBookingForReviewToken(token);

  if (!stay) {
    return (
      <main className="min-h-full">
        <div className="mx-auto max-w-lg px-6 py-20 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">This link isn&apos;t valid</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            It may have been mistyped, or the stay it belongs to hasn&apos;t finished yet. If you think this is a
            mistake, just reply to our WhatsApp message and we&apos;ll send you a fresh one.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition hover:border-gold/50"
          >
            Browse {brand.name} stays
          </Link>
        </div>
      </main>
    );
  }

  const existing = await getMyReview(stay.bookingId);
  const dates = [fmt(stay.checkin), fmt(stay.checkout)].filter(Boolean).join(" — ");

  return (
    <main className="min-h-full pb-16">
      <div className="mx-auto max-w-lg px-6 py-8">
        {/* The stay being reviewed */}
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {stay.property.photo && (
            <div
              className="h-40 sm:h-48"
              style={{
                backgroundColor: "#e7e1d6",
                backgroundImage: `url(${thumb(stay.property.photo, 900, 70)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          )}
          <div className="p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-gold-deep">Rate your stay</div>
            <h1 className="mt-1 font-display text-xl font-semibold tracking-tight text-ink">{stay.property.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {stay.property.area && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {stay.property.area}
                </span>
              )}
              {dates && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={13} /> {dates}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <TokenReviewForm token={token} guestFirstName={stay.guestFirstName} existing={existing} />
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-dim">
          Your review appears on the {brand.name} website with the name you choose above. It takes about 20 seconds
          and helps future guests book with confidence.
        </p>
      </div>
    </main>
  );
}
