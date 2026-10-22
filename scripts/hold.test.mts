// The date hold (lib/booking/hold.ts). Run: node scripts/hold.test.mts
import assert from "node:assert/strict";
import { blocksDates, holdUntil, HOLD_LINE, isExpiringHold, minutesLabel } from "../lib/booking/hold.ts";

const now = Date.parse("2026-10-22T10:00:00Z");
const min = 60_000;
const web = (over: object) => ({ status: "awaiting_payment", source: "Website", created_at: new Date(now - 5 * min).toISOString(), ...over });

// A card holds 30 minutes from the moment of booking.
assert.equal(holdUntil("card", "2026-10-25", new Date(now)), new Date(now + 30 * min).toISOString());
// A transfer (it always comes with its screenshot) holds until check-out
// day's 12:00 PM PKT: only the team's verify or cancel releases it earlier,
// however late they are (founder, 22 Oct).
assert.equal(holdUntil("transfer", "2026-10-25", new Date(now)), "2026-10-25T07:00:00.000Z");
assert.equal(blocksDates(web({ hold_until: holdUntil("transfer", "2026-10-25", new Date(now)) }), now + 2 * 24 * 60 * min), true);
assert.equal(minutesLabel(30), "30 minutes");
assert.equal(HOLD_LINE.transfer, "We confirm transfers within 30 minutes, and your dates stay held until we do.");

// A card hold blocks for 30 minutes, then the dates are back on sale.
assert.equal(blocksDates(web({ hold_until: new Date(now + 1 * min).toISOString() }), now), true);
assert.equal(blocksDates(web({ hold_until: new Date(now - 1 * min).toISOString() }), now), false);

// No stamp (a row from before migration 24): the old 18 hours from creation.
assert.equal(blocksDates(web({ hold_until: null, created_at: new Date(now - 17 * 60 * min).toISOString() }), now), true);
assert.equal(blocksDates(web({ hold_until: null, created_at: new Date(now - 19 * 60 * min).toISOString() }), now), false);

// Only unpaid WEBSITE bookings expire. Paid, staff or CRM bookings always block,
// whatever their stamp says.
const expired = new Date(now - 60 * min).toISOString();
assert.equal(blocksDates({ status: "payment_collected", source: "Website", created_at: expired, hold_until: expired }, now), true);
assert.equal(blocksDates({ status: "awaiting_payment", source: "WhatsApp", created_at: expired, hold_until: expired }, now), true);
assert.equal(blocksDates({ status: "awaiting_payment", source: null, created_at: expired, hold_until: expired }, now), true);
assert.equal(isExpiringHold({ status: "awaiting_payment", source: "website" }), false, "matches the views' exact 'Website'");

console.log("hold: all checks pass");
