import { ok, fail, guard, readJson, unauthorized, appAccount } from "@/lib/app/api";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/app/v1/saves — the signed-in guest's saved stays (migration 23).
 *
 *   GET            { ids: string[] }  newest first
 *   POST  { ids }  add these (the phone's hearts, merged on sign-in, or one tap)
 *   DELETE { id }  remove one
 *
 * Runs on the guest's own session, so RLS is the guarantee that nobody reads or
 * writes anyone else's hearts. The cards themselves come from /search?ids, so
 * a saved stay always shows its live price and availability.
 */

export const GET = guard(async () => {
  const account = await appAccount();
  if (!account) return unauthorized();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_stays")
    .select("listing_id")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[saves] read failed:", error.message);
    return fail("saves_unavailable", "Couldn't load your saved stays. Please try again.", 503);
  }
  return ok({ ids: (data ?? []).map((r) => r.listing_id as string) });
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = guard(async (req: Request) => {
  const account = await appAccount();
  if (!account) return unauthorized();
  const body = await readJson<{ ids?: string[] }>(req);
  const ids = (body?.ids ?? []).filter((id) => typeof id === "string" && UUID.test(id)).slice(0, 200);
  if (!ids.length) return fail("ids_required", "Which stay are you saving?");
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_stays")
    .upsert(ids.map((listing_id) => ({ account_id: account.id, listing_id })), { onConflict: "account_id,listing_id", ignoreDuplicates: true });
  if (error) {
    console.error("[saves] add failed:", error.message);
    return fail("save_failed", "Couldn't save that stay. Please try again.", 503);
  }
  return ok({ saved: ids.length });
});

export const DELETE = guard(async (req: Request) => {
  const account = await appAccount();
  if (!account) return unauthorized();
  const body = await readJson<{ id?: string }>(req);
  const id = body?.id;
  if (!id || !UUID.test(id)) return fail("id_required", "Which stay are you removing?");
  const supabase = await createClient();
  const { error } = await supabase.from("saved_stays").delete().eq("account_id", account.id).eq("listing_id", id);
  if (error) {
    console.error("[saves] remove failed:", error.message);
    return fail("unsave_failed", "Couldn't remove that stay. Please try again.", 503);
  }
  return ok({ removed: true });
});
