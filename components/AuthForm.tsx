"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";

type Mode = "login" | "signup";

// Phone-first auth. Signup leads with the intent (Book stays / List my place):
// guests get the WhatsApp-code flow by default (no password), hosts get the
// email+password form (a listing business needs real credentials — phone + CNIC
// are then enforced by the /host verification checklist). Login defaults to the
// WhatsApp code too, with email+password one tap away.
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const supabase = createClient();

  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [intent, setIntent] = useState<"guest" | "owner">("guest");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const finish = (to = "/account") => {
    router.push(to);
    router.refresh();
  };

  // Hosts always use the email form; guests use whichever method is selected.
  const emailForm = mode === "signup" ? intent === "owner" || method === "email" : method === "email";

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
        finish(intent === "owner" ? "/host" : "/account");
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

  const input = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/60";

  return (
    <div>
      {/* Signup: what brings you here? */}
      {mode === "signup" && (
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setIntent("guest")} className={`rounded-xl border px-3 py-2.5 text-sm transition ${intent === "guest" ? "border-gold bg-gold/10 text-ink" : "border-line text-muted hover:text-ink"}`}>
              Book stays
            </button>
            <button type="button" onClick={() => setIntent("owner")} className={`rounded-xl border px-3 py-2.5 text-sm transition ${intent === "owner" ? "border-gold bg-gold/10 text-ink" : "border-line text-muted hover:text-ink"}`}>
              List my place
            </button>
          </div>
          {intent === "owner" && (
            <p className="mt-2 text-center text-xs text-dim">Listing needs a phone number, email and ID verification — start with your email below.</p>
          )}
        </div>
      )}

      {/* Login: method tabs (phone default) */}
      {mode === "login" && (
        <div className="mb-5 flex gap-1 rounded-full border border-line bg-surface-2 p-1">
          <button type="button" onClick={() => setMethod("phone")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${method === "phone" ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
            <MessageCircle size={14} /> WhatsApp
          </button>
          <button type="button" onClick={() => setMethod("email")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${method === "email" ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
            <Mail size={14} /> Email
          </button>
        </div>
      )}

      {emailForm ? (
        <form onSubmit={submitEmail} className="space-y-3">
          {mode === "signup" && (
            <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
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
          {mode === "signup" && intent === "guest" && (
            <button type="button" onClick={() => setMethod("phone")} className="block w-full text-center text-xs text-muted hover:text-ink">
              Use WhatsApp code instead — no password
            </button>
          )}
        </form>
      ) : (
        <div className="space-y-3">
          <PhoneOtpForm showName={mode === "signup"} cta={mode === "signup" ? "Create account with WhatsApp" : "Send my code"} onDone={() => finish()} />
          {mode === "signup" && (
            <button type="button" onClick={() => setMethod("email")} className="block w-full text-center text-xs text-muted hover:text-ink">
              Prefer email &amp; password?
            </button>
          )}
        </div>
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
