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

// Advance to secure a booking: 50% for Esker Exclusive, 25% otherwise.
// The balance is paid at/before check-in.
export function advancePct(eskerExclusive: boolean): number {
  return eskerExclusive ? 0.5 : 0.25;
}
export function advanceAmount(total: number, eskerExclusive: boolean): number {
  return Math.round(total * advancePct(eskerExclusive));
}
