import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeListing } from "@/lib/listings";

/**
 * The cover's greeting (app design spec §4.2) — a salutation, then ONE true fact.
 *
 * The whole idea rests on the second line being **derived from live data**. It
 * reads as poetry and is actually a query, which is why no competitor can fake
 * it: they don't operate the buildings. The corollary is the rule that governs
 * this file — **if nothing interesting is true, say something plain. Never
 * invent.**
 *
 * The wording itself is hand-written by the founders and stored in
 * `app_settings.app_greetings`, so lines can be edited without an app release.
 * We only choose between them; we never generate them.
 */

export type Greeting = {
  salutation: string;
  /** The true line. May be null — the cover then shows the salutation alone. */
  line: string | null;
  /** Which condition produced it. Useful in logs; the app ignores it. */
  basis: string;
};

type Bucket = "morning" | "afternoon" | "evening" | "night";

/** Asia/Karachi is a single year-round offset, so the hour needs no tz database. */
function pkHour(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Karachi" }).format(now),
  );
}

function bucketFor(hour: number): Bucket {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 16) return "afternoon";
  if (hour >= 16 && hour < 20) return "evening";
  return "night";
}

const SALUTATION: Record<Bucket, string> = {
  morning: "Good morning.",
  afternoon: "Good afternoon.",
  evening: "Good evening.",
  night: "Good evening.",
};

/**
 * The seed bank. `app_settings.app_greetings` overrides it wholesale once the
 * founders start editing; until then this ships the lines from GREETING_BANK.md
 * so the feature is never empty on day one.
 *
 * Placeholders: {n} count · {property} description · {area} · {time}
 */
const SEED: Record<string, Partial<Record<Bucket | "any", string[]>>> = {
  guest_has_booking: {
    any: [
      "Your key is ready. {property}, {when}.",
      "{property} is expecting you {when}.",
      "Everything's set at {property}. Check in from {time}.",
      "Two sleeps until {area}.",
    ],
  },
  guest_staying_now: {
    any: ["You're in {property}. We're one tap away.", "Hope {area} is treating you well.", "Anything you need, we're here."],
  },
  // `{s}` becomes "s" when the count is more than one, "" when it's exactly one.
  // Every line with {n} needs it, or the cover eventually says "1 pools".
  pools_free_tonight: {
    evening: ["{n} pool{s} glowing tonight.", "The pool lights are on at {property}."],
    night: ["{n} pool{s} glowing tonight.", "Somewhere with a pool is still free tonight."],
    morning: ["The water's warm at {property}.", "{n} pool{s} open today."],
    afternoon: ["{n} pool{s} free for tonight."],
  },
  exclusive_free_tonight: {
    any: ["{n} of our own {is} free tonight.", "An Exclusive is open tonight — those go quickly."],
  },
  few_left_tonight: {
    any: ["{n} left for tonight.", "Down to {n} for tonight.", "{n} still open tonight — the rest are taken."],
  },
  plenty_tonight: {
    morning: ["Sun's on the Margalla side.", "{n} home{s} open, and the hills are clear."],
    afternoon: ["{n} place{s} open for tonight.", "Plenty free. Take your time."],
    evening: ["{n} home{s} lit and waiting.", "The city's turning gold. {n} place{s} free."],
    night: ["{n} still open, if tonight got away from you.", "Late is fine. {n} home{s} ready."],
  },
  none_tonight: {
    any: ["Fully booked tonight — but tomorrow is open.", "Tonight's gone. Tomorrow isn't."],
  },
  fallback: {
    any: [
      "Somewhere to disappear for a night.",
      "A few good homes, well kept.",
      "We keep the keys. You just arrive.",
      "Everything here is ours to look after.",
    ],
  },
};

/** Founder-edited overrides, if present. Shape matches SEED. */
async function loadBank(): Promise<typeof SEED> {
  try {
    const { data } = await createAdminClient()
      .from("app_settings")
      .select("value")
      .eq("key", "app_greetings")
      .maybeSingle();
    const v = (data as { value?: unknown } | null)?.value;
    // Merge rather than replace: a founder editing one condition must not blank
    // the rest, and a malformed edit must not empty the cover.
    return v && typeof v === "object" ? { ...SEED, ...(v as typeof SEED) } : SEED;
  } catch {
    return SEED;
  }
}

/** Deterministic-ish pick that still varies between opens. */
function pick(lines: string[] | undefined, seed: number): string | null {
  if (!lines?.length) return null;
  return lines[seed % lines.length] ?? null;
}

