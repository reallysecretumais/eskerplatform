"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { blockDates, unblockDates } from "@/app/host/actions";
import type { CalendarBooking, CalendarBlock } from "@/lib/data/host";

// The host's availability calendar. Bookings show read-only (gold); the host
// taps two free days to block a range (first tap = start, second = end night),
// and taps a blocked range to open it up again. End dates are exclusive,
// checkout-style, so "block 12–14" keeps the 14th free.

const day = (iso: string) => new Date(`${iso}T00:00:00`);
const iso = (d: Date) => d.toLocaleDateString("en-CA");
const addDays = (isoStr: string, n: number) => { const d = day(isoStr); d.setDate(d.getDate() + n); return iso(d); };
const fmtShort = (isoStr: string) => day(isoStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function AvailabilityCalendar({
  listingId,
  bookings,
  blocks,
}: {
  listingId: string;
  bookings: CalendarBooking[];
  blocks: CalendarBlock[];
}) {
  const today = iso(new Date());
  const [month, setMonth] = useState(() => today.slice(0, 7)); // YYYY-MM
  const [selStart, setSelStart] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ start: string; end: string } | null>(null); // end exclusive
  const [unblock, setUnblock] = useState<CalendarBlock | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const bookedDays = useMemo(() => rangesToDays(bookings), [bookings]);
  const blockByDay = useMemo(() => {
    const m = new Map<string, CalendarBlock>();
    for (const b of blocks) for (let d = b.start; d < b.end; d = addDays(d, 1)) m.set(d, b);
    return m;
  }, [blocks]);

  const grid = useMemo(() => monthGrid(month), [month]);
  const monthLabel = day(`${month}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const tap = (d: string) => {
    setMsg(null);
    if (d < today) return;
    const blk = blockByDay.get(d);
    if (blk) { setUnblock(blk); setConfirm(null); setSelStart(null); return; }
    if (bookedDays.has(d)) return;

    if (!selStart) { setSelStart(d); setConfirm(null); return; }
    // Second tap: the tapped day is the LAST blocked night → end is exclusive +1.
    const [s, e] = selStart <= d ? [selStart, addDays(d, 1)] : [d, addDays(selStart, 1)];
    // A range crossing a booked day is invalid — keep it simple: reject.
    for (let x = s; x < e; x = addDays(x, 1)) {
      if (bookedDays.has(x) || blockByDay.has(x)) {
        setMsg({ ok: false, text: "That range crosses booked or blocked dates — pick a free stretch." });
        setSelStart(null);
        return;
      }
    }
    setConfirm({ start: s, end: e });
    setSelStart(null);
  };

  const doBlock = () =>
    start(async () => {
      if (!confirm) return;
      const res = await blockDates(listingId, confirm.start, confirm.end);
      setMsg({ ok: res.ok, text: res.message });
      setConfirm(null);
      if (res.ok) router.refresh();
    });

  const doUnblock = () =>
    start(async () => {
      if (!unblock) return;
      const res = await unblockDates(listingId, unblock.id);
      setMsg({ ok: res.ok, text: res.message });
      setUnblock(null);
      if (res.ok) router.refresh();
    });

  const shift = (n: number) => {
    const d = day(`${month}-01`);
    d.setMonth(d.getMonth() + n);
    setMonth(iso(d).slice(0, 7));
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">Availability</h2>
        <span className="text-xs text-dim">Tap two free days to block them</span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-ink">{monthLabel}</span>
        <button type="button" onClick={() => shift(1)} className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} className="pb-1 text-[10px] font-medium uppercase tracking-wider text-dim">{d}</div>
        ))}
        {grid.map((d, i) =>
          d === null ? (
            <div key={`x${i}`} />
          ) : (
            <DayCell
              key={d}
              date={d}
              past={d < today}
              booked={bookedDays.has(d)}
              blocked={blockByDay.has(d)}
              selected={selStart === d || (confirm != null && d >= confirm.start && d < confirm.end)}
              onTap={() => tap(d)}
            />
          ),
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-dim">
        <Legend cls="bg-gold/25" label="Booked" />
        <Legend cls="bg-surface-2 line-through-dim" label="Blocked by you" strike />
        <Legend cls="ring-1 ring-gold" label="Selecting" />
      </div>

      {selStart && !confirm && (
        <p className="mt-3 text-sm text-muted">
          Blocking from <span className="font-medium text-ink">{fmtShort(selStart)}</span> — tap the last night to finish
          <button type="button" onClick={() => setSelStart(null)} className="ml-2 text-xs text-dim underline">cancel</button>
        </p>
      )}

      {confirm && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
          <span className="text-sm text-ink">
            Block <span className="font-medium">{fmtShort(confirm.start)} – {fmtShort(addDays(confirm.end, -1))}</span>?
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink">Cancel</button>
            <button type="button" onClick={doBlock} disabled={pending} className="rounded-lg bg-ink px-3.5 py-1.5 text-xs font-medium text-bg transition hover:opacity-90 disabled:opacity-60">
              {pending ? "Blocking…" : "Block dates"}
            </button>
          </div>
        </div>
      )}

      {unblock && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-4 py-3">
          <span className="text-sm text-ink">
            Open up <span className="font-medium">{fmtShort(unblock.start)} – {fmtShort(addDays(unblock.end, -1))}</span>?
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => setUnblock(null)} className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink">Keep blocked</button>
            <button type="button" onClick={doUnblock} disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-ink px-3.5 py-1.5 text-xs font-medium text-bg transition hover:opacity-90 disabled:opacity-60">
              <X size={12} /> {pending ? "Opening…" : "Unblock"}
            </button>
          </div>
        </div>
      )}

      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green" : "text-red"}`}>{msg.text}</p>}
    </div>
  );
}

function DayCell({ date, past, booked, blocked, selected, onTap }: { date: string; past: boolean; booked: boolean; blocked: boolean; selected: boolean; onTap: () => void }) {
  const n = Number(date.slice(8, 10));
  const base = "aspect-square rounded-lg text-[12px] tabular-nums transition select-none";
  if (past) return <div className={`${base} grid place-items-center text-line-hi`}>{n}</div>;
  if (booked) return <div className={`${base} grid place-items-center bg-gold/25 font-medium text-gold-deep`} title="Booked">{n}</div>;
  return (
    <button
      type="button"
      onClick={onTap}
      className={`${base} grid place-items-center ${
        blocked
          ? "bg-surface-2 text-dim line-through hover:bg-surface-2/70"
          : selected
            ? "bg-gold/10 text-ink ring-1 ring-gold"
            : "text-ink hover:bg-surface-2"
      }`}
      title={blocked ? "Blocked by you — tap to open" : "Tap to start a block"}
    >
      {n}
    </button>
  );
}

function Legend({ cls, label, strike }: { cls: string; label: string; strike?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${cls}`} />
      <span className={strike ? "line-through" : ""}>{label}</span>
    </span>
  );
}

function rangesToDays(ranges: { start: string; end: string }[]): Set<string> {
  const s = new Set<string>();
  for (const r of ranges) for (let d = r.start; d < r.end; d = addDays(d, 1)) s.add(d);
  return s;
}

/** Monday-first month grid; null = leading blank cells. */
function monthGrid(month: string): (string | null)[] {
  const first = day(`${month}-01`);
  const lead = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  return cells;
}
