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

export type PartnerTrendPoint = { month: string; net: number; yourShare: number };

/** Withdrawable balance = completed-month share − payouts already made. `amount`
 *  is 0 when nothing is available yet. `throughMonth` is the last settled month. */
export type PartnerAvailable = { amount: number; throughMonth: string };

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

// ── Finance core (mirrors Esker OS lib/data/deals.ts getPropertySplit) ─────────
//
// One batched read of a property's whole cash history (payments, expenses, deal
// timeline, withdrawals), then pure in-memory derivation of: the viewed month's
// performance, a trailing monthly series (trend), and the withdrawable balance.
// Reusing a single load keeps the dashboard to one round of queries.

type DealRow = {
  dealType: PartnerDealType;
  ownerPct: number;
  mgmtFeePct: number;
  investment: number;
  ownerLabel: string | null;
  validFrom: string;
};
type Finance = {
  payments: { amount: number; month: string }[]; // month = PKT "YYYY-MM" of paid_at
  expenses: { amount: number; category: string; label: string; month: string }[];
  deals: DealRow[]; // newest first
  withdrawnTotal: number;
};

async function loadFinance(propertyId: string): Promise<Finance> {
  const admin = createAdminClient();
  const { data: bkRows } = await admin.from("bookings").select("id").eq("property_id", propertyId);
  const bookingIds = ((bkRows ?? []) as { id: string }[]).map((b) => b.id);

  const [payRes, expRes, dealRes, wRes] = await Promise.all([
    bookingIds.length
      ? admin.from("booking_payments").select("amount, paid_at").in("booking_id", bookingIds)
      : Promise.resolve({ data: [] as { amount: number; paid_at: string }[] }),
    admin.from("expenses").select("amount, category, label, paid_date").eq("property_id", propertyId).eq("paid", true),
    admin
      .from("property_deals")
      .select("deal_type, owner_pct, mgmt_fee_pct, investment, owner_label, valid_from")
      .eq("property_id", propertyId)
      .order("valid_from", { ascending: false }),
    admin.from("partner_withdrawals").select("amount").eq("property_id", propertyId),
  ]);

  const payments = ((payRes.data ?? []) as { amount: number; paid_at: string }[])
    .filter((p) => p.paid_at)
    .map((p) => ({ amount: Number(p.amount) || 0, month: pktMonthOf(p.paid_at) }));

  const expenses = ((expRes.data ?? []) as { amount: number; category: string | null; label: string | null; paid_date: string | null }[])
    .filter((e) => e.paid_date)
    .map((e) => {
      const cat = e.category || "other";
      return { amount: Number(e.amount) || 0, category: cat, label: EXPENSE_LABEL[cat] ?? cap(cat), month: (e.paid_date as string).slice(0, 7) };
    });

  const deals = ((dealRes.data ?? []) as { deal_type: string; owner_pct: number | null; mgmt_fee_pct: number | null; investment: number | null; owner_label: string | null; valid_from: string }[]).map((d) => ({
    dealType: d.deal_type as PartnerDealType,
    ownerPct: d.owner_pct == null ? 0 : Number(d.owner_pct),
    mgmtFeePct: d.mgmt_fee_pct == null ? 0 : Number(d.mgmt_fee_pct),
    investment: d.investment == null ? 0 : Number(d.investment),
    ownerLabel: d.owner_label ?? null,
    validFrom: d.valid_from,
  }));

  const withdrawnTotal = ((wRes.data ?? []) as { amount: number }[]).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  return { payments, expenses, deals, withdrawnTotal };
}

/** The effective deal for a month = latest whose valid_from is on/before it. */
function dealForMonth(deals: DealRow[], month: string): DealRow | null {
  const cutoff = `${addMonth(month, 1)}-01`;
  return deals.find((d) => d.validFrom < cutoff) ?? null;
}

/** Cash-basis revenue / itemised costs / net for one month under a deal. */
function monthNet(fin: Finance, month: string, deal: DealRow | null) {
  let revenue = 0;
  for (const p of fin.payments) if (p.month === month) revenue += p.amount;

  let expenses = 0;
  const byCat = new Map<string, { label: string; amount: number }>();
  for (const e of fin.expenses) {
    if (e.month !== month) continue;
    expenses += e.amount;
    const line = byCat.get(e.category) ?? { label: e.label, amount: 0 };
    line.amount += e.amount;
    byCat.set(e.category, line);
  }
  const expenseLines: ExpenseLine[] = [...byCat.entries()]
    .map(([category, v]) => ({ category, label: v.label, amount: round(v.amount) }))
    .sort((a, b) => b.amount - a.amount);

  const mgmtFee = deal && deal.dealType === "mgmt_fee_net_split" ? Math.floor(revenue * deal.mgmtFeePct) : 0;
  return { revenue, expenses, expenseLines, net: revenue - mgmtFee - expenses };
}

