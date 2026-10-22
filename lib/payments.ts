import { rs } from "@/lib/listings";
// Guests pay the advance by card (Safepay's hosted checkout) or by bank
// transfer into one of Esker's accounts, then upload a screenshot of it.
//
// ⚠️ THE ACCOUNTS BELOW ARE NO LONGER THE SOURCE OF TRUTH. They live in the
// CRM's Settings (`app_settings.payment_bank_accounts`), because opening or
// closing a bank account should take a founder a minute, not a deploy of the
// public website. Read them with `getBankAccounts()` from lib/data/bankAccounts.
//
// These stay as the FLOOR under that read, and must never be deleted: a
// checkout that renders zero accounts is a guest who came to pay and found
// nowhere to send the money, which fails silently and looks like a page that
// loaded fine. Keep them correct — they are what a database outage serves.
export const FALLBACK_ACCOUNTS = [
  { bank: "Soneri Bank", number: "PK64SONE0041020015820404", primary: true },
  { bank: "Allied Bank", number: "13960010133695040020", primary: false },
] as const;

export const payments = {
  title: "ESKER RENTALS",
} as const;

// ── How a guest can pay (app REBUILD_PLAN D2, §3.5) ──────────────────────────
// THE ONE LIST every guest-facing line that names a method reads: the
// homepage's Standard panel, the footer, the terms, the SEO description, the
// app's /config. It names only what works end to end today. A wallet joins the
// day its own integration ships, by setting `live: true` here — no copy hunt.
//
// Card is live only where Safepay's keys are set on THIS deployment (the
// checkout renders the card option on exactly the same test), so callers pass
// `isSafepayConfigured()` from lib/safepay. Kept as a parameter because this
// file is also read by client components, which can't see the keys.
type GuestMethod = {
  label: string;
  /** A brand name keeps its capital mid-sentence ("Easypaisa"); a common noun doesn't ("card"). */
  proper: boolean;
  /** How the terms describe paying this way. */
  terms: string;
  live: boolean;
  /** Needs Safepay's keys on this deployment. */
  card?: true;
};

const GUEST_METHODS: GuestMethod[] = [
  { label: "Card", proper: false, terms: "by card, through Safepay's secure checkout", live: true, card: true },
  { label: "Bank transfer", proper: false, terms: "by bank transfer, verified from the screenshot you upload", live: true },
  { label: "Easypaisa", proper: true, terms: "by Easypaisa", live: false },
  { label: "JazzCash", proper: true, terms: "by JazzCash", live: false },
  { label: "SadaPay", proper: true, terms: "by SadaPay", live: false },
];

function liveMethods(cardReady: boolean): GuestMethod[] {
  return GUEST_METHODS.filter((m) => m.live && (!m.card || cardReady));
}

/** "a, b or c" — the list as a guest reads it. */
function orList(words: string[]): string {
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}` : (words[0] ?? "");
}

/** Labels for lists and chips: ["Card", "Bank transfer"]. */
export function guestPaymentMethods(cardReady: boolean): string[] {
  return liveMethods(cardReady).map((m) => m.label);
}

/** Mid-sentence: "card or bank transfer". Capitalise it yourself at a sentence start. */
export function guestPaymentSentence(cardReady: boolean): string {
  return orList(liveMethods(cardReady).map((m) => (m.proper ? m.label : m.label.toLowerCase())));
}

/** For the terms: "by card, through Safepay's secure checkout, or by bank transfer, verified …". */
export function guestPaymentTerms(cardReady: boolean): string {
  const parts = liveMethods(cardReady).map((m) => m.terms);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")}, or ${parts[parts.length - 1]}` : (parts[0] ?? "");
}

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
// Rs 2,000 floor lifted it above that %, or "full amount" for a sub-2k total.
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
  const pkr = rs;
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
