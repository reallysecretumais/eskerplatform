"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Camera, ShieldCheck, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { createBooking, verifyIdUpload } from "@/app/book/actions";
import type { BankAccount } from "@/lib/bankAccounts";
import { HOLD_LINE } from "@/lib/booking/hold";

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
  accounts,
  safepayReady = false,
  cardDeclined = false,
}: {
  propertyId: string;
  checkin: string;
  checkout: string;
  advanceLabel: string;
  balanceLabel: string;
  pctLabel: string;
  prefill: Prefill;
  /** Read from the CRM's Settings by the server parent — this is a client
   *  component and can't read the database itself. */
  accounts: BankAccount[];
  /** Safepay keys exist on THIS deployment — the online option renders.
   *  Fail-closed: the live site shows nothing until production keys are set. */
  safepayReady?: boolean;
  /** Safepay sent the guest back without a payment. Their dates are still
   *  held; offer the other method (BUILD_REFERENCE "Payment failed"). */
  cardDeclined?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  // Online-first (founder decision): Safepay is the default whenever available;
  // bank transfer + screenshot stays one tap away for everyone else.
  const [payMethod, setPayMethod] = useState<"safepay" | "transfer">(safepayReady ? "safepay" : "transfer");
  const [error, setError] = useState<string | null>(
    cardDeclined ? "Your card payment didn't go through. Try again, or pay by bank transfer." : null,
  );
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
      if (res.ok && res.checkoutUrl) {
        // Safepay path: hand the guest to the hosted checkout. Full navigation
        // (not router.push — it's an external origin), and `busy` deliberately
        // STAYS true so the button can't double-fire while the browser leaves
        // (a `finally` reset here re-armed the button mid-navigation).
        window.location.assign(res.checkoutUrl);
        return;
      }
      if (res.ok) {
        router.push(`/book/${propertyId}/confirmation${res.bookingId ? `?b=${res.bookingId}` : ""}`);
        return;
      }
      setError(res.message || "Something went wrong.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setBusy(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  const label = "mb-1.5 block text-sm font-semibold text-ink";
  const input = "h-12 w-full rounded-[14px] border border-line bg-surface px-4 text-[15px] text-ink outline-none transition-colors placeholder:text-dim focus:border-brand";
  const heading = "headline text-2xl";

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-8">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="checkin" value={checkin} />
      <input type="hidden" name="checkout" value={checkout} />

      {error && <div className="rounded-[14px] bg-red/[0.08] p-3.5 text-sm text-red">{error}</div>}

      {/* Guest details */}
      <section>
        <h2 className={heading}>Your details</h2>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="co-name" className={label}>Full name</label>
            <input id="co-name" name="name" defaultValue={prefill.name} className={input} required autoComplete="name" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="co-phone" className={label}>Phone</label>
              <input id="co-phone" name="phone" type="tel" defaultValue={prefill.phone} className={input} required autoComplete="tel" placeholder="03xx xxxxxxx" />
            </div>
            <div>
              <label htmlFor="co-email" className={label}>Email</label>
              <input id="co-email" name="email" type="email" defaultValue={prefill.email} className={input} autoComplete="email" placeholder="you@email.com" />
            </div>
          </div>
        </div>
      </section>

      {/* ID — first time only */}
      <section>
        <h2 className={heading}>ID verification</h2>
        <p className="mt-1 text-sm text-muted">Must be valid and unexpired. Just for your first booking with Esker; next time, log in and skip this.</p>

        {/* Document type — a passport is one page; a CNIC has a front and back. */}
        <input type="hidden" name="docType" value={docType} />
        <div className="mt-3 inline-flex rounded-full bg-surface-2 p-1 text-sm">
          {(["cnic", "passport"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => selectDocType(t)}
              className={`h-10 rounded-full px-5 font-semibold transition-colors ${docType === t ? "bg-surface text-ink shadow-[0_1px_0_var(--color-line)]" : "text-muted hover:text-ink"}`}
            >
              {t === "cnic" ? "CNIC" : "Passport"}
            </button>
          ))}
        </div>

        <div className={`mt-3 grid gap-3 ${docType === "cnic" ? "sm:grid-cols-2" : ""}`}>
          <div>
            <FileTile
              id="co-id-front"
              name="cnicFront"
              label={docType === "cnic" ? "CNIC front" : "Passport (photo page)"}
              hint={docType === "cnic" ? "The side with your photo" : "The page with your photo"}
              onChange={onFrontIdChange}
            />
            <IdStatusLine status={frontStatus} message={frontMsg} okText="Looks good — ID verified." checkingText="Checking your ID…" />
          </div>
          {docType === "cnic" && (
            <div>
              <FileTile id="co-id-back" name="cnicBack" label="CNIC back" hint="The side with the address" onChange={onBackIdChange} />
              <IdStatusLine status={backStatus} message={backMsg} okText="Looks good — back verified." checkingText="Checking the back…" />
            </div>
          )}
        </div>
      </section>

      {/* Payment */}
      <section>
        <h2 className={heading}>Payment</h2>
        <p className="mt-1 text-sm text-muted">
          Pay the <span className="font-semibold text-ink">{pctLabel} advance, <span className="tnum">{advanceLabel}</span></span>, now to secure your booking. The balance, <span className="tnum">{balanceLabel}</span>, is paid at check-in.
        </p>

        {/* Method choice — online-first when Safepay is live on this deployment. */}
        {safepayReady && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="pay_method" value={payMethod} />
            <button
              type="button"
              onClick={() => setPayMethod("safepay")}
              aria-pressed={payMethod === "safepay"}
              className={payRow(payMethod === "safepay")}
            >
              <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <Tick on={payMethod === "safepay"} />
                Pay online now <span className="label rounded-full bg-ice-tint px-2 py-0.5 text-[10.5px] tracking-[0.1em] text-brand-ink">Recommended</span>
              </div>
              <div className="mt-1 pl-7 text-[13px] text-muted">Card, through Safepay&apos;s secure checkout. Confirms instantly.</div>
            </button>
            <button
              type="button"
              onClick={() => setPayMethod("transfer")}
              aria-pressed={payMethod === "transfer"}
              className={payRow(payMethod === "transfer")}
            >
              <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <Tick on={payMethod === "transfer"} />
                Bank transfer
              </div>
              <div className="mt-1 pl-7 text-[13px] text-muted">Send to an Esker account and upload your screenshot.</div>
            </button>
          </div>
        )}

        {payMethod === "safepay" ? (
          <p className="mt-3 text-sm text-muted">
            You&apos;ll be taken to Safepay&apos;s secure page to pay the {advanceLabel} advance — your booking confirms
            automatically the moment the payment goes through.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Send it by bank transfer to {accounts.length === 1 ? "the Esker account" : "any of the Esker accounts"} below, then
            upload your screenshot.
          </p>
        )}

        <div className={payMethod === "safepay" ? "hidden" : "mt-3 space-y-2"}>
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-[20px] bg-surface p-4 shadow-[0_1px_0_var(--color-line)]">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink">
                  {a.title} · {a.bank} {a.primary && <span className="label ml-1 rounded-full bg-ice-tint px-2 py-0.5 text-[10.5px] tracking-[0.1em] text-brand-ink">Primary</span>}
                </div>
                <div className="tnum truncate text-sm text-muted">{a.iban}</div>
              </div>
              <button type="button" onClick={() => copy(a.iban)} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-hi)] transition-colors hover:text-brand">
                {copied === a.iban ? <Check size={13} className="text-green" /> : <Copy size={13} />} {copied === a.iban ? "Copied" : "Copy"}
              </button>
            </div>
          ))}
        </div>

        <div className={payMethod === "safepay" ? "hidden" : "mt-4"}>
          {/* `required` only on the transfer path — a hidden required input
              blocks submit invisibly on the Safepay path. */}
          <FileTile
            id="co-proof"
            name="proof"
            label="Payment screenshot"
            hint="Your bank app's confirmation screen"
            required={payMethod !== "safepay"}
          />
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-[14px] bg-ice-tint px-3.5 py-3 text-[13px] text-brand-ink">
          <ShieldCheck size={15} className="mt-0.5 shrink-0" />
          Your advance is held securely and goes toward your stay. The balance is paid at check-in.
        </p>
      </section>

      <div>
        <button type="submit" disabled={busy || idBlocking} className="h-[58px] w-full rounded-full bg-brand px-5 text-base font-bold text-warm transition-colors hover:bg-brand-pressed disabled:opacity-50">
          {busy
            ? payMethod === "safepay" ? "Taking you to secure payment…" : "Confirming…"
            : frontStatus === "checking" || backStatus === "checking"
              ? "Checking your ID…"
              : `Pay ${advanceLabel} advance`}
        </button>
        {idBlocking && frontStatus !== "checking" && backStatus !== "checking" && (
          <p className="mt-2 text-center text-xs text-red">Please upload a valid ID above to continue.</p>
        )}
        <p className="mt-2 text-center text-xs text-muted">
          {payMethod === "safepay"
            ? `${HOLD_LINE.card} Your booking confirms the moment the payment goes through.`
            : HOLD_LINE.transfer}
        </p>
        <p className="mt-3 text-center text-xs text-muted">
          By confirming, you agree to Esker&apos;s{" "}
          <Link href="/legal/terms" className="text-brand underline hover:no-underline">Terms</Link>,{" "}
          <Link href="/legal/cancellation" className="text-brand underline hover:no-underline">Cancellation Policy</Link>, and{" "}
          <Link href="/legal/privacy" className="text-brand underline hover:no-underline">Privacy Policy</Link>.
        </p>
      </div>
    </form>
  );
}

