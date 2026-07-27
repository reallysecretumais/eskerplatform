import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ok, fail, guard, readJson } from "@/lib/app/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/app/v1/auth/refresh — trade a refresh token for a fresh session.
 * Body: { refreshToken }
 *
 * Access tokens last an hour. Without this the app would sign a guest out mid-
 * stay — which is precisely when they need their key. The app calls this on a
 * 401 and retries once.
 *
 * Stateless client: it exchanges the token and hands back the result rather than
 * persisting a session server-side.
 */
export const POST = guard(async (req: Request) => {
  const body = await readJson<{ refreshToken?: string }>(req);
  const refreshToken = body?.refreshToken?.trim();
  if (!refreshToken) return fail("refresh_required", "Please sign in again.", 401);

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    // Expired or revoked — the app clears its keystore and shows the sign-in
    // sheet the next time an action needs an account.
    return fail("refresh_failed", "Please sign in again.", 401);
  }

  return ok({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at ?? null,
  });
});
