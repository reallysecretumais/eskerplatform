"use client";

import { useActionState, useState } from "react";
import { Check, Wallet, ChevronDown } from "lucide-react";
import { savePayout } from "@/app/host/actions";
import { PAYOUT_METHODS } from "@/lib/hostConstants";

type Payout = { method: string; number: string; title: string };

// Parse the stored payout (JSON now; tolerate a legacy plain string).
function parsePayout(raw: string): Payout {
  if (!raw) return { method: "", number: "", title: "" };
  try {
    const o = JSON.parse(raw) as Partial<Payout>;
    if (o && typeof o === "object" && "number" in o) return { method: o.method ?? "", number: o.number ?? "", title: o.title ?? "" };
  } catch {
    /* legacy free text */
  }
  return { method: "", number: raw, title: "" };
}

// Optional, low-key: how the host wants to be paid when payouts begin. All local
// Pakistani methods. Collapsed by default so it never nags.
export function PayoutCard({ initial }: { initial: string }) {
  const saved = parsePayout(initial);
  const hasSaved = Boolean(saved.number);
  const [open, setOpen] = useState(hasSaved);
  const [method, setMethod] = useState(saved.method || "Easypaisa");
  const [state, action, pending] = useActionState(savePayout, null);

  const isBank = method === "Bank transfer";

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <Wallet size={17} className="shrink-0 text-gold-deep" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink">Getting paid</div>
          <div className="text-xs text-dim">
            Esker settles with you directly. Add how you&apos;d like to be paid for when online payouts begin
            {hasSaved ? ` — ${saved.method} saved ✓` : ""}.
          </div>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-dim transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <form action={action} className="space-y-4 border-t border-line px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Payment method</span>
              <select name="method" value={method} onChange={(e) => setMethod(e.target.value)} className={input}>
                {PAYOUT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">{isBank ? "Account number / IBAN" : "Mobile / account number"}</span>
              <input
                name="number"
                defaultValue={saved.number}
                maxLength={40}
                inputMode={isBank ? "text" : "tel"}
                placeholder={isBank ? "PK.. IBAN or account no." : "03xx xxxxxxx"}
                className={input}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Account title <span className="font-normal text-dim">(optional)</span></span>
            <input name="title" defaultValue={saved.title} maxLength={80} placeholder="Account holder name" className={input} />
          </label>

          <div className="flex items-center gap-3">
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
          <p className="text-[11px] text-dim">Clear the number and save to remove your payout details.</p>
        </form>
      )}
    </div>
  );
}

const input = "w-full rounded-xl border border-line bg-bg/40 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/50";
