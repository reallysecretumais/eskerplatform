/**
 * Company identity + contact details, in one place.
 *
 * Published on /contact, in the site footer, and in the legal pages — payment
 * gateways (PayFast/Safepay) require a verifiable local address and a callable
 * phone number to be visible on the site, so these are deliberately public.
 *
 * `legalName` is the trading name we operate under. Do NOT append "(Pvt) Ltd" /
 * "AOP" or any corporate form unless the entity is actually registered that way —
 * it has to match the name on the payment-gateway account.
 */
export const company = {
  legalName: "Esker Rentals",
  tradingAs: "Esker Stays",

  /** Registered address for correspondence — NOT a guest-facing location.
   *  Guests never check in here; every stay is at its own property address.
   *  Always render this with `addressNote` so nobody turns up at the door. */
  address: {
    line1: "House No. 26, Sector A",
    line2: "6th Avenue, DHA Phase 5",
    city: "Islamabad",
    country: "Pakistan",
  },
  addressNote: "Registered office for correspondence only — not a guest check-in location.",

  /** Callable number, E.164. Same line as WhatsApp. */
  phone: "+923325977626",
  /** Digits only, no +, for wa.me links. */
  whatsapp: "923325977626",
  email: "admin@eskerrentals.com",

  /** Guest support availability. */
  hours: "Guest support available 24/7",

  /** Standard times — individual properties can differ, so always say "confirm". */
  checkIn: "2:00 PM",
  checkOut: "12:00 PM",
} as const;

/** One-line address for compact places (footer, structured data). */
export const addressOneLine = [
  company.address.line1,
  company.address.line2,
  company.address.city,
  company.address.country,
].join(", ");

export type Company = typeof company;
