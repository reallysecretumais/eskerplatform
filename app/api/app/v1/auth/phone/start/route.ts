import { ok, fail, guard, readJson } from "@/lib/app/api";
import { startPhoneAuth } from "@/app/auth/phone/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/app/v1/auth/phone/start — WhatsApp a sign-in code.
 * Body: { phone, name? }
 *
 * Wraps the website's own `startPhoneAuth`, so both faces find-or-create
 * accounts by identical rules: a guest who booked on the website signs into the
 * app and finds their trips, instead of quietly getting a second account.
 *
 * Public by design — this IS the sign-in. Abuse is bounded by the OTP engine's
 * own resend cooldown and attempt limit, not by auth.
 */
export const POST = guard(async (req: Request) => {
  const body = await readJson<{ phone?: string; name?: string }>(req);
  const phone = body?.phone?.trim();
  if (!phone) return fail("phone_required", "Enter your WhatsApp number.");

  const res = await startPhoneAuth(body?.name ?? "", phone);
  // The engine's messages are already guest-safe and specific ("Enter a valid
  // Pakistani mobile number", "Wait a minute before asking for a new code"), so
  // they pass straight through rather than being flattened into one generic line.
  if (!res.ok) return fail("otp_not_sent", res.message);

  // `devCode` is only ever populated when WhatsApp isn't configured — it lets us
  // exercise the flow without a live template, and is absent in production.
  return ok({ sent: true, message: res.message, devCode: res.devCode ?? null });
});
