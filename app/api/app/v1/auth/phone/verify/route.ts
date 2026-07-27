import { ok, fail, guard, readJson } from "@/lib/app/api";
import { toE164Pk } from "@/lib/otp";
import { checkOtp, accountIdForPendingOtp, mintSessionTokens } from "@/lib/otpFlow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/app/v1/auth/phone/verify — check the code, return a session.
 * Body: { phone, code }
 *
 * The website's equivalent verifies onto a cookie; the app holds no cookies, so
 * it gets the tokens themselves to put in the OS keystore. Everything before the
 * mint — resolving the account, checking the code, stamping the phone verified —
 * is the shared engine, so the two faces can't drift on who a number belongs to
 * or how many attempts are allowed.
 */
export const POST = guard(async (req: Request) => {
  const body = await readJson<{ phone?: string; code?: string }>(req);
  const rawPhone = body?.phone?.trim();
  const code = body?.code?.trim();
  if (!rawPhone || !code) return fail("code_required", "Enter the code we sent you.");

  const e164 = toE164Pk(rawPhone);
  if (!e164) return fail("bad_phone", "Enter a valid Pakistani mobile number.");

  const accountId = await accountIdForPendingOtp(e164);
  if (!accountId) return fail("no_pending_code", "Ask for a code first.");

  const check = await checkOtp(accountId, code);
  // Wrong/expired/too-many-attempts all come back as guest-safe copy from the
  // engine. 401 rather than 400 so the app can tell "not you" from "bad request".
  if (!check.ok) return fail("bad_code", check.message, 401);

  const session = await mintSessionTokens(accountId);
  if (!session) {
    // The code WAS right — this is our failure, and it must not read as theirs.
    return fail("session_failed", "We couldn't finish signing you in. Please try again.", 500);
  }

  return ok({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
  });
});
