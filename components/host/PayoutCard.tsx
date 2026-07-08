"use client";

import { useActionState, useState } from "react";
import { Check, Wallet, ChevronDown } from "lucide-react";
import { savePayout } from "@/app/host/actions";

// Optional, low-key: how the host wants to be paid when payouts begin. Collapsed
// by default so it never nags — Esker settles directly for now.
export function PayoutCard({ initial }: { initial: string }) {
  const [open, setOpen] = useState(Boolean(initial));
  const [state, action, pending] = useActionState(savePayout, null);

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <Wallet size={17} className="shrink-0 text-gold-deep" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink">Getting paid</div>
          <div className="text-xs text-dim">Esker settles with you directly. Add your payout details for when online payouts begin{initial ? " — saved ✓" : ""}.</div>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-dim transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <form action={action} className="border-t border-line px-5 py-4">
          <label className="block text-sm font-medium text-ink">Payout method <span className="font-normal text-dim">(optional)</span></label>
          <input
            name="payout"
            defaultValue={initial}
            maxLength={300}
            placeholder="Easypaisa 03xx-xxxxxxx  ·  or Bank + IBAN"
            className="mt-1.5 w-full rounded-xl border border-line bg-bg/40 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/50"
          />
          <div className="mt-3 flex items-center gap-3">
            <button type="submit" disabled={pending} className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-60">
              {pending ? "Saving…" : "Save"}
            </button>
            {state?.ok && (
              <span className="inline-flex items-center gap-1 text-sm text-green">
                <Check size={14} /> {state.message}
              </span>
            )}
            {state && !state.ok && <span className="text-sm text-red">{state.message}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
