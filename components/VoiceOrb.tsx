"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

// The voice "entity" — a living, molten-gold sphere and the signature of the
// product. Internal plasma drifts, a sheen rotates, and particles orbit (all
// via CSS, GPU-only). On top of that, one requestAnimationFrame loop scales the
// sphere and brightens its glow from the LIVE audio level (mic while listening,
// the actual voice while speaking) — so it visibly breathes with the
// conversation at 60fps, no React re-renders.
export function VoiceOrb({
  levelRef,
  state,
}: {
  levelRef: MutableRefObject<number>;
  state: OrbState;
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
      const t = performance.now() / 1000;
      const s = stateRef.current;
      let target: number;
      // listening + speaking ride the live audio level; thinking + idle use a
      // gentle synthetic cadence so the entity always feels alive.
      if (s === "listening" || s === "speaking") target = Math.min(1, levelRef.current);
      else if (s === "thinking") target = 0.3 + 0.16 * (0.5 + 0.5 * Math.sin(t * 3.2));
      else target = 0.14 + 0.08 * (0.5 + 0.5 * Math.sin(t * 1.4)); // idle breathe
      smooth += (target - smooth) * 0.18;

      if (core.current) core.current.style.transform = `scale(${1 + smooth * 0.34})`;
      if (halo.current) halo.current.style.opacity = String(0.4 + smooth * 0.55);
      if (ring1.current) {
        ring1.current.style.transform = `scale(${1.04 + smooth * 0.45})`;
        ring1.current.style.opacity = String(0.5 - smooth * 0.32);
      }
      if (ring2.current) {
        ring2.current.style.transform = `scale(${1.16 + smooth * 0.85})`;
        ring2.current.style.opacity = String(0.3 - smooth * 0.24);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <div className="relative grid h-48 w-48 place-items-center sm:h-60 sm:w-60">
      {/* reactive halo */}
      <div
        ref={halo}
        className="absolute inset-3 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.75), rgba(201,168,76,0) 68%)" }}
      />

      {/* reactive rings */}
      <div ref={ring2} className="absolute h-40 w-40 rounded-full border border-gold/20 sm:h-52 sm:w-52" />
      <div ref={ring1} className="absolute h-40 w-40 rounded-full border border-gold/35 sm:h-52 sm:w-52" />

      {/* orbiting particles */}
      <div className="orb-spin pointer-events-none absolute h-44 w-44 sm:h-56 sm:w-56">
        <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-gold shadow-[0_0_10px_3px_rgba(201,168,76,0.65)]" />
        <span className="absolute left-0 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-gold/80 shadow-[0_0_8px_2px_rgba(201,168,76,0.5)]" />
      </div>

      {/* the sphere — molten gold, alive */}
      <div
        ref={core}
        className="relative h-32 w-32 overflow-hidden rounded-full sm:h-40 sm:w-40"
        style={{
          boxShadow: "0 0 80px 16px rgba(201,168,76,0.4), 0 0 34px 6px rgba(201,168,76,0.45)",
          willChange: "transform",
        }}
      >
        {/* base molten tone */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 52%, #dcbd68 0%, #b1913f 64%, #7c5f24 100%)" }} />
        {/* drifting plasma */}
        <div className="orb-drift1 absolute -inset-5 rounded-full blur-2xl" style={{ background: "radial-gradient(circle at 36% 30%, #fff4d2, transparent 55%)" }} />
        <div className="orb-drift2 absolute -inset-5 rounded-full blur-2xl" style={{ background: "radial-gradient(circle at 70% 74%, #8a6a2a, transparent 55%)" }} />
        {/* rotating sheen */}
        <div
          className="orb-spin-slow absolute inset-0 opacity-30 mix-blend-screen"
          style={{ background: "conic-gradient(from 0deg, transparent, rgba(255,246,214,0.7), transparent 38%, transparent 62%, rgba(255,246,214,0.45), transparent)" }}
        />
        {/* specular highlight (glass sphere) */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 34% 27%, rgba(255,255,255,0.9), transparent 38%)" }} />
        {/* rim depth */}
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: "inset 0 2px 12px rgba(255,255,255,0.55), inset 0 -12px 28px rgba(85,62,18,0.6)" }} />
      </div>
    </div>
  );
}
