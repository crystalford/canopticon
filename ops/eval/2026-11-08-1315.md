# Engine test — 2026-11-08-1315 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Reviewer flags (changed) | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 0 policy, numbers | ✅ | 7648 | 54 (0) | 47 | 0 | 4 (4) | $0.3751 | 19 |  |
| team:flash | 1 evidence, studies | ✅ | 11543 | 69 (0) | 46 | 0 | 10 (7) | $0.6191 | 22 |  |
| team:flash | 2 ideas, scholarship | ❌ | 8400 | 22 (0) | 70 | 0 | 2 (2) | $0.5241 | 25 | parts left unwritten; 1 citation problems |
| team:flash | 3 article from the record | ✅ | 3415 | 50 (0) | 0 | 0 | 0 (0) | $0.0547 | 3 |  |
| team:flash | 4 thesis test | ❌ | 5931 | 17 (0) | 59 | 0 | 0 (0) | $0.4781 | 25 | parts left unwritten; no verdict line |

## Verdict

No model passed every task.

- team:flash: failed at least one, $2.05 total
