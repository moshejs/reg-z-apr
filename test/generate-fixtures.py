#!/usr/bin/env python3
"""Independent reference for the Appendix J actuarial APR.

Solves the same general equation with an independent bisection in Python,
over randomized loans (odd days, delayed first payments, multiple advances),
to guard the TypeScript against transcription bugs. Writes test/fixtures.json.
"""
import json
import random

random.seed(1026)


def pv(flows, i):
    return sum(a / ((1 + f * i) * (1 + i) ** t) for a, t, f in flows)


def solve_apr(advances, payments, uppy):
    g = lambda i: pv(payments, i) - pv(advances, i)
    lo, hi = 0.0, 0.1
    for _ in range(80):
        if g(hi) <= 0:
            break
        hi *= 2
    for _ in range(300):
        mid = (lo + hi) / 2
        if g(mid) > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2 * uppy


fixtures = []
for _ in range(150):
    uppy = random.choice([12, 12, 12, 52, 26])
    amount = round(random.uniform(1_000, 50_000), 2)
    n = random.randint(6, 72)
    rate = random.uniform(0.03, 0.36)
    i = rate / uppy
    payment = round(amount * i / (1 - (1 + i) ** -n), 2)
    t1 = random.choice([1, 1, 1, 2])
    f = random.choice([0, 0, round(random.randint(1, 29) / 30, 6)])
    advances = [(amount, 0, 0.0)]
    payments = [(payment, t1 + k, f) for k in range(n)]
    fixtures.append(
        {
            "amount": amount,
            "payment": payment,
            "n": n,
            "uppy": uppy,
            "t1": t1,
            "f": f,
            "apr": solve_apr(advances, payments, uppy),
        }
    )

# multi-advance (student-loan style): 4 advances 6 months apart, then payments
multi = []
for _ in range(20):
    adv = round(random.uniform(1_000, 5_000), 2)
    payment = round(random.uniform(150, 600), 2)
    n = random.randint(24, 60)
    advances = [(adv, 6 * k, 0.0) for k in range(4)]
    first_pay = 24
    payments = [(payment, first_pay + k, 0.0) for k in range(n)]
    if sum(a for a, _, _ in advances) >= payment * n:
        continue
    multi.append(
        {
            "advance": adv,
            "payment": payment,
            "n": n,
            "firstPay": first_pay,
            "apr": solve_apr(advances, payments, 12),
        }
    )

with open("test/fixtures.json", "w") as fh:
    json.dump({"single": fixtures, "multi": multi}, fh)
print(f"single={len(fixtures)} multi={len(multi)}")
