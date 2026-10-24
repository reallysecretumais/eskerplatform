import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Guest push sender: browsers (web push) and the Esker Rentals app (Expo push →
// FCM / APNs), from the one push_subscriptions table (migration 25). Best-effort
// by design — a guest always has the in-app message + email (+ WhatsApp on
// "available"), so push is the extra, never the path that blocks anything.
// Dead endpoints (web 410/404, app DeviceNotRegistered) are pruned so the table
// self-cleans.

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

/** `url` is a website path; the app maps it to its own screen (its src/lib/push.ts). */
type PushPayload = { title: string; body: string; url?: string; tag?: string };

type Sub = { id: string; kind: string | null; endpoint: string; p256dh: string | null; auth: string | null };

export async function sendPush(accountId: string, payload: PushPayload): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("push_subscriptions")
    .select("id, kind, endpoint, p256dh, auth")
    .eq("account_id", accountId);
  const subs = (data ?? []) as Sub[];
  if (subs.length === 0) return;

  const web = subs.filter((s) => (s.kind ?? "web") === "web");
  const app = subs.filter((s) => s.kind === "expo");
  const [deadWeb, deadApp] = await Promise.all([sendWeb(web, payload), sendApp(app, payload)]);
  const dead = [...deadWeb, ...deadApp];
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
}

/** Web push to each browser; returns the ids of endpoints that are gone. */
async function sendWeb(subs: Sub[], payload: PushPayload): Promise<string[]> {
  if (subs.length === 0 || !ensureConfigured()) return [];
  const body = JSON.stringify(payload);
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh ?? "", auth: s.auth ?? "" } }, body);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id); // gone — prune
        else console.error("[push] send failed:", code ?? (e as Error).message);
      }
    }),
  );
  return dead;
}

/**
 * Expo push to each phone: one HTTPS POST, the same service the CRM's staff
 * app uses. Returns the ids of tokens Expo says no longer exist (the app was
 * uninstalled). Any other refusal is logged, never pruned: a token that failed
 * once on a bad day is still the guest's phone.
 */
async function sendApp(subs: Sub[], payload: PushPayload): Promise<string[]> {
  if (subs.length === 0) return [];
  const messages = subs.map((s) => ({
    to: s.endpoint,
    title: payload.title,
    body: payload.body,
    sound: "default",
    priority: "high",
    channelId: "default",
    data: { url: payload.url ?? null, tag: payload.tag ?? null },
  }));
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      console.error("[push] app send failed:", res.status);
      return [];
    }
    const json = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
    const dead: string[] = [];
    (json?.data ?? []).forEach((t, i) => {
      if (t.status !== "error") return;
      if (t.details?.error === "DeviceNotRegistered") dead.push(subs[i].id);
      else console.error("[push] app ticket error:", t.details?.error ?? "unknown");
    });
    return dead;
  } catch (e) {
    console.error("[push] app send failed:", (e as Error).message);
    return [];
  }
}
