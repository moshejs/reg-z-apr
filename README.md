# reg-z-apr

The US **Truth in Lending APR** — Regulation Z ([12 CFR Part 1026, Appendix J](https://www.consumerfinance.gov/rules-policy/regulations/1026/j/)) **actuarial method**: the general-equation solver with odd-days fractions, delayed first periods, multiple advances, and the Reg Z accuracy tolerance. Zero dependencies.

```
npm install reg-z-apr
```

## Why

Every US consumer lender must disclose an APR computed by the Appendix J actuarial method — and npm had no implementation. The method is subtler than an IRR: amounts occurring `t` whole unit periods plus a fraction `f` after consummation discount by `(1 + f·i)(1 + i)^t`, and the APR is the unit-period rate annualized by multiplication. This package solves that exact equation, robustly (bracketed bisection), for any consumer-credit cash-flow pattern.

```ts
import { aprSingleAdvance, apr, levelPayment, withinRegZTolerance } from "reg-z-apr";

// The classic disclosure: $5,000, 36 monthly payments of $166.07
aprSingleAdvance({ amount: 5000, payment: 166.07, numberOfPayments: 36 }); // ≈ 0.12

// Ten odd days before the first period:
aprSingleAdvance({ amount: 10_000, payment: pmt, numberOfPayments: 24, oddDaysFraction: 10/30 });

// Any pattern — multiple advances (student-loan style), irregular payments:
apr({ advances, payments, unitPeriodsPerYear: 12 });

withinRegZTolerance(0.12, actual); // ±1/8 point (regular) per §1026.22
```

## API

Rates are decimals (`0.12` = 12%).

- **`apr({ advances, payments, unitPeriodsPerYear })`** — the general Appendix J equation. Flows are `{ amount, unitPeriods, fraction? }`.
- **`aprSingleAdvance({ amount, payment, numberOfPayments, unitPeriodsPerYear?, firstPaymentUnitPeriods?, oddDaysFraction? })`** — the common case.
- **`levelPayment(amount, annualRate, n, unitPeriodsPerYear?)`** — the inverse (build disclosures).
- **`withinRegZTolerance(disclosed, actual, "regular" | "irregular")`** — ±1/8 or ±1/4 percentage point per §1026.22(a).

Degenerate inputs (payments < advances, bad fractions) throw `RangeError`.

## Correctness

- **The actuarial identity**: a loan whose level payment is computed at exactly `i` per unit period must produce APR = `i ×` periods/year — verified to 9 decimals across rates and terms (this is true *by definition* of the Appendix J equation, making it a self-anchoring test).
- **165 randomized fixtures** (odd days, delayed first periods, weekly/biweekly, multiple advances) cross-checked against an **independent Python reference implementation** ([`test/generate-fixtures.py`](test/generate-fixtures.py)) to 8 decimals.

Not legal advice; verify disclosures with counsel.

## Related

By the same author: consumer & markets finance packages — [`rmd-uniform-lifetime`](https://github.com/moshejs/rmd-uniform-lifetime) · [`tips-index-ratio`](https://github.com/moshejs/tips-index-ratio) · [`compounded-sofr`](https://github.com/moshejs/compounded-sofr) · [`exit-waterfall`](https://github.com/moshejs/exit-waterfall) · [`32nds`](https://github.com/moshejs/32nds).

## Author

Built by **[Moshe Malka](https://moshemalka.com)** — engineering leader in New York City. Studio work at [Quentin.Code](https://www.quentin.software/).

MIT © Moshe Malka
