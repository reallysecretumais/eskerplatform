"use client";

import { savePushSubscription } from "@/app/push/actions";

// Browser-side web-push enablement. Kept out of components so the request flow
// and any future "enable notifications" affordance share one implementation.
//
// LAW (carried from the mobile app): only ever request permission from a real
// user gesture — never on load. Callers gate this behind a tap.

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Register the SW, ask permission (must be inside a click handler), subscribe,
 *  and persist. Returns a coarse result the UI can react to. */
export async function enablePush(): Promise<"enabled" | "denied" | "unsupported" | "error"> {
  if (!pushSupported()) return "unsupported";
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return "unsupported";

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      }));

    const res = await savePushSubscription(sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } });
    return res.ok ? "enabled" : "error";
  } catch {
    return "error";
  }
}
