// Ingestion Critic — grades an external source before extraction.
// Admiralty grade A–F + a short bias profile. Runs on external
// documents (PDFs, URLs, pasted essays); doesn't run on the operator's
// own posts.

import type { Env } from "../../env";
import { callLLM } from "../../llm/index";

const INGESTION_CRITIC_PROMPT = `You grade an external source the operator has just ingested. Two outputs: an Admiralty grade and a short bias profile.

ADMIRALTY GRADE (NATO STANAG 2511 source-reliability scale):
- A — Completely reliable. First-party, on-the-record, well-established institution with no contradicting record (e.g., official government filings, peer-reviewed papers, mainstream investigative outlets with track records).
- B — Usually reliable. Established outlet or analyst with some prior errors but generally trustworthy (e.g., established think tanks, major newspapers).
- C — Fairly reliable. Mixed track record (e.g., specialist trade publications, opinion-leaning analysts).
- D — Not usually reliable. Sources with frequent errors or strong agenda (e.g., partisan blogs, advocacy outlets).
- E — Unreliable. Known for errors or propaganda.
- F — Reliability cannot be judged. Anonymous, unknown provenance, or insufficient context.

BIAS PROFILE (2-4 sentences):
- Identify the source's stated or implicit perspective (e.g., "centrist economic policy publication, generally pro-trade, skeptical of regulatory intervention").
- Note any obvious conflicts of interest (funding, affiliations, ownership).
- Flag terminological choices that signal a frame.

OUTPUT JSON only.`;

const GRADING_SCHEMA = {
  type: "object",
  required: ["grade", "bias_profile"],
  properties: {
    grade: { enum: ["A", "B", "C", "D", "E", "F"] },
    bias_profile: { type: "string" },
    reasoning: { type: "string" },
  },
} as const;

export interface GradingResult {
  grade: "A" | "B" | "C" | "D" | "E" | "F";
  bias_profile: string;
  reasoning?: string;
}

export async function gradeSource(
  env: Env,
  userId: string,
  fullText: string,
): Promise<GradingResult> {
  // Trim to keep cost bounded — first ~8KB of the source is enough for grading.
  const sample = fullText.slice(0, 8000);
  const out = await callLLM(env, {
    provider: "workers_ai",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    system: INGESTION_CRITIC_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: sample }] }],
    max_tokens: 600,
    temperature: 0.2,
    response_schema: GRADING_SCHEMA as unknown as Record<string, unknown>,
    ledger: { user_id: userId, operation_type: "workers_ai.role.ingestion_critic" },
  });
  return (out.structured ?? { grade: "F", bias_profile: "Could not grade." }) as GradingResult;
}
