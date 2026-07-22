# The Blind Spot — Method Paper

> **Runtime source of truth:** `packages/blindspot/src/content/method-paper.ts`
> (rendered at `blindspot.canopticon.com/method`). This file is the readable
> mirror. The stated parameters are defined once in
> `packages/blindspot/src/content/capitalization-factors.ts` and interpolated
> into the rendered paper so the two never drift.

## Abstract

Canada measures the wealth of its richest households three different official ways. The direct household survey (SFS) puts the top 1%'s share of net worth near **13.7%**. A Pareto correction of that survey's upper tail by the PBO raises it to roughly **24%**. Statistics Canada's distributional accounts (DHEA), benchmarked to the National Balance Sheet, put it near **26.6%**.

These are not rounding differences — the same country, the same year, measured three ways, disagreeing by nearly a factor of two at the very top. The instrument does not pick a winner. It makes the disagreement the subject, quantifies it as the **Invisibility Index**, and decomposes that figure into four channels.

## 1. The Proposition

The three official Canadian methods of estimating top-tail wealth disagree by an amount that grows as you move up the distribution, and the disagreement is largest precisely at the top, where policy attention is highest and data quality is lowest. Refuted if the methods agree at the top 1% within stated uncertainty, or if the spread narrows toward the top. Does **not** claim any one method is correct.

## 2. The Mechanism

Three foundations, three blind spots:

- **Survey (SFS)** — asks households directly; blind spot is participation. The wealthiest are least likely to respond.
- **Pareto (PBO)** — accepts the survey below the top, replaces the upper tail with a fitted Pareto; blind spot is the fit and its anchors.
- **Capitalization (DHEA / KSZZ)** — works backwards from capital income; blind spot is income itself. Assets generating little taxable income are underweighted, and the assumed rates of return swing the answer.

## 3. The Spread

Draw the three methods on one axis; fill the zone between highest and lowest. That zone — "what official statistics cannot resolve" — is the headline visual. Spread = max − min top-1% share per period. Never interpolate a method into a year it did not report.

> **Honesty — the scope mismatch.** Survey + Pareto estimate **net worth**; capitalization estimates **financial assets**. Different denominators. Flagged permanently on the chart; never averaged across scopes.

## 4. The Invisibility Index

The dollar value of the gap at the top for the top 1%, in the most recent aligned year. Decomposed into four channels (stated hypothesis):

- **Unrealized capital gains — 55%** (buy–borrow–die; Fox-Liscow).
- **Private equity — 33%** (closely-held business; residual).
- **Offshore wealth — 8%** (Alstadsæter–Johannesen–Zucman).
- **Survey non-response — 4%.**

> **Honesty — a CANOPTICON construction.** The total gap is measured from official sources; the four-way decomposition is a model with stated, tunable assumptions. Read the total as measured; read the split as argued.

## 5. The Recovery Ratio

Share of an independently-known aggregate the method reproduces. Published as pareto_share / capitalization_share. Near 1.0 = agreement; well below the **80%** target = flag the period *unreliable* rather than present false precision.

## 6. The Behavior Strip

Supporting evidence from the NBSA: financial-vs-non-financial asset ratio and debt-to-disposable-income — a savings glut at the top financing indebted demand below. Wide and short by design; one annotation at the 2020 pandemic spike.

## 7. Where You Stand

Enter a net-worth figure; place it on the official distribution; shade the region past the top-1% threshold (~$7.4M, 2023) in the disagreement-zone colour.

> **Honesty — privacy + extrapolation.** Nothing entered leaves the browser — the calculation is entirely client-side. Past the official threshold the placement is an extrapolation into the exact region the instrument exists to say is unresolved, and is shaded to make that unmistakable.

## 8. Limitations

Scope mismatch (net worth vs financial assets); cadence mismatch (sparse alignment years, no interpolation); the channel split is modelled, not measured; capitalization factors are documented assumptions (see [`capitalization-factors.md`](./capitalization-factors.md)).

## Companion note

The unrealized-gains channel — the largest and least directly measured piece — is set out in [`unrealized-gains-note.md`](./unrealized-gains-note.md).
