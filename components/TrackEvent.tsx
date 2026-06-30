"use client";

import { useEffect } from "react";

// Fires a one-shot Meta Pixel event on mount (e.g. ViewContent, InitiateCheckout).
// No-op when the pixel isn't configured.
export function TrackEvent({ event, params }: { event: string; params?: Record<string, unknown> }) {
  useEffect(() => {
    const w = window as unknown as { fbq?: (...a: unknown[]) => void };
    if (typeof window !== "undefined" && w.fbq) w.fbq("track", event, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
