"use client";

import { createContext, useContext, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Check, Loader2, Tag } from "lucide-react";
import { checkPromo } from "@/app/book/actions";
import { rs } from "@/lib/listings";

/**
 * A promo code at checkout. One small state, shared by the form (the field,
 * and the line it adds before payment) and the order summary beside it, so
 * both show the same numbers. The server judges every code (lib/promo.ts) on
 * Apply, and again when the booking is made; the refusal shown is the SQL's
 * own line. A promo only ever comes off what's paid at check-in.
 */

type Applied = { code: string; discount: number; balance: number };

type Ctx = {
  /** The stay as quoted: before any code. */
  base: { total: number; advance: number; balance: number };
  applied: Applied | null;
  error: string | null;
  apply: (a: Applied) => void;
  /** Drop the code and show why (a refusal), or silently (`null`). */
  drop: (why: string | null) => void;
};

const PromoCtx = createContext<Ctx | null>(null);

export function PromoProvider({ base, children }: { base: Ctx["base"]; children: ReactNode }) {
  const [applied, setApplied] = useState<Applied | null>(null);
  const [error, setError] = useState<string | null>(null);
  const value: Ctx = {
    base,
    applied,
    error,
    apply: (a) => {
      setApplied(a);
      setError(null);
    },
    drop: (why) => {
      setApplied(null);
      setError(why);
    },
  };
  return <PromoCtx.Provider value={value}>{children}</PromoCtx.Provider>;
}

export function usePromo() {
  const c = useContext(PromoCtx);
  if (!c) throw new Error("usePromo outside PromoProvider");
  const balance = c.applied ? c.applied.balance : c.base.balance;
  return { ...c, balance };
}

/** "Have a promo code?" — collapsed until asked for, then a field and Apply. */
export function PromoField({ propertyId, checkin, checkout, resume }: { propertyId: string; checkin: string; checkout: string; resume?: string }) {
  const { applied, error, apply, drop, base, balance } = usePromo();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);

  const run = async (form: HTMLFormElement | null) => {
    if (!code.trim() || checking) return;
    setChecking(true);
    try {
      const fd = new FormData();
      fd.set("promo", code);
      fd.set("propertyId", propertyId);
      fd.set("checkin", checkin);
      fd.set("checkout", checkout);
      // "First booking" is judged by the phone this checkout books with.
      fd.set("phone", (form?.elements.namedItem("phone") as HTMLInputElement | null)?.value ?? "");
      if (resume) fd.set("resume", resume);
      const r = await checkPromo(fd);
      if (r.ok) apply({ code: r.code, discount: r.discount, balance: r.balance });
      else drop(r.message);
    } catch {
      drop("We couldn't check that code just now. Please try again.");
    } finally {
      setChecking(false);
    }
  };
  const onApply = (e: MouseEvent<HTMLButtonElement>) => run(e.currentTarget.form);
  // Enter applies the code; it must never submit the whole booking.
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    run(e.currentTarget.form);
  };

  if (applied) {
    return (
      <div className="mt-3 rounded-[18px] bg-ice-tint p-4">
        {/* What the booking sends; the server judges it again. */}
        <input type="hidden" name="promo" value={applied.code} />
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
            <Check size={15} strokeWidth={2.2} /> {applied.code} applied: {rs(applied.discount)} off at check-in
          </span>
          <button type="button" onClick={() => drop(null)} className="-my-2 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-ink">
            Remove
          </button>
        </div>
        <div className="mt-2 space-y-1 text-[13px] text-brand-ink">
          <div className="flex justify-between">
            <span>Pay now</span>
            <span className="tnum font-semibold">{rs(base.advance)}</span>
          </div>
          <div className="flex justify-between">
            <span>At check-in</span>
            <span className="tnum">{rs(balance)}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="-my-2 mt-1 inline-flex items-center gap-1.5 py-2 text-sm font-semibold text-brand transition-colors hover:text-brand-ink">
        <Tag size={14} /> Have a promo code?
      </button>
    );
  }

  return (
    <div className="mt-3">
      <label htmlFor="co-promo" className="mb-1.5 block text-sm font-semibold text-ink">
        Promo code
      </label>
      <div className="flex gap-2">
        <input
          id="co-promo"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) drop(null);
          }}
          onKeyDown={onKey}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "co-promo-error" : undefined}
          className="h-12 min-w-0 flex-1 rounded-[14px] border border-line bg-surface px-4 text-[15px] uppercase tracking-[0.06em] text-ink outline-none transition-colors placeholder:normal-case placeholder:tracking-normal placeholder:text-dim focus:border-brand"
          placeholder="Enter code"
        />
        <button
          type="button"
          onClick={onApply}
          disabled={!code.trim() || checking}
          className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full px-5 text-[15px] font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-hi)] transition-colors hover:text-brand disabled:opacity-50"
        >
          {checking && <Loader2 size={15} className="animate-spin" />} Apply
        </button>
      </div>
      {error && (
        <p id="co-promo-error" role="alert" className="mt-1.5 text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}

/** The order summary's money: the stay, any promo line, and what's paid when. */
export function OrderMoney({ rateLabel, pctLabel }: { rateLabel: string; pctLabel: string }) {
  const { base, applied, balance } = usePromo();
  const total = base.total - (applied?.discount ?? 0);
  return (
    <>
      <div className="space-y-1.5 text-sm">
        <Row label={rateLabel} value={rs(base.total)} />
        {applied && <Row label={`Promo ${applied.code}`} value={rs(-applied.discount)} tone="brand" />}
      </div>
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-sm font-semibold text-ink">Total</span>
        <span className="tnum text-[15px] font-bold text-ink">{rs(total)}</span>
      </div>
      <div className="rounded-[18px] bg-ice-tint p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-brand-ink">
            Pay now <span className="font-medium">({pctLabel})</span>
          </span>
          <span className="tnum text-xl font-bold text-brand">{rs(base.advance)}</span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between text-[13px] text-brand-ink">
          <span>At check-in</span>
          <span className="tnum">{rs(balance)}</span>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "brand" }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted">{label}</span>
      <span className={`tnum ${tone === "brand" ? "font-semibold text-brand" : "text-ink"}`}>{value}</span>
    </div>
  );
}
