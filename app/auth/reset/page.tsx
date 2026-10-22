"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EskerLogo } from "@/components/EskerLogo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => {
        router.push("/account");
        router.refresh();
      }, 1200);
    } catch {
      setError("Couldn't update your password. Please open the reset link from your email again, then retry.");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-brand/40";

  return (
    <main className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center text-ink">
          <EskerLogo />
        </Link>
        <h1 className="headline text-center text-[34px] text-ink">Set a new password</h1>
        <p className="mt-1 text-center text-sm text-muted">Choose a new password for your Esker account.</p>

        {done ? (
          <p className="mt-6 rounded-xl border border-green/40 bg-green/[0.06] p-3 text-center text-sm text-green">Password updated — taking you to your account…</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input className={input} type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={6} />
            <button type="submit" disabled={busy} className="w-full rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-warm transition hover:bg-brand-pressed disabled:opacity-50">
              {busy ? "Updating…" : "Update password"}
            </button>
            {error && <p className="text-sm text-red">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
