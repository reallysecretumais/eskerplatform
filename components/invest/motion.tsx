"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Adds `is-in` once the element scrolls into view (once only). */
export function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced() || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      setInView(true);
      io.disconnect();
      clearInterval(poll);
    };
    const io = new IntersectionObserver(([e]) => e.isIntersecting && show(), { threshold, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    // Belt and braces: some browsers hold observer callbacks back (a backgrounded
    // tab, an in-app webview). A figure must never sit at its "before" state on
    // screen, so check the real position too.
    const poll = setInterval(() => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) show();
    }, 700);
    return () => {
      io.disconnect();
      clearInterval(poll);
    };
  }, [threshold]);
  return [ref, inView] as const;
}

/** A block that fades and rises into place the first time it's seen. */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: { children: ReactNode; delay?: 0 | 1 | 2 | 3 | 4; className?: string; as?: "div" | "li" | "section" }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <Tag ref={ref as never} className={`rv ${delay ? `rv-d${delay}` : ""} ${inView ? "is-in" : ""} ${className}`}>
      {children}
    </Tag>
  );
}

/**
 * A number that counts to its value. On first sight it counts up from zero;
 * after that every change glides from the old value to the new one (~650 ms),
 * which is what pulls the eye to a result when a choice changes it.
 * Reduced motion: the final value, instantly.
 */
export function Num({ value, format, startOnView = true, duration = 650 }: { value: number; format: (n: number) => string; startOnView?: boolean; duration?: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.3);
  const [shown, setShown] = useState(startOnView ? 0 : value);
  // What is visibly on screen right now — a change mid-flight continues from
  // here, so the number never jumps.
  const current = useRef(startOnView ? 0 : value);
  const raf = useRef(0);

  useEffect(() => {
    if (startOnView && !inView) return;
    if (reduced()) {
      current.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = current.current;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const v = a + (value - a) * (1 - Math.pow(1 - k, 3));
      current.current = v;
      setShown(v);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    // Guarantee the exact final figure. Browsers pause animation frames in a
    // background tab or on a struggling phone, and an investor must never be
    // left looking at an in-between number.
    const settle = setTimeout(() => {
      cancelAnimationFrame(raf.current);
      current.current = value;
      setShown(value);
    }, duration + 120);
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(settle);
    };
  }, [value, inView, startOnView, duration]);

  return (
    <span ref={ref} className="num">
      {format(shown)}
    </span>
  );
}
