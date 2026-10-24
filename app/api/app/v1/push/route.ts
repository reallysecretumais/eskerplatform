import { ok, fail, guard, readJson, unauthorized, appAccount } from "@/lib/app/api";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/app/v1/push — where this phone gets the guest's notifications (migration 25).
 *
 *   POST   { token }  this phone's Expo push token belongs to the signed-in guest
 *   DELETE { token }  stop sending to this phone (signing out)
 *
 * The same table as the website's browser subscriptions, so every push the
 * website sends (lib/push.ts) reaches the app too. Writes are service-role,
 * as the website's own subscribe action does: the table's RLS lets a guest
 * read and delete their own rows, never write them. The token is unique, so a
 * phone that changes hands moves to whoever signed in last.
 */

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/;

export const POST = guard(async (req: Request) => {
  const account = await appAccount();
  if (!account) return unauthorized();
  const token = (await readJson<{ token?: string }>(req))?.token;
  if (!token || !EXPO_TOKEN.test(token)) return fail("token_invalid", "That isn't a notification token we recognise.");
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert({ account_id: account.id, endpoint: token, kind: "expo", p256dh: null, auth: null }, { onConflict: "endpoint" });
  if (error) {
    console.error("[push] register failed:", error.message);
    return fail("push_unavailable", "Couldn't turn on notifications just now.", 503);
  }
  return ok({ on: true });
});

export const DELETE = guard(async (req: Request) => {
  const account = await appAccount();
  if (!account) return unauthorized();
  const token = (await readJson<{ token?: string }>(req))?.token;
  if (!token || !EXPO_TOKEN.test(token)) return fail("token_invalid", "That isn't a notification token we recognise.");
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", token)
    .eq("account_id", account.id);
  if (error) {
    console.error("[push] unregister failed:", error.message);
    return fail("push_unavailable", "Couldn't turn off notifications just now.", 503);
  }
  return ok({ on: false });
});
