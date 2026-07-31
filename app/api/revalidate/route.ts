import type { NextRequest } from "next/server";
import { bustListings } from "@/lib/cache";

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
  bustListings();
  return Response.json({ revalidated: true, at: new Date().toISOString() });
}
