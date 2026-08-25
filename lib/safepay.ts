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
 * FEE POLICY mirrors the CRM: guest pays the gateway fee on top
 * (include_fees) — a future partial-absorb lives in feePolicy() here and in
 * the CRM copy together.
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

export function feePolicy(_amountPkr: number): { includeFees: boolean } {
  return { includeFees: true };
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
  try {
    const session = await api("/order/payments/v3/", {
      merchant_api_key: process.env.SAFEPAY_API_KEY,
      intent: "CYBERSOURCE",
      mode: "payment",
      currency: "PKR",
      amount: amount * 100, // paisa
      include_fees: feePolicy(amount).includeFees,
      metadata: { booking_id: opts.bookingId, source: "website" },
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
