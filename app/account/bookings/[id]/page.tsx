import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, FileText } from "lucide-react";
import { getMyBooking } from "@/lib/auth";
import { getMyReview } from "@/lib/data/reviews";
import { cancellationQuote } from "@/lib/payments";
import { thumb } from "@/lib/img";
import { StatusBadge } from "@/components/account/StatusBadge";
import { StatusTimeline } from "@/components/account/StatusTimeline";
import { BalancePanel } from "@/components/account/BalancePanel";
import { CancelDialog } from "@/components/account/CancelDialog";
import { ReviewForm } from "@/components/account/ReviewForm";
import { ChatEntry } from "@/components/chat/ChatEntry";

export const metadata = { title: "Booking — Esker" };

const CANCELLABLE = ["awaiting_payment", "payment_collected", "handed_over", "awaiting_checkin"];
const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—");
const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getMyBooking(id);
  if (!b) notFound();

  const photo = b.listing?.photos?.[0];
  const loc = [b.listing?.category, b.listing?.area].filter(Boolean).join(" · ");
  const activePayable = !["cancelled", "checked_out"].includes(b.status);
  const cancellable = CANCELLABLE.includes(b.status) && Boolean(b.checkin);
  const quote = b.checkin ? cancellationQuote(b.checkin, b.advancePaid) : null;
  const reviewable = b.status === "checked_out";
  const myReview = reviewable ? await getMyReview(b.id) : null;

  return (
    <div className="max-w-2xl">
      <Link href="/account/trips" className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ChevronLeft size={16} /> All trips
      </Link>

      {/* Header */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
        {photo && (
          <div className="h-40 sm:h-48" style={{ backgroundColor: "#e7e1d6", backgroundImage: `url(${thumb(photo, 900, 70)})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-ink">{b.listing?.title ?? "Your stay"}</h1>
              {loc && (
                <div className="mt-1 flex items-center gap-1 text-sm text-muted">
                  <MapPin size={13} /> {loc}
                </div>
              )}
            </div>
            <StatusBadge status={b.status} className="mt-1 shrink-0" />
          </div>
        </div>
      </div>

      {/* Dates + money */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <Row label="Check-in" value={fmt(b.checkin)} />
          <Row label="Check-out" value={fmt(b.checkout)} />
          <Row label="Nights" value={String(b.nights ?? 0)} />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <Row label="Total" value={pkr(b.amount)} />
          <Row label="Advance paid" value={pkr(b.advancePaid)} tone="green" />
          <Row label="Balance" value={b.balance > 0 ? pkr(b.balance) : "Fully paid"} tone={b.balance > 0 ? "gold" : "green"} strong />
        </div>
      </div>

      {/* Balance payment */}
      {activePayable && b.balance > 0 && (
        <div className="mt-4">
          <BalancePanel bookingId={b.id} balance={b.balance} />
        </div>
      )}

      {/* Review — completed stays only */}
      {reviewable && (
        <div className="mt-4">
          <ReviewForm bookingId={b.id} existing={myReview} />
        </div>
      )}

      {/* Timeline */}
      <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 font-display text-base font-semibold tracking-tight text-ink">Status</h2>
        <StatusTimeline status={b.status} />
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <ChatEntry label="Message us about this booking" bookingId={b.id} />
        <Link href={`/account/bookings/${b.id}/receipt`} className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
          <FileText size={15} /> View receipt
        </Link>
        {cancellable && quote && (
          <div className="ml-auto">
            <CancelDialog bookingId={b.id} refund={quote.refund} retained={quote.retained} label={quote.label} />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, tone, strong }: { label: string; value: string; tone?: "green" | "gold"; strong?: boolean }) {
  const color = tone === "green" ? "text-green" : tone === "gold" ? "text-gold-deep" : "text-ink";
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`tabular-nums ${color} ${strong ? "font-display font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
