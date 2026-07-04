"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Upload, ShieldCheck, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { createBooking, verifyIdUpload } from "@/app/book/actions";
import { payments } from "@/lib/payments";

type IdStatus = "idle" | "checking" | "ok" | "bad";

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
  const [docType, setDocType] = useState<"cnic" | "passport">("cnic");
  const [frontStatus, setFrontStatus] = useState<IdStatus>("idle");
  const [frontMsg, setFrontMsg] = useState<string | null>(null);
  const [backStatus, setBackStatus] = useState<IdStatus>("idle");
  const [backMsg, setBackMsg] = useState<string | null>(null);

  // Real-time ID check: validate each image (front/data page, or CNIC back) the
  // moment it's picked, so a bad/expired/wrong-side photo is caught here — not
  // after the whole form is filled.
  const checkSide =
    (side: "front" | "back", setStatus: (s: IdStatus) => void, setMsg: (m: string | null) => void) =>
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setMsg(null);
      if (!file) {
        setStatus("idle");
        return;
      }
      setStatus("checking");
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("side", side);
        const res = await verifyIdUpload(fd);
        if (res.ok) {
          setStatus("ok");
        } else {
          setStatus("bad");
          setMsg(res.message || "That image couldn't be verified. Please upload a clear, valid photo.");
        }
      } catch {
        // Network/transient error — don't hard-block; the server re-checks on submit.
        setStatus("ok");
      }
    };
  const onFrontIdChange = checkSide("front", setFrontStatus, setFrontMsg);
  const onBackIdChange = checkSide("back", setBackStatus, setBackMsg);

  const selectDocType = (t: "cnic" | "passport") => {
    setDocType(t);
    if (t === "passport") {
      // A passport has no back — drop any stale back result so it can't block.
      setBackStatus("idle");
      setBackMsg(null);
    }
  };

  // Block confirming while an ID is being checked or was rejected (an unselected
  // image doesn't block — returning guests already verified can skip it). The
  // back only matters for a CNIC.
  const backBlocking = docType === "cnic" && (backStatus === "checking" || backStatus === "bad");
  const idBlocking = frontStatus === "checking" || frontStatus === "bad" || backBlocking;

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

      {/* ID — first time only */}
      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">ID verification</h2>
        <p className="mt-1 text-sm text-muted">Must be valid and unexpired. Just for your first booking with Esker; next time, log in and skip this.</p>

        {/* Document type — a passport is one page; a CNIC has a front and back. */}
        <input type="hidden" name="docType" value={docType} />
        <div className="mt-3 inline-flex rounded-xl border border-line bg-surface p-1 text-sm">
          {(["cnic", "passport"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => selectDocType(t)}
              className={`rounded-lg px-3.5 py-1.5 font-medium transition ${docType === t ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
            >
              {t === "cnic" ? "CNIC" : "Passport"}
            </button>
          ))}
        </div>

        <div className={`mt-3 grid gap-3 ${docType === "cnic" ? "sm:grid-cols-2" : ""}`}>
          <div>
            <label className={label}>{docType === "cnic" ? "CNIC front" : "Passport (photo page)"}</label>
            <input name="cnicFront" type="file" accept="image/*" className={file} onChange={onFrontIdChange} />
            <IdStatusLine status={frontStatus} message={frontMsg} okText="Looks good — ID verified." checkingText="Checking your ID…" />
          </div>
          {docType === "cnic" && (
            <div>
              <label className={label}>CNIC back</label>
              <input name="cnicBack" type="file" accept="image/*" className={file} onChange={onBackIdChange} />
              <IdStatusLine status={backStatus} message={backMsg} okText="Looks good — back verified." checkingText="Checking the back…" />
            </div>
          )}
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
        <button type="submit" disabled={busy || idBlocking} className="w-full rounded-xl bg-gold px-5 py-3 text-sm font-medium text-ink transition hover:brightness-105 disabled:opacity-50">
          {busy ? "Confirming…" : frontStatus === "checking" || backStatus === "checking" ? "Checking your ID…" : `Pay ${advanceLabel} advance & confirm`}
        </button>
        {idBlocking && frontStatus !== "checking" && backStatus !== "checking" && (
          <p className="mt-2 text-center text-xs text-red">Please upload a valid ID above to continue.</p>
        )}
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

// Inline result line under an ID upload: spinner while checking, green tick when
// valid, red reason when rejected. Hidden until a file is picked.
function IdStatusLine({
  status,
  message,
  okText,
  checkingText,
}: {
  status: IdStatus;
  message: string | null;
  okText: string;
  checkingText: string;
}) {
  if (status === "idle") return null;
  return (
    <p className={`mt-1.5 inline-flex items-start gap-1.5 text-xs ${status === "ok" ? "text-green" : status === "bad" ? "text-red" : "text-muted"}`}>
      {status === "checking" && <Loader2 size={13} className="mt-0.5 shrink-0 animate-spin" />}
      {status === "ok" && <CheckCircle2 size={13} className="mt-0.5 shrink-0" />}
      {status === "bad" && <AlertCircle size={13} className="mt-0.5 shrink-0" />}
      {status === "checking" ? checkingText : status === "ok" ? okText : message}
    </p>
  );
}
