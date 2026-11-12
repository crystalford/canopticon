# Engine test — 2026-11-12-1106 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Reviewer flags (changed) | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 2 ideas, scholarship | ✅ | 5846 | 46 (0) | 49 | 0 | 2 (2) | $0.6264 | 21 |  |
| team:flash | 4 thesis test | ✅ | 6791 | 53 (0) | 49 | 0 | 2 (2) | $0.6096 | 20 |  |

### How it reads

| Model | Task | Sources | Words per source (≤250) | Top publisher | Sentence words (≈20) | Over 35 words | TL;DR words (≤150) | Said again | Uncited facts | First person |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 2 | 13 | 426 | 2 of 13 | 25.8 | 23% | 122 | 1 | 0 | 0 |
| team:flash | 4 | 19 | 341 | 6 of 19 | 28.9 | 28% | 130 | 7 | 0 | 0 |

### What the evidence carries

| Model | Task | Figures not on the cited page | Certainty above its evidence | Key Findings on one publisher | Sources by kind |
|---|---|---|---|---|---|
| team:flash | 2 | 0 | 0 | 8 | 6 other, 4 study, 2 official, 1 book |
| team:flash | 4 | 0 | 0 | 6 | 12 official, 2 preprint, 2 study, 2 other, 1 review |

## Verdict

Cheapest model that passed every task: **team:flash** ($1.24 for 2 tasks).

- team:flash: passed all, $1.24 total
