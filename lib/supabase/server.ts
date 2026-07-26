import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

/**
 * The mobile app's access token, when the caller is the app rather than a
 * browser. The app holds no cookies and sends `Authorization: Bearer <jwt>`.
 *
 * Reading it from `headers()` (instead of threading a token through every
 * function signature) is what lets the ENTIRE existing server layer — getAccount,
 * getMyBookings, every server action — serve the app unchanged. Browsers never
 * send this header to the site, so the web path is untouched.
 */
export async function bearerToken(): Promise<string | null> {
  try {
    const h = await headers();
    const m = (h.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
    return m?.[1]?.trim() || null;
  } catch {
    return null; // outside a request scope
  }
}

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 *
 * Uses the PUBLIC anon key. With no signed-in session this runs as the
 * anonymous role, so it only ever reads what RLS exposes to the public. This is
 * the client the public listing pages and the guest concierge read through.
 *
 * Two session sources, one client: a browser's cookies, or the mobile app's
 * Bearer token. Either way the client acts AS that user, so RLS stays the
 * security boundary — exactly as the CRM's mobile layer does it.
 */
export async function createClient() {
  const bearer = await bearerToken();
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // App callers authenticate per-request via the header. Cookie handlers stay
      // no-ops for them so a stray cookie can never override the token.
      ...(bearer ? { global: { headers: { Authorization: `Bearer ${bearer}` } } } : {}),
      cookies: bearer
        ? { getAll: () => [], setAll: () => {} }
        : {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options),
                );
              } catch {
                // Called from a Server Component — safe to ignore; middleware
                // refreshes the session cookie instead.
              }
            },
          },
    },
  );
}

/** True only when Supabase env vars are present (lets the app boot pre-setup). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