function linesFor(bank: typeof SEED, basis: string, bucket: Bucket): string[] | undefined {
  const entry = bank[basis];
  return entry?.[bucket] ?? entry?.any;
}

export type GreetingInput = {
  /** The signed-in guest's first name, if we've earned the right to use it. */
  firstName?: string | null;
  /** Their nearest booking, if any. */
  trip?: {
    startsInHours: number;
    /** True once they've checked in. */
    staying: boolean;
    property: { bedrooms: number | null; category: string | null; area: string | null };
    checkinTime: string | null;
  } | null;
  /** Tonight's portfolio truth. */
  tonight: { free: number; pools: number; exclusives: number };
};

/**
 * Choose the greeting. Conditions are RANKED — a guest's own booking always
 * beats a portfolio fact, because the app should talk about them before it talks
 * about us.
 */
export async function buildGreeting(input: GreetingInput, now = new Date()): Promise<Greeting> {
  const hour = pkHour(now);
  const bucket = bucketFor(hour);
  const bank = await loadBank();
  const seed = Math.floor(now.getTime() / 60000); // varies minute to minute

  // The first-name rule: we use a name only when there's a real relationship.
  // A signup who has never stayed gets a plain salutation — familiarity is
  // earned, exactly as it is in hospitality.
  const salutation =
    input.firstName && input.trip ? `${SALUTATION[bucket].replace(/\.$/, "")}, ${input.firstName}.` : SALUTATION[bucket];

  const t = input.trip;
  const basis = t?.staying
    ? "guest_staying_now"
    : t && t.startsInHours <= 48
      ? "guest_has_booking"
      : input.tonight.free === 0
        ? "none_tonight"
        : input.tonight.pools > 0
          ? "pools_free_tonight"
          : input.tonight.exclusives > 0
            ? "exclusive_free_tonight"
            : input.tonight.free <= 3
              ? "few_left_tonight"
              : input.tonight.free >= 6
                ? "plenty_tonight"
                : "fallback";

  // Try every line this condition offers, not just one. A template can be
  // unusable for reasons the CONDITION doesn't know about — "The pool lights are
  // on at {property}" needs a property, and the portfolio conditions have none.
  // Picking blind produced "The pool lights are on at ." in front of a guest,
  // which is exactly the kind of not-quite-true the design forbids.
  const candidates = rotate(linesFor(bank, basis, bucket) ?? [], seed);
  for (const template of candidates) {
    const line = fill(template, input, basis);
    if (line) return { salutation, line, basis };
  }

  // Nothing in this condition could be said honestly — say something plain.
  for (const template of rotate(linesFor(bank, "fallback", bucket) ?? [], seed)) {
    const line = fill(template, input, basis);
    if (line) return { salutation, line, basis: "fallback" };
  }

  // The salutation alone is always true.
  return { salutation, line: null, basis: "none" };
}

/** The same list, started at a different point — so repeated opens vary. */
function rotate<T>(list: T[], seed: number): T[] {
  if (list.length < 2) return list;
  const at = seed % list.length;
  return [...list.slice(at), ...list.slice(0, at)];
}

/**
 * Fill a template, or return NULL if any placeholder it uses has no real value.
 *
 * Returning null rather than an empty string is the whole point: a line is
 * either wholly true or it isn't said. This is what stops "The pool lights are
 * on at ." — the sentence is discarded and another is tried instead.
 */
function fill(template: string, input: GreetingInput, basis: string): string | null {
  const t = input.trip;
  const n =
    basis === "pools_free_tonight"
      ? input.tonight.pools
      : basis === "exclusive_free_tonight"
        ? input.tonight.exclusives
        : input.tonight.free;

  const values: Record<string, string> = {
    n: String(n),
    // Agreement tokens, so a hand-written line never reads "1 pools are".
    s: n === 1 ? "" : "s",
    is: n === 1 ? "is" : "are",
    property: t ? describeListing(t.property) : "",
    area: t?.property.area ?? "",
    time: t?.checkinTime ?? "",
    when: t ? whenWord(t.startsInHours) : "",
  };

  let out = template;
  for (const [key, value] of Object.entries(values)) {
    const token = `{${key}}`;
    if (!out.includes(token)) continue;
    // `{s}` legitimately resolves to "" for a count of one; every other empty
    // value means the sentence can't be told truthfully.
    if (!value && key !== "s") return null;
    out = out.split(token).join(value);
  }

  // An unknown placeholder someone added to the bank — never show the braces.
  return out.includes("{") ? null : out;
}

function whenWord(hours: number): string {
  if (hours <= 12) return "today";
  if (hours <= 36) return "tomorrow";
  return "soon";
}
