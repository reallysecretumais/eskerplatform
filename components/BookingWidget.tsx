"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Minus, Plus, MessageCircle, Bell } from "lucide-react";
import type { BusyRange } from "@/lib/data/listings";
import { NF, formatPrice } from "@/lib/listings";
import { company } from "@/lib/contact";
import { requestExternalDates } from "@/app/book/actions";
import { AccountGateModal } from "@/components/AccountGateModal";
import { enablePush, pushSupported } from "@/lib/pushClient";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function bookedSet(busy: BusyRange[]): Set<string> {
  const s = new Set<string>();
  for (const r of busy) {
    const d = new Date(`${r.start_date}T00:00:00`);
    const end = new Date(`${r.end_date}T00:00:00`);
    let g = 0;
    while (d < end && g++ < 400) {
      s.add(iso(d));
      d.setDate(d.getDate() + 1);
    }
  }
  return s;
}
const fmtDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function BookingWidget({
  id,
  title,
  price,
  unit,
  capacity,
  busy,
  bookMode = "instant",
  signedIn = false,
}: {
  id: string;
  title: string;
  price: number;
  /** The listing's own price unit ("night" | "block" | "hour"), decided by
   *  category in the DB. Never derive it here — web and app must agree. */
  unit: string;
  capacity: number | null;
  busy: BusyRange[];
  /** "request" = an EXTERNAL (resale) unit whose owner calendar we can't see
   *  right now, so we ask the owner before taking any money. */
  bookMode?: "instant" | "request";
  /** Request mode needs an account (someone to come back to) — signed-out guests
   *  get the in-place WhatsApp-code gate instead of a dead-end error. */
  signedIn?: boolean;
}) {
  const router = useRouter();
  const isNight = unit === "night";
  const booked = bookedSet(busy);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [ci, setCi] = useState<Date | null>(null);
  const [co, setCo] = useState<Date | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [qty, setQty] = useState(1);
  const [guests, setGuests] = useState(1);
  const [reserved, setReserved] = useState(false);
  const [asking, setAsking] = useState(false);
  const [askMsg, setAskMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [authed, setAuthed] = useState(signedIn);
  const [pushState, setPushState] = useState<"off" | "on" | "denied">("off");
  const showPushOffer = pushSupported();
  const ref = useRef<HTMLDivElement>(null);

  const atCurrentMonth = view.y === today.getFullYear() && view.m === today.getMonth();
  const move = (delta: number) => {
    setReserved(false);
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const rangeHasBooked = (a: Date, b: Date) => {
    const d = new Date(a);
    while (d < b) {
      if (booked.has(iso(d))) return true;
      d.setDate(d.getDate() + 1);
    }
    return false;
  };

  const pick = (d: Date) => {
    if (d < today || booked.has(iso(d))) return;
    setReserved(false);
    if (!isNight) {
      setDay(d);
      return;
    }
    if (!ci || (ci && co)) {
      setCi(d);
      setCo(null);
    } else if (d <= ci || rangeHasBooked(ci, d)) {
      setCi(d);
      setCo(null);
    } else {
      setCo(d);
    }
  };

  const nights = ci && co ? Math.round((co.getTime() - ci.getTime()) / 86400000) : 0;
  const units = isNight ? nights : qty;
  const total = units * price;
  const canReserve = isNight ? nights > 0 : Boolean(day);
  const unitLabel = formatPrice(price, unit).unit;
  const priceFmt = formatPrice(price, unit).amount;
  const totalFmt = formatPrice(total, unit).amount;

  // Calendar cells for the viewed month
  const first = new Date(view.y, view.m, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dayState = (d: number) => {
    const date = new Date(view.y, view.m, d);
    const k = iso(date);
    if (date < today || booked.has(k)) return "disabled";
    if (isNight) {
      if (ci && k === iso(ci)) return "edge";
      if (co && k === iso(co)) return "edge";
      if (ci && co && date > ci && date < co) return "in";
    } else if (day && k === iso(day)) return "edge";
    return "open";
  };

  const waText = encodeURIComponent(
    `Hi Esker! I'm interested in "${title}".${ci && co ? ` Dates: ${fmtDay(ci)}–${fmtDay(co)}.` : ""} Could you share your best price?`,
  );
  const waHref = `https://wa.me/${company.whatsapp}?text=${waText}`;

  const reserve = () => {
    if (!canReserve) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (isNight && ci && co) {
      // Resale unit we can't instant-sell: ask the owner first instead of
      // collecting payment for dates that may already be gone. (createBooking
      // refuses these server-side too — this just avoids a dead-end form.)
      if (bookMode === "request") {
        if (!authed) {
          setGateOpen(true); // create the account in place, then auto-fire
          return;
        }
        fireRequest();
        return;
      }
      router.push(`/book/${id}?checkin=${iso(ci)}&checkout=${iso(co)}&guests=${guests}`);
      return;
    }
    setReserved(true);
  };

  const fireRequest = () => {
    if (!ci || !co) return;
    setAsking(true);
    setAskMsg(null);
    const fd = new FormData();
    fd.set("propertyId", id);
    fd.set("checkin", iso(ci));
    fd.set("checkout", iso(co));
    requestExternalDates(fd)
      .then((r) => setAskMsg({ ok: r.ok, text: r.message }))
      .catch(() => setAskMsg({ ok: false, text: "Couldn't send that request. Please message us and we'll confirm for you." }))
      .finally(() => setAsking(false));
  };

  const onGateAuthed = () => {
    setAuthed(true);
    setGateOpen(false);
    router.refresh(); // nav/account state catches up in the background
    fireRequest();
  };

  return (
    <>
      <div ref={ref} id="book" className="rounded-[22px] bg-surface p-5 shadow-[0_1px_0_var(--color-line)] sm:p-6">
        <div className="flex items-baseline justify-between">
          <span className="tnum text-[24px] font-semibold tracking-[-0.01em] text-ink">
            <span className="mr-1 text-[15px] font-medium text-brand">Rs</span>
            {NF.format(price)}
          </span>
          <span className="label text-[10.5px] text-dim">/ {unitLabel}</span>
        </div>

        {/* Calendar */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => move(-1)} disabled={atCurrentMonth} className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-surface-2 disabled:opacity-30" aria-label="Previous month">
              <ChevronLeft size={18} strokeWidth={1.8} />
            </button>
            <span className="text-[15px] font-bold text-ink">{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
            <button type="button" onClick={() => move(1)} className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-surface-2" aria-label="Next month">
              <ChevronRight size={18} strokeWidth={1.8} />
            </button>
          </div>
          {/* Calendar (BUILD_REFERENCE): days in Manrope, range ends as Esker Blue
              circles, the nights between on the ice band. */}
          <div className="tnum grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAYS.map((w) => (
              <div key={w} className="label py-1 text-[10.5px] text-dim">{w}</div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const st = dayState(d);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={st === "disabled"}
                  onClick={() => pick(new Date(view.y, view.m, d))}
                  className={`mx-auto grid h-10 w-full max-w-10 place-items-center text-[13px] font-semibold transition-colors ${
                    st === "edge"
                      ? "rounded-full bg-brand text-warm"
                      : st === "in"
                        ? "max-w-none bg-ice-band text-brand-ink"
                        : st === "disabled"
                          ? "text-dim/45 line-through"
                          : "rounded-full text-ink hover:bg-surface-2"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot/hour quantity, or guests */}
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-[15px]">
          <span className="font-semibold text-ink">{isNight ? "Guests" : unit === "hour" ? "Hours" : "Blocks"}</span>
          <Stepper
            value={isNight ? guests : qty}
            min={1}
            max={isNight ? capacity ?? 12 : 24}
            onChange={isNight ? setGuests : (v) => { setQty(v); setReserved(false); }}
          />
        </div>

        {/* Total */}
        {units > 0 && (
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-sm text-muted">
              <span className="tnum">{priceFmt}</span> × <span className="tnum">{units}</span> {isNight ? (units === 1 ? "night" : "nights") : unitLabel + (units === 1 ? "" : "s")}
            </span>
            <span className="tnum text-lg font-bold text-ink">{totalFmt}</span>
          </div>
        )}

        <button
          type="button"
          onClick={reserve}
          disabled={asking}
          className="mt-5 h-[58px] w-full rounded-full bg-brand px-5 text-base font-bold text-warm transition-colors hover:bg-brand-pressed disabled:opacity-60"
        >
          {asking
            ? "Sending…"
            : canReserve
              ? bookMode === "request"
                ? "Request these dates"
                : "Reserve"
              : isNight
                ? "Select dates"
                : "Select a day"}
        </button>

        {bookMode === "request" && canReserve && !askMsg && (
          <p className="mt-2 text-center text-xs leading-relaxed text-muted">
            We&rsquo;ll confirm these dates with the owner before any payment.
          </p>
        )}
        {askMsg && (
          <p className={`mt-3 rounded-[14px] px-3 py-2.5 text-center text-[13px] leading-relaxed ${askMsg.ok ? "bg-ice-tint text-brand-ink" : "bg-red/[0.08] text-red"}`}>
            {askMsg.text}
          </p>
        )}

        {/* After a request, offer a browser heads-up — a real gesture, never on
            load. We already message + email (+ WhatsApp) them; this is extra. */}
        {askMsg?.ok && showPushOffer && (
          <button
            type="button"
            onClick={async () => {
              const r = await enablePush();
              setPushState(r === "enabled" ? "on" : r === "denied" ? "denied" : "off");
            }}
            disabled={pushState === "on"}
            className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-hi)] transition-colors hover:text-brand disabled:opacity-70"
          >
            <Bell size={13} />
            {pushState === "on"
              ? "You'll get a notification when they reply ✓"
              : pushState === "denied"
                ? "Notifications are blocked in your browser"
                : "Notify me the moment the owner replies"}
          </button>
        )}

        <AccountGateModal
          open={gateOpen}
          onClose={() => setGateOpen(false)}
          onAuthed={onGateAuthed}
          title="Confirm availability for these dates"
          subtitle="Create your account in seconds — we'll WhatsApp you a code, then ask the owner right away. No payment yet."
        />

        {reserved && (
          <div className="mt-3 rounded-[18px] bg-ice-tint p-4 text-sm text-ink">
            <p className="font-medium">Your selection</p>
            <p className="mt-1 text-muted">
              {isNight && ci && co ? `${fmtDay(ci)} – ${fmtDay(co)} · ${nights} ${nights === 1 ? "night" : "nights"} · ${guests} guests` : `${day ? fmtDay(day) : ""} · ${qty} ${unitLabel}${qty === 1 ? "" : "s"}`} · <span className="tnum font-bold text-ink">{totalFmt}</span>
            </p>
            {/* Slot/hourly checkout isn't online yet — the team locks it in on WhatsApp. */}
            {company.whatsapp ? (
              <a
                href={`https://wa.me/${company.whatsapp}?text=${encodeURIComponent(`Hi Esker! I'd like to book "${title}"${day ? ` on ${fmtDay(day)}` : ""} — ${qty} ${unitLabel}${qty === 1 ? "" : "s"} (${totalFmt}).`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-[13px] font-semibold text-warm transition-colors hover:bg-brand-pressed"
              >
                <MessageCircle size={13} /> Message us to lock this slot — replies in minutes
              </a>
            ) : (
              <p className="mt-2 text-xs text-muted">Contact us to lock this slot — your selection is noted.</p>
            )}
          </div>
        )}

        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
            <MessageCircle size={15} /> Request a price
          </a>
        )}
      </div>

      {/* Mobile sticky reserve bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line bg-bg/95 px-5 py-3 backdrop-blur lg:hidden">
        <div>
          <div className="tnum text-[17px] font-bold text-ink">{units > 0 ? totalFmt : priceFmt}</div>
          <div className="label text-[10.5px] text-dim">{units > 0 ? `${units} ${unitLabel}${units === 1 ? "" : "s"}` : `/ ${unitLabel}`}</div>
        </div>
        <button type="button" onClick={reserve} className="inline-flex h-12 items-center rounded-full bg-brand px-7 text-[15px] font-bold text-warm transition-colors hover:bg-brand-pressed">
          {canReserve ? (bookMode === "request" ? "Request" : "Reserve") : isNight ? "Select dates" : "Select a day"}
        </button>
      </div>
    </>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      {/* Stepper (BUILD_REFERENCE): minus is an outline circle, plus solid black. */}
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="grid h-9 w-9 place-items-center rounded-full text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-hi)] disabled:opacity-30" aria-label="Decrease">
        <Minus size={15} strokeWidth={2} />
      </button>
      <span className="tnum w-7 text-center text-xl font-bold text-ink">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="grid h-9 w-9 place-items-center rounded-full bg-ink text-warm disabled:opacity-30" aria-label="Increase">
        <Plus size={15} strokeWidth={2} />
      </button>
    </div>
  );
}
