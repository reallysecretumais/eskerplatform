import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public view beacon: bumps the daily view counter for a listing. Dedup lives on
// the client (once per listing per day), and the DB write is an atomic upsert via
// the SECURITY DEFINER `bump_listing_view` fn — the table itself has no grants.
// Best-effort: any failure returns ok:false, never throws.
export async function POST(req: NextRequest) {
  try {
    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    if (!id || !UUID.test(id)) return Response.json({ ok: false }, { status: 400 });
    const admin = createAdminClient();
    await admin.rpc("bump_listing_view", { pid: id });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 200 });
  }
}
