import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Partner / investor portal reads.
//
// A partner property lives in the shared `properties` table with
// owner_relationship='partner' and owner_account_id = the partner's website
// account. The financial tables (property_deals, booking_payments, expenses,
// partner_withdrawals) are ADMIN-ONLY in Postgres RLS — a website session can
// read none of them directly. So, exactly like the host portal (lib/data/host.ts),
// these reads go through the SERVICE ROLE and are gated in code by
// owner_account_id === the signed-in account AND owner_relationship='partner',
// projecting ONLY partner-safe fields (never Esker's share, the mgmt-fee amount,
// guest identity/CNIC/proofs, other properties, or company/founder finance).
//
// ⚠️ KEEP-IN-SYNC SEAM: the split math below MIRRORS the CRM source of truth,
// `Esker OS/lib/data/deals.ts` (getPropertySplit). Same cash basis (revenue =
// payments collected in the PKT month; costs = expenses paid in the month; a
// top-line management fee comes off gross first), same Math.floor on shares, and
// the same withdrawal-based recovery model. The secret percentages live only in
// the `property_deals` rows (never in code), so re-implementing the SHAPE here
// leaks nothing. If deals.ts changes, change this too.
// ─────────────────────────────────────────────────────────────────────────────

// Pakistan is UTC+5 year-round (no DST) → shift then take YYYY-MM / YYYY-MM-DD.
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
function pktMonthOf(iso: string): string {
  return new Date(new Date(iso).getTime() + PKT_OFFSET_MS).toISOString().slice(0, 7);
}
/** Current PKT month, "YYYY-MM". */
export function currentPktMonth(): string {
  return pktMonthOf(new Date().toISOString());
}
/** Add n months to a "YYYY-MM" (n may be negative). */
export function addMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
/** The last `count` months ending at (and including) `end` (default now), newest first. */
export function recentMonths(count = 12, end = currentPktMonth()): string[] {
  return Array.from({ length: count }, (_, i) => addMonth(end, -i));
}

const round = (n: number) => Math.round(n);
const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

// ── Types ────────────────────────────────────────────────────────────────────

export type PartnerDealType = "company_owned" | "owner_net_split" | "mgmt_fee_net_split" | "investor_recovery";

export type PartnerProperty = {
  id: string;
  title: string;
  area: string | null;
  status: string | null; // ops status: occupied | ready | cleaning | vacant
  photo: string | null;
};

export type PartnerRecovery = {
  invested: number;
  recovered: number; // cash actually paid to the investor (capped at invested)
  remaining: number;
  phase: "A" | "B";
  pct: number; // 0–100
};

export type ExpenseLine = { category: string; label: string; amount: number };

export type PartnerPerformance = {
  dealType: PartnerDealType;
  ownerLabel: string | null;
  hasMgmtFee: boolean; // true → net is after a management fee we don't itemise
  revenue: number; // collected this month
  expenses: number; // paid this month (the partner's operating costs)
  expenseLines: ExpenseLine[]; // itemised by category
  net: number; // collected − mgmt fee − expenses (cash basis)
  yourShare: number; // the partner's cut this month (100% of net in recovery Phase A)
  inRecovery: boolean;
  recovery: PartnerRecovery | null;
};

export type PartnerBooking = {
  id: string;
  checkin: string | null;
  checkout: string | null;
  nights: number | null;
  nightsInMonth: number; // nights of this stay that fall inside the viewed month
  amount: number;
  status: string;
};

export type PartnerPayout = {
  id: string;
  amount: number;
  withdrawnOn: string; // YYYY-MM-DD
  forPeriod: string | null;
  receiptNo: string;
  note: string | null;
};

// ── Ownership guard (every read goes through this) ──────────────────────────

/** The partner property for the signed-in account, or null. Confirms the row
 *  exists AND owner_account_id === the caller AND owner_relationship='partner'. */
export async function assertPartnerProperty(propertyId: string): Promise<PartnerProperty | null> {
  const user = await currentUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("properties")
    .select("id, name, public_title, area, status, photos")
    .eq("id", propertyId)
    .eq("owner_account_id", user.id)
    .eq("owner_relationship", "partner")
    .maybeSingle();
  if (!data) return null;
  const r = data as { id: string; name: string; public_title: string | null; area: string | null; status: string | null; photos: string[] | null };
  return { id: r.id, title: r.public_title || r.name, area: r.area, status: r.status, photo: (r.photos ?? [])[0] ?? null };
}

/** All properties the signed-in account is the partner for (usually one). */
export async function getMyPartnerProperties(): Promise<PartnerProperty[]> {
  const user = await currentUser();
  if (!user) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("properties")
    .select("id, name, public_title, area, status, photos")
    .eq("owner_account_id", user.id)
    .eq("owner_relationship", "partner")
    .order("name", { ascending: true });
  return ((data ?? []) as { id: string; name: string; public_title: string | null; area: string | null; status: string | null; photos: string[] | null }[]).map((r) => ({
    id: r.id,
    title: r.public_title || r.name,
    area: r.area,
    status: r.status,
    photo: (r.photos ?? [])[0] ?? null,
  }));
}

