// Investor page engine — pinned against the build spec (§4).
// Run: node --test scripts/invest-calc.test.mjs
//
// The spec's table used 20 nights for Conservative; the founder moved it to 21
// (6 Oct 2026). The 24- and 28-night columns are the spec's numbers verbatim;
// the 21-night column is pinned from the same formulas.
import test from "node:test";
import assert from "node:assert/strict";
import { quote, compareRows, returnRange, areaSummary, rs, lakh, pct, months } from "../lib/invest/calc.ts";
import { AREAS, PACKAGES } from "../lib/invest/config.ts";

// [areaId, unit, upfront, monthlyCost, { nights: [monthly, payback, annual%] }]
const TABLE = [
  ["bahria", "2BHK", 1680000, 160000, { 21: [108500, "15.5", 78], 24: [140000, "12", 100], 28: [182000, "9.2", 130] }],
  ["bahria", "1BHK", 920000, 103500, { 21: [52500, "17.5", 68], 24: [70350, "13.1", 92], 28: [94150, "9.8", 123] }],
  ["dha2", "1BHK", 920000, 103500, { 21: [52500, "17.5", 68], 24: [70350, "13.1", 92], 28: [94150, "9.8", 123] }],
  ["e11", "2BHK", 1740000, 180000, { 21: [109200, "15.9", 75], 24: [142800, "12.2", 98], 28: [187600, "9.3", 129] }],
  ["f11", "2BHK", 1980000, 260000, { 21: [82600, "24", 50], 24: [120400, "16.4", 73], 28: [170800, "11.6", 104] }],
  ["skypark", "2BHK", 2010000, 270000, { 21: [149100, "13.5", 89], 24: [197400, "10.2", 118], 28: [261800, "7.7", 156] }],
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

test("hero range at Standard is 73–118%", () => {
  assert.deepEqual(returnRange("standard"), { min: 73, max: 118 });
});

test("compare view is ranked by annual return and covers every area × unit", () => {
  const rows = compareRows("standard");
  assert.equal(rows.length, AREAS.reduce((n, a) => n + Object.keys(a.units).length, 0));
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].annualReturn >= rows[i].annualReturn);
  assert.equal(rows[0].areaId, "skypark");
});

test("unavailable unit returns null (disable, don't crash)", () => {
  assert.equal(quote({ areaId: "e11", unit: "1BHK", stake: 1 }), null);
});

test("breakeven nights round UP", () => {
  assert.equal(quote({ areaId: "bahria", unit: "2BHK", stake: 1 }).breakevenNights, 11); // 160000 / 15000 = 10.67
  assert.equal(quote({ areaId: "skypark", unit: "2BHK", stake: 1 }).breakevenNights, 12); // 270000 / 23000 = 11.74
});

test("area card summary: lowest upfront and best Standard return", () => {
  assert.deepEqual(areaSummary(AREAS.find((a) => a.id === "bahria")), { fromUpfront: 920000, bestReturn: 100 });
});

test("formatting", () => {
  assert.equal(rs(140000), "1,40,000");
  assert.equal(rs(2010000), "20,10,000");
  assert.equal(lakh(1680000), "16.8L");
  assert.equal(lakh(900000), "9L");
  assert.equal(months(12.0), "12");
  assert.equal(months(17.14), "17.1");
});
