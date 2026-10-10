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
 * v2 (10 Oct 2026): the setup is co-owned 70/30, the E-11 terrace-pool
 * penthouse (one investor), photos, the "check us" facts, the FAQ.
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
 *  so projections lean conservative. 2BHK caretaker ₨10k and laundry ₨8k are
 *  the founder's figures (8 Oct 2026; were 15k / 10k). */
export const RUNNING_COSTS: Record<UnitType, RunningCosts> = {
  "2BHK": { electricity: 55000, caretaker: 10000, laundry: 8000, maintenance: 15000, internet: 5000 },
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
  /** Overrides for a unit that doesn't run like a standard one (the pool
   *  penthouse: a pool pump's electricity, a one-off setup figure). */
  costs?: Partial<RunningCosts>;
  furnishing?: number;
  furnishingLabel?: string;
};

export type Area = {
  id: string;
  name: string;
  sub: string;
  tagline: string;
  units: Partial<Record<UnitType, UnitData>>;
  /** Where the area sits on the drawn map (components/invest/AreaMap.tsx), in map
   *  units, and which side its label goes so neighbours never collide. */
  pin: MapPin;
  /** A one-off opportunity, not a standard package: kept out of the area
   *  cards, the compare list and the headline range, shown as its own card. */
  special?: { tag: string; minBudget: number; blurb: string; highlights: string[] };
};

/** A point on the drawn Islamabad–Rawalpindi map. Map units: x = (lon − 72.80) × 1000,
 *  y = (33.80 − lat) × 1200 — approximate placement, the map says "not to scale". */
export type MapPin = { x: number; y: number; label: "left" | "right" };

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
    pin: { x: 300, y: 334, label: "left" },
  },
  {
    id: "dha2",
    name: "DHA Phase 2",
    sub: "Islamabad",
    tagline: "Gated, quiet and in demand with families and professionals.",
    units: { "1BHK": { rent: 40000, rentRange: "~40k", nightly: 8500, nightlyRange: "8–9k" } },
    pin: { x: 350, y: 320, label: "right" },
  },
  {
    id: "e11",
    name: "E-11",
    sub: "Islamabad",
    tagline: "Margalla views and our strongest-performing sector.",
    units: { "2BHK": { rent: 80000, rentRange: "60–80k", nightly: 16000 } },
    pin: { x: 180, y: 121, label: "left" },
  },
  {
    id: "f11",
    name: "F-11",
    sub: "Islamabad",
    tagline: "Central Islamabad's premium address.",
    units: { "2BHK": { rent: 160000, rentRange: "120–160k", nightly: 18000 } },
    pin: { x: 187, y: 139, label: "right" },
  },
  {
    id: "skypark",
    name: "SkyPark One",
    sub: "Gulberg Greens · mall underneath",
    tagline: "A landmark tower with a mall downstairs. Guests pay for that.",
    units: { "2BHK": { rent: 170000, rentRange: "~170k", nightly: 23000, nightlyRange: "22–24k" } },
    pin: { x: 360, y: 228, label: "left" },
  },
  {
    // The founder's figures (10 Oct 2026): rent 1,20,000, 25,000 a night,
    // electricity 80–100k (the upper end is used, as everywhere), Rs 15 lakh
    // all-in — so furnishing + décor + the pool = 15L − 1 month's rent − 2
    // months' security.
    id: "e11pool",
    name: "E-11 Terrace-Pool Penthouse",
    sub: "E-11 · one investor",
    tagline: "A two-bedroom penthouse with its own pool on the terrace.",
    units: {
      "2BHK": {
        rent: 120000,
        rentRange: "~120k",
        nightly: 25000,
        nightlyRange: "~25k",
        costs: { electricity: 100000 },
        furnishing: 1140000,
        furnishingLabel: "Furnishing, décor and the terrace pool",
      },
    },
    pin: { x: 180, y: 121, label: "left" },
    special: {
      tag: "Limited · one investor",
      minBudget: 1500000,
      blurb: "We're setting up a new two-bedroom penthouse in E-11 with a private pool on its terrace — the feature guests in Islamabad pay the most for. It's open to a single investor, and it's the fastest payback we offer.",
      highlights: ["Private terrace pool", "Margalla views", "Two bedrooms, Esker standard", "Same 70/30 co-ownership"],
    },
  },
];

/** The "What would you like to invest?" chips. */
export const BUDGETS: readonly { amount: number; label: string }[] = [
  { amount: 500000, label: "Rs 5 lakh" },
  { amount: 1000000, label: "Rs 10 lakh" },
  { amount: 2000000, label: "Rs 20 lakh" },
  { amount: 3000000, label: "Rs 30 lakh+" },
];

/** The founder's portfolio facts, as he states them (they span every partnership,
 *  not only what one system records). */
export const PORTFOLIO = [
  { value: 25, suffix: "+", label: "Properties" },
  { value: 3, suffix: "", label: "Years operating" },
  { value: 90, prefix: "85–", suffix: "%", label: "Portfolio occupancy" },
  { value: 500, suffix: "+", label: "Bookings a month" },
] as const;

