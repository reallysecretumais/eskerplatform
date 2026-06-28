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
  // Launch markets — but the platform expands to more cities soon, so treat
  // "city" as a first-class dimension everywhere; never hardcode just these two.
  launchCities: ["Islamabad", "Rawalpindi"],
  expansionNote: "more cities soon",
  gold: "#C9A84C",
  // Team WhatsApp for "Request a price" (digits only, country code, no +).
  whatsapp: "923325977626",
  // Local payment methods shown as trust signals.
  payments: ["Easypaisa", "JazzCash", "Bank transfer", "SadaPay"],
} as const;

export type Brand = typeof brand;
