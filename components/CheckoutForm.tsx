"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Upload, ShieldCheck } from "lucide-react";
import { createBooking } from "@/app/book/actions";
import { payments } from "@/lib/payments";

type Prefill = { name: string; email: string; phone: string };

export function CheckoutForm({
  propertyId,
  checkin,
  checkout,
  advanceLabel,
  balanceLabel,
  pctLabel,
  prefill,
}: {
  propertyId: string;
  checkin: string;
  checkout: string;
  advanceLabel: string;
  balanceLabel: string;
  pctLabel: string;
  prefill: Prefill;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await createBooking(fd);
      if (res.ok) {
        router.push(`/book/${propertyId}/confirmation`);
      } else {
        setError(res.message || "Something went wrong.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const label = "mb-1 block text-sm font-medium text-ink";
  const input = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/60";
  const file = "w-full rounded-xl border border-dashed border-line bg-surface px-3.5 py-2.5 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white";

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-8">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="checkin" value={checkin} />
      <input type="hidden" name="checkout" value={checkout} />

      {error && <div className="rounded-xl border border-red/40 bg-red/[0.06] p-3 text-sm text-red">{error}</div>}

      {/* Guest details */}
      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Your details</h2>
        <div className="mt-3 space-y-3">
          <div>
            <label className={label}>Full name</label>
            <input name="name" defaultValue={prefill.name} className={input} required autoComplete="name" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Phone</label>
              <input name="phone" defaultValue={prefill.phone} className={input} required autoComplete="tel" placeholder="03xx xxxxxxx" />
            </div>
            <div>
              <label className={label}>Email</label>
              <input name="email" type="email" defaultValue={prefill.email} className={input} autoComplete="email" placeholder="you@email.com" />
            </div>
          </div>
        </div>
      </section>

      {/* CNIC — first time only */}
      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">ID verification</h2>
        <p className="mt-1 text-sm text-muted">CNIC (front &amp; back) or passport — must be valid and unexpired. Just for your first booking with Esker; next time, log in and skip this.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>ID front</label>
            <input name="cnicFront" type="file" accept="image/*" className={file} />
          </div>
          <div>
            <label className={label}>ID back</label>
            <input name="cnicBack" type="file" accept="image/*" className={file} />
          </div>
        </div>
      </section>

      {/* Payment */}
      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Payment</h2>
        <p className="mt-1 text-sm text-muted">
          Pay the <span className="font-medium text-ink">{pctLabel} advance — {advanceLabel}</span> now to secure your booking (balance {balanceLabel} at check-in). Send it to either Esker account below — from {payments.methods.join(", ")} — then upload your screenshot.
        </p>

        <div className="mt-3 space-y-2">
          {payments.accounts.map((a) => (
            <div key={a.number} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">
                  {payments.title} · {a.bank} {a.primary && <span className="ml-1 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold-deep">Primary</span>}
                </div>
                <div className="truncate text-sm text-muted tnum">{a.number}</div>
              </div>
              <button type="button" onClick={() => copy(a.number)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink transition hover:bg-surface-2">
                {copied === a.number ? <Check size={13} className="text-green" /> : <Copy size={13} />} {copied === a.number ? "Copied" : "Copy"}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className={label}>
            <span className="inline-flex items-center gap-1.5"><Upload size={14} /> Payment screenshot</span>
          </label>
          <input name="proof" type="file" accept="image/*" className={file} required />
        </div>

        <p className="mt-3 inline-flex items-start gap-1.5 text-xs text-muted">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-gold" />
          Your advance is held securely and goes toward your stay. The balance is paid at check-in.
        </p>
      </section>

      <div>
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-gold px-5 py-3 text-sm font-medium text-ink transition hover:brightness-105 disabled:opacity-50">
          {busy ? "Confirming…" : `Pay ${advanceLabel} advance & confirm`}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          By confirming, you agree to Esker&apos;s{" "}
          <Link href="/legal/terms" className="text-gold-deep underline hover:no-underline">Terms</Link>,{" "}
          <Link href="/legal/cancellation" className="text-gold-deep underline hover:no-underline">Cancellation Policy</Link>, and{" "}
          <Link href="/legal/privacy" className="text-gold-deep underline hover:no-underline">Privacy Policy</Link>.
        </p>
      </div>
    </form>
  );
}
