import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  prettyPk,
  generateCode,
  hashCode,
  sendWhatsappOtp,
  otpSendMessage,
  OTP_TTL_MIN,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SEC,
} from "@/lib/otp";

// ─────────────────────────────────────────────────────────────────────────────
// The one OTP engine. Used by BOTH:
//  - the signed-in "verify your WhatsApp number" card (app/account/actions.ts)
//  - the pre-auth phone signup/login flow (app/auth/phone/actions.ts)
// Codes live in `phone_otps` (service-role-only, one active code per account).
// On success the account's phone is stamped verified — for the pre-auth flow the
// account row already exists (created just before the code is sent).
// ─────────────────────────────────────────────────────────────────────────────

export type OtpResult = { ok: boolean; message: string; devCode?: string };

/** Generate + store + WhatsApp a code for this account (cooldown-guarded). */
export async function issueOtp(accountId: string, e164: string): Promise<OtpResult> {
  const admin = createAdminClient();

  // Resend cooldown — one code per minute.
  const { data: existing } = await admin.from("phone_otps").select("last_sent_at").eq("account_id", accountId).maybeSingle();
  if (existing?.last_sent_at) {
    const waited = (Date.now() - new Date(existing.last_sent_at as string).getTime()) / 1000;
    if (waited < OTP_RESEND_COOLDOWN_SEC) {
      return { ok: false, message: `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN_SEC - waited)}s before requesting another code.` };
    }
  }

  const code = generateCode();
  const now = new Date();
  const { error: upErr } = await admin.from("phone_otps").upsert({
    account_id: accountId,
    phone: e164,
    code_hash: hashCode(code, accountId),
    expires_at: new Date(now.getTime() + OTP_TTL_MIN * 60_000).toISOString(),
    attempts: 0,
    last_sent_at: now.toISOString(),
  });
  if (upErr) return { ok: false, message: "Could not start verification. Please try again." };

  const sent = await sendWhatsappOtp(e164, code);
  if (!sent.ok) {
    // Tell the guest what actually went wrong (billing, bad number, misconfig)
    // instead of one generic line — and clear the pending code so the cooldown
    // doesn't lock them out of retrying by another route.
    await admin.from("phone_otps").delete().eq("account_id", accountId);
    return { ok: false, message: otpSendMessage(sent) };
  }
  return { ok: true, message: `Code sent on WhatsApp to ${prettyPk(e164)}.`, devCode: sent.devCode };
}

/** Check the account's pending code; on success stamp the phone verified and
 *  clear the code. Attempts are capped; expiry enforced. */
export async function checkOtp(accountId: string, code: string): Promise<OtpResult> {
  const clean = (code || "").replace(/\D/g, "").slice(0, 6);
  if (clean.length !== 6) return { ok: false, message: "Enter the 6-digit code." };

  const admin = createAdminClient();
  const { data: otp } = await admin
    .from("phone_otps")
    .select("phone, code_hash, expires_at, attempts")
    .eq("account_id", accountId)
    .maybeSingle();
  if (!otp) return { ok: false, message: "Request a code first." };
  if (new Date(otp.expires_at as string).getTime() < Date.now()) {
    return { ok: false, message: "That code expired — request a new one." };
  }
  if ((otp.attempts as number) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, message: "Too many attempts — request a new code." };
  }

  if (hashCode(clean, accountId) !== otp.code_hash) {
    await admin.from("phone_otps").update({ attempts: (otp.attempts as number) + 1 }).eq("account_id", accountId);
    return { ok: false, message: "That code isn't right — try again." };
  }

  // Verified — set the account's phone + stamp, and clear the code.
  await admin.from("accounts").update({ phone: otp.phone, phone_verified_at: new Date().toISOString() }).eq("id", accountId);
  await admin.from("phone_otps").delete().eq("account_id", accountId);
  return { ok: true, message: "Your WhatsApp number is verified." };
}
