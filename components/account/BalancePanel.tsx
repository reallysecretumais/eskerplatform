"use client";

import { useActionState, useState } from "react";
import { CreditCard, Building, Upload, Check } from "lucide-react";
import { submitBalancePayment } from "@/app/account/actions";
import { payments } from "@/lib/payments";

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;

// Balance due + how to pay it. Today: bank transfer + screenshot (verified by the
// team). The "Pay now by card" button is the Safepay seam — enabled when the
// gateway goes live behind lib/payments/provider.ts.
export function BalancePanel({ bookingId, balance }: { bookingId: string; balance: number }) {
  const [state, action, pending] = useActionState(submitBalancePayment, null);
  const [openTransfer, setOpenTransfer] = useState(false);

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-green/30 bg-green/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-green">
          <Check size={16} /> {state.message}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">Balance due at check-in</span>
        <span className="font-display text-xl font-semibold text-gold-deep tabular-nums">{pkr(balance)}</span>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled
          title="Card & wallet payments are coming soon"
          className="flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-dim"
        >
          <CreditCard size={16} /> Pay now by card <span className="text-[10px] uppercase tracking-wider">Soon</span>
        </button>
        <button
          type="button"
          onClick={() => setOpenTransfer((v) => !v)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-ink transition hover:bg-surface-2"
        >
          <Building size={16} /> Pay by bank transfer
        </button>
      </div>

      {openTransfer && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-xs text-muted">Transfer {pkr(balance)} to any Esker account below, then upload your screenshot — we&apos;ll confirm it.</p>
          <div className="mt-3 space-y-2">
            {payments.accounts.map((a) => (
              <div key={a.number} className="rounded-lg border border-line bg-bg/40 px-3 py-2 text-sm">
                <div className="text-ink">{payments.title} · {a.bank}{a.primary ? " (primary)" : ""}</div>
                <div className="break-all font-mono text-xs text-muted">{a.number}</div>
              </div>
            ))}
          </div>

          <form action={action} className="mt-4">
            <input type="hidden" name="bookingId" value={bookingId} />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-hi px-4 py-3 text-sm text-muted transition hover:bg-surface-2">
              <Upload size={16} />
              <span>Choose payment screenshot</span>
              <input type="file" name="proof" accept="image/*" required className="sr-only" onChange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()} />
            </label>
            {pending && <p className="mt-2 text-xs text-dim">Uploading…</p>}
            {state && !state.ok && <p className="mt-2 text-xs text-red">{state.message}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
