"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { pauseListing, resumeListing } from "@/app/host/actions";

// Pause hides the listing from the website instantly; resume brings it back.
export function PauseResume({ listingId, status }: { listingId: string; status: "live" | "paused" }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const paused = status === "paused";

  const toggle = () =>
    start(async () => {
      setError(null);
      const res = await (paused ? resumeListing(listingId) : pauseListing(listingId));
      if (res.ok) router.refresh();
      else setError(res.message);
    });

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-60"
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
        {pending ? "Working…" : paused ? "Resume listing" : "Pause listing"}
      </button>
      {error && <span className="text-xs text-red">{error}</span>}
    </span>
  );
}
