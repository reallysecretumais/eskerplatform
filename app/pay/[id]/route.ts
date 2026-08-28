import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSafepayCheckout, isSafepayConfigured } from "@/lib/safepay";

// Public tap target for WhatsApp pay-links: eskerrentals.com/pay/<anchor-id> —
// the frozen base URL of the approved `payment_link` template's button.
// Mirrors the CRM's app/pay/[id]/route.ts (the product-tier copy); this one
// exists so guests tap a brand-domain link. The checkout is minted at TAP time
// (Safepay's tbt token is short-lived; the anchor id is not), every mint
// carries the same anchor id, and a paid/cancelled anchor refuses to mint —
// which is what makes double payment structurally impossible.
export const dynamic = "force-dynamic";

/** How long a pay-link stays payable (founder, 28 Aug). The CRM's twin of this
 *  route carries the SAME constant — change one, change both. */
const PAY_LINK_TTL_DAYS = 7;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  // Meta stores a URL button as <frozen base> + {{1}}, and THIS button's base
  // ends in a literal {{1}} of its own (Graph returns it as %7B%7B1%7D%7D), so a
  // tapped link can arrive as /pay/{{1}}<anchor-id>. Recover the id from anywhere
  // in the segment rather than answer a guest holding real money with a dead
  // page. A correct link matches itself, so this changes nothing once the
  // template's button is fixed — it is a net, not a substitute for fixing it.
  const id = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? raw;
  if (id !== raw) console.warn(`[pay] malformed link segment "${raw}" — recovered anchor ${id}. FIX THE TEMPLATE BUTTON.`);
  const origin = req.nextUrl.origin;
  const gone = (why: string) => NextResponse.redirect(`${origin}/pay/closed?why=${why}`, 302);

  if (!/^[0-9a-f-]{36}$/i.test(id)) return gone("invalid");
  if (!isSafepayConfigured()) return gone("unavailable");

  const admin = createAdminClient();
  const { data: anchor } = await admin.from("gateway_payments").select("id, amount, status, created_at").eq("id", id).maybeSingle();
  if (!anchor) return gone("invalid");
  if (anchor.status === "paid" || anchor.status === "refunded") return gone("paid");
  if (anchor.status !== "pending") return gone("cancelled");

  // Links die after 7 days (founder, 28 Aug) — a pay-link carries a price that
  // was true when quoted, and dates we may since have sold. Checked at TAP
  // time so there is no scheduler to fail.
  const ageDays = (Date.now() - new Date(anchor.created_at).getTime()) / 86_400_000;
  if (ageDays > PAY_LINK_TTL_DAYS) {
    await admin
      .from("gateway_payments")
      .update({ status: "cancelled", last_error: `Expired automatically after ${PAY_LINK_TTL_DAYS} days.`, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    return gone("expired");
  }

  const checkout = await createSafepayCheckout({
    amountPkr: anchor.amount,
    bookingId: anchor.id, // metadata order_id carries the ANCHOR id
    redirectUrl: `${origin}/pay/done`,
    cancelUrl: `${origin}/pay/cancelled`,
  });
  if (!checkout.ok) return gone("error");

  await admin.from("gateway_payments").update({ tracker: checkout.tracker, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
  return NextResponse.redirect(checkout.url, 302);
}
