"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Store / remove a browser's web-push subscription for the signed-in guest.
// Writes are service-role (the table's RLS is read/delete-own only).

type SubJson = { endpoint: string; keys?: { p256dh?: string; auth?: string } };

export async function savePushSubscription(sub: SubJson): Promise<{ ok: boolean }> {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { ok: false };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };

  const admin = createAdminClient();
  // endpoint is unique — upsert re-points it at the current account if it moved.
  const { error } = await admin.from("push_subscriptions").upsert(
    { account_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: "endpoint" },
  );
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  if (!endpoint) return { ok: false };
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { ok: false };
  const admin = createAdminClient();
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("account_id", user.id);
  return { ok: true };
}
