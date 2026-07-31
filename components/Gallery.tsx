"use client";

import { useState } from "react";
import { X, LayoutGrid, Play } from "lucide-react";
import { thumb } from "@/lib/img";

// Airbnb-style gallery: a large lead photo + a grid of more, so you see several
// at a glance — on phones as well as desktop. "Show all photos" opens a lightbox
// with full, uncropped images. Resized thumbnails keep it fast; full-size only
// loads when opened.
export function Gallery({
  photos,
  title,
  where,
  video,
}: {
  photos: string[];
  title: string;
  /** "Bahria Phase 7, Rawalpindi" — folded into the alt text so each photo
   *  describes a real place for screen readers and image search. */
  where?: string | null;
  /** Optional walkthrough video. Never mixed into `photos` — thumb() is the
   *  IMAGE transform CDN and errors on a video URL. */
  video?: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Which the viewer asked for. Someone who taps a play button wants the VIDEO,
  // so it leads — landing them on the cover photo and asking them to scroll is
  // how the feature came across as missing in the first place.
  const [videoFirst, setVideoFirst] = useState(false);
  const show = () => { setVideoFirst(false); setOpen(true); };
  const showVideo = () => { setVideoFirst(true); setOpen(true); };

  if (photos.length === 0) {
    return <div className="flex h-[340px] items-center justify-center rounded-2xl bg-surface-2 text-sm text-dim sm:h-[460px]">Photos coming soon</div>;
  }

  const grid = photos.length >= 5;

  // Alt text that describes the actual place. The lead photo carries the plain
  // name (it IS the page's subject); the rest are numbered so they're
  // distinguishable without inventing what each room is.
  const place = [title, where].filter(Boolean).join(" — ");
  const alt = (i: number) => (i === 0 ? place : `${place}, photo ${i + 1}`);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl">
        {grid ? (
          // Phones get the collage too: lead photo on top, then a 2×2 of the
          // next four. Previously the tiles were `hidden sm:block`, so a phone
          // saw exactly ONE photo and had to tap "Show all" to discover the
          // rest — most never did. Desktop keeps the 4-col side-by-side layout.
          <div className="grid h-[520px] grid-cols-2 grid-rows-[2.2fr_1fr_1fr] gap-2 sm:h-[460px] sm:grid-cols-4 sm:grid-rows-2">
            <button type="button" onClick={show} className="col-span-2 row-span-1 overflow-hidden sm:row-span-2">
              <img src={thumb(photos[0], 1200, 80)} alt={alt(0)} fetchPriority="high" decoding="async" className="h-full w-full object-cover transition hover:opacity-95" />
            </button>
            {photos.slice(1, 5).map((p, i) => (
              <button key={i} type="button" onClick={show} className="overflow-hidden">
                <img src={thumb(p, 640, 72)} alt={alt(i + 1)} loading="lazy" decoding="async" className="h-full w-full object-cover transition hover:opacity-95" />
              </button>
            ))}
          </div>
        ) : (
          <button type="button" onClick={show} className="block h-[340px] w-full overflow-hidden sm:h-[460px]">
            <img src={thumb(photos[0], 1400, 80)} alt={alt(0)} fetchPriority="high" decoding="async" className="h-full w-full object-cover" />
          </button>
        )}

        {/* ONE affordance for the video: this pill. A centred play overlay was
            tried and REVERTED — a transparent button stretched across the cover
            swallowed the clicks meant for the photos, so tapping any picture
            opened the video. Never lay an invisible button over the gallery.
            Bottom-left so it never collides with "Show all photos". */}
        {video && (
          <button
            type="button"
            onClick={showVideo}
            className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/95 px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition hover:bg-white"
          >
            <Play size={14} /> Watch video
          </button>
        )}

        {photos.length > 1 && (
          <button
            type="button"
            onClick={show}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/95 px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition hover:bg-white"
          >
            <LayoutGrid size={14} /> Show all {photos.length} photos
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90" onClick={() => setOpen(false)}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3">
            <span className="text-sm text-white/80">{title}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close gallery" className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20">
              <X size={20} />
            </button>
          </div>
          <div className="mx-auto max-w-3xl space-y-3 px-4 pb-12" onClick={(e) => e.stopPropagation()}>
            {/* Opened from a play button → the video leads and AUTOPLAYS, because
                that is precisely what was asked for. Opened from a photo → the
                cover leads and the video sits second, still high up. Muted so
                autoplay is actually permitted by browsers; the controls are there
                to unmute. */}
            {video && videoFirst && (
              <video
                controls
                autoPlay
                muted
                playsInline
                poster={thumb(photos[0], 1200, 80)}
                src={video}
                className="w-full rounded-xl bg-black"
              />
            )}
            <img src={thumb(photos[0], 1400, 82)} alt={alt(0)} loading="eager" decoding="async" className="w-full rounded-xl" />
            {video && !videoFirst && (
              <video
                controls
                preload="metadata"
                playsInline
                poster={thumb(photos[0], 1200, 80)}
                src={video}
                className="w-full rounded-xl bg-black"
              />
            )}
            {photos.slice(1).map((p, i) => (
              <img key={i} src={thumb(p, 1400, 82)} alt={alt(i)} loading={i < 1 ? "eager" : "lazy"} decoding="async" className="w-full rounded-xl" />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
