// The date hold (lib/booking/hold.ts). Run: node scripts/hold.test.mts
import assert from "node:assert/strict";
import { blocksDates, holdUntil, holdLabel, isExpiringHold } from "../lib/booking/hold.ts";

const now = Date.parse("2026-10-22T10:00:00Z");
const min = 60_000;
const web = (over: object) => ({ status: "awaiting_payment", source: "Website", created_at: new Date(now - 5 * min).toISOString(), ...over });

// Durations, stamped from the moment of booking.
assert.equal(holdUntil("card", new Date(now)), new Date(now + 30 * min).toISOString());
assert.equal(holdUntil("transfer", new Date(now)), new Date(now + 18 * 60 * min).toISOString());
assert.equal(holdLabel("card"), "30 minutes");
assert.equal(holdLabel("transfer"), "18 hours");

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
