# Engine test — 2026-11-07-2117 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Reviewer flags (changed) | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 0 policy, numbers | ❌ | 5662 | 27 (0) | 41 | 0 | 21 (21) | $0.3316 | 25 | parts left unwritten |
| team:flash | 1 evidence, studies | ❌ | 6122 | 44 (4) | 50 | 0 | 0 (0) | $0.4574 | 25 | parts left unwritten; 4 quotations not found |
| team:flash | 2 ideas, scholarship | ❌ | 3133 | 10 (1) | 28 | 0 | 0 (0) | $0.354 | 25 | parts left unwritten; 1 quotations not found |

## Verdict

No model passed every task.

- team:flash: failed at least one, $1.14 total