/** Real months from our own operating records (Investor Guide, Sep 2026). `pin` = where the
 *  property sits on the drawn map. */
export const PROOF = [
  {
    pin: { x: 180, y: 121, label: "right" } as MapPin,
    place: "E-11, Islamabad",
    name: "E-11 2BHK Penthouse",
    sub: "Private pool · outdoor cinema · Margalla views",
    revenue: 815000,
    month: "June 2026",
    photo: "e11-pool",
    lines: ["Booked at up to Rs 35,000 a night", "Consistently one of our strongest performers", "Partner receives a full monthly report"],
  },
  {
    pin: { x: 38, y: 152, label: "right" } as MapPin,
    place: "B-17, Islamabad",
    name: "B-17 Duplex Penthouse",
    sub: "Private pool · movie room · sleeps 8",
    revenue: 711500,
    month: "June 2026",
    photo: "b17-pool",
    lines: ["Rs 7.5 lac of investor capital set it up from bare walls", "Cash-positive, investor repayment underway", "Monthly report with every expense itemised"],
  },
] as const;

/**
 * Photos from our own listings (property-photos bucket), chosen 10 Oct 2026.
 * Keyed so copy can name a photo without repeating a URL. `area` ties a photo
 * to an area card; areas without a photo show their map tile instead.
 */
const BUCKET = "https://bvnpooxxcbnjrbgbrfqb.supabase.co/storage/v1/object/public/property-photos";
export type Photo = { key: string; url: string; alt: string; area?: string };
export const PHOTOS: readonly Photo[] = [
  { key: "e11-pool", url: `${BUCKET}/7dc7023b-fcfe-4773-9e4c-8c73783dbe5f/c0bb9403-194c-4eb3-9be6-e9a3889e5533.jpg`, alt: "The private rooftop pool of the E-11 penthouse at dusk", area: "e11" },
  { key: "e11-pool-2", url: `${BUCKET}/7dc7023b-fcfe-4773-9e4c-8c73783dbe5f/8c6a0ffd-f5af-409e-a3ea-3c6a3f23c6c6.jpg`, alt: "E-11 penthouse pool with the Margalla Hills behind" },
  { key: "e11-pool-3", url: `${BUCKET}/7dc7023b-fcfe-4773-9e4c-8c73783dbe5f/f34d1f9a-b5ce-452f-a576-d3e6314ba76f.jpg`, alt: "E-11 penthouse pool, lit at night", area: "e11pool" },
  { key: "e11-cinema", url: `${BUCKET}/7dc7023b-fcfe-4773-9e4c-8c73783dbe5f/c913a159-e7a1-4162-a897-2c47c00fd2bd.jpg`, alt: "The outdoor cinema on the E-11 penthouse terrace" },
  { key: "e11-lounge", url: `${BUCKET}/7dc7023b-fcfe-4773-9e4c-8c73783dbe5f/1e24aa46-3312-4bd3-8175-241c2ad4927d.jpg`, alt: "The E-11 penthouse lounge" },
  { key: "e11-bedroom", url: `${BUCKET}/7dc7023b-fcfe-4773-9e4c-8c73783dbe5f/08506a6b-00ee-432a-9d88-3f52efd2e648.jpg`, alt: "A bedroom in the E-11 penthouse" },
  { key: "b17-pool", url: `${BUCKET}/32940cfa-a6fa-4c06-86a9-5a00256da88b/d369c0bc-79ba-48fd-8cfc-2cbe9906fb81.jpg`, alt: "The private pool of the B-17 duplex penthouse at night" },
  { key: "b17-terrace", url: `${BUCKET}/32940cfa-a6fa-4c06-86a9-5a00256da88b/66c6fda7-5230-4775-ab6f-ae339c0629e9.jpg`, alt: "The B-17 duplex terrace lawn at sunset" },
  { key: "b17-lounge", url: `${BUCKET}/32940cfa-a6fa-4c06-86a9-5a00256da88b/bd107d7e-2f5b-4589-92d8-a5bdbbff964f.jpg`, alt: "The B-17 duplex lounge" },
  { key: "b17-bedroom", url: `${BUCKET}/32940cfa-a6fa-4c06-86a9-5a00256da88b/3a3900df-e288-4e58-a0e8-542cf9e6cdd0.jpg`, alt: "A bedroom in the B-17 duplex" },
  { key: "b17-waterfall", url: `${BUCKET}/32940cfa-a6fa-4c06-86a9-5a00256da88b/c165586c-0982-40f0-ba35-eb0690c2d89f.jpg`, alt: "The water feature at the B-17 duplex" },
  { key: "bahria-lounge", url: `${BUCKET}/5812c441-f2d6-44b7-900e-79b0e709d3f7/8227c3db-7ccc-481b-be5b-b5f0c02b8a1b.jpg`, alt: "The lounge of a Bahria Town Phase 7 two-bedroom", area: "bahria" },
  { key: "bahria-jacuzzi", url: `${BUCKET}/5812c441-f2d6-44b7-900e-79b0e709d3f7/29418282-ce25-4379-88d4-11af35a5c4db.jpg`, alt: "The jacuzzi at a Bahria Town Phase 7 apartment" },
  { key: "bahria-bedroom", url: `${BUCKET}/5812c441-f2d6-44b7-900e-79b0e709d3f7/096643a7-3e82-4edf-8254-e97529ccc52b.jpg`, alt: "A bedroom in a Bahria Town Phase 7 apartment" },
  { key: "medieval-lounge", url: `${BUCKET}/6e213488-8d6b-4bbd-b060-f418fc35cfe6/a45381fb-6c84-4e7c-83bb-0be49083cfa1.jpg`, alt: "The lounge of the Medieval apartment, Bahria Phase 7" },
  { key: "studio-jacuzzi", url: `${BUCKET}/dcbb2f18-11b5-49b6-aa3a-235cae28a9df/23ca3b70-25c7-4db1-8c3e-8ea4678ad1b6.jpg`, alt: "The terrace jacuzzi of the E-11 studio penthouse" },
  { key: "studio-bedroom", url: `${BUCKET}/dcbb2f18-11b5-49b6-aa3a-235cae28a9df/8cd5da34-f17f-4040-b92c-5a62e49a8efe.jpg`, alt: "The bedroom of the E-11 studio penthouse" },
];

