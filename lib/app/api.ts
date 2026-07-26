import "server-only";
import { getAccount, type Account } from "@/lib/auth";

/**
 * Shared plumbing for the `/api/app/v1` routes — the Esker Rentals mobile API.
 *
 * DESIGN RULE (see `Esker Platform (app)/CLAUDE.md`): these routes WRAP the
 * website's existing server layer, they never re-implement it. That works
 * because `lib/supabase/server.ts` resolves a session from either cookies (web)
 * or the app's `Authorization: Bearer <jwt>` — so `getAccount()`,
 * `getMyBookings()`, and every server action already behave correctly here.
 * If you find yourself copying logic out of an actions file, stop and import it.
 *
 * Mirrors the CRM's `lib/mobile/auth.ts` on purpose: same Bearer scheme, same
 * thin-route shape, so the two mobile clients stay consistent.
 */

/** JSON success. */
export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data as object, { status: 200, ...init });
}

/**
 * JSON failure. `code` is a stable machine string the app switches on; `message`
 * is safe to show a guest as-is (plain language, no internals) — the app should
 * never have to invent copy for a server failure.
 */
export function fail(code: string, message: string, status = 400): Response {
  return Response.json({ error: code, message }, { status });
}

export function unauthorized(): Response {
  return fail("unauthorized", "Please sign in again.", 401);
}

export function notFound(message = "Not found."): Response {
  return fail("not_found", message, 404);
}

/** Body parse that never throws — a malformed body is a 400, not a 500. */
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/**
 * The signed-in guest, or null. Deliberately does NOT use `requireAccount()` —
 * that redirects to /login, which is meaningless to an API client and would
 * surface as a mystery 3xx in the app.
 */
export async function appAccount(): Promise<Account | null> {
  return getAccount();
}

/** The context Next hands a route handler (dynamic segments, already awaited-able). */
type RouteCtx = { params: Promise<Record<string, string>> };

/**
 * Wrap a handler so an unexpected throw becomes a clean JSON 500 instead of an
 * HTML error page — an app parsing JSON would otherwise fail on the response
 * itself and report something misleading to the guest.
 */
export function guard<C extends RouteCtx = RouteCtx>(handler: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      console.error("[api/app] unhandled:", e);
      return fail("server_error", "Something went wrong on our side. Please try again.", 500);
    }
  };
}
