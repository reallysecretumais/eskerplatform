"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Trash2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sniffVideoFile, friendlyUploadError } from "@/lib/videoClient";
import { createListingVideoUpload, confirmListingVideo, removeListingVideo } from "@/app/host/actions";

const VIDEO_BUCKET = "property-videos";

/**
 * The one optional walkthrough video for a listing.
 *
 * Optional on purpose: photos are the approval gate, a video is the bonus that
 * makes a place feel real. It never blocks submitting.
 *
 * The file uploads straight from this browser to Storage (16MB won't fit
 * through a server action). Ask for a signed URL → PUT the file → tell the
 * server to save it. Close the tab midway and nothing is saved.
 */
export function VideoManager({ listingId, videoUrl }: { listingId: string; videoUrl: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(file: File | null | undefined) {
    if (!file) return;
    setMsg(null);

    // Fail fast on an obviously-wrong file; the bucket is the real gate.
    const sniffed = await sniffVideoFile(file);
    if (!sniffed.ok) {
      setMsg(sniffed.message);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setBusy(true);
    try {
      const minted = await createListingVideoUpload(listingId, sniffed.ext);
      if (!minted.ok || !minted.path || !minted.token) {
        setMsg(minted.message);
        return;
      }

      const { error } = await createClient()
        .storage.from(VIDEO_BUCKET)
        .uploadToSignedUrl(minted.path, minted.token, file, { contentType: sniffed.contentType });
      if (error) {
        setMsg(friendlyUploadError(error.message));
        return;
      }

      const done = await confirmListingVideo(listingId, minted.path);
      setMsg(done.ok ? null : done.message);
      if (done.ok) router.refresh();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await removeListingVideo(listingId);
      if (!r.ok) setMsg(r.message);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <Video size={16} className="text-gold-deep" />
        <h3 className="text-sm font-medium text-ink">Video walkthrough</h3>
        <span className="text-xs text-dim">Optional</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        A short clip walking through the place — guests trust it far more than photos alone.
        Up to 16MB. MP4 plays everywhere.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/3gpp"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {videoUrl && (
        // Never run this through thumb() — that's the image transform CDN.
        <video
          controls
          preload="metadata"
          playsInline
          src={videoUrl}
          className="mt-4 max-h-72 w-full rounded-xl bg-black"
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-bg px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface disabled:opacity-50"
        >
          {videoUrl ? <RefreshCw size={15} /> : <Video size={15} />}
          {busy ? "Uploading…" : videoUrl ? "Replace video" : "Add a video"}
        </button>
        {videoUrl && !busy && (
          <button
            type="button"
            onClick={remove}
            className="inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-ink"
          >
            <Trash2 size={14} /> Remove
          </button>
        )}
        {msg && <span className="text-xs text-red-600">{msg}</span>}
      </div>

      {busy && (
        <p className="mt-2 text-xs text-dim">
          Uploading — a 16MB clip can take a minute on mobile data. Please keep this page open.
        </p>
      )}
    </div>
  );
}
