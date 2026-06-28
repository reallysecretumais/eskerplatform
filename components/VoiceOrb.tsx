"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

// The voice centerpiece. A gold orb + halo + two rings that breathe with the
// conversation: it pulses with the guest's live mic level while listening, and
// with a gentle cadence while thinking/speaking. Animated by mutating transform/
// opacity inside one requestAnimationFrame loop (no React re-renders, GPU-only),
// so it holds 60fps and never janks. Reads the live level from a ref the parent
// updates from the audio analyser.
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
      // listening + speaking are driven by the live audio level (mic / voice);
      // thinking + idle use a gentle synthetic cadence.
      if (s === "listening" || s === "speaking") target = Math.min(1, levelRef.current);
      else if (s === "thinking") target = 0.26 + 0.14 * (0.5 + 0.5 * Math.sin(t * 3));
      else target = 0.12 + 0.07 * (0.5 + 0.5 * Math.sin(t * 1.4)); // idle breathe
      // ease toward target so mic spikes feel organic, not twitchy
      smooth += (target - smooth) * 0.18;

      if (core.current) core.current.style.transform = `scale(${1 + smooth * 0.42})`;
      if (halo.current) halo.current.style.opacity = String(0.35 + smooth * 0.6);
      if (ring1.current) {
        ring1.current.style.transform = `scale(${1.05 + smooth * 0.5})`;
        ring1.current.style.opacity = String(0.5 - smooth * 0.35);
      }
      if (ring2.current) {
        ring2.current.style.transform = `scale(${1.18 + smooth * 0.9})`;
        ring2.current.style.opacity = String(0.32 - smooth * 0.26);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <div className="relative grid h-44 w-44 place-items-center sm:h-56 sm:w-56">
      {/* soft outer halo */}
      <div
        ref={halo}
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.85), rgba(201,168,76,0) 70%)" }}
      />
      {/* expanding rings */}
      <div ref={ring2} className="absolute h-36 w-36 rounded-full border border-gold/25 sm:h-44 sm:w-44" />
      <div ref={ring1} className="absolute h-36 w-36 rounded-full border border-gold/40 sm:h-44 sm:w-44" />
      {/* core orb */}
      <div
        ref={core}
        className="relative h-28 w-28 rounded-full sm:h-32 sm:w-32"
        style={{
          background: "radial-gradient(circle at 36% 30%, #fffaf0 0%, #f0dca0 26%, #d4b25c 58%, #a9883a 100%)",
          boxShadow: "0 0 70px 14px rgba(201,168,76,0.45), 0 0 30px 4px rgba(201,168,76,0.5), inset 0 3px 18px rgba(255,255,255,0.7), inset 0 -8px 22px rgba(120,90,30,0.45)",
          willChange: "transform",
        }}
      />
    </div>
  );
}
