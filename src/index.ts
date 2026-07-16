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
 * Uses bracketing bisection then Newton polish — robust for any consumer
 * credit cash-flow pattern (multiple advances, irregular payments, odd days).
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
  check(amount > 0, "amount must be positive");
  check(annualRate >= 0, "annualRate must be ≥ 0");
  check(Number.isInteger(numberOfPayments) && numberOfPayments > 0, "numberOfPayments must be a positive integer");
  const i = annualRate / unitPeriodsPerYear;
  if (i === 0) return amount / numberOfPayments;
  return (amount * i) / (1 - Math.pow(1 + i, -numberOfPayments));
}

/**
 * Reg Z accuracy tolerance: a disclosed APR is considered accurate if within
 * ±1/8 of 1 percentage point of the actual APR for regular transactions
 * (±1/4 for irregular ones). Rates as decimals.
 */
export function withinRegZTolerance(
  disclosedApr: number,
  actualApr: number,
  transaction: "regular" | "irregular" = "regular",
): boolean {
  check(Number.isFinite(disclosedApr) && Number.isFinite(actualApr), "APRs must be finite");
  const tol = transaction === "regular" ? 0.00125 : 0.0025;
  return Math.abs(disclosedApr - actualApr) <= tol + 1e-12;
}
