import { describe, expect, it } from "vitest";
import {
  apr,
  aprFromDates,
  aprSingleAdvance,
  levelPayment,
  periodsPerYear,
  unitPeriodsBetween,
  withinRegZTolerance,
} from "../src/index.js";
import { APPENDIX_J_EXAMPLES } from "./appendix-j.js";
import fixtures from "./fixtures.json";

describe("Regulation Z Appendix J published examples", () => {
  const pct2 = (x: number) => Math.round(x * 10_000) / 100;

  it("(b)(9): reproduces the iteration result 12.82557529% to 1e-5 points", () => {
    // Appendix J's own iterates (10-digit calculator): 12.82483042, 12.82557859, 12.82557529
    const got = aprSingleAdvance({ amount: 1000, payment: 33.61, numberOfPayments: 36 });
    expect(Math.abs(got * 100 - 12.82557529)).toBeLessThan(1e-5);
  });

  for (const ex of APPENDIX_J_EXAMPLES) {
    it(`${ex.name} → ${ex.apr.toFixed(2)}% (general equation, printed t and f)`, () => {
      const got = apr({
        advances: ex.advances,
        payments: ex.payments,
        unitPeriodsPerYear: ex.unitPeriodsPerYear,
      });
      expect(pct2(got)).toBe(ex.apr);
    });

    it(`${ex.name} → ${ex.apr.toFixed(2)}% (from the printed dates)`, () => {
      const got = aprFromDates({
        advances: ex.datedAdvances,
        payments: ex.datedPayments,
        unitPeriod: ex.unitPeriod,
      });
      expect(pct2(got)).toBe(ex.apr);
      expect(periodsPerYear(ex.unitPeriod)).toBeCloseTo(ex.unitPeriodsPerYear, 12);
    });

    it(`${ex.name}: dates convert to exactly the printed t and f`, () => {
      const dated = [...ex.datedAdvances, ...ex.datedPayments];
      const start = dated.map((d) => String(d.date)).sort()[0]!;
      const printed = [...ex.advances, ...ex.payments];
      expect(dated.length).toBe(printed.length);
      dated.forEach((d, k) => {
        const span = unitPeriodsBetween(start, d.date, ex.unitPeriod);
        expect(span.unitPeriods, `${String(d.date)}`).toBe(printed[k]!.unitPeriods);
        expect(span.fraction, `${String(d.date)}`).toBeCloseTo(printed[k]!.fraction ?? 0, 12);
      });
    });
  }
});

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

describe("unit-periods between dates (Appendix J (b)(5))", () => {
  it("monthly: full months measured back from the later date, remaining days ÷ 30", () => {
    expect(unitPeriodsBetween("1978-02-10", "1978-04-01", "month")).toEqual({ unitPeriods: 1, fraction: 19 / 30 });
    expect(unitPeriodsBetween("1979-04-10", "1979-09-18", "month")).toEqual({ unitPeriods: 5, fraction: 8 / 30 });
    expect(unitPeriodsBetween("2025-03-15", "2025-03-15", "month")).toEqual({ unitPeriods: 0, fraction: 0 });
  });

  it("29th/30th fall back to the last day of February; month-end series measure end to end", () => {
    // back from Apr 30: Mar 30, Feb 29 (2024), Jan 30 < Jan 31 → 2 months + 29 days
    expect(unitPeriodsBetween("2024-01-31", "2024-04-30", "month")).toEqual({ unitPeriods: 2, fraction: 29 / 30 });
    // month-end series: Apr 30 → Mar 31 → Feb 29 → Jan 31 = exactly 3 months
    expect(unitPeriodsBetween("2024-01-31", "2024-04-30", "month", { endOfMonth: true })).toEqual({
      unitPeriods: 3,
      fraction: 0,
    });
  });

  it("a remainder of a full 30 days is one more whole unit-period", () => {
    expect(unitPeriodsBetween("1978-01-01", "1978-01-31", "month")).toEqual({ unitPeriods: 1, fraction: 0 });
  });

  it("year unit: whole months ÷ 12, otherwise days ÷ 365", () => {
    expect(unitPeriodsBetween("1978-07-17", "1980-01-17", "year")).toEqual({ unitPeriods: 1, fraction: 0.5 });
    expect(unitPeriodsBetween("2025-01-01", "2026-03-11", "year")).toEqual({ unitPeriods: 1, fraction: 69 / 365 });
  });

  it("rejects reversed or malformed dates and unknown units", () => {
    expect(() => unitPeriodsBetween("2025-02-01", "2025-01-01", "month")).toThrow(RangeError);
    expect(() => unitPeriodsBetween("2025-02-30", "2025-03-01", "month")).toThrow(RangeError);
    expect(() => unitPeriodsBetween("2025-01-01", "2025-03-01", { months: 12 })).toThrow(RangeError);
    // @ts-expect-error — not a unit-period
    expect(() => periodsPerYear("fortnight")).toThrow(RangeError);
  });

  it("aprFromDates honours an explicit termStart and rejects one after a flow", () => {
    const payments = Array.from({ length: 11 }, (_, k) => ({
      amount: 98,
      date: `2025-${String(k + 2).padStart(2, "0")}-01`,
    }));
    const base = aprFromDates({ advances: [{ amount: 1000, date: "2025-01-01" }], payments, unitPeriod: "month" });
    expect(base).toBeCloseTo(
      aprSingleAdvance({ amount: 1000, payment: 98, numberOfPayments: 11 }),
      12,
    );
    expect(() =>
      aprFromDates({
        advances: [{ amount: 1000, date: "2025-01-01" }],
        payments,
        unitPeriod: "month",
        termStart: "2025-01-15",
      }),
    ).toThrow(RangeError);
  });
});

describe("validation", () => {
  it("rejects non-integer unitPeriods (fractions belong in `fraction`)", () => {
    expect(() =>
      apr({
        advances: [{ amount: 1000, unitPeriods: 0 }],
        payments: [{ amount: 1100, unitPeriods: 1.5 }],
        unitPeriodsPerYear: 12,
      }),
    ).toThrow(/whole number/);
    expect(() =>
      aprSingleAdvance({ amount: 1000, payment: 100, numberOfPayments: 12, firstPaymentUnitPeriods: 1.5 }),
    ).toThrow(RangeError);
  });

  it("levelPayment and withinRegZTolerance validate their inputs", () => {
    expect(() => levelPayment(Infinity, 0.1, 12)).toThrow(RangeError);
    expect(() => levelPayment(1000, 0.1, 12, 0)).toThrow(RangeError);
    // @ts-expect-error — not a transaction type
    expect(() => withinRegZTolerance(0.1, 0.1, "mortgage")).toThrow(RangeError);
  });

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
