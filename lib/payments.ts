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
