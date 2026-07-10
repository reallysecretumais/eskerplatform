// Plain shared constants for the host portal — safe to import from both client
// components and server actions (a "use server" file may only export async
// functions, so these can't live in app/host/actions.ts).

// Local payout methods Pakistani hosts actually use. "Other" allows anything.
export const PAYOUT_METHODS = ["Easypaisa", "JazzCash", "SadaPay", "NayaPay", "UPaisa", "Bank transfer", "Raast", "Other"] as const;

// Minimum photos before a listing can be submitted for review — photos are the
// approval gate, so we require a real set, not just one.
export const MIN_LISTING_PHOTOS = 3;
export const MAX_LISTING_PHOTOS = 14;
