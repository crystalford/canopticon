// Critic — scans a draft post for sentences that make factual
// assertions without grounding in a cited claim. Operator-triggered.
// Does NOT auto-run on every publish. Returns a list of ungrounded
// passages with severity.
//
// Default model: Llama 3.3 70B. Opt-in escalation to Claude Sonnet via
// AI Gateway when the operator says "use Claude".

import type { Env } from "../../env";
import { all, one } from "../../lib/d1";
import { callLLM } from "../../llm/index";

const CRITIC_PROMPT = `You are the Critic. You scan a draft post for sentences that make factual assertions but are NOT supported by any of the cited claims.

INPUT: a markdown draft and a list of claims that the draft is supposed to be grounded in.

YOUR JOB: identify sentences that:
1. Make a factual assertion (not a transition, not a framing remark, not a question), AND
2. Are NOT supported — even loosely — by any claim in the cited list.

EXCLUDE from your output:
- Transitional sentences ("As we'll see...", "Take the example of...").
- Rhetorical questions.
- Pure framing or summary sentences that re-state the section's argument without adding new factual content.
- Sentences that paraphrase ONE of the cited claims (those are fine).
- The author's own opinions, clearly marked as such.

For each ungrounded passage, output:
- sentence: the verbatim sentence (or the smallest verbatim span carrying the unsupported assertion)
- paragraph_idx: 0-based paragraph index in the markdown
- severity: 'minor' (background, easily fixable) | 'major' (load-bearing factual assertion) | 'fatal' (the claim being made is contradicted by the cited claims or has no relationship to them)
- suggested_fix: one short suggestion (cite [claim:ID], soften the claim, cut the sentence, etc.)

OUTPUT JSON only. No prose.`;

const CRITIQUE_SCHEMA = {
  type: "object",
  required: ["ungrounded_passages"],
  properties: {
    ungrounded_passages: {
      type: "array",
      items: {
        type: "object",
        required: ["sentence", "paragraph_idx", "severity"],
        properties: {
          sentence: { type: "string" },
          paragraph_idx: { type: "integer", minimum: 0 },
          severity: { enum: ["minor", "major", "fatal"] },
          suggested_fix: { type: "string" },
        },
      },
    },
  },
} as const;

export interface CritiqueResult {
  ungrounded_passages: Array<{
    sentence: string;
    paragraph_idx: number;
    severity: "minor" | "major" | "fatal";
    suggested_fix?: string;
  }>;
}

export async function critique(
  env: Env,
  userId: string,
  postId: string,
  useAnthropic = false,
): Promise<CritiqueResult> {
  const post = await one<{ body_md: string; cited_claim_ids: string }>(
    env.DB,
    "SELECT body_md, cited_claim_ids FROM posts WHERE id = ? AND user_id = ?",
    [postId, userId],
  );
  if (!post) return { ungrounded_passages: [] };

  const claimIds = JSON.parse(post.cited_claim_ids || "[]") as string[];
  const claims =
    claimIds.length > 0
      ? await all<{ id: string; text: string; evidence_text: string }>(
          env.DB,
          `SELECT id, text, evidence_text FROM claims WHERE id IN (${claimIds.map(() => "?").join(",")})`,
          claimIds,
        )
      : [];

  const userPrompt = [
    "--- DRAFT ---",
    post.body_md,
    "",
    "--- CITED CLAIMS ---",
    JSON.stringify(claims, null, 2),
  ].join("\n");

  const out = await callLLM(env, {
    provider: useAnthropic ? "anthropic" : "workers_ai",
    model: useAnthropic ? "claude-sonnet-4-6" : "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    system: CRITIC_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: userPrompt }] }],
    max_tokens: 4000,
    temperature: 0.2,
    response_schema: CRITIQUE_SCHEMA as unknown as Record<string, unknown>,
    ledger: {
      user_id: userId,
      operation_type: useAnthropic ? "anthropic.role.critic" : "workers_ai.role.critic",
    },
  });

  return (out.structured ?? { ungrounded_passages: [] }) as CritiqueResult;
}
