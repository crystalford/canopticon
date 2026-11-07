# Engine test — 2026-11-07-1809 UTC

Tasks and bar: packages/api/src/write/eval.ts. Cost is Workers AI (or Anthropic) as metered by the workspace.

| Model | Task | Pass | Words | Quotes (not found) | Pages | Figures not in pages | Cost | Minutes | Misses |
|---|---|---|---|---|---|---|---|---|---|
| deepseek-ai/deepseek-v4.1-flash-1017 | 0 policy, numbers | ❌ | 1398 | 3 (0) | 28 | 0 | $0.1241 | 4 | parts left unwritten; 1398 words (bar 3000); 3 quotations (bar 10) |
| deepseek-ai/deepseek-v4.1-flash-1017 | 1 evidence, studies | ✅ | 10250 | 25 (0) | 48 | 0 | $0.3253 | 12 |  |
| deepseek-ai/deepseek-v4.1-flash-1017 | 2 ideas, scholarship | ❌ | 180 | 0 (0) | 21 | 3 | $0.1225 | 4 | parts left unwritten; 180 words (bar 3000); 0 quotations (bar 10) |
| deepseek-ai/deepseek-v4.1-flash-1017 | 3 article from the record | ✅ | 1993 | 51 (0) | 0 | 0 | $0.0498 | 3 |  |
| deepseek-ai/deepseek-v4-pro-0813 | 0 policy, numbers | ✅ | 6257 | 28 (0) | 31 | 0 | $0.8375 | 18 |  |
| deepseek-ai/deepseek-v4-pro-0813 | 1 evidence, studies | ❌ | 5223 | 22 (4) | 27 | 0 | $0.9405 | 25 | parts left unwritten; 4 quotations not found |
| deepseek-ai/deepseek-v4-pro-0813 | 2 ideas, scholarship | ✅ | 5513 | 19 (0) | 16 | 0 | $1.0118 | 20 |  |
| deepseek-ai/deepseek-v4-pro-0813 | 3 article from the record | ❌ | 0 | 0 (0) | 0 | 0 | $0.0641 | 8 | 0 words (bar 1200); 0 quotations (bar 8); It has no title.; It has no body.; Its topic is not one of the record's topics.; It quotes nothing: an article argues from the record. |

## Verdict

No model passed every task.

- @cf/deepseek-ai/deepseek-v4.1-flash-1017: failed at least one, $0.62 total
- @cf/deepseek-ai/deepseek-v4-pro-0813: failed at least one, $2.85 total
