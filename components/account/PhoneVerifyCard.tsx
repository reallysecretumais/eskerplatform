"use client";

import { useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { BadgeCheck, MessageCircle, Loader2 } from "lucide-react";
import { sendPhoneOtp, verifyPhoneOtp } from "@/app/account/actions";

// "Verify your WhatsApp number" card. Enter number → send code → paste/type the
// 6-digit code → verified. Fast, on-brand, and the code field auto-fills when a
// 6-digit code is pasted (Copy-code from WhatsApp).
export function PhoneVerifyCard({ verified, phone }: { verified: boolean; phone: string | null }) {
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [num, setNum] = useState(phone ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(verified);
  const codeRef = useRef<HTMLInputElement>(null);

  if (done) {
    return (
      <div className="rounded-2xl border border-green/30 bg-green/[0.06] p-5">
        <div className="flex items-center gap-2.5">
          <BadgeCheck size={20} className="text-green" />
          <div>
            <div className="text-sm font-medium text-ink">WhatsApp number verified</div>
            {phone && <div className="text-xs text-muted">{phone}</div>}
          </div>
        </div>
      </div>
    );
  }

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setNote(null);
    setBusy(true);
    const res = await sendPhoneOtp(num);
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
    if (c.length !== 6) return;
    setErr(null);
    setBusy(true);
    const res = await verifyPhoneOtp(c);
    setBusy(false);
    if (!res.ok) {
      setErr(res.message);
      return;
    }
    setDone(true);
  };

  const onCodePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setCode(pasted);
      void verify(pasted); // auto-submit on a full pasted code
    }
  };

  const input = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/60";

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/12">
          <MessageCircle size={18} className="text-gold-deep" />
        </span>
        <div>
          <div className="text-sm font-medium text-ink">Verify your WhatsApp number</div>
          <div className="text-xs text-muted">Confirm your number so we can reach you about your stay.</div>
        </div>
      </div>

      {step === "idle" ? (
        <form onSubmit={send} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={num}
            onChange={(e) => setNum(e.target.value)}
            placeholder="03xx xxxxxxx"
            inputMode="tel"
            autoComplete="tel"
            aria-label="WhatsApp number"
            className={`${input} sm:flex-1`}
          />
          <button
            type="submit"
            disabled={busy || !num.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold px-5 py-2.5 text-sm font-medium text-ink transition hover:brightness-105 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Send code
          </button>
        </form>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            ref={codeRef}
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
            aria-label="Verification code"
            className={`${input} tracking-[0.4em] sm:flex-1`}
          />
          <button
            type="button"
            onClick={() => void verify()}
            disabled={busy || code.length !== 6}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold px-5 py-2.5 text-sm font-medium text-ink transition hover:brightness-105 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Verify
          </button>
        </div>
      )}

      {step === "code" && (
        <button
          type="button"
          onClick={() => {
            setStep("idle");
            setCode("");
            setNote(null);
            setErr(null);
          }}
          className="mt-2 text-xs text-muted transition hover:text-ink"
        >
          Change number / resend
        </button>
      )}

      {note && <p className="mt-2 text-xs text-green">{note}</p>}
      {err && <p className="mt-2 text-xs text-red">{err}</p>}
    </div>
  );
}
