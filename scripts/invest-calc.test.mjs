// Investor page engine — pinned against the build spec (§4).
// Run: node --test scripts/invest-calc.test.mjs
//
// The spec's table used 20 nights for Conservative; the founder moved it to 21
// (6 Oct 2026). 1BHK rows are the spec's numbers; 2BHK rows were re-pinned on
// 8 Oct 2026 when the founder set 2BHK caretaker ₨10k and laundry ₨8k.
import test from "node:test";
import assert from "node:assert/strict";
import { quote, compareRows, returnRange, areaSummary, headline, fitForBudget, standardAreas, specialAreas, rs, lakh, pct, months } from "../lib/invest/calc.ts";
import { AREAS, PACKAGES } from "../lib/invest/config.ts";

// [areaId, unit, upfront, monthlyCost, { nights: [monthly, payback, annual%] }]
const TABLE = [
  ["bahria", "2BHK", 1680000, 153000, { 21: [113400, "14.8", 81], 24: [144900, "11.6", 103], 28: [186900, "9", 134] }],
  ["bahria", "1BHK", 920000, 103500, { 21: [52500, "17.5", 68], 24: [70350, "13.1", 92], 28: [94150, "9.8", 123] }],
  ["dha2", "1BHK", 920000, 103500, { 21: [52500, "17.5", 68], 24: [70350, "13.1", 92], 28: [94150, "9.8", 123] }],
  ["e11", "2BHK", 1740000, 173000, { 21: [114100, "15.2", 79], 24: [147700, "11.8", 102], 28: [192500, "9", 133] }],
  ["f11", "2BHK", 1980000, 253000, { 21: [87500, "22.6", 53], 24: [125300, "15.8", 76], 28: [175700, "11.3", 106] }],
  ["skypark", "2BHK", 2010000, 263000, { 21: [154000, "13.1", 92], 24: [202300, "9.9", 121], 28: [266700, "7.5", 159] }],
];

test("packages are 21 / 24 / 28 nights, Standard in the middle", () => {
  assert.deepEqual(PACKAGES.map((p) => p.nights), [21, 24, 28]);
  assert.equal(PACKAGES[1].id, "standard");
});

for (const [areaId, unit, upfront, cost, cells] of TABLE) {
  test(`${areaId} ${unit} — full stake`, () => {
    const q = quote({ areaId, unit, stake: 1 });
    assert.ok(q);
    assert.equal(q.upfrontTotal, upfront, "upfront");
    assert.equal(q.monthlyCost, cost, "monthly cost");
    for (const p of PACKAGES) {
      const [monthly, payback, annual] = cells[p.nights];
      const r = q.packages[p.id];
      assert.equal(r.yourMonthly, monthly, `${p.nights} nights monthly`);
      assert.equal(months(r.paybackMonths), payback, `${p.nights} nights payback`);
      assert.equal(pct(r.annualReturn), annual, `${p.nights} nights annual`);
    }
  });

  test(`${areaId} ${unit} — half stake halves capital and share, keeps return`, () => {
    const full = quote({ areaId, unit, stake: 1 });
    const half = quote({ areaId, unit, stake: 0.5 });
    assert.equal(half.yourCapital, full.yourCapital / 2);
    assert.equal(half.packages.standard.yourMonthly, Math.floor(full.packages.standard.investorPool * 0.5));
    assert.equal(pct(half.packages.standard.annualReturn), pct(full.packages.standard.annualReturn));
  });
}

test("hero range at Standard is 76–121%", () => {
  assert.deepEqual(returnRange("standard"), { min: 76, max: 121 });
});

test("compare view is ranked by annual return and covers every area × unit", () => {
  const rows = compareRows("standard");
  assert.equal(rows.length, standardAreas().reduce((n, a) => n + Object.keys(a.units).length, 0));
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].annualReturn >= rows[i].annualReturn);
  assert.equal(rows[0].areaId, "skypark");
});

test("unavailable unit returns null (disable, don't crash)", () => {
  assert.equal(quote({ areaId: "e11", unit: "1BHK", stake: 1 }), null);
});

