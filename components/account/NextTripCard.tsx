import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import type { MyBooking } from "@/lib/auth";
import { thumb } from "@/lib/img";
import { StatusBadge } from "@/components/account/StatusBadge";

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;

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
      className="group block overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-line-hi hover:shadow-lg"
    >
      <div className="relative h-44 sm:h-52" style={{ backgroundColor: "#e7e1d6", backgroundImage: photo ? `url(${thumb(photo, 900, 70)})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          {countdown(booking.checkin, booking.status)}
        </div>
        <div className="absolute inset-x-4 bottom-3 text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
          <div className="font-display text-lg font-semibold leading-tight">{booking.listing?.title ?? "Your stay"}</div>
          {loc && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-white/85">
              <MapPin size={12} /> {loc}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <div className="text-sm text-ink">
            {fmt(booking.checkin)} – {fmt(booking.checkout)} · {booking.nights ?? 0} {booking.nights === 1 ? "night" : "nights"}
          </div>
          <div className="mt-0.5">
            <StatusBadge status={booking.status} />
          </div>
        </div>
        <div className="text-right">
          {booking.balance > 0 ? (
            <>
              <div className="text-[11px] uppercase tracking-wider text-dim">Balance</div>
              <div className="font-display text-base font-semibold text-gold-deep tabular-nums">{pkr(booking.balance)}</div>
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
