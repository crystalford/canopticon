# Engine test — 2026-11-07-1920 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|
| deepseek-ai/deepseek-v4.1-flash-1017 | 0 policy, numbers | ❌ | 8428 | 45 (0) | 45 | 0 | $0.3496 | 25 | parts left unwritten; 1 citation problems |
| deepseek-ai/deepseek-v4.1-flash-1017 | 1 evidence, studies | ❌ | 9066 | 69 (0) | 50 | 1 | $0.4156 | 21 | parts left unwritten; 1 citation problems |
| deepseek-ai/deepseek-v4.1-flash-1017 | 2 ideas, scholarship | ✅ | 7666 | 45 (0) | 33 | 0 | $0.3099 | 18 |  |
| deepseek-ai/deepseek-v4.1-flash-1017 | 3 article from the record | ✅ | 3252 | 56 (0) | 0 | 0 | $0.0556 | 3 |  |
| deepseek-ai/deepseek-v4-pro-0813 | 0 policy, numbers | ✅ | 5572 | 39 (0) | 25 | 0 | $0.7074 | 16 |  |
| deepseek-ai/deepseek-v4-pro-0813 | 1 evidence, studies | ❌ | 6304 | 42 (0) | 31 | 0 | $1.1645 | 25 | parts left unwritten |
| deepseek-ai/deepseek-v4-pro-0813 | 2 ideas, scholarship | ✅ | 5888 | 28 (0) | 13 | 0 | $1.0052 | 19 |  |
| deepseek-ai/deepseek-v4-pro-0813 | 3 article from the record | ❌ | 0 | 0 (0) | 0 | 0 | $0.0513 | 23 | 0 words (bar 1200); 0 quotations (bar 8); It has no title.; It has no body.; Its topic is not one of the record's topics.; It quotes nothing: an article argues from the record. |
| team:deepseek | 0 policy, numbers | ❌ | 5163 | 36 (0) | 40 | 0 | $1.0415 | 25 | parts left unwritten |
| team:deepseek | 1 evidence, studies | ❌ | 6572 | 50 (0) | 48 | 0 | $1.1026 | 25 | parts left unwritten |
| team:deepseek | 2 ideas, scholarship | ✅ | 5761 | 33 (0) | 13 | 0 | $1.0351 | 18 |  |
| team:deepseek | 3 article from the record | ❌ | 0 | 0 (0) | 0 | 0 | $0.037 | 25 | 0 words (bar 1200); 0 quotations (bar 8); It has no title.; It has no body.; Its topic is not one of the record's topics.; It quotes nothing: an article argues from the record. |
| team:flash | 0 policy, numbers | ✅ | 11249 | 94 (0) | 45 | 0 | $0.2468 | 14 |  |
| team:flash | 1 evidence, studies | ✅ | 15032 | 91 (0) | 49 | 0 | $0.2898 | 23 |  |
| team:flash | 2 ideas, scholarship | ✅ | 11175 | 75 (0) | 27 | 0 | $0.2898 | 15 |  |
| team:flash | 3 article from the record | ✅ | 2402 | 57 (0) | 0 | 0 | $0.0722 | 3 |  |

## Verdict

Cheapest model that passed every task: **team:flash** ($0.9 for 4 tasks).

- team:flash: passed all, $0.9 total
- @cf/deepseek-ai/deepseek-v4.1-flash-1017: failed at least one, $1.13 total
- @cf/deepseek-ai/deepseek-v4-pro-0813: failed at least one, $2.93 total
- team:deepseek: failed at least one, $3.22 total
