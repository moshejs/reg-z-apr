# reg-z-apr

The US **Truth in Lending APR** — Regulation Z ([12 CFR Part 1026, Appendix J](https://www.consumerfinance.gov/rules-policy/regulations/1026/j/)) **actuarial method**: the general-equation solver with odd-days fractions, delayed first periods, multiple advances, Appendix J's date-to-unit-period rules, and the Reg Z accuracy tolerance. Reproduces every worked example in Appendix J. Zero dependencies.

```
npm install reg-z-apr
```

## Why

Every US consumer lender must disclose an APR computed by the Appendix J actuarial method (or the US Rule) — and npm had no implementation. The method is subtler than an IRR: amounts occurring `t` whole unit periods plus a fraction `f` after the beginning of the term discount by `(1 + f·i)(1 + i)^t`, and the APR is the unit-period rate annualized by multiplication. Counting `t` and `f` from calendar dates has its own rules (months measured back from the later date, odd days ÷ 30, …). This package implements both, robustly (bracketed bisection), for any consumer-credit cash-flow pattern.

```ts
import { aprSingleAdvance, aprFromDates, apr, levelPayment, withinRegZTolerance } from "reg-z-apr";

// Appendix J (b)(9): $1,000, 36 monthly payments of $33.61
aprSingleAdvance({ amount: 1000, payment: 33.61, numberOfPayments: 36 }); // 0.128256 → 12.83%

// Straight from dates — Appendix J (c)(1)(ii): advance 1978-02-10, 36 × $200 monthly from 1978-04-01
aprFromDates({
  advances: [{ amount: 6000, date: "1978-02-10" }],
  payments: dates.map((date) => ({ amount: 200, date })), // "1978-04-01", "1978-05-01", … (36)
  unitPeriod: "month",
}); // 0.118165 → 11.82%  (t = 1, f = 19/30 worked out for you)

// Any pattern — multiple advances (construction / student loans), irregular payments:
apr({ advances, payments, unitPeriodsPerYear: 12 });

withinRegZTolerance(0.12, actual); // ±1/8 point (regular) per §1026.22(a)(2)
```

## API

Rates are decimals (`0.12` = 12%). Dates are `"YYYY-MM-DD"` strings or `Date`s (UTC calendar day).

- **`apr({ advances, payments, unitPeriodsPerYear })`** — the general Appendix J equation. Flows are `{ amount, unitPeriods, fraction? }`: `unitPeriods` is the whole number of unit-periods from the beginning of the term (an integer), `fraction` the odd fraction in `[0, 1)`.
- **`aprFromDates({ advances, payments, unitPeriod, termStart?, endOfMonth? })`** — the same, from dated flows `{ amount, date }`. The term begins at `termStart` (consummation, or when the finance charge starts to be earned) or, by default, at the earliest flow date — Appendix J's convention when payments precede the first advance.
- **`unitPeriodsBetween(from, to, unitPeriod, { endOfMonth? })`** → `{ unitPeriods, fraction }` — Appendix J (b)(5): monthly units count full months back from the later date plus remaining days ÷ 30; semimonthly and multi-month units use 30-day months ÷ 15 or 30n; daily and weekly units use actual days; yearly units use whole months ÷ 12 or days ÷ 365. The 29th/30th fall back to the end of February; pass `endOfMonth: true` for a series scheduled on the last day of each month.
- **`periodsPerYear(unitPeriod)`** — 365, 52, 52/n, 24, 12, 12/n, 1, or 365/n.
  Unit-periods: `"day" | "week" | "semimonth" | "month" | "year" | { weeks: n } | { months: n }` (n ≤ 11) `| { days: n }` (a single-advance, single-payment term).
- **`aprSingleAdvance({ amount, payment, numberOfPayments, unitPeriodsPerYear?, firstPaymentUnitPeriods?, oddDaysFraction? })`** — the common case.
- **`levelPayment(amount, annualRate, n, unitPeriodsPerYear?)`** — the inverse for a regular loan (no odd days).
- **`withinRegZTolerance(disclosed, actual, "regular" | "irregular")`** — ±1/8 or ±1/4 percentage point per §1026.22(a)(2)–(3). A transaction is irregular if it has multiple advances, irregular payment periods, or irregular payment amounts — an irregular first period or an irregular first or final payment alone does not count. The extra finance-charge-based mortgage tolerances of §1026.22(a)(4)–(5) are not modelled.

Invalid inputs throw `RangeError`: total payments below total advances (negative APR), non-integer `unitPeriods`, fractions outside `[0, 1)`, malformed dates, a `termStart` after a flow, unknown unit-periods.

Choosing the unit-period (the most frequent common period, §(b)(4)) is the caller's job. Where a cash-flow pattern has more than one root (possible only when advances follow payments), the solver returns the root it brackets first, scanning up from 0.

## Correctness

- **Every worked example in Appendix J** — (b)(9) and all of (c)(1)–(c)(7): monthly, semimonthly, quarterly, weekly, 2- and 4-weekly, odd first periods, irregular first/final payments, single-payment loans, skipped payments, a 30-year graduated mortgage, a construction loan and a student loan with payments before the advances — reproduces the published APR to the disclosed two decimals, both from the printed `t`/`f` and from the printed calendar dates (which also convert to exactly the printed `t`/`f`). See [`test/appendix-j.ts`](test/appendix-j.ts).
- **The actuarial identity**: a loan whose level payment is computed at exactly `i` per unit period produces APR = `i ×` periods/year to 9 decimals.
- **165 randomized fixtures** (odd days, delayed first periods, weekly/biweekly, multiple advances) from a separate Python implementation of the equation ([`test/generate-fixtures.py`](test/generate-fixtures.py)), to 8 decimals; and, outside the test suite, 3,000 random irregular schedules agree with SciPy's `brentq` to 2e-13.

Not legal advice; verify disclosures with counsel.

## Related

By the same author: consumer & markets finance packages — [`rmd-uniform-lifetime`](https://github.com/moshejs/rmd-uniform-lifetime) · [`tips-index-ratio`](https://github.com/moshejs/tips-index-ratio) · [`compounded-sofr`](https://github.com/moshejs/compounded-sofr) · [`exit-waterfall`](https://github.com/moshejs/exit-waterfall) · [`32nds`](https://github.com/moshejs/32nds).

## Author

Built by **[Moshe Malka](https://moshemalka.com)** — engineering leader in New York City. Studio work at [Quentin.Code](https://www.quentin.software/).

MIT © Moshe Malka
