"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { updateProfile } from "@/app/account/actions";

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, null);

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-6">
      <Field label="Name">
        <input name="name" defaultValue={name} required maxLength={80} className={input} placeholder="Your name" />
      </Field>
      <Field label="Email" hint="This is your sign-in — contact us to change it.">
        <input value={email} disabled className={`${input} cursor-not-allowed opacity-60`} />
      </Field>
      <Field label="WhatsApp number" hint="Changing it here will ask you to re-verify below.">
        <input name="phone" defaultValue={phone} className={input} placeholder="03xx xxxxxxx" inputMode="tel" />
      </Field>

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-60">
          {pending ? "Saving…" : "Save changes"}
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

const input = "w-full rounded-xl border border-line bg-bg/40 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-gold/50";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-dim">{hint}</span>}
    </label>
  );
}
