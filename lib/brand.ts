/**
 * Single source of truth for the consumer brand. The working name is a
 * placeholder — change it here once and it updates everywhere. Never hardcode
 * "Esker" in components; read from this object so the platform stays
 * re-nameable / re-skinnable.
 */
export const brand = {
  name: "Esker",
  short: "Esker",
  tagline: "Premium short stays, beautifully managed.",
  exclusiveTier: "Esker Exclusive",
  // Launch geography. The real dimension is the MARKET (a metro a guest would
  // travel within): Islamabad + Rawalpindi are ONE market, and Lahore/Karachi
  // arrive soon as their own. Markets + their cities live in the DB (`markets`,
  // `locations`) — these values are COPY ONLY (SEO strings, prose). Never filter
  // or branch on them, and never hardcode a city name anywhere else.
  launchCities: ["Islamabad", "Rawalpindi"],
  /** Human phrase for the launch market, used in prose and the AI prompt. */
  launchMarket: "Islamabad and Rawalpindi",
  expansionNote: "more cities soon",
  gold: "#C9A84C",
  // Team WhatsApp for "Request a price" (digits only, country code, no +).
  whatsapp: "923325977626",
  // Local payment methods shown as trust signals.
  payments: ["Easypaisa", "JazzCash", "Bank transfer", "SadaPay"],
} as const;

export type Brand = typeof brand;
