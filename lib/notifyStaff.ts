import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** In-app bell for every active staff member (best-effort, never throws).
 *  Single definition — used by account actions (cancellations), the external
 *  date-request flow, and any future website→staff alert. */
export async function notifyStaff(
  admin: ReturnType<typeof createAdminClient>,
  n: { title: string; body: string; link: string; type?: string },
): Promise<void> {
  try {
    const { data: staff } = await admin.from("users").select("id").eq("active", true);
    const rows = (staff ?? []).map((u: { id: string }) => ({
      user_id: u.id,
      type: n.type ?? "booking",
      title: n.title,
      body: n.body,
      link: n.link,
    }));
    if (rows.length) await admin.from("notifications").insert(rows);
  } catch {
    /* best-effort */
  }
}
