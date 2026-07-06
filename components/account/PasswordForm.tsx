"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { changePassword } from "@/app/account/actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-6">
      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm font-medium text-ink">New password</span>
        <input type="password" name="password" required minLength={8} autoComplete="new-password" className={input} placeholder="At least 8 characters" />
      </label>
      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Confirm new password</span>
        <input type="password" name="confirm" required minLength={8} autoComplete="new-password" className={input} placeholder="Repeat it" />
      </label>

      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-60">
          {pending ? "Updating…" : "Update password"}
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
