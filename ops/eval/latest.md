# Engine test — 2026-11-08-0138 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Reviewer flags (changed) | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 0 policy, numbers | ❌ | 6842 | 37 (0) | 45 | 0 | 14 (11) | $0.5562 | 25 | parts left unwritten; 1 citation problems |
| team:flash | 1 evidence, studies | ✅ | 7166 | 45 (0) | 22 | 0 | 10 (10) | $0.4032 | 23 |  |
| team:flash | 2 ideas, scholarship | ❌ | 2038 | 10 (0) | 41 | 0 | 12 (11) | $0.3934 | 19 | 2038 words (bar 3000) |
| team:flash | 3 article from the record | ✅ | 2572 | 60 (0) | 0 | 0 | 0 (0) | $0.0813 | 7 |  |
| team:flash | 4 thesis test | ✅ | 6962 | 28 (0) | 36 | 0 | 8 (8) | $0.48 | 19 |  |

## Verdict

No model passed every task.

- team:flash: failed at least one, $1.91 total
