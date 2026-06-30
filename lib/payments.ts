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
