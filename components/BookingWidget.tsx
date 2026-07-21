"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Minus, Plus, MessageCircle } from "lucide-react";
import type { BusyRange } from "@/lib/data/listings";
import { formatPrice, type BookingUnit } from "@/lib/listings";
import { brand } from "@/lib/brand";
import { requestExternalDates } from "@/app/book/actions";

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
}: {
  id: string;
  title: string;
  price: number;
  unit: BookingUnit;
  capacity: number | null;
  busy: BusyRange[];
  /** "request" = an EXTERNAL (resale) unit whose owner calendar we can't see
   *  right now, so we ask the owner before taking any money. */
  bookMode?: "instant" | "request";
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
  const waHref = brand.whatsapp ? `https://wa.me/${brand.whatsapp}?text=${waText}` : null;

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
        return;
      }
      router.push(`/book/${id}?checkin=${iso(ci)}&checkout=${iso(co)}&guests=${guests}`);
      return;
    }
    setReserved(true);
  };

  return (
    <>
      <div ref={ref} id="book" className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-xl font-semibold text-ink tnum">{priceFmt}</span>
          <span className="text-xs text-dim">per {unitLabel}</span>
        </div>

        {/* Calendar */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => move(-1)} disabled={atCurrentMonth} className="rounded-md p-1 text-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-ink">{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
            <button type="button" onClick={() => move(1)} className="rounded-md p-1 text-muted hover:bg-surface-2" aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-[11px] text-dim">{w}</div>
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
                  className={`h-8 rounded-md text-[13px] transition ${
                    st === "edge"
                      ? "bg-ink font-medium text-white"
                      : st === "in"
                        ? "bg-gold/15 text-ink"
                        : st === "disabled"
                          ? "text-dim/40 line-through"
                          : "text-ink hover:bg-surface-2"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot/hour quantity, or guests */}
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-sm">
          <span className="text-muted">{isNight ? "Guests" : unit === "hour" ? "Hours" : "Slots"}</span>
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
              {priceFmt} × {units} {isNight ? (units === 1 ? "night" : "nights") : unitLabel + (units === 1 ? "" : "s")}
            </span>
            <span className="font-display text-lg font-semibold text-ink tnum">{totalFmt}</span>
          </div>
        )}

        <button
          type="button"
          onClick={reserve}
          disabled={asking}
          className="mt-4 w-full rounded-xl bg-gold px-5 py-3 text-sm font-medium text-ink transition hover:brightness-105 disabled:opacity-60"
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
          <p className={`mt-2 rounded-lg border px-3 py-2 text-center text-xs leading-relaxed ${askMsg.ok ? "border-green/40 bg-green/[0.06] text-green" : "border-red/40 bg-red/[0.06] text-red"}`}>
            {askMsg.text}
          </p>
        )}

        {reserved && (
          <div className="mt-3 rounded-xl border border-gold/30 bg-gold/[0.06] p-3 text-sm text-ink">
            <p className="font-medium">Your selection</p>
            <p className="mt-1 text-muted">
              {isNight && ci && co ? `${fmtDay(ci)} – ${fmtDay(co)} · ${nights} ${nights === 1 ? "night" : "nights"} · ${guests} guests` : `${day ? fmtDay(day) : ""} · ${qty} ${unitLabel}${qty === 1 ? "" : "s"}`} · <span className="font-medium text-ink">{totalFmt}</span>
            </p>
            {/* Slot/hourly checkout isn't online yet — the team locks it in on WhatsApp. */}
            {brand.whatsapp ? (
              <a
                href={`https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(`Hi Esker! I'd like to book "${title}"${day ? ` on ${fmtDay(day)}` : ""} — ${qty} ${unitLabel}${qty === 1 ? "" : "s"} (${totalFmt}).`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-medium text-white transition hover:opacity-90"
              >
                <MessageCircle size={13} /> Message us to lock this slot — replies in minutes
              </a>
            ) : (
              <p className="mt-2 text-xs text-muted">Contact us to lock this slot — your selection is noted.</p>
            )}
          </div>
        )}

        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted hover:text-ink">
            <MessageCircle size={15} /> Request a price
          </a>
        )}
      </div>

      {/* Mobile sticky reserve bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line bg-bg/95 px-5 py-3 backdrop-blur lg:hidden">
        <div>
          <div className="font-display text-base font-semibold text-ink tnum">{units > 0 ? totalFmt : priceFmt}</div>
          <div className="text-[11px] text-dim">{units > 0 ? `${units} ${unitLabel}${units === 1 ? "" : "s"}` : `per ${unitLabel}`}</div>
        </div>
        <button type="button" onClick={reserve} className="rounded-xl bg-gold px-6 py-2.5 text-sm font-medium text-ink transition hover:brightness-105">
          {canReserve ? "Reserve" : "Select dates"}
        </button>
      </div>
    </>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="rounded-full border border-line p-1 text-ink disabled:opacity-30" aria-label="Decrease">
        <Minus size={14} />
      </button>
      <span className="w-5 text-center text-sm tnum text-ink">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="rounded-full border border-line p-1 text-ink disabled:opacity-30" aria-label="Increase">
        <Plus size={14} />
      </button>
    </div>
  );
}
