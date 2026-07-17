import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReviewRequest } from "@/lib/notifyReview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Post-stay review nudge dispatcher. Runs daily via Vercel Cron (which sends
// `Authorization: Bearer $CRON_SECRET`); can also be POSTed manually / by the CRM
// with the shared REVALIDATE_SECRET. Finds account-linked stays that completed in
// the last few days and haven't been nudged, and sends each a gentle email +
// queues a WhatsApp. Idempotent via bookings.review_requested_at.

const LOOKBACK_DAYS = 7; // grace so a missed cron day still gets caught
const MAX_PER_RUN = 50;

function authorised(req: NextRequest): boolean {
  const bearer = req.headers.get("authorization");
  if (process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  const secret = req.headers.get("x-revalidate-secret") || new URL(req.url).searchParams.get("secret");
  if (process.env.REVALIDATE_SECRET && secret === process.env.REVALIDATE_SECRET) return true;
  return false;
}

async function run(req: NextRequest): Promise<Response> {
  if (!authorised(req)) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);

  // Every finished stay at one of OUR properties — account holders (email +
  // account deep link) AND WhatsApp bookings (tokened /review link; they have no
  // account, which used to exclude them entirely). "completed" too: CRM staff
  // often close a stay out before this daily cron fires. Resold external stays
  // are skipped — not our property to collect reviews for.
  const { data: due, error } = await admin
    .from("bookings")
    .select("id")
    .in("status", ["checked_out", "completed"])
    .eq("is_external", false)
    .not("property_id", "is", null)
    .is("review_requested_at", null)
    .gte("checkout", since)
    .lte("checkout", today)
    .order("checkout", { ascending: true })
    .limit(MAX_PER_RUN);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  let emailed = 0;
  let queued = 0;
  for (const b of due ?? []) {
    const r = await sendReviewRequest(b.id);
    if (r.emailed) emailed++;
    if (r.queuedWhatsapp) queued++;
  }

  return Response.json({ ok: true, processed: due?.length ?? 0, emailed, queuedWhatsapp: queued, at: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
