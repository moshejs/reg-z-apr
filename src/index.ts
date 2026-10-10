/**
 * reg-z-apr — the US Truth in Lending APR (Regulation Z, 12 CFR Part 1026,
 * Appendix J actuarial method).
 *
 * The general equation: at the APR's unit-period rate i, the discounted value
 * of all advances equals the discounted value of all payments, where an
 * amount occurring t whole unit periods plus a fraction f after consummation
 * is discounted by (1 + f·i)(1 + i)^t. The APR is i × unit periods per year.
 *
 * This is the actuarial method every US consumer lender must use to compute
 * the disclosed APR. Rates are decimals (0.12 = 12%).
 */

export interface CashFlow {
  /** Amount of the advance or payment. */
  amount: number;
  /** Whole unit periods from consummation to this flow. */
  unitPeriods: number;
  /** Fractional unit period (odd days ÷ days in a unit period), per App J. Default 0. */
  fraction?: number;
}

export interface AprInputs {
  /** Advances to the borrower (usually one, at time 0). */
  advances: readonly CashFlow[];
  /** Payments by the borrower. */
  payments: readonly CashFlow[];
  /** Unit periods per year: 12 monthly, 52 weekly, 26 biweekly, 1 annual… */
  unitPeriodsPerYear: number;
}

function check(cond: boolean, msg: string): void {
  if (!cond) throw new RangeError(msg);
}

function validateFlows(flows: readonly CashFlow[], label: string): void {
  check(flows.length > 0, `${label} must be non-empty`);
  for (const f of flows) {
    check(Number.isFinite(f.amount) && f.amount > 0, `${label}: amounts must be positive`);
    check(
      Number.isFinite(f.unitPeriods) && f.unitPeriods >= 0,
      `${label}: unitPeriods must be ≥ 0`,
    );
    check(
      Number.isInteger(f.unitPeriods),
      `${label}: unitPeriods must be a whole number (put the remainder in fraction)`,
    );
    const frac = f.fraction ?? 0;
    check(frac >= 0 && frac < 1, `${label}: fraction must be in [0,1)`);
  }
}

/** Discounted value of flows at unit-period rate i, per the App J factor. */
function presentValue(flows: readonly CashFlow[], i: number): number {
  let pv = 0;
  for (const f of flows) {
    const frac = f.fraction ?? 0;
    pv += f.amount / ((1 + frac * i) * Math.pow(1 + i, f.unitPeriods));
  }
  return pv;
}

/**
 * Solve the Appendix J general equation for the APR (decimal per year).
 *
 * Uses bracketing bisection to ~1e-14 relative precision — robust for any
 * consumer-credit cash-flow pattern (multiple advances, irregular payments,
 * odd days). If a pattern admits more than one root (possible only when
 * advances follow payments), the root inside the first bracket found by
 * doubling up from 0 is returned.
 *
 * ```ts
 * apr({
 *   advances: [{ amount: 5000, unitPeriods: 0 }],
 *   payments: Array.from({ length: 36 }, (_, k) => ({ amount: 166.07, unitPeriods: k + 1 })),
 *   unitPeriodsPerYear: 12,
 * }); // ≈ 0.12
 * ```
 */
export function apr(inputs: AprInputs): number {
  validateFlows(inputs.advances, "advances");
  validateFlows(inputs.payments, "payments");
  check(
    Number.isFinite(inputs.unitPeriodsPerYear) && inputs.unitPeriodsPerYear > 0,
    `unitPeriodsPerYear must be positive`,
  );

  const totalAdvances = inputs.advances.reduce((a, f) => a + f.amount, 0);
  const totalPayments = inputs.payments.reduce((a, f) => a + f.amount, 0);
  check(
    totalPayments >= totalAdvances - 1e-9,
    "total payments are less than total advances — negative APR is out of Appendix J scope",
  );

  // g(i) = PV(payments) − PV(advances). g(0) = ΣP − ΣA ≥ 0; g decreases in i.
  const g = (i: number) => presentValue(inputs.payments, i) - presentValue(inputs.advances, i);

  if (Math.abs(g(0)) < 1e-12) return 0; // zero-interest credit

  // Bracket: find hi with g(hi) < 0.
  let lo = 0;
  let hi = 0.1;
  for (let k = 0; k < 60 && g(hi) > 0; k++) hi *= 2;
  check(g(hi) <= 0, "failed to bracket the APR (cash flows may be degenerate)");

  // Bisection to tight tolerance.
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 0) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-14 * Math.max(1, hi)) break;
  }
  const i = (lo + hi) / 2;
  return i * inputs.unitPeriodsPerYear;
}

