"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, AlertTriangle } from "lucide-react";
import { cancelMyBooking } from "@/app/account/actions";

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;

// Guest self-cancel with an up-front refund preview. The numbers shown here come
// from the same cancellationQuote the server re-applies, so they always match.
export function CancelDialog({ bookingId, refund, retained, label }: { bookingId: string; refund: number; retained: number; label: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function confirm() {
    setError(null);
    start(async () => {
      const res = await cancelMyBooking(bookingId);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-red transition hover:underline">
        Cancel booking
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !pending && setOpen(false)} aria-hidden />
          <div className="relative w-full max-w-md rounded-t-2xl border border-line bg-surface p-6 shadow-2xl sm:rounded-2xl">
            <button type="button" onClick={() => !pending && setOpen(false)} className="absolute right-4 top-4 text-dim hover:text-ink" aria-label="Close">
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 text-ink">
              <AlertTriangle size={18} className="text-orange" />
              <h3 className="font-display text-lg font-semibold tracking-tight">Cancel this booking?</h3>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-bg/40 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Refund to you</span>
                <span className="font-display font-semibold text-gold-deep tabular-nums">{pkr(refund)}</span>
              </div>
              {retained > 0 && (
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-muted">Cancellation fee</span>
                  <span className="tabular-nums text-ink">{pkr(retained)}</span>
                </div>
              )}
              <p className="mt-3 text-xs text-dim">{label} — as per our cancellation policy. Refunds are sent to your original payment method within 5–7 working days.</p>
            </div>

            {error && <p className="mt-3 text-sm text-red">{error}</p>}

            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => !pending && setOpen(false)} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm text-muted transition hover:text-ink" disabled={pending}>
                Keep booking
              </button>
              <button type="button" onClick={confirm} disabled={pending} className="flex-1 rounded-xl bg-red px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60">
                {pending ? "Cancelling…" : "Confirm cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
