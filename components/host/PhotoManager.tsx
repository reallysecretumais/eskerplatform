"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Star, Trash2 } from "lucide-react";
import { uploadListingPhoto, removeListingPhoto, setListingCover } from "@/app/host/actions";
import { thumb } from "@/lib/img";

// Listing photo manager: grid + upload (auto-submits) + set-cover + remove.
// First photo = the cover shown on cards and search.
export function PhotoManager({ listingId, photos }: { listingId: string; photos: string[] }) {
  const [state, action, pending] = useActionState(uploadListingPhoto, null);
  const [busy, start] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">Photos</h2>
        <span className="text-xs text-dim">{photos.length}/14 · first photo is your cover</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((url, i) => (
          <figure key={url} className="group relative overflow-hidden rounded-xl border border-line">
            <div className="aspect-[4/3]" style={{ backgroundColor: "#e7e1d6", backgroundImage: `url(${thumb(url, 480, 65)})`, backgroundSize: "cover", backgroundPosition: "center" }} />
            {i === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">Cover</span>
            )}
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

        {photos.length < 14 && (
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
      {photos.length === 0 && <p className="mt-3 text-xs text-dim">Add at least 4 bright, landscape photos — listings with great photos get approved (and booked) faster.</p>}
    </div>
  );
}
