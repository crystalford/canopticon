# The Blind Spot — Capitalization Factors & Index Parameters

> **Runtime source of truth:** `packages/blindspot/src/content/capitalization-factors.ts`.
> These are **CANOPTICON constructions**, not official statistics. Tunable in
> one file; nothing else changes.

## Capitalization factors

A factor is `1 / (rate of return)`: $1 of dividend income at a 4% yield implies $25 of underlying equity. Grounded in the Saez–Zucman / KSZZ methodology; the exact returns are a modelling choice.

| Asset class | Factor | Implied return | Note |
|-------------|-------:|---------------:|------|
| Interest-bearing (deposits, bonds) | ×40 | 2.5% | Blended interest yield. |
| Dividends (listed equity) | ×25 | 4% | Dividend yield. |
| Business + professional income | ×12.5 | 8% | Return on closely-held business equity. |
| Realized capital gains (proxy) | ×20 | 5% | Weak proxy for the underlying stock. |

## Invisibility Index channel shares

How the total dollar gap is split into the four channels — the instrument's stated hypothesis about **where** the invisible wealth hides. Sum = 1.0 (guarded at module load).

| Channel | Share | Grounding |
|---------|------:|-----------|
| Unrealized capital gains | 55% | Fox-Liscow / buy–borrow–die |
| Private equity | 33% | Residual; closely-held business |
| Offshore wealth | 8% | Alstadsæter–Johannesen–Zucman |
| Survey non-response | 4% | SFS technical documentation |

**Recovery-ratio target: 80%.** Below this, a period is flagged *unreliable* rather than presented as settled.