export interface SingleAdvanceLoan {
  /** Amount financed (advance at consummation). */
  amount: number;
  /** Level payment amount. */
  payment: number;
  /** Number of payments. */
  numberOfPayments: number;
  /** Unit periods per year. Default 12 (monthly). */
  unitPeriodsPerYear?: number;
  /** Whole unit periods to the FIRST payment. Default 1 (regular first period). */
  firstPaymentUnitPeriods?: number;
  /**
   * Odd-days fraction for the first period (odd days ÷ days per unit period,
   * e.g. 10/30 for ten odd days on a monthly loan). Applies to every payment
   * (they all shift with the first). Default 0.
   */
  oddDaysFraction?: number;
}

/**
 * The common case: one advance, level payments.
 *
 * ```ts
 * aprSingleAdvance({ amount: 5000, payment: 166.07, numberOfPayments: 36 }); // ≈ 0.12
 * ```
 */
export function aprSingleAdvance(loan: SingleAdvanceLoan): number {
  const uppy = loan.unitPeriodsPerYear ?? 12;
  const t1 = loan.firstPaymentUnitPeriods ?? 1;
  const f = loan.oddDaysFraction ?? 0;
  check(Number.isInteger(loan.numberOfPayments) && loan.numberOfPayments > 0, "numberOfPayments must be a positive integer");
  const payments: CashFlow[] = Array.from({ length: loan.numberOfPayments }, (_, k) => ({
    amount: loan.payment,
    unitPeriods: t1 + k,
    fraction: f,
  }));
  return apr({
    advances: [{ amount: loan.amount, unitPeriods: 0 }],
    payments,
    unitPeriodsPerYear: uppy,
  });
}

/**
 * The level payment that amortizes an amount at a given APR — the inverse of
 * {@link aprSingleAdvance} for regular loans (useful for building disclosures).
 */
export function levelPayment(
  amount: number,
  annualRate: number,
  numberOfPayments: number,
  unitPeriodsPerYear = 12,
): number {
  check(Number.isFinite(amount) && amount > 0, "amount must be positive");
  check(Number.isFinite(annualRate) && annualRate >= 0, "annualRate must be ≥ 0");
  check(Number.isInteger(numberOfPayments) && numberOfPayments > 0, "numberOfPayments must be a positive integer");
  check(
    Number.isFinite(unitPeriodsPerYear) && unitPeriodsPerYear > 0,
    "unitPeriodsPerYear must be positive",
  );
  const i = annualRate / unitPeriodsPerYear;
  if (i === 0) return amount / numberOfPayments;
  return (amount * i) / (1 - Math.pow(1 + i, -numberOfPayments));
}

/**
 * Reg Z accuracy tolerance (§1026.22(a)(2)–(3)): a disclosed APR is
 * considered accurate if within ±1/8 of 1 percentage point of the actual APR
 * for regular transactions, or ±1/4 for irregular ones — those with multiple
 * advances, irregular payment periods, or irregular payment amounts (an
 * irregular first period or an irregular first or final payment alone does
 * NOT make a transaction irregular). Rates as decimals.
 *
 * The additional finance-charge-based tolerances for mortgage loans
 * (§1026.22(a)(4)–(5)) are not modelled.
 */
export function withinRegZTolerance(
  disclosedApr: number,
  actualApr: number,
  transaction: "regular" | "irregular" = "regular",
): boolean {
  check(Number.isFinite(disclosedApr) && Number.isFinite(actualApr), "APRs must be finite");
  check(
    transaction === "regular" || transaction === "irregular",
    `transaction must be "regular" or "irregular"`,
  );
  const tol = transaction === "regular" ? 0.00125 : 0.0025;
  return Math.abs(disclosedApr - actualApr) <= tol + 1e-12;
}

// ---------------------------------------------------------------------------
// Dates → unit periods (Appendix J (b)(3)–(5))
// ---------------------------------------------------------------------------

/** A calendar date: "YYYY-MM-DD", or a Date (its UTC calendar day is used). */
export type DateInput = string | Date;

/**
 * An Appendix J unit-period (§(b)(3)(iii) standard intervals):
 * `"day"`, `"week"`, `"semimonth"`, `"month"`, `"year"`, a multiple of a week
 * (`{ weeks: 2 }`), a multiple of a month up to 11 (`{ months: 3 }`), or — for a
 * single-advance, single-payment transaction whose unit-period is its term
 * (§(b)(4)(ii), (b)(5)(vii)) — a number of days (`{ days: 255 }`).
 */
export type UnitPeriod =
  | "day"
  | "week"
  | "semimonth"
  | "month"
  | "year"
  | { weeks: number }
  | { months: number }
  | { days: number };

export interface UnitPeriodOptions {
  /**
   * The series is scheduled for the LAST day of each month: measure months
   * from month-end to month-end (§(b)(3)(iv)). Default false (same day-of-month,
   * clamped to the month's last day — e.g. the 30th → Feb 28/29).
   */
  endOfMonth?: boolean;
}

