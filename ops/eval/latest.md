# Engine test — 2026-11-12-2322 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Reviewer flags (changed) | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 2 ideas, scholarship | ✅ | 5767 | 42 (0) | 62 | 0 | 14 (13) | $0.5502 | 20 |  |
| team:flash | 4 thesis test | ✅ | 6369 | 48 (0) | 42 | 0 | 3 (3) | $0.5041 | 19 |  |

### How it reads

| Model | Task | Sources | Words per source (≤250) | Top publisher | Sentence words (≈20) | Over 35 words | TL;DR words (≤150) | Said again | Uncited facts | First person |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 2 | 18 | 303 | 2 of 18 | 22.8 | 12% | 137 | 0 | 0 | 0 |
| team:flash | 4 | 24 | 249 | 6 of 24 | 33.1 | 27% | 113 | 0 | 1 | 0 |

### What the evidence carries

| Model | Task | Figures not on the cited page | Certainty above its evidence | Key Findings on one publisher | Sources by kind |
|---|---|---|---|---|---|
| team:flash | 2 | 0 | 1 | 3 | 7 study, 7 other, 2 official, 1 preprint, 1 academic |
| team:flash | 4 | 0 | 1 | 4 | 10 official, 9 preprint, 3 other, 1 review, 1 study |

## Verdict

Cheapest model that passed every task: **team:flash** ($1.05 for 2 tasks).

- team:flash: passed all, $1.05 total
