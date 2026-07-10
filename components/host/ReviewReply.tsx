"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Reply, Check, X } from "lucide-react";
import { replyToReview } from "@/app/host/actions";

// Inline host reply on a review: shows the existing public reply with Edit, or a
// "Reply" affordance that opens a compact box. Saving publishes it under the
// review on the listing page.
export function ReviewReply({ reviewId, initial }: { reviewId: string; initial: string | null }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState<string | null>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const save = () =>
    start(async () => {
      setErr(null);
      const res = await replyToReview(reviewId, text);
      if (res.ok) {
        setSaved(text.trim() || null);
        setEditing(false);
        router.refresh();
      } else {
        setErr(res.message);
      }
    });

  if (!editing) {
    return saved ? (
      <div className="mt-3 rounded-xl border border-line bg-surface-2/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink">Your response</span>
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted transition hover:text-ink">Edit</button>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">{saved}</p>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold-deep transition hover:underline"
      >
        <Reply size={14} /> Reply publicly
      </button>
    );
  }

  return (
    <div className="mt-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={1000}
        autoFocus
        placeholder="Thank your guest, or respond gracefully to any feedback… (shown publicly)"
        className="w-full resize-none rounded-xl border border-line bg-bg/40 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/50"
      />
      {err && <p className="mt-1.5 text-xs text-red">{err}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={save} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 text-xs font-medium text-bg transition hover:opacity-90 disabled:opacity-60">
          <Check size={13} /> {pending ? "Saving…" : saved ? "Update reply" : "Post reply"}
        </button>
        <button type="button" onClick={() => { setEditing(false); setText(saved ?? ""); setErr(null); }} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink">
          <X size={13} /> Cancel
        </button>
        {saved && text.trim() === "" && (
          <span className="text-[11px] text-dim">Save empty to remove your reply.</span>
        )}
      </div>
    </div>
  );
}
