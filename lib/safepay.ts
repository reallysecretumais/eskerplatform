import "server-only";

/**
 * Safepay hosted-checkout minting for WEBSITE bookings — sanctioned duplicate
 * of the checkout half of `Esker OS/lib/payments/safepay.ts` (which also owns
 * webhook verification: ALL Safepay webhooks land on the CRM, because both
 * apps share one database and the booking_id in tracker metadata is the whole
 * routing). Change one file, change both — each cites the other.
 *
 * Endpoints/headers read from Safepay's own SDK source (@sfpy/node-core
 * `main`, 2026-08-25). Fail-closed: no keys in THIS deployment's env → the
 * online-payment option never renders. The live site only ever gets
 * PRODUCTION keys; sandbox testing happens on a preview deployment.
 *
 *   SAFEPAY_ENV / SAFEPAY_API_KEY / SAFEPAY_SECRET_KEY   (per deployment)
 *
 * FEE POLICY mirrors the CRM: the gateway fee is SPLIT — Esker absorbs half,
 * the guest pays half as a surcharge on top of the quoted price (founder,
 * 28 Aug 2026). The rates below are SANDBOX-MEASURED, not Esker's contracted
 * production rate; confirm with Safepay in writing before go-live. This block
 * and lib/payments/safepay.ts in the CRM must stay identical.
 */

const HOSTS = {
  sandbox: "https://sandbox.api.getsafepay.com",
  production: "https://api.getsafepay.com",
} as const;
const CHECKOUT_HOSTS = {
  sandbox: "https://sandbox.api.getsafepay.com/embedded/",
  production: "https://getsafepay.com/embedded/",
} as const;

type SafepayEnv = keyof typeof HOSTS;
const env = (): SafepayEnv => (process.env.SAFEPAY_ENV === "production" ? "production" : "sandbox");

export function isSafepayConfigured(): boolean {
  return Boolean(process.env.SAFEPAY_API_KEY && process.env.SAFEPAY_SECRET_KEY);
}

const GATEWAY_FEE_RATE = 0.029; // 2.90% — sandbox-measured
const GATEWAY_FEE_TAX = 0.1517; // 15.17% tax ON the fee — sandbox-measured
export const GATEWAY_ALL_IN_RATE = GATEWAY_FEE_RATE * (1 + GATEWAY_FEE_TAX);
/** Esker's share of the gateway fee. 0.5 = half and half (founder, 28 Aug). */
export const ESKER_FEE_SHARE = 0.5;

/** `h = A·k/(1−k)` where `k = allInRate · guestShare` — solving it (rather than
 *  adding half of rate·A) is what makes the split genuinely even. */
export function feePolicy(amountPkr: number): {
  includeFees: boolean;
  chargeAmountPkr: number;
  surchargePkr: number;
} {
  const k = GATEWAY_ALL_IN_RATE * (1 - ESKER_FEE_SHARE);
  const surcharge = Math.round((amountPkr * k) / (1 - k));
  return { includeFees: true, chargeAmountPkr: amountPkr + surcharge, surchargePkr: surcharge };
}

async function api(path: string, body: unknown): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(`${HOSTS[env()]}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-sfpy-merchant-secret": process.env.SAFEPAY_SECRET_KEY ?? "",
    },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

export async function createSafepayCheckout(opts: {
  amountPkr: number;
  bookingId: string;
  redirectUrl: string;
  cancelUrl: string;
}): Promise<{ ok: true; url: string; tracker: string } | { ok: false; message: string }> {
  if (!isSafepayConfigured()) return { ok: false, message: "Online payment isn't available right now." };
  const amount = Math.round(opts.amountPkr);
  if (!Number.isFinite(amount) || amount < 1) return { ok: false, message: "Invalid amount." };
  // The guest is charged the quote plus their half of the gateway fee.
  const { includeFees, chargeAmountPkr } = feePolicy(amount);
  try {
    const session = await api("/order/payments/v3/", {
      merchant_api_key: process.env.SAFEPAY_API_KEY,
      intent: "CYBERSOURCE",
      mode: "payment",
      currency: "PKR",
      amount: chargeAmountPkr * 100, // paisa
      include_fees: includeFees,
      // Safepay whitelists metadata keys ("booking_id" is rejected) —
      // order_id carries our booking id. Mirrors the CRM copy.
      metadata: { order_id: opts.bookingId, source: "website" },
    });
    const tracker = (session.json as { data?: { tracker?: { token?: string } } } | null)?.data?.tracker?.token;
    if (!session.ok || !tracker) return { ok: false, message: "Couldn't start the payment — please try again." };

    const passport = await api("/client/passport/v1/token", {});
    const tbt = (passport.json as { data?: string } | null)?.data;
    if (!passport.ok || typeof tbt !== "string" || !tbt) return { ok: false, message: "Couldn't start the payment — please try again." };

    const qs = new URLSearchParams({
      environment: env(),
      tracker,
      tbt,
      source: "hosted",
      redirect_url: opts.redirectUrl,
      cancel_url: opts.cancelUrl,
    });
    return { ok: true, url: `${CHECKOUT_HOSTS[env()]}?${qs.toString()}`, tracker };
  } catch {
    return { ok: false, message: "Couldn't reach the payment provider — please try again." };
  }
}
