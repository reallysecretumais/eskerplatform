import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { guestTitle } from "@/lib/listings";
import { pkDay } from "@/lib/pkDate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/platform/booking-confirmed — the CRM verified a guest's payment
 * (a bank transfer checked by the team: Esker OS verifyWebsiteBookingSvc), so
 * the guest hears it on their phone and in their browser: "You're booked."
 *
 * The CRM can't send this itself: guest push lives here (lib/push.ts), beside
 * the subscriptions it reads. Best-effort on both sides — the booking is
 * already confirmed in the database, and the trip pass shows it either way.
 *
 * Auth: `x-esker-secret`, the same shared secret as availability-replied.
 * Body: { bookingId }. A booking with no account (made over WhatsApp) has
 * nobody to push to, and says so.
 */
const ROUTE = "booking-confirmed";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fmt = (day: string) =>
  new Date(`${day}T00:00:00+05:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Karachi" });

export async function POST(req: NextRequest) {
  const secret = process.env.PLATFORM_API_SECRET || process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get("x-esker-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let bookingId: string | undefined;
  try {
    bookingId = ((await req.json()) as { bookingId?: string }).bookingId;
  } catch {
    return Response.json({ ok: false, route: ROUTE, message: "Invalid JSON." }, { status: 400 });
  }
  if (!bookingId || !UUID.test(bookingId)) {
    return Response.json({ ok: false, route: ROUTE, message: "A booking id is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: b } = await admin
    .from("bookings")
    .select("id, account_id, property_id, external_property_id, checkin, checkout, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b) return Response.json({ ok: false, route: ROUTE, message: "Booking not found." }, { status: 404 });
  if (!b.account_id) return Response.json({ ok: true, route: ROUTE, sent: false, message: "No guest account to notify." });

  const listingId = (b.property_id ?? b.external_property_id) as string | null;
  const { data: l } = listingId
    ? await admin.from("public_listings").select("title").eq("id", listingId).maybeSingle()
    : { data: null };
  const title = l?.title ? guestTitle(l.title as string) : "Your stay";
  const dates = b.checkin && b.checkout ? `${fmt(pkDay(b.checkin as string))}–${fmt(pkDay(b.checkout as string))}` : null;

  await sendPush(b.account_id as string, {
    title: "You're booked",
    body: `${title}${dates ? ` · ${dates}` : ""}. Your payment is confirmed. Tap for your trip pass.`,
    url: `/account/bookings/${b.id}`,
    tag: `confirmed-${b.id}`,
  });
  return Response.json({ ok: true, route: ROUTE, sent: true });
}