/** The hero film: Hamza's investor video (61 s, captions burned in), re-encoded to 7 MB. */
export const HERO_VIDEO = {
  src: "https://bvnpooxxcbnjrbgbrfqb.supabase.co/storage/v1/object/public/property-videos/invest/hamza-investor-2026-10.mp4",
  poster: "e11-pool",
  caption: "Hamza Shah, co-founder, on how it works · 1 min",
} as const;

export const FOUNDERS = [
  { name: "Umais", phone: "923132659989", display: "+92 313 2659989", role: "Co-founder", line: "Built the operation and the system that runs it. Your first call on numbers and terms." },
  { name: "Hamza", phone: "923107777687", display: "+92 310 7777687", role: "Co-founder", line: "Runs the properties and the team on the ground. The voice in the film above." },
] as const;

/** Verifiable facts for "Check us yourself" (founder, 10 Oct 2026). */
export const COMPANY = {
  ntn: "E938246-5",
  office: "Bahria Town Phase 7, Rawalpindi",
  instagram: { handle: "eskerrentals", url: "https://www.instagram.com/eskerrentals/", followers: "4,600+" },
  website: "https://eskerrentals.com",
} as const;

export const VERIFY: readonly { title: string; body: string }[] = [
  { title: "Visit any property", body: "Walk into one of our live apartments, meet the caretaker and see the standard for yourself. Or see one being set up, so you know exactly where an investor's money goes." },
  { title: "A registered company", body: `Esker Rentals is registered with the Federal Board of Revenue, NTN ${COMPANY.ntn}. Our office is in ${COMPANY.office}, open to investors by appointment.` },
  { title: "Money moves only one way", body: "Every payment goes to the company bank account, with a receipt. Nothing is ever paid to a personal number." },
  { title: "Read the agreement first", body: "The full written agreement, before a rupee changes hands. Take it to your own lawyer." },
  { title: "Three years in public", body: `Every listing, every guest review and three years of posts are on our website and on Instagram, where ${COMPANY.instagram.followers} people follow what we do.` },
  { title: "See the system", body: "Esker OS runs every booking, every guest message and every monthly report. The line below is read from it live." },
];

export const FAQ: readonly { q: string; a: string }[] = [
  { q: "Who owns the apartment and the furniture?", a: "The apartment belongs to its landlord; Esker holds the lease. The setup — furnishing, fittings and the lease deposit — is co-owned 70% by you and 30% by Esker, and the profit is split the same way." },
  { q: "Is the security deposit refundable?", a: "Yes. The two-month security deposit is held by the landlord for the lease and is refundable at the end of it." },
  { q: "What if a month has low occupancy?", a: "Your share is 70% of that month's actual net profit, so a quieter month means a smaller share, not a bill. Each apartment covers all of its costs at 11–15 booked nights a month; our portfolio runs at 85–90%." },
  { q: "Who pays for repairs and replacements?", a: "Routine maintenance is a running cost of the apartment and sits inside the monthly figures you see here. It is paid before profit is shared, never charged to you separately." },
  { q: "What if the landlord ends the lease?", a: "Leases are 2–3 years and renewable, and we operate only in buildings we have vetted. If a lease does end, the setup is yours and ours to move: the furniture goes to the next apartment, and your share with it." },
  { q: "When and how is my share paid?", a: "Monthly, to your bank account, with a report that itemises revenue, every expense, the net profit and your share." },
  { q: "Can I visit my apartment?", a: "Yes, whenever you like. Message us and we'll arrange it around the guests' stays." },
  { q: "How do I exit?", a: `${TERMS.exitNoticeDays} days' notice. You receive your share of the furniture and fittings, and your share of the deposit when the lease returns it.` },
];

export const DISCLAIMER =
  "All figures are projections based on current market rents, Esker's standard furnishing costs and stated occupancy packages. Actual returns depend on property performance. Past performance of other properties does not guarantee future results.";
