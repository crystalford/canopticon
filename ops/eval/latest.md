# Engine test — 2026-11-08-0240 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Reviewer flags (changed) | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 0 policy, numbers | ❌ | 6366 | 40 (8) | 49 | 0 | 2 (2) | $0.5573 | 25 | parts left unwritten; 8 quotations not found; 1 citation problems |
| team:flash | 1 evidence, studies | ❌ | 1703 | 0 (0) | 49 | 0 | 0 (0) | $0.3817 | 23 | 1703 words (bar 3000); 0 quotations (bar 10) |
| team:flash | 2 ideas, scholarship | ❌ | 7064 | 44 (0) | 41 | 0 | 1 (1) | $0.4771 | 25 | parts left unwritten |
| team:flash | 3 article from the record | ✅ | 2269 | 45 (0) | 0 | 0 | 0 (0) | $0.06 | 4 |  |
| team:flash | 4 thesis test | ❌ | 5733 | 7 (0) | 42 | 1 | 1 (0) | $0.6308 | 25 | parts left unwritten; 7 quotations (bar 10); no verdict line |

## Verdict

No model passed every task.

- team:flash: failed at least one, $2.11 total
