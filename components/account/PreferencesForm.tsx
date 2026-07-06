"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { updatePreferences } from "@/app/account/actions";

export function PreferencesForm({ notifyEmail, notifyWhatsapp, language }: { notifyEmail: boolean; notifyWhatsapp: boolean; language: "en" | "ur" }) {
  const [state, action, pending] = useActionState(updatePreferences, null);

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-6">
      <fieldset>
        <legend className="text-sm font-medium text-ink">How should we reach you?</legend>
        <p className="mt-0.5 text-xs text-dim">Booking updates and check-in details.</p>
        <div className="mt-3 space-y-2">
          <Toggle name="notify_email" label="Email" defaultChecked={notifyEmail} />
          <Toggle name="notify_whatsapp" label="WhatsApp" defaultChecked={notifyWhatsapp} />
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-ink">Language</legend>
        <div className="mt-3 flex gap-2">
          <Radio name="language" value="en" label="English" defaultChecked={language === "en"} />
          <Radio name="language" value="ur" label="Roman Urdu" defaultChecked={language === "ur"} />
        </div>
      </fieldset>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-60">
          {pending ? "Saving…" : "Save preferences"}
        </button>
        {state?.ok && (
          <span className="inline-flex items-center gap-1 text-sm text-green">
            <Check size={15} /> {state.message}
          </span>
        )}
        {state && !state.ok && <span className="text-sm text-red">{state.message}</span>}
      </div>
    </form>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-bg/40 px-3.5 py-2.5">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-[var(--color-gold,#C9A84C)]" />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}

function Radio({ name, value, label, defaultChecked }: { name: string; value: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-line bg-bg/40 px-3.5 py-2.5 has-[:checked]:border-gold/50 has-[:checked]:bg-gold/5">
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} className="h-4 w-4 accent-[var(--color-gold,#C9A84C)]" />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}
