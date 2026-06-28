"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

// The voice "entity" — a luminous gold jewel, rendered in SVG so it is PERFECTLY
// circular and crisp on every browser (iOS Safari included): SVG clips flawlessly,
// so no square/rectangle artifact can ever appear. Layered radial gradients give
// 3D depth; soft motes drift inside a clip; particles orbit outside. One
// requestAnimationFrame loop scales the sphere + brightens the glow from the LIVE
// audio level (mic while listening, the real voice while speaking) and gives a
// quick "heard you" pop when `pulseRef` is bumped — all by mutating attributes,
// no React re-renders, 60fps.
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

  const core = useRef<SVGGElement>(null);
  const halo = useRef<SVGCircleElement>(null);
  const ring1 = useRef<SVGCircleElement>(null);
  const ring2 = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    const scaleAbout = (s: number) => `translate(100 100) scale(${s}) translate(-100 -100)`;
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

      core.current?.setAttribute("transform", scaleAbout(1 + smooth * 0.3));
      if (halo.current) halo.current.style.opacity = String(0.4 + smooth * 0.5);
      if (ring1.current) {
        ring1.current.setAttribute("transform", scaleAbout(1 + smooth * 0.16));
        ring1.current.style.opacity = String(0.5 - smooth * 0.3);
      }
      if (ring2.current) {
        ring2.current.setAttribute("transform", scaleAbout(1 + smooth * 0.32));
        ring2.current.style.opacity = String(0.28 - smooth * 0.22);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef, pulseRef]);

  return (
    <svg viewBox="0 0 200 200" className="h-44 w-44 sm:h-56 sm:w-56" aria-hidden>
      <defs>
        <radialGradient id="esk-sphere" cx="0.38" cy="0.32" r="0.78">
          <stop offset="0%" stopColor="#fff6da" />
          <stop offset="30%" stopColor="#eccf86" />
          <stop offset="66%" stopColor="#c89f48" />
          <stop offset="100%" stopColor="#7e5f27" />
        </radialGradient>
        <radialGradient id="esk-glow">
          <stop offset="0%" stopColor="rgba(201,168,76,0.55)" />
          <stop offset="45%" stopColor="rgba(201,168,76,0.18)" />
          <stop offset="100%" stopColor="rgba(201,168,76,0)" />
        </radialGradient>
        <radialGradient id="esk-spec">
          <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id="esk-mote">
          <stop offset="0%" stopColor="rgba(255,248,224,0.8)" />
          <stop offset="100%" stopColor="rgba(255,248,224,0)" />
        </radialGradient>
        <clipPath id="esk-clip">
          <circle cx="100" cy="100" r="46" />
        </clipPath>
      </defs>

      {/* glow */}
      <circle ref={halo} cx="100" cy="100" r="92" fill="url(#esk-glow)" />
      {/* reflection beneath — gives a "floating" read */}
      <ellipse cx="100" cy="160" rx="38" ry="6" fill="url(#esk-glow)" opacity="0.3" />

      {/* reactive rings */}
      <circle ref={ring2} cx="100" cy="100" r="64" fill="none" stroke="rgba(201,168,76,0.28)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <circle ref={ring1} cx="100" cy="100" r="54" fill="none" stroke="rgba(201,168,76,0.42)" strokeWidth="1" vectorEffect="non-scaling-stroke" />

      {/* sphere (reactive scale about centre) */}
      <g ref={core}>
        <circle cx="100" cy="100" r="46" fill="url(#esk-sphere)" />
        {/* living shimmer — soft motes drift, clipped to the sphere */}
        <g clipPath="url(#esk-clip)">
          <circle cx="86" cy="84" r="22" fill="url(#esk-mote)">
            <animateTransform attributeName="transform" type="translate" values="0 0; 9 7; -5 4; 0 0" dur="9s" repeatCount="indefinite" />
          </circle>
          <circle cx="120" cy="118" r="17" fill="url(#esk-mote)" opacity="0.55">
            <animateTransform attributeName="transform" type="translate" values="0 0; -7 -5; 5 -4; 0 0" dur="12s" repeatCount="indefinite" />
          </circle>
        </g>
        {/* specular highlight + rim light */}
        <circle cx="85" cy="80" r="15" fill="url(#esk-spec)" opacity="0.9" />
        <circle cx="100" cy="100" r="45" fill="none" stroke="url(#esk-spec)" strokeWidth="1.4" opacity="0.4" />
      </g>

      {/* orbiting motes */}
      <g>
        <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="18s" repeatCount="indefinite" />
        <circle cx="100" cy="33" r="2" fill="#c9a84c" />
        <circle cx="167" cy="100" r="1.4" fill="rgba(201,168,76,0.8)" />
      </g>
    </svg>
  );
}
