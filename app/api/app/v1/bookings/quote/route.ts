import { ok, fail, guard, readJson } from "@/lib/app/api";
import { getListing, getAvailability } from "@/lib/data/listings";
import { getSlots, getBusyTimes, isSlotFree, slotRunsOn } from "@/lib/data/slots";
import { quote, isQuoteError, nightsBetween } from "@/lib/quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  listingId?: string;
  // nightly
  checkin?: string;
  checkout?: string;
  // slotted
  date?: string;
  slotId?: string;
  startTime?: string;
  hours?: number;
};

/**
 * POST /api/app/v1/bookings/quote — what this will cost, decided by the server.
 *
 * The app NEVER computes a price. It sends what the guest chose and renders what
 * comes back, so the number on the review step is the number that gets charged.
 * This also re-checks availability, because the honest failure ("those dates were
 * just taken") has to arrive before a guest reaches the payment screen.
 *
 * Public (no auth): a guest can price a stay before signing in — the account is
 * only required to actually book. Nothing here reveals more than the stay page.
 */
export const GET_NOT_ALLOWED = undefined; // quotes are POSTs (they carry a selection)

export const POST = guard(async (req: Request) => {
  const body = await readJson<Body>(req);
  if (!body?.listingId) return fail("listing_required", "Which stay are you booking?");

  const listing = await getListing(body.listingId);
  if (!listing) return fail("not_found", "That stay isn't available.", 404);

  const mode = listing.booking_mode;
  const exclusive = listing.esker_exclusive;

  // ── Nightly ───────────────────────────────────────────────────────
  if (mode === "nightly") {
    const { checkin, checkout } = body;
    if (!checkin || !checkout) return fail("dates_required", "Pick your check-in and check-out dates.");

    const q = quote({ mode: "nightly", price: listing.price, exclusive, checkin, checkout });
    if (isQuoteError(q)) return fail(q.error, q.message);

    // Any night already taken kills the whole range — the same rule the website
    // checkout applies, and the reason a guest never reaches payment on a clash.
    const busy = await getAvailability(body.listingId);
    const taken = new Set<string>();
    for (const r of busy) {
      for (let d = new Date(`${r.start_date}T00:00:00`), g = 0; d < new Date(`${r.end_date}T00:00:00`) && g < 400; d.setDate(d.getDate() + 1), g++) {
        taken.add(d.toISOString().slice(0, 10));
      }
    }
    const nights = nightsBetween(checkin, checkout);
    for (let d = new Date(`${checkin}T00:00:00`), g = 0; g < nights; d.setDate(d.getDate() + 1), g++) {
      if (taken.has(d.toISOString().slice(0, 10))) {
        return fail("dates_taken", "Those dates were just taken. Please pick another range.", 409);
      }
    }
    return ok({ quote: q });
  }

  // ── Day-use blocks ────────────────────────────────────────────────
  if (mode === "blocks") {
    const { date, slotId } = body;
    if (!date || !slotId) return fail("slot_required", "Pick a date and a time slot.");

    const [slots, busy] = await Promise.all([getSlots(body.listingId), getBusyTimes(body.listingId)]);
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return fail("slot_required", "That slot isn't available any more.", 404);

    // getUTCDay on a PK-noon instant gives the local weekday without a tz lib.
    const weekday = new Date(`${date}T12:00:00+05:00`).getUTCDay();
    if (!slotRunsOn(slot, weekday)) {
      return fail("slot_not_on_day", `${slot.label} doesn't run on that day.`);
    }
    if (!isSlotFree(date, slot, busy)) {
      return fail("slot_taken", "That slot was just taken. Please pick another.", 409);
    }

    const q = quote({
      mode: "blocks",
      price: listing.price,
      exclusive,
      date,
      blockPrice: slot.price,
      blockLabel: slot.label,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
    if (isQuoteError(q)) return fail(q.error, q.message);
    return ok({ quote: q, slot: { id: slot.id, label: slot.label } });
  }

  // ── Hourly ────────────────────────────────────────────────────────
  if (mode === "hourly") {
    const { date, startTime, hours } = body;
    if (!date || !startTime || !hours) return fail("time_required", "Pick a date, a start time, and how long you need.");

    // Hourly config lives on the listing; the public view carries the price, and
    // the minimum is enforced by the quote. A missing minimum means 1 hour.
    const q = quote({
      mode: "hourly",
      price: listing.price,
      exclusive,
      date,
      startTime,
      hours,
      minHours: 1,
    });
    if (isQuoteError(q)) return fail(q.error, q.message);

    const busy = await getBusyTimes(body.listingId);
    const start = new Date(q.startsAt!).getTime();
    const end = new Date(q.endsAt!).getTime();
    if (busy.some((b) => new Date(b.startsAt).getTime() < end && new Date(b.endsAt).getTime() > start)) {
      return fail("slot_taken", "That time was just taken. Please pick another.", 409);
    }
    return ok({ quote: q });
  }

  // `session` (experiences) is named in the plan but not built — say so plainly
  // rather than pricing it wrong.
  return fail("mode_unsupported", "This can't be booked in the app yet.", 400);
});
