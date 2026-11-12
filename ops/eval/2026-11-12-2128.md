# Engine test — 2026-11-12-2128 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Reviewer flags (changed) | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 2 ideas, scholarship | ✅ | 5873 | 67 (0) | 71 | 0 | 6 (6) | $0.6661 | 19 |  |
| team:flash | 4 thesis test | ✅ | 6430 | 52 (0) | 41 | 0 | 2 (2) | $0.4883 | 21 |  |

### How it reads

| Model | Task | Sources | Words per source (≤250) | Top publisher | Sentence words (≈20) | Over 35 words | TL;DR words (≤150) | Said again | Uncited facts | First person |
|---|---|---|---|---|---|---|---|---|---|---|
| team:flash | 2 | 22 | 253 | 3 of 22 | 23.8 | 17% | 143 | 0 | 0 | 0 |
| team:flash | 4 | 26 | 231 | 7 of 26 | 25.9 | 22% | 116 | 9 | 0 | 0 |

### What the evidence carries

| Model | Task | Figures not on the cited page | Certainty above its evidence | Key Findings on one publisher | Sources by kind |
|---|---|---|---|---|---|
| team:flash | 2 | 0 | 0 | 8 | 8 study, 6 other, 4 official, 2 academic, 1 preprint, 1 book |
| team:flash | 4 | 0 | 0 | 1 | 10 official, 10 preprint, 4 study, 1 review, 1 other |

## Verdict

Cheapest model that passed every task: **team:flash** ($1.15 for 2 tasks).

- team:flash: passed all, $1.15 total
