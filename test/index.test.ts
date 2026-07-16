import { describe, expect, it } from "vitest";
import { apr, aprSingleAdvance, levelPayment, withinRegZTolerance } from "../src/index.js";
import fixtures from "./fixtures.json";

describe("the actuarial identity — the bedrock check", () => {
  it("a loan whose payment is computed at i per month has APR exactly 12·i", () => {
    for (const annual of [0.06, 0.12, 0.18, 0.29]) {
      const pmt = levelPayment(10_000, annual, 36);
      const got = aprSingleAdvance({ amount: 10_000, payment: pmt, numberOfPayments: 36 });
      expect(got).toBeCloseTo(annual, 9);
    }
  });

  it("the classic disclosure: $5,000, 36 × $166.07 ≈ 12.00% APR", () => {
    const got = aprSingleAdvance({ amount: 5000, payment: 166.07, numberOfPayments: 36 });
    expect(got).toBeCloseTo(0.12, 4); // payment is rounded to cents → 4 dp
    expect(withinRegZTolerance(0.12, got)).toBe(true);
  });

  it("weekly loans annualize by 52", () => {
    const pmt = levelPayment(2_000, 0.104, 26, 52); // 0.2%/week
    const got = aprSingleAdvance({
      amount: 2_000,
      payment: pmt,
      numberOfPayments: 26,
      unitPeriodsPerYear: 52,
    });
    expect(got).toBeCloseTo(0.104, 9);
  });

  it("zero-interest credit has APR 0", () => {
    expect(aprSingleAdvance({ amount: 1200, payment: 100, numberOfPayments: 12 })).toBeCloseTo(0, 10);
  });
});

describe("odd days and delayed first payments", () => {
  it("odd days delay the payments → APR falls below the no-delay rate", () => {
    const pmt = levelPayment(10_000, 0.12, 24);
    const base = aprSingleAdvance({ amount: 10_000, payment: pmt, numberOfPayments: 24 });
    const delayed = aprSingleAdvance({
      amount: 10_000,
      payment: pmt,
      numberOfPayments: 24,
      oddDaysFraction: 10 / 30,
    });
    expect(delayed).toBeLessThan(base);
  });

  it("a longer first period lowers the APR too", () => {
    const pmt = levelPayment(10_000, 0.12, 24);
    const long1st = aprSingleAdvance({
      amount: 10_000,
      payment: pmt,
      numberOfPayments: 24,
      firstPaymentUnitPeriods: 2,
    });
    expect(long1st).toBeLessThan(0.12);
  });
});

describe("cross-check against the independent Python reference", () => {
  it(`matches all ${fixtures.single.length} single-advance fixtures`, () => {
    for (const f of fixtures.single) {
      const got = aprSingleAdvance({
        amount: f.amount,
        payment: f.payment,
        numberOfPayments: f.n,
        unitPeriodsPerYear: f.uppy,
        firstPaymentUnitPeriods: f.t1,
        oddDaysFraction: f.f,
      });
      expect(got, `loan ${JSON.stringify(f)}`).toBeCloseTo(f.apr, 8);
    }
  });

  it(`matches all ${fixtures.multi.length} multi-advance fixtures`, () => {
    for (const f of fixtures.multi) {
      const got = apr({
        advances: Array.from({ length: 4 }, (_, k) => ({ amount: f.advance, unitPeriods: 6 * k })),
        payments: Array.from({ length: f.n }, (_, k) => ({
          amount: f.payment,
          unitPeriods: f.firstPay + k,
        })),
        unitPeriodsPerYear: 12,
      });
      expect(got, `multi ${JSON.stringify(f)}`).toBeCloseTo(f.apr, 8);
    }
  });
});

describe("tolerance helper", () => {
  it("±1/8 point for regular, ±1/4 for irregular", () => {
    expect(withinRegZTolerance(0.12, 0.12124)).toBe(true);
    expect(withinRegZTolerance(0.12, 0.1213)).toBe(false);
    expect(withinRegZTolerance(0.12, 0.1224, "irregular")).toBe(true);
  });
});

describe("validation", () => {
  it("rejects degenerate inputs", () => {
    expect(() => aprSingleAdvance({ amount: 0, payment: 1, numberOfPayments: 1 })).toThrow();
    expect(() => aprSingleAdvance({ amount: 100, payment: 1, numberOfPayments: 12 })).toThrow(
      /less than total advances/,
    );
    expect(() =>
      apr({ advances: [], payments: [{ amount: 1, unitPeriods: 1 }], unitPeriodsPerYear: 12 }),
    ).toThrow(RangeError);
    expect(() =>
      apr({
        advances: [{ amount: 1, unitPeriods: 0, fraction: 1.5 }],
        payments: [{ amount: 2, unitPeriods: 1 }],
        unitPeriodsPerYear: 12,
      }),
    ).toThrow(RangeError);
  });
});