// ── Performance / split (mirrors Esker OS lib/data/deals.ts getPropertySplit) ──

/** The viewed month's cash-basis performance + the partner's share, for a property
 *  the caller partners on. null when it isn't theirs, or there's no deal on file.
 *  Omits Esker's share and the mgmt-fee amount by construction. */
export async function getPartnerPerformance(propertyId: string, month: string): Promise<PartnerPerformance | null> {
  const own = await assertPartnerProperty(propertyId);
  if (!own) return null;
  const admin = createAdminClient();

  // Latest effective-dated deal whose valid_from is on/before the selected month.
  const { data: deals } = await admin
    .from("property_deals")
    .select("deal_type, owner_pct, esker_pct, mgmt_fee_pct, investment, owner_label, valid_from")
    .eq("property_id", propertyId)
    .lt("valid_from", `${addMonth(month, 1)}-01`)
    .order("valid_from", { ascending: false })
    .limit(1);
  const d = deals?.[0] as
    | { deal_type: string; owner_pct: number | null; esker_pct: number | null; mgmt_fee_pct: number | null; investment: number | null; owner_label: string | null }
    | undefined;
  if (!d) return null;

  const dealType = d.deal_type as PartnerDealType;
  const ownerPct = d.owner_pct == null ? 0 : Number(d.owner_pct);
  const eskerPct = d.esker_pct == null ? 0 : Number(d.esker_pct);
  const mgmtFeePct = d.mgmt_fee_pct == null ? 0 : Number(d.mgmt_fee_pct);
  const investment = d.investment == null ? 0 : Number(d.investment);

  // Cash basis. Revenue = payments collected in the month (by paid_at, PKT), for
  // this property's bookings. Costs = this property's expenses paid in the month
  // (company-wide rows have a null property_id and are excluded by the equality
  // filter). Itemised by category. Two-step read (booking ids → payments) so the
  // scoping is deterministic and index-backed.
  const { data: bkRows } = await admin.from("bookings").select("id").eq("property_id", propertyId);
  const bookingIds = ((bkRows ?? []) as { id: string }[]).map((b) => b.id);

  const [payRes, expRes] = await Promise.all([
    bookingIds.length
      ? admin.from("booking_payments").select("amount, paid_at").in("booking_id", bookingIds)
      : Promise.resolve({ data: [] as { amount: number; paid_at: string }[] }),
    admin.from("expenses").select("amount, category, label, paid_date").eq("property_id", propertyId).eq("paid", true),
  ]);

  let revenue = 0;
  for (const p of (payRes.data ?? []) as { amount: number; paid_at: string }[]) {
    if (pktMonthOf(p.paid_at) === month) revenue += Number(p.amount) || 0;
  }

  let expenses = 0;
  const byCat = new Map<string, { label: string; amount: number }>();
  for (const e of (expRes.data ?? []) as { amount: number; category: string | null; label: string | null; paid_date: string | null }[]) {
    if (!e.paid_date || e.paid_date.slice(0, 7) !== month) continue;
    const amt = Number(e.amount) || 0;
    expenses += amt;
    const cat = e.category || "other";
    const line = byCat.get(cat) ?? { label: EXPENSE_LABEL[cat] ?? cap(cat), amount: 0 };
    line.amount += amt;
    byCat.set(cat, line);
  }
  const expenseLines: ExpenseLine[] = [...byCat.entries()].map(([category, v]) => ({ category, label: v.label, amount: round(v.amount) })).sort((a, b) => b.amount - a.amount);

  const mgmtFee = dealType === "mgmt_fee_net_split" ? Math.floor(revenue * mgmtFeePct) : 0;
  const net = revenue - mgmtFee - expenses;

  // Recovery is tracked on CASH ACTUALLY PAID to the investor (cumulative
  // partner_withdrawals), not profit merely earned — matching the CRM.
  let yourShare = 0;
  let inRecovery = false;
  let recovery: PartnerRecovery | null = null;

  if (dealType === "owner_net_split") {
    yourShare = Math.floor(net * ownerPct);
  } else if (dealType === "mgmt_fee_net_split") {
    yourShare = Math.floor(net * ownerPct);
  } else if (dealType === "investor_recovery") {
    const totalWithdrawn = await getWithdrawnTotal(propertyId);
    const phase: "A" | "B" = totalWithdrawn >= investment ? "B" : "A";
    const recovered = Math.min(totalWithdrawn, investment);
    recovery = {
      invested: round(investment),
      recovered: round(recovered),
      remaining: round(Math.max(0, investment - totalWithdrawn)),
      phase,
      pct: investment > 0 ? Math.min(100, Math.round((recovered / investment) * 100)) : 0,
    };
    if (phase === "A") {
      inRecovery = true;
      yourShare = net; // 100% earmarked for the investor until repaid
    } else {
      yourShare = Math.floor(net * ownerPct);
    }
  }
  // company_owned → no partner distribution (won't normally be linked as a partner).
  void eskerPct;

  return {
    dealType,
    ownerLabel: d.owner_label ?? null,
    hasMgmtFee: dealType === "mgmt_fee_net_split",
    revenue: round(revenue),
    expenses: round(expenses),
    expenseLines,
    net: round(net),
    yourShare: round(yourShare),
    inRecovery,
    recovery,
  };
}

