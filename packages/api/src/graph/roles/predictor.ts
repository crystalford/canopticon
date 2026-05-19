// Predictor — parses the operator's verbal forecast ("I bank that X
// will happen at 70% by Q3") into a structured prediction row.
// Cheap routing-tier model (Llama 3.1 8B). Schema-constrained.

import type { Env } from "../../env";
import { callLLM } from "../../llm/index";

const PREDICTOR_PROMPT = `You parse the operator's verbal forecast into a structured prediction.

The operator writes things like:
- "I bank that the BoC will hold at 65% by Q4"
- "70% chance Carney announces the DSRB by end of January"
- "Likely the housing approvals stall; resolves by mid-2026"

Extract:
- thesis: the prediction in one declarative sentence
- probability: 0-1 (parse "70%" as 0.70, "likely" as ~0.7, "virtually certain" as 0.95)
- qualifier: IPCC label if probability is verbal (virtually_certain | very_likely | likely | about_as_likely | unlikely | very_unlikely)
- resolves_by_iso: ISO date for resolution deadline. Parse "Q3 2026" → 2026-09-30. "by mid-2026" → 2026-06-30. "by end of January" relative to today → next year-month combination that fits.

If anything is ambiguous, do your best and set confidence_low=true.

OUTPUT JSON only. No prose.`;

const PREDICTION_SCHEMA = {
  type: "object",
  required: ["thesis", "probability", "resolves_by_iso"],
  properties: {
    thesis: { type: "string" },
    probability: { type: "number", minimum: 0, maximum: 1 },
    qualifier: {
      enum: [
        "virtually_certain",
        "very_likely",
        "likely",
        "about_as_likely",
        "unlikely",
        "very_unlikely",
        "",
      ],
    },
    resolves_by_iso: { type: "string" },
    confidence_low: { type: "boolean" },
  },
} as const;

export interface ParsedPrediction {
  thesis: string;
  probability: number;
  qualifier?: string;
  resolves_by_iso: string;
  confidence_low?: boolean;
}

export async function parsePrediction(
  env: Env,
  userId: string,
  utterance: string,
): Promise<ParsedPrediction> {
  const out = await callLLM(env, {
    provider: "workers_ai",
    model: "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
    system: PREDICTOR_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: utterance }] }],
    max_tokens: 500,
    temperature: 0.1,
    response_schema: PREDICTION_SCHEMA as unknown as Record<string, unknown>,
    ledger: { user_id: userId, operation_type: "workers_ai.role.predictor" },
  });
  return (out.structured ?? {
    thesis: utterance,
    probability: 0.5,
    resolves_by_iso: new Date(Date.now() + 90 * 86400 * 1000).toISOString(),
    confidence_low: true,
  }) as ParsedPrediction;
}
