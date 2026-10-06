/**
 * Investor projections — pure functions over `lib/invest/config.ts` (spec §4).
 *
 * Rules: whole rupees; every share is FLOORED; Pakistani digit grouping.
 * The page, the compare view and the handover sheet all read from here, so the
 * numbers can never disagree. Pinned by `scripts/invest-calc.test.mjs`.
 *
 * Erasable TypeScript only and a relative `.ts` import, because the test runs
 * this file directly with Node's type stripping (no build step).
 */
import { AREAS, FURNISHING, PACKAGES, RUNNING_COSTS, TERMS, type Area, type PackageId, type UnitType } from "./config.ts";

export type Selection = { areaId: string; unit: UnitType; stake: number };

export type Projection = {
  nights: number;
  revenue: number;
  netProfit: number;
  investorPool: number;
  eskerPool: number;
  yourMonthly: number;
  yourYearly: number;
  /** Months to recover your capital. */
  paybackMonths: number;
  /** yourYearly ÷ yourCapital, e.g. 1.0 = 100%. */
  annualReturn: number;
};

export type Quote = {
  area: Area;
  unit: UnitType;
  stake: number;
  rent: number;
  nightly: number;
  costs: { rent: number; electricity: number; caretaker: number; laundry: number; maintenance: number; internet: number };
  monthlyCost: number;
  advanceRent: number;
  securityDeposit: number;
  furnishing: number;
  upfrontTotal: number;
  yourCapital: number;
  breakevenNights: number;
  packages: Record<PackageId, Projection>;
};

export function findArea(areaId: string): Area | undefined {
  return AREAS.find((a) => a.id === areaId);
}

export function unitsOf(area: Area): UnitType[] {
  return (["1BHK", "2BHK"] as const).filter((u) => area.units[u]);
}

/** Null when the area doesn't offer that unit. */
export function quote(sel: Selection): Quote | null {
  const area = findArea(sel.areaId);
  const u = area?.units[sel.unit];
  if (!area || !u) return null;
  const run = RUNNING_COSTS[sel.unit];
  const furnishing = FURNISHING[sel.unit];

  const advanceRent = u.rent * TERMS.advanceRentMonths;
  const securityDeposit = u.rent * TERMS.securityMonths;
  const upfrontTotal = advanceRent + securityDeposit + furnishing;
  const monthlyCost = u.rent + run.electricity + run.caretaker + run.laundry + run.maintenance + run.internet;
  const yourCapital = upfrontTotal * sel.stake;

  // The split in WHOLE percent, applied as integer arithmetic: 172000 × 0.7 is
  // 120399.99999… in floating point, which floors to a rupee short of the spec.
  const sharePct = Math.round(TERMS.investorShare * 100);
  const packages = {} as Record<PackageId, Projection>;
  for (const p of PACKAGES) {
    const revenue = p.nights * u.nightly;
    const netProfit = revenue - monthlyCost;
    const investorPool = Math.floor((netProfit * sharePct) / 100);
    const yourMonthly = Math.floor(investorPool * sel.stake);
    const yourYearly = yourMonthly * 12;
    packages[p.id] = {
      nights: p.nights,
      revenue,
      netProfit,
      investorPool,
      eskerPool: netProfit - investorPool,
      yourMonthly,
      yourYearly,
      paybackMonths: yourMonthly > 0 ? yourCapital / yourMonthly : Infinity,
      annualReturn: yourCapital > 0 ? yourYearly / yourCapital : 0,
    };
  }

  return {
    area,
    unit: sel.unit,
    stake: sel.stake,
    rent: u.rent,
    nightly: u.nightly,
    costs: { rent: u.rent, ...run },
    monthlyCost,
    advanceRent,
    securityDeposit,
    furnishing,
    upfrontTotal,
    yourCapital,
    breakevenNights: Math.ceil(monthlyCost / u.nightly),
    packages,
  };
}

export type CompareRow = { areaId: string; areaName: string; unit: UnitType; upfront: number; monthly: number; annualReturn: number; paybackMonths: number };

/** Every area × unit at one package, full stake, best annual return first. */
export function compareRows(pkg: PackageId = "standard"): CompareRow[] {
  const rows: CompareRow[] = [];
  for (const area of AREAS) {
    for (const unit of unitsOf(area)) {
      const q = quote({ areaId: area.id, unit, stake: 1 })!;
      const p = q.packages[pkg];
      rows.push({ areaId: area.id, areaName: area.name, unit, upfront: q.upfrontTotal, monthly: p.yourMonthly, annualReturn: p.annualReturn, paybackMonths: p.paybackMonths });
    }
  }
  return rows.sort((a, b) => b.annualReturn - a.annualReturn);
}

/** The hero's "X–Y% projected annual return" range at one package. */
export function returnRange(pkg: PackageId = "standard"): { min: number; max: number } {
  const r = compareRows(pkg).map((x) => pct(x.annualReturn));
  return { min: Math.min(...r), max: Math.max(...r) };
}

/** Lowest upfront in an area ("from Rs X") and its best Standard return (the badge). */
export function areaSummary(area: Area): { fromUpfront: number; bestReturn: number } {
  const qs = unitsOf(area).map((u) => quote({ areaId: area.id, unit: u, stake: 1 })!);
  return {
    fromUpfront: Math.min(...qs.map((q) => q.upfrontTotal)),
    bestReturn: Math.max(...qs.map((q) => pct(q.packages.standard.annualReturn))),
  };
}

// ── Formatting ───────────────────────────────────────────────────────────────

const GROUP = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** 140000 → "1,40,000" (Pakistani grouping). */
export function rs(n: number): string {
  return GROUP.format(Math.round(n));
}

/** 1680000 → "16.8L"; 2010000 → "20.1L"; 900000 → "9L". Headline short form. */
export function lakh(n: number): string {
  const l = Math.round((n / 100000) * 10) / 10;
  return `${Number.isInteger(l) ? l.toFixed(0) : l.toFixed(1)}L`;
}

/** 1.0 → 100 (whole percent). */
export function pct(r: number): number {
  return Math.round(r * 100);
}

/** 12.0 → "12", 17.14 → "17.1" — the payback display. */
export function months(m: number): string {
  if (!Number.isFinite(m)) return "—";
  const r = Math.round(m * 10) / 10;
  return Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1);
}

export function stakeLabel(stake: number): string {
  return stake === 1 ? "Full (100%)" : "Half (50%)";
}