/** The partner's cut of a month's net, given the deal + whether recovery is ongoing. */
function shareForMonth(deal: DealRow | null, net: number, inRecoveryNow: boolean): number {
  if (!deal) return 0;
  switch (deal.dealType) {
    case "owner_net_split":
    case "mgmt_fee_net_split":
      return Math.floor(net * deal.ownerPct);
    case "investor_recovery":
      return inRecoveryNow ? net : Math.floor(net * deal.ownerPct);
    default:
      return 0; // company_owned
  }
}

/** True while a recovery investor hasn't been fully repaid (drives 100%-to-you). */
function inRecoveryNow(fin: Finance): boolean {
  const d = fin.deals[0];
  return !!d && d.dealType === "investor_recovery" && fin.withdrawnTotal < d.investment;
}

/** The viewed month's performance from a loaded finance set (pure). */
function computePerformance(fin: Finance, month: string): PartnerPerformance | null {
  const deal = dealForMonth(fin.deals, month);
  if (!deal) return null;
  const { revenue, expenses, expenseLines, net } = monthNet(fin, month, deal);

  let yourShare = 0;
  let inRecovery = false;
  let recovery: PartnerRecovery | null = null;

  if (deal.dealType === "investor_recovery") {
    // Recovery is tracked on CASH ACTUALLY PAID (cumulative withdrawals), not
    // profit merely earned — matching the CRM.
    const phaseA = fin.withdrawnTotal < deal.investment;
    const recovered = Math.min(fin.withdrawnTotal, deal.investment);
    recovery = {
      invested: round(deal.investment),
      recovered: round(recovered),
      remaining: round(Math.max(0, deal.investment - fin.withdrawnTotal)),
      phase: phaseA ? "A" : "B",
      pct: deal.investment > 0 ? Math.min(100, Math.round((recovered / deal.investment) * 100)) : 0,
    };
    inRecovery = phaseA;
    yourShare = phaseA ? net : Math.floor(net * deal.ownerPct);
  } else {
    yourShare = shareForMonth(deal, net, false);
  }

  return {
    dealType: deal.dealType,
    ownerLabel: deal.ownerLabel,
    hasMgmtFee: deal.dealType === "mgmt_fee_net_split",
    revenue: round(revenue),
    expenses: round(expenses),
    expenseLines,
    net: round(net),
    yourShare: round(yourShare),
    inRecovery,
    recovery,
  };
}

/** Trailing `count` months (oldest→newest) of net + the partner's share. */
function computeTrend(fin: Finance, count = 6): PartnerTrendPoint[] {
  const rec = inRecoveryNow(fin);
  return recentMonths(count)
    .slice()
    .reverse()
    .map((m) => {
      const deal = dealForMonth(fin.deals, m);
      const { net } = monthNet(fin, m, deal);
      return { month: m, net: round(net), yourShare: round(shareForMonth(deal, net, rec)) };
    });
}

/** Withdrawable now = the partner's share of COMPLETED months (never the running
 *  month, whose costs are still accruing) minus what's already been paid out. */
function computeAvailable(fin: Finance): PartnerAvailable {
  const cur = currentPktMonth();
  const throughMonth = addMonth(cur, -1);
  const rec = inRecoveryNow(fin);
  const months = new Set([...fin.payments.map((p) => p.month), ...fin.expenses.map((e) => e.month)].filter((m) => m < cur));

  let earned = 0;
  for (const m of months) {
    const deal = dealForMonth(fin.deals, m);
    earned += shareForMonth(deal, monthNet(fin, m, deal).net, rec);
  }
  return { amount: Math.max(0, round(earned - fin.withdrawnTotal)), throughMonth };
}

/** The viewed month's cash-basis performance + the partner's share, for a property
 *  the caller partners on. null when it isn't theirs, or there's no deal on file. */
export async function getPartnerPerformance(propertyId: string, month: string): Promise<PartnerPerformance | null> {
  const own = await assertPartnerProperty(propertyId);
  if (!own) return null;
  return computePerformance(await loadFinance(propertyId), month);
}