/** Whole unit-periods `unitPeriods` plus fraction `fraction` (the App J t and f). */
export interface UnitPeriodSpan {
  unitPeriods: number;
  fraction: number;
}

interface YMD {
  y: number;
  m: number; // 1-12
  d: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function toYMD(input: DateInput, label: string): YMD {
  if (input instanceof Date) {
    check(!Number.isNaN(input.getTime()), `Invalid Date for ${label}`);
    return { y: input.getUTCFullYear(), m: input.getUTCMonth() + 1, d: input.getUTCDate() };
  }
  const m = typeof input === "string" ? DATE_RE.exec(input) : null;
  check(m !== null, `Invalid date for ${label}: "${String(input)}" (expected YYYY-MM-DD)`);
  const ymd = { y: Number(m![1]), m: Number(m![2]), d: Number(m![3]) };
  check(ymd.m >= 1 && ymd.m <= 12 && ymd.d >= 1 && ymd.d <= daysInMonth(ymd.y, ymd.m),
    `Invalid calendar date for ${label}: "${input}"`);
  return ymd;
}

function serial(a: YMD): number {
  const t = new Date(0);
  t.setUTCFullYear(a.y, a.m - 1, a.d); // setUTCFullYear avoids the 0–99 → 19xx quirk
  return Math.round(t.getTime() / DAY_MS);
}

function daysInMonth(y: number, m: number): number {
  return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
}

/** The date k months before `a` (same day-of-month, clamped; or month-end). */
function monthsBack(a: YMD, k: number, endOfMonth: boolean): YMD {
  const idx = a.y * 12 + (a.m - 1) - k;
  const y = Math.floor(idx / 12);
  const m = idx - y * 12 + 1;
  const dim = daysInMonth(y, m);
  return { y, m, d: endOfMonth ? dim : Math.min(a.d, dim) };
}

/** Full months measured back from `to` that fit after `from`, and the leftover days. */
function fullMonthsBack(from: YMD, to: YMD, endOfMonth: boolean): { months: number; days: number } {
  const f = serial(from);
  let k = Math.max(0, (to.y - from.y) * 12 + (to.m - from.m) - 1);
  while (k > 0 && serial(monthsBack(to, k, endOfMonth)) < f) k--;
  while (serial(monthsBack(to, k + 1, endOfMonth)) >= f) k++;
  return { months: k, days: serial(monthsBack(to, k, endOfMonth)) - f };
}

function checkUnit(unit: UnitPeriod): void {
  if (typeof unit === "string") {
    check(["day", "week", "semimonth", "month", "year"].includes(unit), `unknown unit-period "${unit}"`);
  } else if ("weeks" in unit) {
    check(Number.isInteger(unit.weeks) && unit.weeks >= 1 && unit.weeks <= 52, "weeks must be an integer 1–52");
  } else if ("months" in unit) {
    check(Number.isInteger(unit.months) && unit.months >= 1 && unit.months <= 11, "months must be an integer 1–11");
  } else if ("days" in unit) {
    check(Number.isInteger(unit.days) && unit.days >= 1 && unit.days <= 365, "days must be an integer 1–365");
  } else {
    check(false, "invalid unit-period");
  }
}

/**
 * Unit-periods per year for a unit-period (Appendix J (b)(5)): day 365,
 * week 52, n weeks 52/n, semimonth 24, month 12, n months 12/n, year 1,
 * n days 365/n.
 */
export function periodsPerYear(unit: UnitPeriod): number {
  checkUnit(unit);
  if (typeof unit === "string") {
    return { day: 365, week: 52, semimonth: 24, month: 12, year: 1 }[unit];
  }
  if ("weeks" in unit) return 52 / unit.weeks;
  if ("months" in unit) return 12 / unit.months;
  return 365 / unit.days;
}

/**
 * The number of unit-periods between two dates per Appendix J (b)(5): the
 * `unitPeriods` (t) and `fraction` (f) to use for a flow on `to` when the
 * term begins on `from`.
 *
 * - month: full months measured BACK from the later date; the remaining days
 *   (measured forward from the earlier date) ÷ 30.
 * - semimonth / n months: 30 × full months back + remaining days, ÷ 15 or 30n.
 * - day / week / n weeks / n days: actual days ÷ days per unit-period.
 * - year: full years back; remainder months ÷ 12 if a whole number of months,
 *   otherwise remaining days ÷ 365.
 *
 * ```ts
 * unitPeriodsBetween("1978-02-10", "1978-04-01", "month"); // { unitPeriods: 1, fraction: 19/30 }
 * ```
 */
export function unitPeriodsBetween(
  from: DateInput,
  to: DateInput,
  unit: UnitPeriod,
  options: UnitPeriodOptions = {},
): UnitPeriodSpan {
  checkUnit(unit);
  const a = toYMD(from, "from");
  const b = toYMD(to, "to");
  const totalDays = serial(b) - serial(a);
  check(totalDays >= 0, "`to` must not be before `from`");
  const eom = options.endOfMonth ?? false;

  let t: number;
  let f: number;
  if (unit === "month") {
    const { months, days } = fullMonthsBack(a, b, eom);
    t = months;
    f = days / 30;
  } else if (unit === "semimonth" || (typeof unit === "object" && "months" in unit)) {
    const per = unit === "semimonth" ? 15 : 30 * unit.months;
    const { months, days } = fullMonthsBack(a, b, eom);
    const d30 = 30 * months + days;
    t = Math.floor(d30 / per);
    f = (d30 - t * per) / per;
  } else if (unit === "year") {
    const { months } = fullMonthsBack(a, b, eom);
    t = Math.floor(months / 12);
    const anchor = monthsBack(b, 12 * t, eom);
    const rem = fullMonthsBack(a, anchor, eom);
    f = rem.days === 0 ? rem.months / 12 : (serial(anchor) - serial(a)) / 365;
  } else {
    const per = unit === "day" ? 1 : unit === "week" ? 7 : "weeks" in unit ? 7 * unit.weeks : unit.days;
    t = Math.floor(totalDays / per);
    f = (totalDays - t * per) / per;
  }
  // A remainder of exactly one unit-period (e.g. 30 days ÷ 30) is one more
  // whole period — the discount factor (1 + 1·i)(1 + i)^t equals (1 + i)^(t+1).
  if (f >= 1) {
    t += 1;
    f = 0;
  }
  return { unitPeriods: t, fraction: f };
}

/** An advance or payment on a calendar date. */
export interface DatedFlow {
  amount: number;
  date: DateInput;
}

export interface DatedAprInputs {
  advances: readonly DatedFlow[];
  payments: readonly DatedFlow[];
  /** The transaction's unit-period (Appendix J (b)(4) — the most frequent common period). */
  unitPeriod: UnitPeriod;
  /**
   * Beginning of the term (§(b)(2)): consummation, or the later date the
   * finance charge begins to be earned. Default: the earliest flow date
   * (Appendix J's convention when a payment precedes the first advance).
   * Must not be after any flow.
   */
  termStart?: DateInput;
  /** Month-end series rule; see {@link UnitPeriodOptions}. */
  endOfMonth?: boolean;
}

/**
 * The Appendix J APR from dated advances and payments: converts every date to
 * unit-periods and a fraction from the beginning of the term per §(b)(5), then
 * solves the general equation with {@link apr}.
 *
 * ```ts
 * // Appendix J (c)(1)(ii): $6,000 on 1978-02-10, 36 × $200 monthly from 1978-04-01
 * aprFromDates({
 *   advances: [{ amount: 6000, date: "1978-02-10" }],
 *   payments: Array.from({ length: 36 }, (_, k) => ({
 *     amount: 200,
 *     date: `${1978 + Math.floor((3 + k) / 12)}-${String(((3 + k) % 12) + 1).padStart(2, "0")}-01`,
 *   })),
 *   unitPeriod: "month",
 * }); // ≈ 0.1182
 * ```
 */
export function aprFromDates(inputs: DatedAprInputs): number {
  checkUnit(inputs.unitPeriod);
  check(inputs.advances.length > 0, "advances must be non-empty");
  check(inputs.payments.length > 0, "payments must be non-empty");
  const all = [...inputs.advances, ...inputs.payments];
  const start =
    inputs.termStart !== undefined
      ? toYMD(inputs.termStart, "termStart")
      : all
          .map((x, k) => toYMD(x.date, k < inputs.advances.length ? "advance date" : "payment date"))
          .reduce((lo, d) => (serial(d) < serial(lo) ? d : lo));
  const opts = { endOfMonth: inputs.endOfMonth ?? false };
  const startIso = isoOf(start);
  const convert = (flows: readonly DatedFlow[]): CashFlow[] =>
    flows.map((x) => {
      const span = unitPeriodsBetween(startIso, x.date, inputs.unitPeriod, opts);
      return { amount: x.amount, unitPeriods: span.unitPeriods, fraction: span.fraction };
    });
  return apr({
    advances: convert(inputs.advances),
    payments: convert(inputs.payments),
    unitPeriodsPerYear: periodsPerYear(inputs.unitPeriod),
  });
}

function isoOf(a: YMD): string {
  return `${String(a.y).padStart(4, "0")}-${String(a.m).padStart(2, "0")}-${String(a.d).padStart(2, "0")}`;
}
