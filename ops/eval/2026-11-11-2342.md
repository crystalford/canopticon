# Engine test — 2026-11-11-2342 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Reviewer flags (changed) | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 2 ideas, scholarship | ❌ | 5718 | 7 (0) | 59 | 0 | 2 (2) | $0.5411 | 20 | 7 quotations (bar 10) |
| team:flash | 4 thesis test | ✅ | 6457 | 31 (0) | 48 | 0 | 1 (1) | $0.6302 | 21 |  |

### How it reads

| Model | Task | Sources | Words per source (≤250) | Top publisher | Sentence words (≈20) | Over 35 words | TL;DR words (≤150) | Said again | Uncited facts | First person |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 2 | 16 | 340 | 4 of 16 | 22.5 | 15% | 159 | 0 | 0 | 0 |
| team:flash | 4 | 16 | 387 | 3 of 16 | 28.3 | 30% | 111 | 1 | 0 | 0 |

## Verdict

No model passed every task.

- team:flash: failed at least one, $1.17 total
