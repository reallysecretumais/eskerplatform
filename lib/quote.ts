/**
 * What a stay costs — the ONE pricing calculation for every booking mode and
 * both faces (website checkout and the mobile app).
 *
 * Why this module exists: nightly pricing was computed inline in
 * `app/book/[id]/page.tsx` AND again in `createBooking`. Adding day-use blocks
 * and hourly windows would have made that three places × three modes, which is
 * how a guest ends up seeing one price and being charged another. Everything
 * prices here now.
 *
 * Pure and side-effect free (no DB, no clock beyond what's passed in) so it can
 * run on the server for a quote, again for the authoritative charge, and be unit
 * reasoned about. The CALLER supplies the listing's price and mode from
 * `public_listings` — never trust a client for either.
 */
import { advanceAmount, advanceLabel, advancePct } from "@/lib/payments";

export type QuoteMode = "nightly" | "blocks" | "hourly";

export type QuoteRequest =
  | { mode: "nightly"; price: number; exclusive: boolean; checkin: string; checkout: string }
  | { mode: "blocks"; price: number; exclusive: boolean; date: string; blockPrice: number; blockLabel: string; startTime: string; endTime: string }
  | { mode: "hourly"; price: number; exclusive: boolean; date: string; startTime: string; hours: number; minHours: number };

export type Quote = {
  mode: QuoteMode;
  /** Units charged: nights, 1 block, or N hours. */
  units: number;
  unitLabel: string;
  unitPrice: number;
  total: number;
  advance: number;
  balance: number;
  advancePct: number;
  /** "50%" / "25%" / "minimum" / "full amount" — honest about the floor. */
  advanceNote: string;
  /** Human summary of WHEN, e.g. "Sat 16 Aug, 3–7pm" or "14–16 Aug · 2 nights". */
  when: string;
  /** ISO timestamps for slotted bookings; null for nightly (which uses dates). */
  startsAt: string | null;
  endsAt: string | null;
};

export type QuoteError = { error: string; message: string };

/** Whole nights between two ISO dates (checkout exclusive). */
export function nightsBetween(checkin: string, checkout: string): number {
  const a = new Date(`${checkin}T00:00:00`);
  const b = new Date(`${checkout}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

const money = (n: number) => Math.max(0, Math.round(n));

// Pakistan runs a single offset year-round (UTC+5, no DST), so a local wall-clock
// time maps to an instant without a timezone database. Keeping it explicit here
// means a slot booked for "3pm" is 3pm in Islamabad no matter where the server is.
const PK_OFFSET = "+05:00";
const pkInstant = (date: string, time: string) => new Date(`${date}T${normalizeTime(time)}${PK_OFFSET}`);

/** "15:00" | "15:00:00" → "15:00:00". */
function normalizeTime(t: string): string {
  const parts = t.split(":");
  const [h = "00", m = "00", s = "00"] = parts;
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
}

const DAY = { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Karachi" } as const;

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-GB", DAY);
}

/** 15:00 → "3pm", 15:30 → "3:30pm" — how a person says a time. */
function fmtClock(time: string): string {
  const [hStr, mStr] = normalizeTime(time).split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

/**
 * Price a booking, or explain why it can't be priced. Validation lives here
 * alongside the maths so no caller can price something it should have rejected.
 */
export function quote(req: QuoteRequest): Quote | QuoteError {
  if (req.mode === "nightly") {
    const nights = nightsBetween(req.checkin, req.checkout);
    if (!Number.isFinite(nights) || nights < 1) {
      return { error: "bad_dates", message: "Your stay must be at least one night." };
    }
    const unitPrice = money(req.price);
    const total = money(unitPrice * nights);
    return finish({
      mode: "nightly",
      units: nights,
      unitLabel: "night",
      unitPrice,
      total,
      exclusive: req.exclusive,
      when: `${req.checkin} → ${req.checkout} · ${nights} ${nights === 1 ? "night" : "nights"}`,
      startsAt: null,
      endsAt: null,
    });
  }

  if (req.mode === "blocks") {
    const start = pkInstant(req.date, req.startTime);
    let end = pkInstant(req.date, req.endTime);
    // A block ending at or before its start runs past midnight (e.g. 8pm–12am),
    // so it belongs to the evening it began.
    if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 86_400_000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { error: "bad_slot", message: "That time doesn't look right. Please pick a slot again." };
    }
    const unitPrice = money(req.blockPrice);
    if (unitPrice <= 0) return { error: "bad_slot", message: "That slot isn't bookable right now." };
    return finish({
      mode: "blocks",
      units: 1,
      unitLabel: "block",
      unitPrice,
      total: unitPrice,
      exclusive: req.exclusive,
      when: `${fmtDay(start)}, ${req.blockLabel} · ${fmtClock(req.startTime)}–${fmtClock(req.endTime)}`,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    });
  }

  // hourly
  const hours = Math.floor(req.hours);
  const min = Math.max(1, Math.floor(req.minHours || 1));
  if (!Number.isFinite(hours) || hours < min) {
    return { error: "below_minimum", message: `This space books for at least ${min} ${min === 1 ? "hour" : "hours"}.` };
  }
  const start = pkInstant(req.date, req.startTime);
  if (Number.isNaN(start.getTime())) {
    return { error: "bad_slot", message: "That start time doesn't look right." };
  }
  const end = new Date(start.getTime() + hours * 3_600_000);
  const unitPrice = money(req.price);
  if (unitPrice <= 0) return { error: "bad_slot", message: "This space isn't bookable right now." };
  const total = money(unitPrice * hours);
  return finish({
    mode: "hourly",
    units: hours,
    unitLabel: "hour",
    unitPrice,
    total,
    exclusive: req.exclusive,
    when: `${fmtDay(start)} · ${fmtClock(req.startTime)} for ${hours} ${hours === 1 ? "hour" : "hours"}`,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  });
}

/** Shared tail: the advance rules are identical for every mode. */
function finish(p: {
  mode: QuoteMode;
  units: number;
  unitLabel: string;
  unitPrice: number;
  total: number;
  exclusive: boolean;
  when: string;
  startsAt: string | null;
  endsAt: string | null;
}): Quote {
  const advance = advanceAmount(p.total, p.exclusive);
  return {
    mode: p.mode,
    units: p.units,
    unitLabel: p.unitLabel,
    unitPrice: p.unitPrice,
    total: p.total,
    advance,
    balance: Math.max(0, p.total - advance),
    advancePct: advancePct(p.exclusive),
    advanceNote: advanceLabel(p.total, p.exclusive),
    when: p.when,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
  };
}

export const isQuoteError = (q: Quote | QuoteError): q is QuoteError => "error" in q;
