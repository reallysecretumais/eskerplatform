import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { brand } from "@/lib/brand";
import { SITE_URL } from "@/lib/seo";

// Shared "someone replied in chat" email — throttled to one per recipient+event
// per 30 minutes via the guest_messages log (same mechanism as the CRM's
// notify-reply ping), so a rapid back-and-forth never spams anyone's inbox.
// Used for: host reply → guest, and guest message → host. Best-effort only.

const THROTTLE_MIN = 30;

export async function notifyChatEmail(opts: {
  to: string | null;
  name: string | null;
  event: string; // e.g. 'chat_reply' (to guest) | 'chat_msg_host' (to host)
  conversationId: string;
  headline: string; // "Your host replied…" / "A guest messaged you about {listing}"
  cta: string; // button label
  link: string; // absolute or site-relative
}): Promise<void> {
  const to = opts.to?.trim();
  if (!to) return;
  const admin = createAdminClient();

  try {
    const since = new Date(Date.now() - THROTTLE_MIN * 60_000).toISOString();
    const { data: recent } = await admin
      .from("guest_messages")
      .select("id")
      .eq("channel", "email")
      .eq("event", opts.event)
      .eq("recipient", to)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) return;

    const first = (opts.name ?? "").split(" ")[0] || "there";
    const link = opts.link.startsWith("http") ? opts.link : `${SITE_URL}${opts.link}`;
    const subject = opts.headline;
    const html = `<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <div style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#211f1a;">${brand.name}</div>
      <p style="color:#211f1a;font-size:15px;line-height:1.6;">Hi ${first} — ${opts.headline.charAt(0).toLowerCase()}${opts.headline.slice(1)}.</p>
      <a href="${link}" style="display:inline-block;background:#9c7d2e;color:#fff;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">${opts.cta}</a>
      <p style="color:#6b675e;font-size:12px;line-height:1.6;margin-top:18px;">You're receiving this because of your conversations on ${SITE_URL.replace(/^https?:\/\//, "")}.</p>
    </div>`;
    const text = `Hi ${first} — ${opts.headline} ${link}`;

    const res = await sendEmail({ to, subject, html, text });
    await admin.from("guest_messages").insert({
      channel: "email",
      event: opts.event,
      recipient: to,
      status: res.ok ? "sent" : "failed",
      error: res.ok ? null : (res.error ?? null),
      sent_at: res.ok ? new Date().toISOString() : null,
      payload: { conversation_id: opts.conversationId, subject },
    });
  } catch {
    /* best-effort — chat never breaks on email */
  }
}
