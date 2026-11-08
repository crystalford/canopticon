# Engine test — 2026-11-08-0024 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Reviewer flags (changed) | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 0 policy, numbers | ✅ | 8103 | 38 (0) | 51 | 0 | 3 (3) | $0.5165 | 23 |  |
| team:flash | 1 evidence, studies | ✅ | 8485 | 64 (0) | 40 | 0 | 4 (4) | $0.5306 | 25 |  |
| team:flash | 2 ideas, scholarship | ✅ | 7047 | 13 (0) | 52 | 0 | 3 (3) | $0.3811 | 17 |  |
| team:flash | 3 article from the record | ✅ | 2159 | 54 (0) | 0 | 0 | 0 (0) | $0.0584 | 3 |  |
| team:flash | 4 thesis test | ✅ | 7658 | 15 (0) | 37 | 0 | 8 (7) | $0.3999 | 18 |  |

## Verdict

Cheapest model that passed every task: **team:flash** ($1.89 for 5 tasks).

- team:flash: passed all, $1.89 total
