"use client";

import { useRef, useState, useCallback } from "react";

// Draggable / tappable 5-star rating, snapped to 0.25 (so 4, 4.5, 4.75 are all
// reachable). One continuous gold fill sweeps across via clip-path, so base +
// fill stay pixel-aligned.
//
// ⚠️ The stars are FIXED-SIZE on purpose. They used to be fluid (`flex-1` +
// `aspect-square` inside `w-full`), which silently collapsed to 0×0 — and so
// rendered NOTHING but the number — whenever a parent was shrink-to-fit (a
// centered flex column, a grid cell, a narrow wrapper). That shipped to the
// guest review page. A rating control must never depend on its parent giving it
// width; if you make it fluid again, give it a real min-width.
const SNAP = 0.25;
const snap = (v: number) => Math.min(5, Math.max(0, Math.round(v / SNAP) * SNAP));

export function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  const fromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const { left, width } = el.getBoundingClientRect();
    const ratio = (clientX - left) / width;
    // Bias by half a snap so tapping the middle of a star lands on the round value.
    return snap(ratio * 5 + SNAP / 2);
  }, []);

  const onMove = (e: React.PointerEvent) => setHover(fromClientX(e.clientX));
  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onChange(fromClientX(e.clientX));
  };
  const onUp = () => setHover(null);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(snap(Math.max(SNAP, value - SNAP))); }
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(snap(Math.min(5, value + SNAP))); }
    else if (e.key === "Home") { e.preventDefault(); onChange(SNAP); }
    else if (e.key === "End") { e.preventDefault(); onChange(5); }
  };

  const pct = (shown / 5) * 100;

  return (
    <div className="flex w-full select-none flex-col items-center gap-2.5">
      <div
        ref={ref}
        role="slider"
        aria-label="Your rating out of 5"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value}
        aria-valuetext={`${value} out of 5`}
        tabIndex={0}
        onPointerDown={onDown}
        onPointerMove={(e) => { if (hover !== null || e.buttons > 0) onMove(e); }}
        onPointerEnter={onMove}
        onPointerLeave={onUp}
        onPointerUp={onUp}
        onKeyDown={onKey}
        className="relative inline-block cursor-pointer rounded-lg py-1 outline-none ring-gold/40 focus-visible:ring-2"
        style={{ touchAction: "none" }}
      >
        {/* base (empty) */}
        <StarRow className="text-line-hi" />
        {/* gold fill, revealed from the left to the current value */}
        <div className="pointer-events-none absolute inset-0 py-1" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
          <StarRow className="text-gold" filled />
        </div>
      </div>

      {shown > 0 ? (
        <span className="font-display text-3xl font-semibold text-ink tabular-nums" aria-hidden>
          {shown.toFixed(2).replace(/\.?0+$/, "")}
        </span>
      ) : (
        <span className="text-xs text-dim" aria-hidden>
          Tap a star to rate
        </span>
      )}
    </div>
  );
}

// A row of 5 FIXED-SIZE stars drawn as inline SVG so the fill layer lines up
// exactly with the base layer. Explicit width/height (not flex-1/aspect-square)
// so the row has an intrinsic size in ANY parent — see the warning above.
function StarRow({ className, filled }: { className: string; filled?: boolean }) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={44}
          height={44}
          className="h-11 w-11 shrink-0"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinejoin="round"
        >
          <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.4l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z" />
        </svg>
      ))}
    </div>
  );
}
