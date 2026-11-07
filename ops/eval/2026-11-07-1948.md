# Engine test — 2026-11-07-1948 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|
| team:flash | 0 policy, numbers | ✅ | 6706 | 37 (0) | 66 | 0 | $0.2019 | 14 |  |
| team:flash | 1 evidence, studies | ✅ | 9585 | 72 (0) | 48 | 0 | $0.2718 | 17 |  |
| team:flash | 2 ideas, scholarship | ✅ | 9758 | 48 (0) | 44 | 0 | $0.2383 | 18 |  |
| team:flash | 3 article from the record | ✅ | 2604 | 51 (0) | 0 | 0 | $0.081 | 5 |  |

## Verdict

Cheapest model that passed every task: **team:flash** ($0.79 for 4 tasks).

- team:flash: passed all, $0.79 total
