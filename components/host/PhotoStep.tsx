"use client";

import Link from "next/link";
import { Camera, ArrowRight, Sun, Maximize, Sparkles } from "lucide-react";
import { PhotoManager } from "@/components/host/PhotoManager";
import { VideoManager } from "@/components/host/VideoManager";

// The shared, emphatic photo step both listing flows land on right after the
// draft is created. Photos are Esker's approval gate, so this makes them the
// hero — with concrete guidance so hosts actually put the effort in.
export function PhotoStep({ draftId }: { draftId: string }) {
  return (
    <div className="space-y-5">
      <div className="rounded-[22px] border border-brand/40 bg-surface p-6">
        <div className="flex items-center gap-2 text-brand">
          <Camera size={20} />
          <span className="text-lg font-bold text-ink">Now, the photos — this is what gets you booked</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Great photos are the single biggest thing that gets your place <span className="font-medium text-ink">approved by Esker</span> and booked by guests. Please take your time here — it&apos;s worth it.
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <Tip icon={<Sun size={14} />} text="Shoot in daylight — open the curtains, lights on." />
          <Tip icon={<Maximize size={14} />} text="Wide shots of every room, plus the view & special bits." />
          <Tip icon={<Sparkles size={14} />} text="Tidy up first. Add 5+ — your best one leads." />
        </div>
      </div>

      <PhotoManager listingId={draftId} photos={[]} />

      {/* Optional, and deliberately after the photos — a video is a bonus, not
          a second hurdle. It never gates submitting. */}
      <VideoManager listingId={draftId} videoUrl={null} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-line bg-surface p-5">
        <div>
          <div className="text-sm font-medium text-ink">Next: availability, guest info &amp; submit</div>
          <div className="text-xs text-dim">Set any blocked dates and check-in details, then send it to Esker for review.</div>
        </div>
        <Link
          href={`/host/listings/${draftId}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-warm transition-colors hover:bg-brand-pressed"
        >
          Continue <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

function Tip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2.5 text-xs text-muted">
      <span className="mt-0.5 shrink-0 text-brand">{icon}</span>
      {text}
    </div>
  );
}
