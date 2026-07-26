import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // The mobile app authenticates with `Authorization: Bearer <jwt>` and holds no
  // cookies. Cookie-session refresh has nothing to do there, and running it
  // would cost every API call an extra Supabase round-trip, so skip it.
  if (request.nextUrl.pathname.startsWith("/api/app/")) return NextResponse.next();
  return await updateSession(request);
}

export const config = {
  // Run on all routes except static assets and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
