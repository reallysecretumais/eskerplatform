import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import type { MyBooking } from "@/lib/auth";
import { thumb } from "@/lib/img";
import { StatusBadge } from "@/components/account/StatusBadge";
import { rs } from "@/lib/listings";

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");


function countdown(checkin: string | null, status: string): string {
  if (status === "currently_staying") return "You're staying now";
  if (!checkin) return "";
  const days = Math.round((new Date(`${checkin}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
  if (days < 0) return "";
  if (days === 0) return "Check-in today";
  if (days === 1) return "Check-in tomorrow";
  return `Check-in in ${days} days`;
}

// The soonest upcoming stay, front and centre — photo, countdown, balance.
export function NextTripCard({ booking }: { booking: MyBooking }) {
  const photo = booking.listing?.photos?.[0];
  const loc = [booking.listing?.category, booking.listing?.area].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/account/bookings/${booking.id}`}
      className="group block overflow-hidden rounded-[22px] border border-line bg-surface transition hover:border-line-hi"
    >
      <div className="relative h-44 bg-surface-2 sm:h-52" style={{ backgroundImage: photo ? `url(${thumb(photo, 900, 70)})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 bg-ink/35" />
        <div className="tnum absolute left-4 top-4 rounded-full bg-ink/45 px-3 py-1 text-xs font-semibold text-warm shadow-[inset_0_0_0_1px_rgba(244,243,239,0.3)] backdrop-blur">
          {countdown(booking.checkin, booking.status)}
        </div>
        <div className="absolute inset-x-4 bottom-3 text-warm [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
          <div className="text-lg font-bold leading-tight">{booking.listing?.title ?? "Your stay"}</div>
          {loc && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-veil">
              <MapPin size={12} /> {loc}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <div className="tnum text-sm text-ink">
            {fmt(booking.checkin)} – {fmt(booking.checkout)} · {booking.nights ?? 0} {booking.nights === 1 ? "night" : "nights"}
          </div>
          <div className="mt-0.5">
            <StatusBadge status={booking.status} />
          </div>
        </div>
        <div className="text-right">
          {booking.balance > 0 ? (
            <>
              <div className="label text-[11px] text-dim">Balance</div>
              <div className="tnum text-base font-bold text-brand">{rs(booking.balance)}</div>
            </>
          ) : (
            <div className="text-xs font-medium text-green">Fully paid</div>
          )}
          <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted transition group-hover:text-ink">
            Details <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
}
