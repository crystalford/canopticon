# Engine test — 2026-11-08-0337 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Reviewer flags (changed) | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 0 policy, numbers | ✅ | 6063 | 30 (0) | 41 | 0 | 1 (1) | $0.3939 | 22 |  |
| team:flash | 1 evidence, studies | ✅ | 7554 | 29 (0) | 41 | 0 | 1 (0) | $0.575 | 21 |  |
| team:flash | 2 ideas, scholarship | ✅ | 8079 | 11 (0) | 53 | 0 | 0 (0) | $0.4765 | 19 |  |
| team:flash | 3 article from the record | ✅ | 2883 | 60 (0) | 0 | 0 | 0 (0) | $0.0574 | 3 |  |
| team:flash | 4 thesis test | ✅ | 8156 | 37 (0) | 53 | 0 | 9 (9) | $0.5469 | 24 |  |

## Verdict

Cheapest model that passed every task: **team:flash** ($2.05 for 5 tasks).

- team:flash: passed all, $2.05 total
