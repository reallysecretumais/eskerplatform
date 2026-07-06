"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, ZoomIn } from "lucide-react";

// Lightweight circular crop + zoom (no dependency). The image covers a square
// frame (shown as a circle); drag to reposition, slide to zoom, then it's exported
// to a 512×512 JPEG. HEIC/unreadable images fall back to uploading the original.
const FRAME = 256;
const OUT = 512;

export function AvatarCropper({
  src,
  onCancel,
  onSave,
  onUnsupported,
}: {
  src: string;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
  onUnsupported: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tl, setTl] = useState({ x: 0, y: 0 }); // top-left of drawn image, frame coords
  const drag = useRef<{ sx: number; sy: number; tx: number; ty: number } | null>(null);

  useEffect(() => {
    const image = new window.Image();
    image.onload = () => setImg(image);
    image.onerror = () => onUnsupported();
    image.src = src;
  }, [src, onUnsupported]);

  const baseScale = img ? FRAME / Math.min(img.width, img.height) : 1;
  const drawScale = baseScale * zoom;
  const dw = img ? img.width * drawScale : FRAME;
  const dh = img ? img.height * drawScale : FRAME;

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.min(0, Math.max(FRAME - dw, x)),
      y: Math.min(0, Math.max(FRAME - dh, y)),
    }),
    [dw, dh],
  );

  // Center on load; keep within bounds whenever zoom changes.
  useEffect(() => {
    if (img) setTl(clamp((FRAME - dw) / 2, (FRAME - dh) / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);
  useEffect(() => {
    setTl((p) => clamp(p.x, p.y));
  }, [zoom, clamp]);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, tx: tl.x, ty: tl.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setTl(clamp(drag.current.tx + (e.clientX - drag.current.sx), drag.current.ty + (e.clientY - drag.current.sy)));
  };
  const onUp = () => { drag.current = null; };

  const save = () => {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return onUnsupported();
    const ratio = OUT / FRAME;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, tl.x * ratio, tl.y * ratio, dw * ratio, dh * ratio);
    canvas.toBlob((blob) => (blob ? onSave(blob) : onUnsupported()), "image/jpeg", 0.9);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} aria-hidden />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        <button type="button" onClick={onCancel} className="absolute right-4 top-4 text-dim hover:text-ink" aria-label="Cancel">
          <X size={18} />
        </button>
        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">Adjust your photo</h3>
        <p className="mt-0.5 text-xs text-dim">Drag to position · slide to zoom.</p>

        <div className="mt-4 flex justify-center">
          <div
            className="relative overflow-hidden rounded-full ring-1 ring-line-hi"
            style={{ width: FRAME, height: FRAME, touchAction: "none", cursor: img ? "grab" : "wait" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
          >
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ left: tl.x, top: tl.y, width: dw, height: dh }} />
            )}
            {/* subtle inner ring for framing */}
            <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomIn size={16} className="shrink-0 text-dim" />
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line-hi accent-[var(--color-gold,#C9A84C)]"
            aria-label="Zoom"
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm text-muted transition hover:text-ink">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={!img} className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-60">
            Save photo
          </button>
        </div>
      </div>
    </div>
  );
}
