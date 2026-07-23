import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Short, clean reserve link for the "dates available" WhatsApp reminder — a
// WhatsApp URL button variable must be a tidy path (a raw ?checkin=…&checkout=…
// query is fragile at Meta), so the reminder points here with just the request
// id, and we redirect to the prefilled booking page. Also used anywhere we want
// one tap from "available" → book.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("external_date_requests")
    .select("external_property_id, checkin, checkout, status")
    .eq("id", id)
    .maybeSingle();

  // Unknown / not-yet-available → send them to the listing (or all stays) rather
  // than a dead end. Only an "available" request deep-links into booking.
  if (!data) return NextResponse.redirect(`${SITE_URL}/stays`);
  const row = data as { external_property_id: string; checkin: string; checkout: string; status: string };
  if (row.status !== "available") {
    return NextResponse.redirect(`${SITE_URL}/stays/${row.external_property_id}`);
  }
  return NextResponse.redirect(
    `${SITE_URL}/book/${row.external_property_id}?checkin=${row.checkin}&checkout=${row.checkout}`,
  );
}
