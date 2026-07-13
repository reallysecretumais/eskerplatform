import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Confirms an admin-issued email link (magic link / invite) via its token_hash,
// establishing the session SERVER-SIDE. Unlike the implicit-hash flow, this
// doesn't depend on Supabase's Site URL / redirect-allowlist config and has no
// first-paint redirect race — the session cookie is set before we redirect on.
// Used by the CRM's partner-portal invite (token_hash + next=/partner).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "magiclink") as EmailOtpType;
  const nextParam = searchParams.get("next") ?? "/account";
  const next = nextParam.startsWith("/") ? nextParam : `/${nextParam}`;

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
