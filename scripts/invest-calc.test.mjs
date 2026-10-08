// Investor page engine — pinned against the build spec (§4).
// Run: node --test scripts/invest-calc.test.mjs
//
// The spec's table used 20 nights for Conservative; the founder moved it to 21
// (6 Oct 2026). 1BHK rows are the spec's numbers; 2BHK rows were re-pinned on
// 8 Oct 2026 when the founder set 2BHK caretaker ₨10k and laundry ₨8k.
import test from "node:test";
import assert from "node:assert/strict";
import { quote, compareRows, returnRange, areaSummary, rs, lakh, pct, months } from "../lib/invest/calc.ts";
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
  assert.equal(rows.length, AREAS.reduce((n, a) => n + Object.keys(a.units).length, 0));
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
