# Engine test — 2026-11-07-2150 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Reviewer flags (changed) | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 0 policy, numbers | ✅ | 6117 | 14 (0) | 31 | 0 | 23 (19) | $0.1666 | 21 |  |
| team:flash | 1 evidence, studies | ❌ | 4449 | 32 (0) | 37 | 0 | 0 (0) | $0.3013 | 25 | parts left unwritten |
| team:flash | 2 ideas, scholarship | ✅ | 7836 | 25 (0) | 44 | 0 | 0 (0) | $0.3316 | 22 |  |

## Verdict

No model passed every task.

- team:flash: failed at least one, $0.8 total
