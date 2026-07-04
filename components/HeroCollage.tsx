"use client";

import { useEffect, useRef } from "react";
import { thumb } from "@/lib/img";

// The full hero background: a 3D mosaic photo-wall that tilts toward the cursor,
// with a scrim + gold glow for legibility, edge-dissolved with a mask so it reads
// as one designed object. Fast by construction:
//  - desktop: ONE rAF loop drives the tilt + a cursor-following gold light
//  - touch devices: no JS loop at all — a CSS sway keyframe carries the motion
//  - reduced-motion: everything settles static.

const COLS = 3;
const PER_COL = 5;
const DEPTHS = [-70, 36, -18];
const DURATIONS = ["92s", "108s", "100s"];
const BASE = "rotateZ(-5deg)";
const ASPECTS = ["aspect-[3/2]", "aspect-[4/5]", "aspect-[1/1]", "aspect-[3/2]", "aspect-[5/4]"];
const GLOW = 560; // px — diameter of the cursor light

export function HeroCollage({ photos }: { photos: string[] }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });
  const px = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    if (photos.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Touch devices: no pointer to follow — hand the living motion to a CSS
    // keyframe (GPU-only) and run zero JavaScript per frame.
    if (window.matchMedia("(pointer: coarse)").matches) {
      const scene = sceneRef.current;
      scene?.classList.add("hero-sway");
      return () => scene?.classList.remove("hero-sway");
    }

    let raf = 0;
    let lastMove = -9999;
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      px.current.x = e.clientX;
      px.current.y = e.clientY;
      lastMove = performance.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const loop = () => {
      const now = performance.now();
      const idle = now - lastMove > 1800;
      if (idle) {
        const t = now / 4200;
        target.current.x = Math.sin(t) * 0.55;
        target.current.y = Math.cos(t * 0.8) * 0.3;
      }
      cur.current.x += (target.current.x - cur.current.x) * 0.05;
      cur.current.y += (target.current.y - cur.current.y) * 0.05;
      const ry = (cur.current.x * 12).toFixed(2);
      const rx = (-cur.current.y * 8).toFixed(2);
      if (sceneRef.current) sceneRef.current.style.transform = `${BASE} rotateX(${rx}deg) rotateY(${ry}deg)`;
      // The gold light trails the cursor; it breathes out when the hand rests.
      if (glowRef.current) {
        glowRef.current.style.opacity = idle ? "0" : "1";
        glowRef.current.style.transform = `translate3d(${px.current.x - GLOW / 2}px, ${px.current.y - GLOW / 2}px, 0)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, [photos.length]);

  if (photos.length === 0) return null;

  // Distribute DISTINCT photos across the columns (no on-screen repeats).
  const slots = COLS * PER_COL;
  let perCol = PER_COL;
  let pool: string[];
  if (photos.length >= slots) {
    pool = photos.slice(0, slots);
  } else if (photos.length >= COLS * 3) {
    perCol = Math.floor(photos.length / COLS);
    pool = photos.slice(0, perCol * COLS);
  } else {
    pool = Array.from({ length: slots }, (_, i) => photos[i % photos.length]);
  }
  const columns = Array.from({ length: COLS }, (_, c) => pool.slice(c * perCol, (c + 1) * perCol));

  return (
    <div aria-hidden className="absolute inset-0 z-0 overflow-hidden">
      {/* 3D mosaic photo-wall — edge-dissolved with a vertical mask */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          perspective: "1100px",
          maskImage: "linear-gradient(180deg, transparent 0%, black 10%, black 90%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 10%, black 90%, transparent 100%)",
        }}
      >
        <div ref={sceneRef} className="absolute -inset-[22%] flex justify-center gap-3" style={{ transformStyle: "preserve-3d", transform: BASE }}>
          {columns.map((col, c) => (
            <div key={c} className={`relative flex-1 overflow-hidden ${c === 2 ? "hidden sm:block" : ""}`} style={{ transform: `translateZ(${DEPTHS[c]}px)` }}>
              <div className={`marq flex flex-col gap-3 ${c % 2 === 1 ? "marq-rev" : ""}`} style={{ animationDuration: DURATIONS[c % DURATIONS.length] }}>
                {[...col, ...col].map((url, i) => (
                  <div key={i} className={`${ASPECTS[i % ASPECTS.length]} relative w-full shrink-0 overflow-hidden rounded-[20px] shadow-xl shadow-black/50`}>
                    <img
                      src={thumb(url, 1000, 72)}
                      srcSet={`${thumb(url, 640, 70)} 640w, ${thumb(url, 1000, 72)} 1000w, ${thumb(url, 1400, 72)} 1400w`}
                      sizes="(max-width: 640px) 72vw, 48vw"
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    {/* soft depth gradient so each card sits in the scene */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scrim for legibility */}
      <div className="absolute inset-0 z-[1]" style={{ background: "radial-gradient(58% 50% at 50% 50%, rgba(8,6,4,0.52), transparent 78%), linear-gradient(180deg, rgba(12,10,7,0.52) 0%, rgba(12,10,7,0.60) 50%, rgba(12,10,7,0.90) 100%)" }} />
      {/* Gold focal glow */}
      <div className="absolute inset-0 z-[2]" style={{ background: "radial-gradient(42% 40% at 50% 48%, rgba(201,168,76,0.17), transparent 70%)" }} />
      {/* Cursor-following gold light (desktop; driven by the same rAF loop) */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute left-0 top-0 z-[2] rounded-full opacity-0 transition-opacity duration-700"
        style={{ width: GLOW, height: GLOW, background: "radial-gradient(circle, rgba(201,168,76,0.16), transparent 62%)" }}
      />
      {/* Wash behind the top menu */}
      <div className="absolute inset-x-0 top-0 z-[3] h-36" style={{ background: "linear-gradient(180deg, rgba(8,7,5,0.72) 0%, rgba(8,7,5,0) 100%)" }} />
    </div>
  );
}
