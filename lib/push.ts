import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Web push sender. Best-effort by design — a guest always has the in-app message
// + email (+ WhatsApp on "available"), so push is the extra, never the path that
// blocks anything. Dead endpoints (410/404) are pruned so the table self-cleans.

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@eskerrentals.com", pub, priv);
  configured = true;
  return true;
}

export function pushConfigured(): boolean {
  return ensureConfigured();
}

type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Send a notification to every browser this account has subscribed. No-ops
 *  cleanly when VAPID isn't configured or the account has no subscriptions. */
export async function sendPush(accountId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("account_id", accountId);
  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
          body,
        );
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id as string); // gone — prune
        else console.error("[push] send failed:", code ?? (e as Error).message);
      }
    }),
  );

  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
}
