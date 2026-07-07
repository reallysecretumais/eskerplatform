// Real Esker payment accounts shown at checkout. Guests can send the amount into
// either account from any Easypaisa / JazzCash / bank transfer / SadaPay, then
// upload a screenshot of the transfer. (A real gateway slots in behind this later.)
export const payments = {
  title: "ESKER RENTALS",
  methods: ["Easypaisa", "JazzCash", "Bank transfer", "SadaPay"],
  accounts: [
    { bank: "Soneri Bank", number: "PK64SONE0041020015820404", primary: true },
    { bank: "Allied Bank", number: "13960010133695040020", primary: false },
  ],
} as const;

// Guest support contact (shown in emails / messages).
export const support = {
  whatsapp: "923325977626",
  email: "admin@eskerrentals.com",
} as const;

// Advance to secure a booking: 50% for Esker Exclusive, 25% otherwise — but never
// less than MIN_ADVANCE, and never more than the stay total (so a cheap day-use
// slot can't be asked for more than it costs). The balance is paid at/before
// check-in.
export const MIN_ADVANCE = 2000;

export function advancePct(eskerExclusive: boolean): number {
  return eskerExclusive ? 0.5 : 0.25;
}
export function advanceAmount(total: number, eskerExclusive: boolean): number {
  const pct = Math.round(total * advancePct(eskerExclusive));
  return Math.min(Math.max(pct, MIN_ADVANCE), Math.max(total, 0));
}

// Honest headline for the advance: the policy % normally, but "minimum" when the
// ₨2,000 floor lifted it above that %, or "full amount" for a sub-2k total.
export function advanceLabel(total: number, eskerExclusive: boolean): string {
  const adv = advanceAmount(total, eskerExclusive);
  if (adv >= total) return "full amount";
  if (adv > Math.round(total * advancePct(eskerExclusive))) return "minimum";
  return `${Math.round(advancePct(eskerExclusive) * 100)}%`;
}

// ── Host commission (single knob) ────────────────────────────────────────────
// Self-listed host stays are FREE for now — Esker takes 0%. When the business
// flips to a commission, change this ONE constant; the host earnings view (and
// later the payout math) read it from here. Fraction of the stay total, 0–1.
export const HOST_COMMISSION_PCT = 0;

export function hostCommission(total: number): number {
  return Math.round(Math.max(0, total) * HOST_COMMISSION_PCT);
}

// ── Cancellation policy (single source of truth) ─────────────────────────────
// Mirrors the published policy in app/legal/cancellation/page.tsx:
//   • 7 or more days before check-in  → full advance refunded
//   • 3 to 7 days before check-in     → 50% of the advance refunded
//   • less than 72 hours / no-show    → non-refundable
// Used by BOTH the account UI (preview) and the cancel action (authoritative), so
// the number a guest is shown is exactly the number they get.

export type CancellationTier = "7d" | "3-7d" | "72h";

export type CancellationQuote = {
  tier: CancellationTier;
  daysToCheckin: number; // whole calendar days from today to check-in
  refundPct: number; // 1 | 0.5 | 0
  refund: number; // PKR refunded to the guest (rounded down)
  retained: number; // PKR kept as the cancellation fee
  label: string; // guest-facing summary line
};

// Whole calendar days between today and the check-in date (date-only, so a stay
// exactly 7 dates away counts as 7 — matching "7 or more days before check-in").
function daysUntil(checkin: string, now: Date): number {
  const toMidnight = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const ci = new Date(`${checkin}T00:00:00`);
  return Math.round((toMidnight(ci) - toMidnight(now)) / 86_400_000);
}

export function cancellationQuote(checkin: string, advancePaid: number, now: Date = new Date()): CancellationQuote {
  const collected = Math.max(0, Math.round(Number(advancePaid) || 0));
  const days = daysUntil(checkin, now);

  let tier: CancellationTier;
  let refundPct: number;
  if (days >= 7) {
    tier = "7d";
    refundPct = 1;
  } else if (days >= 3) {
    tier = "3-7d";
    refundPct = 0.5;
  } else {
    tier = "72h";
    refundPct = 0;
  }

  const refund = Math.floor(collected * refundPct);
  const retained = collected - refund;
  const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;
  const label =
    refundPct === 1
      ? collected > 0
        ? `Full advance refunded (${pkr(refund)})`
        : "Cancel free of charge"
      : refundPct === 0.5
        ? `50% of your advance refunded (${pkr(refund)})`
        : "Non-refundable (within 72 hours of check-in)";

  return { tier, daysToCheckin: days, refundPct, refund, retained, label };
}
