// ─────────────────────────────────────────────────────────────────────────
// Demo account data for playing with the Account Hub. Seeds a handful of
// bookings (varied statuses) onto ONE person's website account so /account,
// /account/trips, booking detail, receipt and cancel all have real data.
//
//   node scripts/seed-demo-account.mjs            # seed (default email: secretumais@gmail.com)
//   node scripts/seed-demo-account.mjs --delete   # remove everything this script created
//   EMAIL=someone@x.com node scripts/seed-demo-account.mjs
//
// SAFE ON THE LIVE SITE: 4 of 5 bookings never block real availability (past
// stays + auto-expiring website holds). Only the "staying now" demo occupies its
// dates until you delete it. All rows are tagged "[SEED-DEMO]" for clean removal.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MARK = "[SEED-DEMO]";
const DEMO_PHONE = "03000000090"; // reserved test guest
const EMAIL = process.env.EMAIL || "secretumais@gmail.com";
const DELETE = process.argv.includes("--delete");

// -- env --
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

const isoDay = (offsetDays) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().slice(0, 10); };
const nightsBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86_400_000);

async function resolveAccount() {
  // Staff (Umais) live in public.users; guests in public.accounts. Booking RLS is
  // account_id = auth.uid(); users.id / accounts.id both equal the auth uid.
  const u = await db.from("users").select("id,email,name").ilike("email", EMAIL).maybeSingle();
  if (u.data?.id) return { id: u.data.id, email: u.data.email, name: u.data.name };
  const a = await db.from("accounts").select("id,email,name").ilike("email", EMAIL).maybeSingle();
  if (a.data?.id) return { id: a.data.id, email: a.data.email, name: a.data.name };
  // Fallback: scan auth users.
  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  const found = data?.users?.find((x) => (x.email || "").toLowerCase() === EMAIL.toLowerCase());
  return found ? { id: found.id, email: found.email, name: found.user_metadata?.name ?? null } : null;
}

// bookings.account_id → public.accounts(id). A staff member has no accounts row,
// so provision one (they can be a guest too). Harmless: is_staff() is unaffected.
async function ensureAccountRow({ id, email, name }) {
  const existing = await db.from("accounts").select("id").eq("id", id).maybeSingle();
  if (existing.data?.id) return;
  const ins = await db.from("accounts").insert({ id, email, name: name || "Umais" });
  if (ins.error) { console.error("Could not create accounts row:", ins.error.message); process.exit(1); }
  await db.from("account_roles").upsert({ account_id: id, role: "guest" }, { onConflict: "account_id,role", ignoreDuplicates: true });
  console.log(`Provisioned website account row for ${email}.`);
}

async function cleanup(accountId) {
  const { data: bs } = await db.from("bookings").select("id").ilike("notes", `%${MARK}%`);
  const ids = (bs ?? []).map((b) => b.id);
  if (ids.length) {
    // reviews FK is ON DELETE SET NULL, so remove demo reviews first (else they'd
    // orphan and stay public), then payments, then the bookings themselves.
    await db.from("reviews").delete().in("booking_id", ids);
    await db.from("booking_payments").delete().in("booking_id", ids);
    await db.from("bookings").delete().in("id", ids);
  }
  await db.from("guests").delete().eq("phone", DEMO_PHONE);
  console.log(`Deleted ${ids.length} demo booking(s) + demo reviews + demo guest.`);
}

async function main() {
  const acct = await resolveAccount();
  if (!acct) { console.error(`No user/account found for ${EMAIL}. Sign in on the website once, then retry.`); process.exit(1); }
  const accountId = acct.id;

  if (DELETE) { await cleanup(accountId); return; }

  await ensureAccountRow(acct);

  // Fresh start, then reseed.
  await cleanup(accountId);

  const { data: listings } = await db
    .from("public_listings")
    .select("id,title,price,esker_exclusive,category,area")
    .limit(8);
  if (!listings || listings.length === 0) { console.error("No public listings found to attach bookings to."); process.exit(1); }
  const pick = (i) => listings[i % listings.length];

  // demo guest
  let guestId;
  const g0 = await db.from("guests").select("id").eq("phone", DEMO_PHONE).maybeSingle();
  if (g0.data?.id) guestId = g0.data.id;
  else {
    const gi = await db.from("guests").insert({ name: "Demo Guest (seed)", phone: DEMO_PHONE, lead_source: "Website", notes: MARK }).select("id").single();
    guestId = gi.data.id;
  }

  const daysAgoIso = (h) => new Date(Date.now() - h * 3600_000).toISOString();

  // status, checkin, checkout, listingIndex, pay: 'advance'|'full'|'none', source, createdAt?
  const plan = [
    { status: "awaiting_payment", ci: isoDay(12), co: isoDay(15), li: 0, pay: "advance", source: "Website", created_at: daysAgoIso(48), note: "Upcoming — awaiting verification (won't block dates)." },
    { status: "awaiting_payment", ci: isoDay(5), co: isoDay(8), li: 1, pay: "advance", source: "Website", created_at: daysAgoIso(48), note: "Upcoming soon — cancel gives 50% (won't block dates)." },
    { status: "currently_staying", ci: isoDay(-1), co: isoDay(2), li: 2, pay: "advance", source: "Website", note: "Staying now (occupies these dates until deleted)." },
    { status: "checked_out", ci: isoDay(-5), co: isoDay(-2), li: 3, pay: "full", source: "Website", note: "Recently completed — reviewable + review-nudge eligible." },
    { status: "cancelled", ci: isoDay(-6), co: isoDay(-3), li: 4, pay: "none", source: "Website", note: "Cancelled example." },
  ];

  let made = 0;
  for (const p of plan) {
    const l = pick(p.li);
    const price = Number(l.price) || 0;
    const nights = nightsBetween(p.ci, p.co);
    const amount = Math.round(price * nights);
    const pct = l.esker_exclusive ? 0.5 : 0.25;
    const advance = Math.min(Math.max(Math.round(amount * pct), 2000), amount);
    const paid = p.pay === "full" ? amount : p.pay === "advance" ? advance : 0;

    const row = {
      guest_id: guestId,
      account_id: accountId,
      property_id: l.id,
      checkin: p.ci,
      checkout: p.co,
      nights,
      rate_at_booking: price,
      amount,
      status: p.status,
      payment_status: paid >= amount ? "paid" : paid > 0 ? "partial" : "unpaid",
      source: p.source,
      notes: `${p.note} ${MARK}`,
    };
    if (p.created_at) row.created_at = p.created_at;

    const bi = await db.from("bookings").insert(row).select("id").single();
    if (bi.error) { console.error("booking insert failed:", bi.error.message); continue; }
    if (paid > 0) {
      const pi = await db.from("booking_payments").insert({ booking_id: bi.data.id, amount: paid, note: `Demo payment ${MARK}` });
      if (pi.error) console.error("payment insert failed:", pi.error.message);
    }
    made++;
    console.log(`  + ${p.status.padEnd(18)} ${l.title} · ${p.ci}→${p.co} · ₨${amount.toLocaleString()} (paid ₨${paid.toLocaleString()})`);
  }
  console.log(`\nSeeded ${made} demo booking(s) for ${EMAIL}. Open /account to explore. Run with --delete to remove.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
