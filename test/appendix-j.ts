/**
 * The worked examples published in Regulation Z, 12 CFR Part 1026,
 * Appendix J — paragraph (b)(9) and every example in (c)(1)–(c)(7) — with the
 * dates, unit-periods (t, f) and annual percentage rates exactly as printed in
 * the regulation (source: eCFR / consumerfinance.gov rendering of Appendix J,
 * 76 FR 79772, retrieved 2026-10-10). Disclosed APRs are to two decimals.
 *
 * `flows` give t and f as printed (for the general equation); `dated` give the
 * calendar dates as printed (for the date → unit-period rules of (b)(5)).
 */
import type { CashFlow, DatedFlow, UnitPeriod } from "../src/index.js";

export interface AppendixJExample {
  name: string;
  /** Published APR, percent, two decimals. */
  apr: number;
  unitPeriodsPerYear: number;
  advances: CashFlow[];
  payments: CashFlow[];
  unitPeriod: UnitPeriod;
  datedAdvances: DatedFlow[];
  datedPayments: DatedFlow[];
}

const iso = (y: number, m: number, d: number): string => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
};
/** n flows every `months` months from (y, m, d). */
const monthly = (amount: number, n: number, y: number, m: number, d: number, months = 1): DatedFlow[] =>
  Array.from({ length: n }, (_, k) => ({ amount, date: iso(y, m + k * months, d) }));
/** n flows every `days` days from (y, m, d). */
const everyDays = (amount: number, n: number, y: number, m: number, d: number, days: number): DatedFlow[] =>
  Array.from({ length: n }, (_, k) => ({ amount, date: iso(y, m, d + k * days) }));
/** n flows on the 1st and 16th of each month starting (y, m, 1). */
const semimonthly = (amount: number, n: number, y: number, m: number): DatedFlow[] =>
  Array.from({ length: n }, (_, k) => ({ amount, date: iso(y, m + Math.floor(k / 2), k % 2 ? 16 : 1) }));
const series = (amount: number, n: number, t0: number, fraction = 0): CashFlow[] =>
  Array.from({ length: n }, (_, k) => ({ amount, unitPeriods: t0 + k, fraction }));

const MORTGAGE_C6III = [
  291.81, 300.18, 308.78, 317.61, 326.65, 335.92, 345.42, 355.15, 365.12, 375.33, 385.76, 385.42,
  385.03, 384.62, 384.17, 383.67, 383.13, 382.54, 381.9, 381.2, 380.43, 379.6, 378.68, 377.69,
  376.6, 375.42, 374.13, 372.72, 371.18, 369.5,
];

