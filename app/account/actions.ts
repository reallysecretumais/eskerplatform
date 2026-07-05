"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  toE164Pk,
  prettyPk,
  generateCode,
  hashCode,
  sendWhatsappOtp,
  OTP_TTL_MIN,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SEC,
} from "@/lib/otp";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Self-grant the 'owner' role (RLS only permits guest/owner for one's own
// account; 'partner' is admin-granted and cannot be self-assigned).
export async function becomeHost() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("account_roles")
    .upsert({ account_id: user.id, role: "owner" }, { onConflict: "account_id,role", ignoreDuplicates: true });

  revalidatePath("/account");
}

// ── WhatsApp phone verification (OTP) ────────────────────────────────────────

export type OtpResult = { ok: boolean; message: string; devCode?: string };

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Send a WhatsApp OTP to the given number for the signed-in account. */
export async function sendPhoneOtp(rawPhone: string): Promise<OtpResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const e164 = toE164Pk(rawPhone);
  if (!e164) return { ok: false, message: "Enter a valid Pakistani mobile number." };

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
    if (sent.error === "not_configured") {
      return { ok: false, message: "WhatsApp verification isn't available yet — please verify by email for now." };
    }
    return { ok: false, message: "Couldn't send the code. Check the number and try again." };
  }
  return { ok: true, message: `Code sent on WhatsApp to ${prettyPk(e164)}.`, devCode: sent.devCode };
}

/** Verify the code the guest received; on success stamp the account verified. */
export async function verifyPhoneOtp(code: string): Promise<OtpResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

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
  revalidatePath("/account");
  return { ok: true, message: "Your WhatsApp number is verified." };
}
