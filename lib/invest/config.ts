/**
 * Investor page — the single source of truth for every number on /invest and
 * on the handover sheet. Nothing is hardcoded in a component.
 *
 * ⚠️ Investor-facing. Never change a figure, a term or a formula here without
 * Umais. Spec: "Esker Investor Page Build Spec" v1.0 (6 Oct 2026), with the
 * founder's same-day decisions:
 *   - Flat 70% of net profit to the investor for as long as the property runs
 *     (the Sep "60% after recovery" guide is superseded).
 *   - Packages 21 / 24 / 28 booked nights (spec said 20 for Conservative).
 *   - Portfolio facts are the founder's, used as given.
 *
 * Pure data, no imports: `lib/invest/calc.ts` and the test script load this
 * file directly with Node, so it must stay import-free.
 */

export type UnitType = "1BHK" | "2BHK";

export const TERMS = {
  investorShare: 0.7,
  eskerShare: 0.3,
  /** 100% or 50% of one unit. */
  stakes: [1, 0.5] as const,
  advanceRentMonths: 1,
  securityMonths: 2,
  launchDays: 30,
  leaseYears: "2–3 years, renewable",
  exitNoticeDays: 75,
} as const;

export type PackageId = "conservative" | "standard" | "high";

/** Booked nights per month. Standard is pre-selected — the middle anchors as normal. */
export const PACKAGES: readonly { id: PackageId; label: string; nights: number }[] = [
  { id: "conservative", label: "Conservative", nights: 21 },
  { id: "standard", label: "Standard", nights: 24 },
  { id: "high", label: "High Demand", nights: 28 },
];
export const DEFAULT_PACKAGE: PackageId = "standard";

export type RunningCosts = { electricity: number; caretaker: number; laundry: number; maintenance: number; internet: number };

/** Monthly running costs. Electricity sits at the UPPER end of the real range,
 *  so projections lean conservative. */
export const RUNNING_COSTS: Record<UnitType, RunningCosts> = {
  "2BHK": { electricity: 55000, caretaker: 15000, laundry: 10000, maintenance: 15000, internet: 5000 },
  "1BHK": { electricity: 35000, caretaker: 8000, laundry: 7000, maintenance: 10000, internet: 3500 },
};

export const COST_LABEL: Record<keyof RunningCosts, string> = {
  electricity: "Electricity",
  caretaker: "Caretaker",
  laundry: "Laundry & linen",
  maintenance: "Maintenance",
  internet: "Internet",
};

/** One-time furnishing to the Esker standard. */
export const FURNISHING: Record<UnitType, number> = { "2BHK": 1500000, "1BHK": 800000 };

export const UNIT_INCLUDES: Record<UnitType, string> = {
  "1BHK": "One bedroom, living room and kitchen, furnished to the Esker standard.",
  "2BHK": "Two bedrooms, living room and kitchen, furnished to the Esker standard.",
};

export type UnitData = {
  /** Monthly rent used in every calculation. */
  rent: number;
  /** The real market range, shown beside it. */
  rentRange: string;
  /** Nightly rate — the MIDPOINT of the real range. */
  nightly: number;
  nightlyRange?: string;
};

export type Area = {
  id: string;
  name: string;
  sub: string;
  tagline: string;
  units: Partial<Record<UnitType, UnitData>>;
  /** A public listing whose cover photo stands in for this area (Esker-run units only). */
  photoListingId: string;
  /** True when that photo is an Esker interior from ANOTHER area — the card then says so. */
  photoIsRepresentative?: boolean;
};

