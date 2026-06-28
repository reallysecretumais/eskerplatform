"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

// The voice "entity" — a luminous gold sphere, the signature of the product.
// Built to be PERFECTLY circular on every browser (incl. iOS Safari): every
// layer is either the sphere itself or a `rounded-full` circle, and the glow is
// a radial gradient — NOT a `filter: blur()` (large blurs clip to a square
// bounding box and leak a visible rectangle, which is what we're fixing). One
// requestAnimationFrame loop scales the sphere and brightens the glow from the
// LIVE audio level (mic while listening, the real voice while speaking), so it
// breathes with the conversation at 60fps with no React re-renders.
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
      if (s === "listening" || s === "speaking") target = Math.min(1, levelRef.current);
      else if (s === "thinking") target = 0.3 + 0.16 * (0.5 + 0.5 * Math.sin(t * 3.2));
      else target = 0.14 + 0.08 * (0.5 + 0.5 * Math.sin(t * 1.4)); // idle breathe
      smooth += (target - smooth) * 0.18;

      if (core.current) core.current.style.transform = `scale(${1 + smooth * 0.32})`;
      if (halo.current) halo.current.style.opacity = String(0.45 + smooth * 0.5);
      if (ring1.current) {
        ring1.current.style.transform = `scale(${1.03 + smooth * 0.42})`;
        ring1.current.style.opacity = String(0.55 - smooth * 0.35);
      }
      if (ring2.current) {
        ring2.current.style.transform = `scale(${1.12 + smooth * 0.8})`;
        ring2.current.style.opacity = String(0.32 - smooth * 0.24);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <div className="relative grid h-44 w-44 place-items-center sm:h-56 sm:w-56">
      {/* glow — radial gradient that fades to transparent (circular, no square) */}
      <div
        ref={halo}
        className="pointer-events-none absolute rounded-full"
        style={{ inset: "-42%", background: "radial-gradient(circle, rgba(201,168,76,0.42) 0%, rgba(201,168,76,0.15) 32%, rgba(201,168,76,0) 62%)" }}
      />

      {/* reactive rings (plain circular borders — always clip clean) */}
      <div ref={ring2} className="pointer-events-none absolute rounded-full border border-gold/15" style={{ inset: "3%" }} />
      <div ref={ring1} className="pointer-events-none absolute rounded-full border border-gold/30" style={{ inset: "12%" }} />

      {/* orbiting particles (circular dots; container is transparent) */}
      <div className="orb-spin pointer-events-none absolute inset-0">
        <span className="absolute left-1/2 top-[1%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-gold shadow-[0_0_10px_3px_rgba(201,168,76,0.6)]" />
        <span className="absolute left-[5%] top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-gold/80 shadow-[0_0_8px_2px_rgba(201,168,76,0.5)]" />
      </div>

      {/* the sphere — a single circular element, lit for 3D depth */}
      <div
        ref={core}
        className="relative h-[62%] w-[62%] overflow-hidden rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 22%), radial-gradient(circle at 50% 50%, #f4dca0 0%, #dcbb6e 38%, #bd9743 70%, #8c6b2c 100%)",
          boxShadow:
            "0 0 55px 6px rgba(201,168,76,0.5), inset 0 8px 18px rgba(255,248,220,0.55), inset 0 -16px 28px rgba(74,54,18,0.6)",
          willChange: "transform",
        }}
      >
        {/* molten life — soft circular blobs drift inside (no blur filter) */}
        <div className="orb-drift1 absolute rounded-full" style={{ inset: "6%", background: "radial-gradient(circle at 40% 35%, rgba(255,249,228,0.7), rgba(255,249,228,0) 55%)" }} />
        <div className="orb-drift2 absolute rounded-full" style={{ inset: "8%", background: "radial-gradient(circle at 66% 70%, rgba(120,92,38,0.5), rgba(120,92,38,0) 55%)" }} />
      </div>
    </div>
  );
}
