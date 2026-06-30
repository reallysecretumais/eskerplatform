"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<"email" | "phone">("email");
  const [intent, setIntent] = useState<"guest" | "owner">("guest");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const finish = () => {
    router.push("/account");
    router.refresh();
  };

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, account_type: intent },
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo("Almost there — check your email to confirm your account, then sign in.");
          return;
        }
        finish();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        finish();
      }
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) {
      setError("Enter your email above first, then tap reset.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/auth/reset` });
      if (error) throw error;
      setInfo("If that email has an account, a password-reset link is on its way.");
    } catch (err) {
      setError((err as Error).message || "Couldn't send the reset email. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitPhone = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone, options: { data: { account_type: "guest" } } });
      if (error) throw error;
      setInfo("If SMS is enabled, a one-time code is on its way.");
    } catch {
      setError("Phone login isn't switched on yet — it activates once the SMS provider is connected. Use email for now.");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/60";

  return (
    <div>
      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-full border border-line bg-surface-2 p-1">
        <button type="button" onClick={() => setTab("email")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${tab === "email" ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
          <Mail size={14} /> Email
        </button>
        <button type="button" onClick={() => setTab("phone")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${tab === "phone" ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
          <Phone size={14} /> Phone
        </button>
      </div>

      {tab === "email" ? (
        <form onSubmit={submitEmail} className="space-y-3">
          {mode === "signup" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setIntent("guest")} className={`rounded-xl border px-3 py-2.5 text-sm transition ${intent === "guest" ? "border-gold bg-gold/10 text-ink" : "border-line text-muted hover:text-ink"}`}>
                  Book stays
                </button>
                <button type="button" onClick={() => setIntent("owner")} className={`rounded-xl border px-3 py-2.5 text-sm transition ${intent === "owner" ? "border-gold bg-gold/10 text-ink" : "border-line text-muted hover:text-ink"}`}>
                  List my place
                </button>
              </div>
              <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </>
          )}
          <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <input className={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={6} />
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-gold px-5 py-2.5 text-sm font-medium text-ink transition hover:brightness-105 disabled:opacity-50">
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
          {mode === "login" && (
            <button type="button" onClick={forgot} disabled={busy} className="block w-full text-center text-xs text-muted hover:text-ink">
              Forgot password?
            </button>
          )}
        </form>
      ) : (
        <form onSubmit={submitPhone} className="space-y-3">
          <input className={input} type="tel" placeholder="Phone (e.g. 03xx xxxxxxx)" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-gold px-5 py-2.5 text-sm font-medium text-ink transition hover:brightness-105 disabled:opacity-50">
            {busy ? "Please wait…" : "Send code"}
          </button>
          <p className="text-center text-xs text-dim">Phone login switches on once the SMS provider is connected.</p>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red">{error}</p>}
      {info && <p className="mt-3 text-sm text-green">{info}</p>}

      <p className="mt-5 text-center text-sm text-muted">
        {mode === "signup" ? (
          <>Already have an account? <Link href="/login" className="text-gold-deep hover:underline">Sign in</Link></>
        ) : (
          <>New to Esker? <Link href="/signup" className="text-gold-deep hover:underline">Create an account</Link></>
        )}
      </p>
    </div>
  );
}
