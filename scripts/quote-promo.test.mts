// The quote and its promo line (lib/quote.ts). Run: node scripts/quote-promo.test.mts
// lib/quote.ts imports through the "@/" alias, which plain Node doesn't know,
// so the alias is mapped to the repo for this run.
import assert from "node:assert/strict";
import { register } from "node:module";

const root = new URL("../", import.meta.url).href;
register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(spec, ctx, next) {
      if (spec.startsWith("@/")) return next(${JSON.stringify(root)} + spec.slice(2) + ".ts", ctx);
      return next(spec, ctx);
    }`)}`,
  import.meta.url,
);
const { quote, isQuoteError, withPromo, promoBasis } = await import("../lib/quote.ts");

// A standard 3-night stay at Rs 10,000: 25% advance, the rest at check-in.
const q = quote({ mode: "nightly", price: 10_000, exclusive: false, checkin: "2026-11-10", checkout: "2026-11-13" });
assert.ok(!isQuoteError(q));
if (isQuoteError(q)) throw new Error("unreachable");
assert.equal(q.total, 30_000);
assert.equal(q.advance, 7_500);
assert.equal(q.balance, 22_500);
assert.equal(q.promo, null);
// What promo_check is asked about: the stay, and what's due at check-in.
assert.deepEqual(promoBasis(q), { subtotal: 30_000, owed: 22_500 });

// SAIR: Rs 1,000 off at check-in. The advance never changes.
const s = withPromo(q, { code: "SAIR", discount: 1_000 });
assert.deepEqual(s.promo, { code: "SAIR", discount: 1_000 });
assert.equal(s.advance, 7_500);
assert.equal(s.total, 30_000);
assert.equal(s.balance, 21_500);
// The booking's value is the stay less the promo, and it reconciles.
assert.equal(s.total - s.promo!.discount, s.advance + s.balance);

// A discount larger than the check-in balance stops at it.
const big = withPromo(q, { code: "BIG", discount: 50_000 });
assert.equal(big.promo!.discount, 22_500);
assert.equal(big.balance, 0);
assert.equal(big.advance, 7_500);

// No promo: unchanged, and the input quote is never mutated.
assert.deepEqual(withPromo(q, null), q);
assert.equal(q.balance, 22_500);

// An Exclusive stay takes 50% up front; the promo still only meets the rest.
const x = quote({ mode: "nightly", price: 35_000, exclusive: true, checkin: "2026-11-10", checkout: "2026-11-12" });
if (isQuoteError(x)) throw new Error("exclusive quote failed");
assert.equal(x.advance, 35_000);
assert.equal(withPromo(x, { code: "SAIR", discount: 1_000 }).balance, 34_000);

console.log("quote + promo: all checks pass");