// Payment row (BUILD_REFERENCE): white, radius 20; selected = a 2px Esker Blue
// ring and a filled check.
const payRow = (on: boolean) =>
  `min-h-16 rounded-[20px] bg-surface p-4 text-left transition-shadow ${
    on ? "shadow-[inset_0_0_0_2px_var(--color-brand)]" : "shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-hi)]"
  }`;

function Tick({ on }: { on: boolean }) {
  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${on ? "bg-brand text-warm" : "shadow-[inset_0_0_0_1.5px_var(--color-line-hi)]"}`} aria-hidden>
      {on && <Check size={12} strokeWidth={3} />}
    </span>
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

/**
 * An ID or payment-screenshot upload: a tile with a camera mark that shows the
 * picked photo, in place of the browser's "Choose File / No file chosen". The
 * real input covers the tile, transparent, so taps, keyboard focus, the
 * phone's camera-or-gallery sheet and `required` all behave natively.
 */
function FileTile({
  id,
  name,
  label,
  hint,
  required,
  onChange,
}: {
  id: string;
  name: string;
  label: ReactNode;
  hint: string;
  required?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [picked, setPicked] = useState<{ name: string; url: string } | null>(null);
  // Release each preview once it's replaced or the tile goes away.
  useEffect(
    () => () => {
      if (picked) URL.revokeObjectURL(picked.url);
    },
    [picked],
  );

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative flex min-h-[76px] items-center gap-3.5 rounded-[18px] border border-dashed border-line-hi bg-surface p-3 transition-colors hover:border-brand has-[:focus-visible]:border-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/25">
        {picked ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picked.url} alt="" className="h-[52px] w-[72px] shrink-0 rounded-[10px] object-cover" />
        ) : (
          <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px] bg-ice-tint text-brand">
            <Camera size={22} strokeWidth={1.8} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{picked ? picked.name : "Take a photo or upload"}</span>
          <span className="block text-[13px] text-muted">{picked ? "Tap to choose a different photo" : hint}</span>
        </span>
        <input
          id={id}
          name={name}
          type="file"
          accept="image/*"
          required={required}
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPicked(f ? { name: f.name, url: URL.createObjectURL(f) } : null);
            onChange?.(e);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}