export const AREAS: readonly Area[] = [
  {
    id: "bahria",
    name: "Bahria Town",
    sub: "Phase 4 & Phase 7",
    tagline: "Rawalpindi's busiest short-stay district, all year round.",
    units: {
      "2BHK": { rent: 60000, rentRange: "55–65k", nightly: 15000 },
      "1BHK": { rent: 40000, rentRange: "~40k", nightly: 8500, nightlyRange: "8–9k" },
    },
    photoListingId: "5812c441-f2d6-44b7-900e-79b0e709d3f7", // 2BHK Jacuzzi Phase 7
  },
  {
    id: "dha2",
    name: "DHA Phase 2",
    sub: "Islamabad",
    tagline: "Gated, quiet and in demand with families and professionals.",
    units: { "1BHK": { rent: 40000, rentRange: "~40k", nightly: 8500, nightlyRange: "8–9k" } },
    photoListingId: "6e213488-8d6b-4bbd-b060-f418fc35cfe6", // Medieval Apartment (Bahria)
    photoIsRepresentative: true,
  },
  {
    id: "e11",
    name: "E-11",
    sub: "Islamabad",
    tagline: "Margalla views and our strongest-performing sector.",
    units: { "2BHK": { rent: 80000, rentRange: "60–80k", nightly: 16000 } },
    photoListingId: "7dc7023b-fcfe-4773-9e4c-8c73783dbe5f", // E-11 2BHK Luxury Penthouse
  },
  {
    id: "f11",
    name: "F-11",
    sub: "Islamabad",
    tagline: "Central Islamabad's premium address.",
    units: { "2BHK": { rent: 160000, rentRange: "120–160k", nightly: 18000 } },
    photoListingId: "ee92a337-134d-4e69-b2a9-132119c01995", // Rockstar's 1BHK (F-10/F-11)
  },
  {
    id: "skypark",
    name: "SkyPark One",
    sub: "Gulberg Greens · mall underneath",
    tagline: "A landmark tower with a mall downstairs. Guests pay for that.",
    units: { "2BHK": { rent: 170000, rentRange: "~170k", nightly: 23000, nightlyRange: "22–24k" } },
    photoListingId: "32940cfa-a6fa-4c06-86a9-5a00256da88b", // B-17 Duplex Penthouse
    photoIsRepresentative: true,
  },
];

/** The hero photograph: the E-11 pool penthouse. */
export const HERO_LISTING_ID = "7dc7023b-fcfe-4773-9e4c-8c73783dbe5f";

/** The founder's portfolio facts, as he states them (they span every partnership,
 *  not only what one system records). */
export const PORTFOLIO = [
  { value: 25, suffix: "+", label: "Properties" },
  { value: 3, suffix: "", label: "Years operating" },
  { value: 90, prefix: "85–", suffix: "%", label: "Portfolio occupancy" },
  { value: 500, suffix: "+", label: "Bookings a month" },
] as const;

/** Real months from our own operating records (Investor Guide, Sep 2026). */
export const PROOF = [
  {
    listingId: "7dc7023b-fcfe-4773-9e4c-8c73783dbe5f",
    name: "E-11 2BHK Penthouse",
    sub: "Private pool · outdoor cinema · Margalla views",
    revenue: 815000,
    month: "June 2026",
    lines: ["Booked at up to Rs 35,000 a night", "Consistently one of our strongest performers", "Partner receives a full monthly report"],
  },
  {
    listingId: "32940cfa-a6fa-4c06-86a9-5a00256da88b",
    name: "B-17 Duplex Penthouse",
    sub: "Private pool · movie room · sleeps 8",
    revenue: 711500,
    month: "June 2026",
    lines: ["Rs 7.5 lac of investor capital set it up from bare walls", "Cash-positive, investor repayment underway", "Monthly report with every expense itemised"],
  },
] as const;

export const FOUNDERS = [
  { name: "Umais", phone: "923132659989", display: "+92 313 2659989" },
  { name: "Hamza", phone: "923107777687", display: "+92 310 7777687" },
] as const;

export const DISCLAIMER =
  "All figures are projections based on current market rents, Esker's standard furnishing costs and stated occupancy packages. Actual returns depend on property performance. Past performance of other properties does not guarantee future results.";
