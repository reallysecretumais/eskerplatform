import "server-only";
import { advanceAmount } from "@/lib/payments";

// ── Payment provider seam ────────────────────────────────────────────────────
// Today the advance is paid by manual transfer (Easypaisa / JazzCash / SadaPay /
// bank) and a screenshot the team verifies. This interface is the single seam a
// real Pakistani gateway (Safepay or PayFast) drops in behind later — the
// checkout/booking flow talks to a `PaymentProvider`, never to a specific vendor,
// so switching is a one-file change with no churn in `app/book/actions.ts`.
//
// NOT wired into the booking flow yet — `manualProvider` documents the current
// behaviour; a hosted-gateway implementation will be added when we go live.

export type ChargeRequest = {
  bookingId: string;
  amount: number; // PKR, the advance
  currency: "PKR";
  guest: { name: string; email?: string; phone: string };
  description: string;
};

// A charge that still needs human verification (manual) OR a hosted-checkout
// redirect (gateway). `status` mirrors what `booking_payments` records.
export type ChargeResult = {
  provider: string;
  reference: string; // our id for this charge (booking id / gateway order id)
  status: "pending_verification" | "redirect" | "paid" | "failed";
  redirectUrl?: string; // set when status === 'redirect'
  message?: string;
};

export interface PaymentProvider {
  readonly id: string;
  /** Begin collecting the advance. */
  createCharge(req: ChargeRequest): Promise<ChargeResult>;
  /** Confirm a charge actually settled (gateway webhook / manual verify). */
  verifyCharge(reference: string): Promise<{ paid: boolean; message?: string }>;
}

// Current reality: the guest transfers manually and uploads a screenshot; the
// team verifies it in the CRM. No money moves through code.
export const manualProvider: PaymentProvider = {
  id: "manual-screenshot",
  async createCharge(req) {
    return { provider: this.id, reference: req.bookingId, status: "pending_verification" };
  },
  async verifyCharge() {
    // Verification is the team confirming the screenshot in the CRM.
    return { paid: false, message: "Awaiting team verification of the payment screenshot." };
  },
};

// Single place the rest of the app asks "who collects payment right now". Swap the
// return value (env-gated) when a gateway is configured.
export function paymentProvider(): PaymentProvider {
  return manualProvider;
}

// Re-export the advance math so callers have one import for "what to charge".
export { advanceAmount };