test("breakeven nights round UP", () => {
  assert.equal(quote({ areaId: "bahria", unit: "2BHK", stake: 1 }).breakevenNights, 11); // 153000 / 15000 = 10.2
  assert.equal(quote({ areaId: "skypark", unit: "2BHK", stake: 1 }).breakevenNights, 12); // 263000 / 23000 = 11.43
});

test("area card summary: lowest upfront and best Standard return", () => {
  assert.deepEqual(areaSummary(AREAS.find((a) => a.id === "bahria")), { fromUpfront: 920000, bestReturn: 103 });
});

test("formatting", () => {
  assert.equal(rs(140000), "1,40,000");
  assert.equal(rs(2010000), "20,10,000");
  assert.equal(lakh(1680000), "16.8L");
  assert.equal(lakh(900000), "9L");
  assert.equal(months(12.0), "12");
  assert.equal(months(17.14), "17.1");
});

// ── v2 (10 Oct 2026) ───────────────────────────────────────────────────────

test("the one-off penthouse stays out of the standard set, the compare list and the hero range", () => {
  assert.deepEqual(specialAreas().map((a) => a.id), ["e11pool"]);
  assert.ok(!standardAreas().some((a) => a.id === "e11pool"));
  assert.ok(!compareRows("standard").some((r) => r.areaId === "e11pool"));
  assert.deepEqual(returnRange("standard"), { min: 76, max: 121 });
});

test("E-11 terrace-pool penthouse — the founder's figures (10 Oct 2026)", () => {
  // Rent 1,20,000 · 25,000 a night · electricity 1,00,000 (upper end of 80–100k)
  // · Rs 15 lakh all-in = 1 month's rent + 2 months' security + 11.4L furnishing/pool.
  const q = quote({ areaId: "e11pool", unit: "2BHK", stake: 1 });
  assert.equal(q.upfrontTotal, 1500000);
  assert.equal(q.advanceRent, 120000);
  assert.equal(q.securityDeposit, 240000);
  assert.equal(q.furnishing, 1140000);
  assert.equal(q.costs.electricity, 100000);
  assert.equal(q.monthlyCost, 258000);
  assert.equal(q.breakevenNights, 11); // 258000 / 25000 = 10.32
  const s = q.packages.standard;
  assert.equal(s.revenue, 600000);
  assert.equal(s.netProfit, 342000);
  assert.equal(s.yourMonthly, 239400);
  assert.equal(months(s.paybackMonths), "6.3");
  assert.equal(pct(s.annualReturn), 192);
  assert.equal(q.packages.conservative.yourMonthly, 186900);
  assert.equal(q.packages.high.yourMonthly, 309400);
});

test("hero headline: the smallest start, the span of monthly shares and paybacks", () => {
  const h = headline("standard");
  assert.equal(h.fromCapital, 460000); // half a Bahria/DHA 1BHK
  assert.equal(h.monthlyMin, 35175);
  assert.equal(h.monthlyMax, 202300); // SkyPark 2BHK, full
  assert.equal(months(h.paybackMin), "9.9");
  assert.equal(months(h.paybackMax), "15.8");
});

test("budget fit: the biggest monthly share within budget, best first", () => {
  const ten = fitForBudget(1000000);
  assert.equal(ten.best.areaId, "e11"); // half 2BHK E-11 (8.7L) earns 73,850 — more than a full 1BHK (70,350)
  assert.equal(ten.best.stake, 0.5);
  assert.ok(ten.within.every((o) => o.quote.yourCapital <= 1000000));
  for (let i = 1; i < ten.within.length; i++) assert.ok(ten.within[i - 1].quote.packages.standard.yourMonthly >= ten.within[i].quote.packages.standard.yourMonthly);
  const twenty = fitForBudget(2000000);
  assert.deepEqual([twenty.best.areaId, twenty.best.unit, twenty.best.stake], ["e11", "2BHK", 1]); // 17.4L; SkyPark (20.1L) is over
  const thirty = fitForBudget(3000000);
  assert.deepEqual([thirty.best.areaId, thirty.best.stake], ["skypark", 1]);
  const tiny = fitForBudget(100000);
  assert.equal(tiny.best, null);
  assert.equal(tiny.smallest.quote.yourCapital, 460000);
});
