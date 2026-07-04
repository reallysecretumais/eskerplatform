"use client";

import { useState } from "react";
import { X, LayoutGrid } from "lucide-react";
import { thumb } from "@/lib/img";

// Airbnb-style gallery: a large lead photo + a 2×2 grid of more, so you see
// several at a glance. "Show all photos" opens a lightbox with full, uncropped
// images. Resized thumbnails keep it fast; full-size only loads when opened.
export function Gallery({ photos, title }: { photos: string[]; title: string }) {
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true);

  if (photos.length === 0) {
    return <div className="flex h-[340px] items-center justify-center rounded-2xl bg-surface-2 text-sm text-dim sm:h-[460px]">Photos coming soon</div>;
  }

  const grid = photos.length >= 5;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl">
        {grid ? (
          <div className="grid h-[340px] grid-cols-4 grid-rows-2 gap-2 sm:h-[460px]">
            <button type="button" onClick={show} className="col-span-4 row-span-2 overflow-hidden sm:col-span-2">
              <img src={thumb(photos[0], 1200, 80)} alt={title} className="h-full w-full object-cover transition hover:opacity-95" />
            </button>
            {photos.slice(1, 5).map((p, i) => (
              <button key={i} type="button" onClick={show} className="hidden overflow-hidden sm:block">
                <img src={thumb(p, 640, 72)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition hover:opacity-95" />
              </button>
            ))}
          </div>
        ) : (
          <button type="button" onClick={show} className="block h-[340px] w-full overflow-hidden sm:h-[460px]">
            <img src={thumb(photos[0], 1400, 80)} alt={title} className="h-full w-full object-cover" />
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
            {photos.map((p, i) => (
              <img key={i} src={thumb(p, 1400, 82)} alt="" loading={i < 2 ? "eager" : "lazy"} decoding="async" className="w-full rounded-xl" />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
