"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload, Star, Trash2, GripVertical } from "lucide-react";
import { uploadListingPhoto, removeListingPhoto, setListingCover, reorderListingPhotos } from "@/app/host/actions";
import { thumb } from "@/lib/img";
import { MAX_LISTING_PHOTOS, MIN_LISTING_PHOTOS } from "@/lib/hostConstants";

// Listing photos: upload (auto-submits) · drag to reorder (first = cover) ·
// quick "make cover" · remove. Reorder is pointer-based so it works on touch and
// mouse — the tiles swap live as you drag, no floating clone.
export function PhotoManager({ listingId, photos }: { listingId: string; photos: string[] }) {
  const [state, action, pending] = useActionState(uploadListingPhoto, null);
  const [busy, start] = useTransition();
  const router = useRouter();

  // Local order for optimistic drag; resync whenever the server list changes.
  const [order, setOrder] = useState<string[]>(photos);
  const orderRef = useRef(order);
  useEffect(() => { setOrder(photos); }, [photos]);
  useEffect(() => { orderRef.current = order; }, [order]);

  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  const drag = useRef<{ from: number; sx: number; sy: number; active: boolean } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const idxUnder = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest("[data-pidx]") as HTMLElement | null;
    return el ? Number(el.dataset.pidx) : null;
  };

  const onDown = (i: number) => (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return; // don't hijack the action buttons
    drag.current = { from: i, sx: e.clientX, sy: e.clientY, active: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return; // tap, not drag
      d.active = true;
      setDragIdx(d.from);
    }
    const over = idxUnder(e.clientX, e.clientY);
    if (over == null || over === d.from) return;
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(d.from, 1);
      next.splice(over, 0, moved);
      return next;
    });
    d.from = over;
    setDragIdx(over);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    setDragIdx(null);
    const snapshot = orderRef.current;
    if (snapshot.join("|") !== photos.join("|")) run(() => reorderListingPhotos(listingId, snapshot));
  };

  const enough = order.length >= MIN_LISTING_PHOTOS;

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">Photos</h2>
        <span className={`text-xs ${enough ? "text-dim" : "text-orange"}`}>
          {order.length}/{MAX_LISTING_PHOTOS} · {enough ? "drag to reorder · first is your cover" : `add ${MIN_LISTING_PHOTOS - order.length} more to submit`}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {order.map((url, i) => (
          <figure
            key={url}
            data-pidx={i}
            onPointerDown={onDown(i)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{ touchAction: "none" }}
            className={`group relative cursor-grab overflow-hidden rounded-xl border transition active:cursor-grabbing ${
              dragIdx === i ? "border-gold ring-2 ring-gold/40 opacity-90" : "border-line"
            }`}
          >
            <div className="aspect-[4/3]" style={{ backgroundColor: "#e7e1d6", backgroundImage: `url(${thumb(url, 480, 65)})`, backgroundSize: "cover", backgroundPosition: "center" }} />
            {i === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">Cover</span>
            )}
            <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/40 text-white/90 opacity-0 backdrop-blur transition group-hover:opacity-100 [@media(hover:none)]:opacity-100" title="Drag to reorder">
              <GripVertical size={12} />
            </span>
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/55 to-transparent p-2 opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
              {i !== 0 && (
                <button type="button" disabled={busy} onClick={() => run(() => setListingCover(listingId, url))} title="Make cover" className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink transition hover:bg-white">
                  <Star size={13} />
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => run(() => removeListingPhoto(listingId, url))} title="Remove" className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-red transition hover:bg-white">
                <Trash2 size={13} />
              </button>
            </div>
          </figure>
        ))}

        {order.length < MAX_LISTING_PHOTOS && (
          <form action={action}>
            <input type="hidden" name="listingId" value={listingId} />
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-hi text-muted transition hover:bg-surface-2 hover:text-ink">
              <Upload size={18} />
              <span className="text-xs">{pending ? "Uploading…" : "Add photo"}</span>
              <input type="file" name="photo" accept="image/*" className="sr-only" onChange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()} />
            </label>
          </form>
        )}
      </div>

      {state && !state.ok && <p className="mt-3 text-sm text-red">{state.message}</p>}
      {order.length === 0 && <p className="mt-3 text-xs text-dim">Add at least {MIN_LISTING_PHOTOS} bright, landscape photos — listings with great photos get approved (and booked) faster.</p>}
    </div>
  );
}
