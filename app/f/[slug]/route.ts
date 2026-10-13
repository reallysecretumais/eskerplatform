import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * eskerrentals.com/f/<founder> → that co-founder's personal WhatsApp.
 *
 * The "Message the founder" button of Esker OS's `founder_followup` template
 * points here (lib/founderFollowup.ts in Esker OS), so the Meta-approved
 * template never carries a phone number: a founder changes their number in
 * Esker OS Settings and every link already sent keeps working. Numbers live in
 * app_settings `founder_whatsapp` ({ founders: [{ userId, name, slug, phone }] }).
 * An unknown name goes to the contact page rather than a dead end.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  const { data } = await createAdminClient().from("app_settings").select("value").eq("key", "founder_whatsapp").maybeSingle();
  const founders = ((data?.value as { founders?: unknown } | null)?.founders ?? []) as { slug?: string; phone?: string; name?: string }[];
  const f = Array.isArray(founders) ? founders.find((x) => x?.slug === slug && typeof x.phone === "string") : undefined;
  if (!f?.phone) return NextResponse.redirect(`${SITE_URL}/contact`, 302);
  const first = (f.name ?? "").trim().split(/\s+/)[0];
  const text = first ? `Hi ${first}, ` : "";
  return NextResponse.redirect(`https://wa.me/${f.phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`, 302);
}
