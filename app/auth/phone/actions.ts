"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toE164Pk } from "@/lib/otp";
import { issueOtp, checkOtp, type OtpResult } from "@/lib/otpFlow";

// ─────────────────────────────────────────────────────────────────────────────
// Passwordless signup/login by WhatsApp OTP — the default way guests get an
// account. Two steps:
//   startPhoneAuth(name, phone)  → find-or-create the account, WhatsApp a code
//   completePhoneAuth(phone, code) → verify, then mint a real session
//
// Session mint: Supabase can't sign in a phone-only user without an SMS
// provider, so accounts created here get a synthetic email we control
// (wa<E164>@guest.eskerrentals.com — never receives mail). After the code
// checks out we generateLink(magiclink) for the user's email and verify its
// token_hash on the SSR client, which sets the session cookie server-side —
// the exact pattern already proven by /auth/confirm (partner invites).
// ─────────────────────────────────────────────────────────────────────────────

const syntheticEmail = (e164: string) => `wa${e164}@guest.eskerrentals.com`;

/** The account a phone number belongs to (verified numbers win; else oldest). */
async function findAccountByPhone(admin: ReturnType<typeof createAdminClient>, e164: string): Promise<string | null> {
  const { data } = await admin
    .from("accounts")
    .select("id, phone_verified_at, created_at")
    .or(`phone.eq.${e164},phone.eq.+${e164}`)
    .order("phone_verified_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/** Step 1 — find or create the account for this number, then WhatsApp a code. */
export async function startPhoneAuth(name: string, rawPhone: string): Promise<OtpResult> {
  const e164 = toE164Pk(rawPhone);
  if (!e164) return { ok: false, message: "Enter a valid Pakistani mobile number (e.g. 03xx xxxxxxx)." };

  const admin = createAdminClient();

  // Existing account with this number (incl. ones provisioned at booking time —
  // reusing it prevents a second account for the same guest).
  let accountId = await findAccountByPhone(admin, e164);

  if (!accountId) {
    const email = syntheticEmail(e164);
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: (name || "").trim().slice(0, 80) || "Guest", account_type: "guest", phone: `+${e164}` },
    });
    if (created?.user) {
      accountId = created.user.id;
    } else {
      // A previous signup attempt may have created the user but never verified
      // (accounts.phone unstamped) — reuse it via the synthetic email.
      const { data: prior } = await admin.from("accounts").select("id").eq("email", email).maybeSingle();
      accountId = (prior?.id as string) ?? null;
      if (!accountId) {
        console.error("[phone-auth] createUser failed:", error?.message);
        return { ok: false, message: "Couldn't start sign-in. Please try again." };
      }
    }
  }

  return issueOtp(accountId, e164);
}

export type PhoneAuthResult = { ok: boolean; message: string };

/** Step 2 — check the code, then sign the browser in (session cookie). */
export async function completePhoneAuth(rawPhone: string, code: string): Promise<PhoneAuthResult> {
  const e164 = toE164Pk(rawPhone);
  if (!e164) return { ok: false, message: "Enter a valid Pakistani mobile number." };

  const admin = createAdminClient();

  // The pending code identifies the exact account this attempt belongs to.
  const { data: pending } = await admin
    .from("phone_otps")
    .select("account_id")
    .eq("phone", e164)
    .order("last_sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const accountId = pending?.account_id as string | undefined;
  if (!accountId) return { ok: false, message: "Request a code first." };

  const check = await checkOtp(accountId, code);
  if (!check.ok) return { ok: false, message: check.message };

  // Mint the session: magic-link token for this user's email, verified
  // server-side so the cookie is set with no redirect round-trip.
  const { data: authUser } = await admin.auth.admin.getUserById(accountId);
  const email = authUser?.user?.email;
  if (!email) return { ok: false, message: "Couldn't sign you in. Please try again." };

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    console.error("[phone-auth] generateLink failed:", linkErr?.message);
    return { ok: false, message: "Couldn't sign you in. Please try again." };
  }

  const session = await createClient();
  const { error: verifyErr } = await session.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verifyErr) {
    console.error("[phone-auth] verifyOtp failed:", verifyErr.message);
    return { ok: false, message: "Couldn't sign you in. Please try again." };
  }

  return { ok: true, message: "You're in." };
}
