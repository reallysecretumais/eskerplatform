import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // The mobile app authenticates with `Authorization: Bearer <jwt>` and holds no
  // cookies. Cookie-session refresh has nothing to do there, and running it
  // would cost every API call an extra Supabase round-trip, so skip it.
  if (request.nextUrl.pathname.startsWith("/api/app/")) {
    // CORS for the app API. Safe to allow any origin here because these routes
    // carry NO ambient credentials — there is no cookie session on this path, and
    // a Bearer token is never attached automatically by a browser. So a hostile
    // page can reach only the same public data it could fetch server-side anyway.
    // Needed for a future Expo web/PWA build and for running the app against a
    // dev server on a different port.
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders() });
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(corsHeaders())) res.headers.set(k, v);
    return res;
  }
  return await updateSession(request);
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export const config = {
  // Run on all routes except static assets and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