export const APPENDIX_J_EXAMPLES: AppendixJExample[] = [
  {
    name: "(b)(9) iteration example: $1,000, 36 × $33.61, first payment after 1 month",
    apr: 12.83,
    unitPeriodsPerYear: 12,
    advances: [{ amount: 1000, unitPeriods: 0 }],
    payments: series(33.61, 36, 1),
    unitPeriod: "month",
    datedAdvances: [{ amount: 1000, date: "1978-01-10" }],
    datedPayments: monthly(33.61, 36, 1978, 2, 10),
  },
  {
    name: "(c)(1)(i) monthly, regular first period",
    apr: 9.69,
    unitPeriodsPerYear: 12,
    advances: [{ amount: 5000, unitPeriods: 0 }],
    payments: series(230, 24, 1),
    unitPeriod: "month",
    datedAdvances: [{ amount: 5000, date: "1978-01-10" }],
    datedPayments: monthly(230, 24, 1978, 2, 10),
  },
  {
    name: "(c)(1)(ii) monthly, long first period (t=1, f=19/30)",
    apr: 11.82,
    unitPeriodsPerYear: 12,
    advances: [{ amount: 6000, unitPeriods: 0 }],
    payments: series(200, 36, 1, 19 / 30),
    unitPeriod: "month",
    datedAdvances: [{ amount: 6000, date: "1978-02-10" }],
    datedPayments: monthly(200, 36, 1978, 4, 1),
  },
  {
    name: "(c)(1)(iii) semimonthly, short first period (t=0, f=6/15)",
    apr: 10.34,
    unitPeriodsPerYear: 24,
    advances: [{ amount: 5000, unitPeriods: 0 }],
    payments: series(219.17, 24, 0, 6 / 15),
    unitPeriod: "semimonth",
    datedAdvances: [{ amount: 5000, date: "1978-02-23" }],
    datedPayments: semimonthly(219.17, 24, 1978, 3),
  },
  {
    name: "(c)(1)(iv) quarterly, long first period (t=1, f=39/90)",
    apr: 8.97,
    unitPeriodsPerYear: 4,
    advances: [{ amount: 10000, unitPeriods: 0 }],
    payments: series(385, 40, 1, 39 / 90),
    unitPeriod: { months: 3 },
    datedAdvances: [{ amount: 10000, date: "1978-05-23" }],
    datedPayments: monthly(385, 40, 1978, 10, 1, 3),
  },
  {
    name: "(c)(1)(v) weekly, long first period (t=4, f=4/7)",
    apr: 14.96,
    unitPeriodsPerYear: 52,
    advances: [{ amount: 500, unitPeriods: 0 }],
    payments: series(17.6, 30, 4, 4 / 7),
    unitPeriod: "week",
    datedAdvances: [{ amount: 500, date: "1978-03-20" }],
    datedPayments: everyDays(17.6, 30, 1978, 4, 21, 7),
  },
  {
    name: "(c)(2)(i) monthly, irregular first payment",
    apr: 10.08,
    unitPeriodsPerYear: 12,
    advances: [{ amount: 5000, unitPeriods: 0 }],
    payments: [{ amount: 250, unitPeriods: 1 }, ...series(230, 23, 2)],
    unitPeriod: "month",
    datedAdvances: [{ amount: 5000, date: "1978-01-10" }],
    datedPayments: [{ amount: 250, date: "1978-02-10" }, ...monthly(230, 23, 1978, 3, 10)],
  },
  {
    name: "(c)(2)(ii) every 4 weeks, long first period, irregular first payment (f=5/28)",
    apr: 28.5,
    unitPeriodsPerYear: 13,
    advances: [{ amount: 400, unitPeriods: 0 }],
    payments: [{ amount: 39.5, unitPeriods: 1, fraction: 5 / 28 }, ...series(38.31, 11, 2, 5 / 28)],
    unitPeriod: { weeks: 4 },
    datedAdvances: [{ amount: 400, date: "1978-03-18" }],
    datedPayments: [{ amount: 39.5, date: "1978-04-20" }, ...everyDays(38.31, 11, 1978, 4, 20 + 28, 28)],
  },
  {
    name: "(c)(3)(i) monthly, irregular final payment",
    apr: 10.5,
    unitPeriodsPerYear: 12,
    advances: [{ amount: 5000, unitPeriods: 0 }],
    payments: [...series(230, 23, 1), { amount: 280, unitPeriods: 24 }],
    unitPeriod: "month",
    datedAdvances: [{ amount: 5000, date: "1978-01-10" }],
    datedPayments: [...monthly(230, 23, 1978, 2, 10), { amount: 280, date: "1980-01-10" }],
  },
  {
    name: "(c)(3)(ii) every 2 weeks, short first period, irregular final payment (f=8/14)",
    apr: 12.22,
    unitPeriodsPerYear: 26,
    advances: [{ amount: 200, unitPeriods: 0 }],
    payments: [...series(9.5, 19, 0, 8 / 14), { amount: 30, unitPeriods: 19, fraction: 8 / 14 }],
    unitPeriod: { weeks: 2 },
    datedAdvances: [{ amount: 200, date: "1978-04-03" }],
    datedPayments: [...everyDays(9.5, 19, 1978, 4, 11, 14), { amount: 30, date: iso(1978, 4, 11 + 19 * 14) }],
  },
  {
    name: "(c)(4)(i) monthly, irregular first and final payments",
    apr: 10.9,
    unitPeriodsPerYear: 12,
    advances: [{ amount: 5000, unitPeriods: 0 }],
    payments: [{ amount: 250, unitPeriods: 1 }, ...series(230, 22, 2), { amount: 280, unitPeriods: 24 }],
    unitPeriod: "month",
    datedAdvances: [{ amount: 5000, date: "1978-01-10" }],
    datedPayments: [
      { amount: 250, date: "1978-02-10" },
      ...monthly(230, 22, 1978, 3, 10),
      { amount: 280, date: "1980-01-10" },
    ],
  },
  {
    name: "(c)(4)(ii) every 2 months, short first period, irregular first and final (f=52/60)",
    apr: 7.3,
    unitPeriodsPerYear: 6,
    advances: [{ amount: 8000, unitPeriods: 0 }],
    payments: [
      { amount: 449.36, unitPeriods: 0, fraction: 52 / 60 },
      ...series(465, 18, 1, 52 / 60),
      { amount: 200, unitPeriods: 19, fraction: 52 / 60 },
    ],
    unitPeriod: { months: 2 },
    datedAdvances: [{ amount: 8000, date: "1978-01-10" }],
    datedPayments: [
      { amount: 449.36, date: "1978-03-01" },
      ...monthly(465, 18, 1978, 5, 1, 2),
      { amount: 200, date: iso(1978, 3 + 19 * 2, 1) },
    ],
  },
  {
    name: "(c)(5)(i) single advance, single payment, 255-day term",
    apr: 11.45,
    unitPeriodsPerYear: 365 / 255,
    advances: [{ amount: 1000, unitPeriods: 0 }],
    payments: [{ amount: 1080, unitPeriods: 1 }],
    unitPeriod: { days: 255 },
    datedAdvances: [{ amount: 1000, date: "1978-01-03" }],
    datedPayments: [{ amount: 1080, date: "1978-09-15" }],
  },
  {
    name: "(c)(5)(ii) single advance, single payment, 6 calendar months",
    apr: 8.8,
    unitPeriodsPerYear: 2,
    advances: [{ amount: 1000, unitPeriods: 0 }],
    payments: [{ amount: 1044, unitPeriods: 1 }],
    unitPeriod: { months: 6 },
    datedAdvances: [{ amount: 1000, date: "1978-07-15" }],
    datedPayments: [{ amount: 1044, date: "1979-01-15" }],
  },
  {
    name: "(c)(5)(iii) single advance, single payment, 18 months (t=1, f=6/12)",
    apr: 8.76,
    unitPeriodsPerYear: 1,
    advances: [{ amount: 1000, unitPeriods: 0 }],
    payments: [{ amount: 1135.19, unitPeriods: 1, fraction: 6 / 12 }],
    unitPeriod: "year",
    datedAdvances: [{ amount: 1000, date: "1978-07-17" }],
    datedPayments: [{ amount: 1135.19, date: "1980-01-17" }],
  },
  {
    name: "(c)(5)(iv) single advance, single payment, exactly 2 years",
    apr: 11.36,
    unitPeriodsPerYear: 1,
    advances: [{ amount: 1000, unitPeriods: 0 }],
    payments: [{ amount: 1240, unitPeriods: 2 }],
    unitPeriod: "year",
    datedAdvances: [{ amount: 1000, date: "1978-01-03" }],
    datedPayments: [{ amount: 1240, date: "1980-01-03" }],
  },
  {
    name: "(c)(6)(i) skipped-payment loan, every 4 weeks",
    apr: 12.0,
    unitPeriodsPerYear: 13,
    advances: [{ amount: 2135, unitPeriods: 0 }],
    payments: [
      ...series(100, 9, 0, 26 / 28),
      ...series(100, 6, 10, 12 / 28),
      ...series(100, 6, 16, 26 / 28),
      ...series(100, 3, 23, 12 / 28),
    ],
    unitPeriod: { weeks: 4 },
    datedAdvances: [{ amount: 2135, date: "1978-01-25" }],
    // 26 days to the first series; each later series starts n unit-periods + 2 weeks after the prior one
    datedPayments: [
      ...everyDays(100, 9, 1978, 1, 25 + 26, 28),
      ...everyDays(100, 6, 1978, 1, 25 + 26 + 9 * 28 + 14, 28),
      ...everyDays(100, 6, 1978, 1, 25 + 26 + 9 * 28 + 14 + 6 * 28 + 14, 28),
      ...everyDays(100, 3, 1978, 1, 25 + 26 + 9 * 28 + 14 + 2 * (6 * 28 + 14), 28),
    ],
  },
  {
    name: "(c)(6)(ii) skipped-payment loan plus single payments",
    apr: 10.22,
    unitPeriodsPerYear: 12,
    advances: [{ amount: 7350, unitPeriods: 0 }],
    payments: [
      ...series(1000, 3, 6, 12 / 30),
      { amount: 2000, unitPeriods: 12, fraction: 12 / 30 },
      ...series(750, 3, 18, 12 / 30),
      { amount: 1000, unitPeriods: 22, fraction: 29 / 30 },
    ],
    unitPeriod: "month",
    datedAdvances: [{ amount: 7350, date: "1978-03-03" }],
    datedPayments: [
      ...monthly(1000, 3, 1978, 9, 15),
      { amount: 2000, date: "1979-03-15" },
      ...monthly(750, 3, 1979, 9, 15),
      { amount: 1000, date: "1980-02-01" },
    ],
  },
  {
    name: "(c)(6)(iii) mortgage with varying payments (t=1, f=21/30)",
    apr: 9.8,
    unitPeriodsPerYear: 12,
    advances: [{ amount: 39688.56, unitPeriods: 0 }],
    payments: MORTGAGE_C6III.flatMap((p, y) => series(p, 12, 1 + 12 * y, 21 / 30)),
    unitPeriod: "month",
    datedAdvances: [{ amount: 39688.56, date: "1978-04-10" }],
    datedPayments: MORTGAGE_C6III.flatMap((p, y) => monthly(p, 12, 1978, 6 + 12 * y, 1)),
  },
  {
    name: "(c)(7)(i) construction loan, three advances",
    apr: 10.25,
    unitPeriodsPerYear: 12,
    advances: [
      { amount: 20000, unitPeriods: 0 },
      { amount: 20000, unitPeriods: 2, fraction: 2 / 30 },
      { amount: 20000, unitPeriods: 5, fraction: 8 / 30 },
    ],
    payments: series(612.36, 240, 8),
    unitPeriod: "month",
    datedAdvances: [
      { amount: 20000, date: "1979-04-10" },
      { amount: 20000, date: "1979-06-12" },
      { amount: 20000, date: "1979-09-18" },
    ],
    datedPayments: monthly(612.36, 240, 1979, 12, 10),
  },
  {
    name: "(c)(7)(ii) student loan, payments begin before the first advance",
    apr: 32.04,
    unitPeriodsPerYear: 12,
    advances: [
      ...[2, 14, 26, 38].map((t) => ({ amount: 1800, unitPeriods: t, fraction: 4 / 30 })),
      ...[6, 18, 30, 42].map((t) => ({ amount: 1000, unitPeriods: t, fraction: 4 / 30 })),
    ],
    payments: series(240, 50, 0),
    unitPeriod: "month",
    datedAdvances: [
      ...[1978, 1979, 1980, 1981].map((y) => ({ amount: 1800, date: `${y}-09-05` })),
      ...[1979, 1980, 1981, 1982].map((y) => ({ amount: 1000, date: `${y}-01-05` })),
    ],
    datedPayments: monthly(240, 50, 1978, 7, 1),
  },
];
