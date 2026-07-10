"use client";

import { useEffect } from "react";

// Fires one view beacon per listing per day (deduped in localStorage so refreshes
// and repeat visits don't inflate the count). Best-effort; silent on failure.
export function TrackListingView({ id }: { id: string }) {
  useEffect(() => {
    if (!id) return;
    const key = `esker_v_${id}_${new Date().toISOString().slice(0, 10)}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* private mode / storage blocked — still count it */
    }
    const body = JSON.stringify({ id });
    // sendBeacon survives navigation; fall back to fetch.
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track/listing-view", new Blob([body], { type: "application/json" }));
        return;
      }
    } catch {
      /* fall through */
    }
    fetch("/api/track/listing-view", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }, [id]);
  return null;
}
