import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tell the founders (CRM admins) a fresh guest review is waiting for approval.
 * Reviews no longer publish instantly — the CRM's Team → Reviews queue is the
 * gate — so without this ping a five-star review could sit invisible for days. Writes straight into the shared `notifications` table
 * (recipient-scoped RLS; inserts are service-role, same as the CRM's own
 * notify helpers). Best-effort: a failed ping must never fail the guest's
 * submit.
 */
export async function notifyReviewPending(propertyName: string, stayRating: number): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: admins } = await admin.from("users").select("id").eq("active", true).eq("role", "admin");
    const rows = (admins ?? []).map((u: { id: string }) => ({
      user_id: u.id,
      type: "property",
      title: "New guest review awaiting approval",
      body: `${propertyName} · ${stayRating}★ — approve it to show it on the website.`,
      link: "/team/reviews",
      actor_id: null,
    }));
    if (rows.length) await admin.from("notifications").insert(rows);
  } catch {
    /* best-effort */
  }
}