/** Cumulative cash paid out for a property (drives recovery). */
async function getWithdrawnTotal(propertyId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("partner_withdrawals").select("amount").eq("property_id", propertyId);
  if (error) return 0;
  return (data ?? []).reduce((s, r) => s + (Number((r as { amount: number }).amount) || 0), 0);
}

// ── Bookings for the month (no guest identity) ──────────────────────────────

const BOOKING_STATUSES = ["awaiting_payment", "payment_collected", "handed_over", "awaiting_checkin", "currently_staying", "checked_out", "needs_attention"];

/** The property's bookings overlapping the viewed month — dates, nights, amount,
 *  status only. Never joins `guests`; never touches payment proofs. */
export async function getPartnerBookings(propertyId: string, month: string): Promise<PartnerBooking[]> {
  const own = await assertPartnerProperty(propertyId);
  if (!own) return [];
  const admin = createAdminClient();

  const monthStart = `${month}-01`;
  const monthEnd = `${addMonth(month, 1)}-01`; // exclusive

  const { data } = await admin
    .from("bookings")
    .select("id, checkin, checkout, nights, amount, status, lost_reason")
    .eq("property_id", propertyId)
    .in("status", BOOKING_STATUSES)
    .lt("checkin", monthEnd)
    .gte("checkout", monthStart)
    .order("checkin", { ascending: true });

  return ((data ?? []) as { id: string; checkin: string | null; checkout: string | null; nights: number | null; amount: number | null; status: string; lost_reason: string | null }[])
    .filter((b) => b.checkin && b.checkout && !b.lost_reason)
    .map((b) => ({
      id: b.id,
      checkin: b.checkin,
      checkout: b.checkout,
      nights: b.nights,
      nightsInMonth: overlapNights(b.checkin!, b.checkout!, monthStart, monthEnd),
      amount: Math.max(0, round(Number(b.amount) || 0)),
      status: b.status,
    }));
}

/** Occupancy % for the month = occupied nights ÷ days in month (capped 100). */
export function occupancyPct(bookings: PartnerBooking[], month: string): number {
  const nights = bookings.reduce((s, b) => s + b.nightsInMonth, 0);
  return Math.min(100, Math.round((nights / daysInMonth(month)) * 100));
}

function overlapNights(checkin: string, checkout: string, monthStart: string, monthEnd: string): number {
  const start = checkin < monthStart ? monthStart : checkin;
  const end = checkout < monthEnd ? checkout : monthEnd;
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

// ── Payouts (their property's withdrawals) ──────────────────────────────────

/** Payouts made against this property, newest first. Filtered by property (not by
 *  the free-text recipient label). */
export async function getPartnerPayouts(propertyId: string): Promise<PartnerPayout[]> {
  const own = await assertPartnerProperty(propertyId);
  if (!own) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_withdrawals")
    .select("id, amount, withdrawn_on, for_period, receipt_no, note")
    .eq("property_id", propertyId)
    .order("withdrawn_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return [];
  return ((data ?? []) as { id: string; amount: number; withdrawn_on: string; for_period: string | null; receipt_no: string; note: string | null }[]).map((r) => ({
    id: r.id,
    amount: Math.max(0, round(Number(r.amount) || 0)),
    withdrawnOn: r.withdrawn_on,
    forPeriod: r.for_period,
    receiptNo: r.receipt_no,
    note: r.note,
  }));
}

// ── Statement (composed view-model for the printable page) ──────────────────

export type PartnerStatement = {
  property: PartnerProperty;
  month: string;
  performance: PartnerPerformance | null;
  bookings: PartnerBooking[];
  occupancy: number;
  bookingsCount: number;
  payouts: PartnerPayout[]; // payouts recorded in this month
};

/** Everything the monthly statement page needs, in one owner-checked call. */
export async function getPartnerStatement(propertyId: string, month: string): Promise<PartnerStatement | null> {
  const property = await assertPartnerProperty(propertyId);
  if (!property) return null;
  const [performance, bookings, allPayouts] = await Promise.all([
    getPartnerPerformance(propertyId, month),
    getPartnerBookings(propertyId, month),
    getPartnerPayouts(propertyId),
  ]);
  return {
    property,
    month,
    performance,
    bookings,
    occupancy: occupancyPct(bookings, month),
    bookingsCount: bookings.length,
    payouts: allPayouts.filter((p) => p.withdrawnOn.slice(0, 7) === month),
  };
}

// ── Labels ───────────────────────────────────────────────────────────────────

const EXPENSE_LABEL: Record<string, string> = {
  rent: "Rent",
  electricity: "Electricity",
  maintenance: "Maintenance",
  ad_spend: "Marketing",
  salary: "Staff",
  internet: "Internet",
  other: "Other",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