// ── Bookings for the month (no guest identity) ──────────────────────────────

const BOOKING_STATUSES = ["awaiting_payment", "payment_collected", "handed_over", "awaiting_checkin", "currently_staying", "checked_out", "needs_attention"];

/** The property's bookings overlapping the viewed month — dates, nights, amount,
 *  status only. Never joins `guests`; never touches payment proofs. */
export async function getPartnerBookings(propertyId: string, month: string): Promise<PartnerBooking[]> {
  const own = await assertPartnerProperty(propertyId);
  if (!own) return [];
  return queryBookings(createAdminClient(), propertyId, month);
}

async function queryBookings(admin: ReturnType<typeof createAdminClient>, propertyId: string, month: string): Promise<PartnerBooking[]> {
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
  const nights = bookings.reduce((s, b) => s + (Number.isFinite(b.nightsInMonth) ? b.nightsInMonth : 0), 0);
  const days = daysInMonth(month);
  return days > 0 ? Math.min(100, Math.round((nights / days) * 100)) : 0;
}

// checkin/checkout are timestamptz ("2026-07-10T07:29:00+00:00"); monthStart/End
// are "YYYY-MM-01". Compare on the date part so nights are whole calendar days.
function overlapNights(checkin: string, checkout: string, monthStart: string, monthEnd: string): number {
  const ci = checkin.slice(0, 10);
  const co = checkout.slice(0, 10);
  const start = ci < monthStart ? monthStart : ci;
  const end = co < monthEnd ? co : monthEnd;
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0;
}

// ── Payouts (their property's withdrawals) ──────────────────────────────────

/** Payouts made against this property, newest first. Filtered by property (not by
 *  the free-text recipient label). */
export async function getPartnerPayouts(propertyId: string): Promise<PartnerPayout[]> {
  const own = await assertPartnerProperty(propertyId);
  if (!own) return [];
  return queryPayouts(createAdminClient(), propertyId);
}

async function queryPayouts(admin: ReturnType<typeof createAdminClient>, propertyId: string): Promise<PartnerPayout[]> {
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

// ── Composed dashboard reads ────────────────────────────────────────────────

/** Trailing 6-month net + share series for the property (oldest→newest). */
export async function getPartnerTrend(propertyId: string, count = 6): Promise<PartnerTrendPoint[]> {
  const own = await assertPartnerProperty(propertyId);
  if (!own) return [];
  return computeTrend(await loadFinance(propertyId), count);
}

/** What the partner can withdraw right now (settled months only). */
export async function getPartnerAvailable(propertyId: string): Promise<PartnerAvailable | null> {
  const own = await assertPartnerProperty(propertyId);
  if (!own) return null;
  return computeAvailable(await loadFinance(propertyId));
}

export type PartnerDashboardData = {
  property: PartnerProperty;
  month: string;
  performance: PartnerPerformance | null;
  bookings: PartnerBooking[];
  occupancy: number;
  payouts: PartnerPayout[];
  trend: PartnerTrendPoint[];
  available: PartnerAvailable;
};

/** Everything one property's dashboard needs, in a single owner-checked pass:
 *  one finance load (→ performance + trend + available) plus bookings + payouts.
 *  Used by both the single-property /partner home and the property detail page. */
export async function getPartnerDashboard(propertyId: string, month: string): Promise<PartnerDashboardData | null> {
  const property = await assertPartnerProperty(propertyId);
  if (!property) return null;
  const admin = createAdminClient();
  const [fin, bookings, payouts] = await Promise.all([
    loadFinance(propertyId),
    queryBookings(admin, propertyId, month),
    queryPayouts(admin, propertyId),
  ]);
  return {
    property,
    month,
    performance: computePerformance(fin, month),
    bookings,
    occupancy: occupancyPct(bookings, month),
    payouts,
    trend: computeTrend(fin, 6),
    available: computeAvailable(fin),
  };
}

export type PartnerSummary = {
  property: PartnerProperty;
  performance: PartnerPerformance | null; // current month
  available: PartnerAvailable;
};

/** A light per-property roll-up (current month + withdrawable) for the portfolio
 *  overview when a partner holds more than one property. */
export async function getPartnerSummary(propertyId: string): Promise<PartnerSummary | null> {
  const property = await assertPartnerProperty(propertyId);
  if (!property) return null;
  const fin = await loadFinance(propertyId);
  return { property, performance: computePerformance(fin, currentPktMonth()), available: computeAvailable(fin) };
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
