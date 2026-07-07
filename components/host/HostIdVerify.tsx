"use client";

import { useActionState, useState } from "react";
import { ShieldCheck, Upload, Check } from "lucide-react";
import { submitHostId } from "@/app/host/actions";

// Host CNIC verification — both sides, AI-checked on submit (same check guests
// pass at booking). One-time; unlocks listing creation.
export function HostIdVerify() {
  const [state, action, pending] = useActionState(submitHostId, null);
  const [frontName, setFrontName] = useState<string | null>(null);
  const [backName, setBackName] = useState<string | null>(null);

  if (state?.ok) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-green/30 bg-green/5 p-4 text-sm font-medium text-green">
        <Check size={16} /> {state.message}
      </div>
    );
  }

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-gold-deep" />
        <span className="font-display text-base font-semibold tracking-tight text-ink">Verify your CNIC</span>
      </div>
      <p className="mt-1 text-xs text-dim">Required once before you can list. Checked instantly; stored privately.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Slot name="front" label="CNIC front" picked={frontName} onPick={setFrontName} />
        <Slot name="back" label="CNIC back" picked={backName} onPick={setBackName} />
      </div>

      {state && !state.ok && <p className="mt-3 text-sm text-red">{state.message}</p>}

      <button
        type="submit"
        disabled={pending || !frontName || !backName}
        className="mt-4 rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Verifying…" : "Verify identity"}
      </button>
    </form>
  );
}

function Slot({ name, label, picked, onPick }: { name: string; label: string; picked: string | null; onPick: (n: string) => void }) {
  return (
    <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-4 text-sm transition hover:bg-surface-2 ${picked ? "border-green/50 text-green" : "border-line-hi text-muted"}`}>
      {picked ? <Check size={15} /> : <Upload size={15} />}
      <span className="truncate">{picked ?? label}</span>
      <input type="file" name={name} accept="image/*" required className="sr-only" onChange={(e) => onPick(e.currentTarget.files?.[0]?.name ?? "")} />
    </label>
  );
}
