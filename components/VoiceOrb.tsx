"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

// The voice "entity" — a luminous gold sphere. Built for SPEED: every animation
// is a GPU-composited CSS transform/opacity (no SVG SMIL, no `filter: blur()`, no
// blend modes, no backdrop-filter), so it holds 60fps even on phones. It's also
// perfectly circular everywhere — the sphere is one round div with NO square-able
// layers, and the glow is a radial gradient (not a blur filter). One rAF loop
// scales the sphere + brightens the glow from the LIVE audio level and adds a
// quick "heard you" pop when `pulseRef` is bumped.
export function VoiceOrb({
  levelRef,
  state,
  pulseRef,
}: {
  levelRef: MutableRefObject<number>;
  state: OrbState;
  pulseRef?: MutableRefObject<number>;
}) {
  const stateRef = useRef<OrbState>(state);
  stateRef.current = state;

  const core = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  const ring1 = useRef<HTMLDivElement>(null);
  const ring2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    const tick = () => {
      const now = performance.now();
      const t = now / 1000;
      const s = stateRef.current;
      let target: number;
      if (s === "listening" || s === "speaking") target = Math.min(1, levelRef.current);
      else if (s === "thinking") target = 0.3 + 0.16 * (0.5 + 0.5 * Math.sin(t * 3.2));
      else target = 0.14 + 0.08 * (0.5 + 0.5 * Math.sin(t * 1.4)); // idle breathe
      if (pulseRef) {
        const since = now - pulseRef.current;
        if (since >= 0 && since < 450) target += (1 - since / 450) * 0.5; // "heard you" pop
      }
      target = Math.min(1.25, target);
      smooth += (target - smooth) * 0.18;

      if (core.current) core.current.style.transform = `scale(${1 + smooth * 0.3})`;
      if (halo.current) halo.current.style.opacity = String(0.4 + smooth * 0.5);
      if (ring1.current) {
        ring1.current.style.transform = `scale(${1 + smooth * 0.16})`;
        ring1.current.style.opacity = String(0.5 - smooth * 0.3);
      }
      if (ring2.current) {
        ring2.current.style.transform = `scale(${1 + smooth * 0.32})`;
        ring2.current.style.opacity = String(0.28 - smooth * 0.22);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef, pulseRef]);

  return (
    <div className="relative grid h-44 w-44 place-items-center sm:h-56 sm:w-56">
      {/* glow — radial gradient, no blur filter (circular, cheap) */}
      <div
        ref={halo}
        className="pointer-events-none absolute rounded-full"
        style={{ inset: "-42%", background: "radial-gradient(circle, rgba(201,168,76,0.45) 0%, rgba(201,168,76,0.15) 32%, rgba(201,168,76,0) 62%)" }}
      />

      {/* reactive rings */}
      <div ref={ring2} className="pointer-events-none absolute rounded-full border border-gold/25" style={{ inset: "3%" }} />
      <div ref={ring1} className="pointer-events-none absolute rounded-full border border-gold/40" style={{ inset: "12%" }} />

      {/* orbiting motes — single GPU-rotated container (smooth, no SMIL) */}
      <div className="orb-spin pointer-events-none absolute inset-0" style={{ willChange: "transform" }}>
        <span className="absolute left-1/2 top-[1%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-gold" style={{ boxShadow: "0 0 10px 3px rgba(201,168,76,0.55)" }} />
        <span className="absolute left-[5%] top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-gold/80" />
      </div>

      {/* the sphere — one round div, lit for 3D depth */}
      <div
        ref={core}
        className="relative h-[62%] w-[62%] overflow-hidden rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 24%), radial-gradient(circle at 38% 32%, #fff6da 0%, #eccf86 30%, #c89f48 66%, #7e5f27 100%)",
          boxShadow: "0 0 50px 6px rgba(201,168,76,0.5), inset 0 8px 18px rgba(255,248,220,0.5), inset 0 -16px 28px rgba(74,54,18,0.6)",
          willChange: "transform",
        }}
      >
        {/* one soft drifting highlight for life — circular, no filter/blend */}
        <div className="orb-drift1 absolute rounded-full" style={{ inset: "14%", background: "radial-gradient(circle at 42% 38%, rgba(255,249,228,0.6), rgba(255,249,228,0) 60%)", willChange: "transform" }} />
      </div>
    </div>
  );
}
