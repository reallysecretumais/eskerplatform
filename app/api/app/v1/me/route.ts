import { ok, guard, unauthorized, appAccount } from "@/lib/app/api";
import { getHomeMarket } from "@/lib/data/markets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/v1/me — who's signed in, from the app's Bearer token.
 *
 * The app calls this once after sign-in and on resume to confirm the session is
 * still good. A 401 here is the app's cue to re-authenticate, which is why every
 * other authed route returns the same shape for an expired token.
 *
 * Roles are ADDITIVE (guest / owner / partner) — one account can hold several,
 * and the app shows whichever portals the account actually has. Phase A renders
 * the guest surface only, but the roles ride along so Host and Partner need no
 * new endpoint.
 */
export const GET = guard(async () => {
  const account = await appAccount();
  if (!account) return unauthorized();

  const homeMarket = await getHomeMarket(account.id);

  return ok({
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone,
    phoneVerified: account.phoneVerified,
    roles: account.roles,
    avatarUrl: account.avatarUrl,
    language: account.language,
    notify: { email: account.notifyEmail, whatsapp: account.notifyWhatsapp },
    homeMarket,
  });
});
