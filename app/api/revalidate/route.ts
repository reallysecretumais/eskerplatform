import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";

// Cache-bust hook for the CRM. When an admin toggles a listing's publish flag or
// edits its public title/price/photos/facts, Esker OS pings this endpoint so the
// website reflects the change immediately (instead of waiting for the cache TTL).
// POST with the shared secret (header `x-revalidate-secret` or `?secret=`).
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret") || new URL(req.url).searchParams.get("secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Legacy 1-arg tag bust (busts the unstable_cache "listings" entries). Next 16's
  // type adds a 2nd cache-life arg for the new model; the runtime still accepts a
  // lone tag, and the 10-min TTL is the backstop either way.
  (revalidateTag as unknown as (tag: string) => void)("listings");
  return Response.json({ revalidated: true, at: new Date().toISOString() });
}
