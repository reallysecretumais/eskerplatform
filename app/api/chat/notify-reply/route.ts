import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { brand } from "@/lib/brand";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";

// The CRM pings this (fire-and-forget, shared REVALIDATE_SECRET) after a staff
// member replies on a website thread. If the guest isn't watching the chat, a
// short branded email brings them back — throttled to one per conversation per
// 30 minutes via the guest_messages log, so a rapid staff exchange never spams.

const THROTTLE_MIN = 30;

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let conversationId = "";
  try {
    const body = await req.json();
    conversationId = String(body?.conversationId ?? "");
  } catch {
    /* fall through */
  }
  if (!conversationId) return NextResponse.json({ ok: false, error: "missing conversationId" }, { status: 400 });

  const admin = createAdminClient();

  // The thread's guest account (website channel only).
  const { data: convo } = await admin
    .from("conversations")
    .select("id, channel, account_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo || convo.channel !== "website" || !convo.account_id) {
    return NextResponse.json({ ok: false, error: "not a website thread" }, { status: 404 });
  }
  const { data: account } = await admin.from("accounts").select("email, name").eq("id", convo.account_id).maybeSingle();
  const to = (account?.email as string) ?? null;
  if (!to) return NextResponse.json({ ok: true, skipped: "no email" });

  // Throttle: one ping per conversation per THROTTLE_MIN.
  const since = new Date(Date.now() - THROTTLE_MIN * 60_000).toISOString();
  const { data: recent } = await admin
    .from("guest_messages")
    .select("id")
    .eq("channel", "email")
    .eq("event", "chat_reply")
    .eq("recipient", to)
    .gte("created_at", since)
    .limit(1);
  if (recent && recent.length > 0) return NextResponse.json({ ok: true, skipped: "throttled" });

  const first = ((account?.name as string) ?? "").split(" ")[0] || "there";
  const link = `${SITE_URL}/messages`;
  const subject = `${brand.name} replied to your message`;
  const html = `<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#211f1a;">${brand.name}</div>
    <p style="color:#211f1a;font-size:15px;line-height:1.6;">Hi ${first} — the ${brand.name} team replied to your message.</p>
    <a href="${link}" style="display:inline-block;background:#9c7d2e;color:#fff;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">Read the reply</a>
    <p style="color:#6b675e;font-size:12px;line-height:1.6;margin-top:18px;">You're receiving this because you messaged us on ${SITE_URL.replace(/^https?:\/\//, "")}.</p>
  </div>`;
  const text = `Hi ${first} — the ${brand.name} team replied to your message. Read it here: ${link}`;

  const res = await sendEmail({ to, subject, html, text });

  // Log (also feeds the throttle) — best-effort.
  try {
    await admin.from("guest_messages").insert({
      channel: "email",
      event: "chat_reply",
      recipient: to,
      status: res.ok ? "sent" : "failed",
      error: res.ok ? null : (res.error ?? null),
      sent_at: res.ok ? new Date().toISOString() : null,
      payload: { conversation_id: conversationId, subject },
    });
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ ok: true, sent: res.ok });
}
