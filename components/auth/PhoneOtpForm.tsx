"use client";

import { useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { startPhoneAuth, completePhoneAuth } from "@/app/auth/phone/actions";

// Passwordless phone → WhatsApp-code sign-in/up. The ONE phone-auth UI, used by
// the signup/login pages and the AccountGateModal. Same UX idioms as
// PhoneVerifyCard: auto-submit on a full 6-digit code, paste-to-fill (WhatsApp
// Copy code), resend via "change number", dev-code hint when WhatsApp isn't
// configured locally.
export function PhoneOtpForm({
  showName = false,
  cta = "Continue with WhatsApp",
  onDone,
}: {
  /** Signup shows a name field; login hides it. */
  showName?: boolean;
  cta?: string;
  /** Called once the session cookie is set — caller refreshes/navigates. */
  onDone: () => void;
}) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setNote(null);
    setBusy(true);
    const res = await startPhoneAuth(name, num);
    setBusy(false);
    if (!res.ok) {
      setErr(res.message);
      return;
    }
    setStep("code");
    setNote(res.message + (res.devCode ? ` (dev code: ${res.devCode})` : ""));
    setTimeout(() => codeRef.current?.focus(), 50);
  };

  const verify = async (value?: string) => {
    const c = (value ?? code).replace(/\D/g, "").slice(0, 6);
    if (c.length !== 6 || busy) return;
    setErr(null);
    setBusy(true);
    const res = await completePhoneAuth(num, c);
    setBusy(false);
    if (!res.ok) {
      setErr(res.message);
      return;
    }
    onDone();
  };

  const onCodePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setCode(pasted);
      void verify(pasted);
    }
  };

  const input = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/60";

  return step === "phone" ? (
    <form onSubmit={send} className="space-y-3">
      {showName && (
        <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      )}
      <input
        className={input}
        type="tel"
        placeholder="Phone (e.g. 03xx xxxxxxx)"
        value={num}
        onChange={(e) => setNum(e.target.value)}
        inputMode="tel"
        autoComplete="tel"
        required
      />
      <button
        type="submit"
        disabled={busy || !num.trim() || (showName && !name.trim())}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gold px-5 py-2.5 text-sm font-medium text-ink transition hover:brightness-105 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />} {busy ? "Sending…" : cta}
      </button>
      <p className="text-center text-xs text-dim">We&rsquo;ll WhatsApp you a 6-digit code — no password needed.</p>
      {err && <p className="text-sm text-red">{err}</p>}
    </form>
  ) : (
    <div className="space-y-3">
      <input
        ref={codeRef}
        className={`${input} text-center tracking-[0.4em]`}
        value={code}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
          setCode(v);
          if (v.length === 6) void verify(v);
        }}
        onPaste={onCodePaste}
        placeholder="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="WhatsApp code"
      />
      <button
        type="button"
        onClick={() => void verify()}
        disabled={busy || code.length !== 6}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gold px-5 py-2.5 text-sm font-medium text-ink transition hover:brightness-105 disabled:opacity-50"
      >
        {busy && <Loader2 size={14} className="animate-spin" />} {busy ? "Checking…" : "Verify & continue"}
      </button>
      <button
        type="button"
        onClick={() => {
          setStep("phone");
          setCode("");
          setNote(null);
          setErr(null);
        }}
        className="block w-full text-center text-xs text-muted transition hover:text-ink"
      >
        Change number / resend
      </button>
      {note && <p className="text-xs text-green">{note}</p>}
      {err && <p className="text-sm text-red">{err}</p>}
    </div>
  );
}
