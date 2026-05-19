// Extractor — the most important graph role.
//
// Reads one chunk of source text. Returns claims (with Toulmin
// structure) and entities. Schema-constrained JSON. No critic-refiner
// loop — grounding is enforced by code-level span validation here in
// this file. Every claim whose `evidence_text` is not a verbatim
// substring of the chunk gets dropped.

import type { Env } from "../../env";
import { callLLM } from "../../llm/index";

export const EXTRACTOR_PROMPT = `You extract grounded claims and entities from Canadian political/economic analysis essays.

HARD RULES (violations cause your output to be discarded):
- Every claim MUST include verbatim evidence_text quoted from the chunk.
- span_start/span_end MUST be exact character offsets into the chunk text.
- If you cannot ground a claim in a verbatim quote, DO NOT EMIT IT.
- Do not invent entities. If referenced only by pronoun, do not emit.
- Preserve nuance: hedged language ("appears to", "may have") → stance='hedged'.

TOULMIN STRUCTURE (preferred, not required):
For each claim, when the chunk supports it, also extract:
- data_text: the documented fact(s) the claim rests on
- warrant_text: the inference rule connecting data to claim
- backing_text: support for the warrant
- qualifier: IPCC-style likelihood ('virtually_certain' through 'very_unlikely')
- rebuttal_text: known counter-positions or limitations

CLASSIFICATION:
- claim_type:
    'factual' for empirical assertions
    'normative' for value judgments
    'predictive' for future-state claims (only with implicit/explicit probability)
    'causal' for X causes/explains Y
    'definitional' for "X means Y" statements
- layer (CANOPTICON four-layer template):
    'factual' for empirical/verifiable
    'framing' for how the topic is being framed
    'architectural' for structural pattern claims
    'distributive' for who pays / who receives / on what timeline
- intervention_level (for policy-relevant claims only):
    'symptom' for treating downstream effects
    'mechanism' for proximate causes
    'structural' for root conditions

OUTPUT JSON only matching the schema. No prose.`;

export const EXTRACT_SCHEMA = {
  type: "object",
  required: ["claims", "entities"],
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        required: ["text", "claim_type", "evidence_text", "span_start", "span_end", "confidence"],
        properties: {
          text: { type: "string" },
          claim_type: { enum: ["factual", "normative", "predictive", "causal", "definitional"] },
          data_text: { type: "string" },
          warrant_text: { type: "string" },
          backing_text: { type: "string" },
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
          rebuttal_text: { type: "string" },
          evidence_text: { type: "string" },
          span_start: { type: "integer" },
          span_end: { type: "integer" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          stance: { enum: ["asserted", "reported", "rejected", "hedged"] },
          layer: { enum: ["factual", "framing", "architectural", "distributive", ""] },
          intervention_level: { enum: ["symptom", "mechanism", "structural", ""] },
          entity_refs: { type: "array", items: { type: "string" } },
        },
      },
    },
    entities: {
      type: "array",
      items: {
        type: "object",
        required: ["canonical", "kind"],
        properties: {
          canonical: { type: "string" },
          kind: { enum: ["person", "org", "program", "place", "instrument", "concept"] },
          aliases: { type: "array", items: { type: "string" } },
          description: { type: "string" },
        },
      },
    },
  },
} as const;

export interface ExtractedClaim {
  text: string;
  claim_type: string;
  data_text?: string;
  warrant_text?: string;
  backing_text?: string;
  qualifier?: string;
  rebuttal_text?: string;
  evidence_text: string;
  span_start: number;
  span_end: number;
  confidence: number;
  stance?: string;
  layer?: string;
  intervention_level?: string;
  entity_refs?: string[];
}

export interface ExtractedEntity {
  canonical: string;
  kind: string;
  aliases?: string[];
  description?: string;
}

export interface ExtractResult {
  claims: ExtractedClaim[];
  entities: ExtractedEntity[];
}

/** Extract claims + entities from a chunk of text. Llama 3.3 70B with
 *  JSON schema constraint. Returns only claims whose evidence_text is a
 *  verbatim substring of the chunk (code-level grounding check). */
export async function extract(
  env: Env,
  userId: string,
  chunk: { id: string; text: string },
): Promise<ExtractResult> {
  const out = await callLLM(env, {
    provider: "workers_ai",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    system: EXTRACTOR_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: chunk.text }] }],
    max_tokens: 4000,
    temperature: 0.1,
    response_schema: EXTRACT_SCHEMA as unknown as Record<string, unknown>,
    ledger: { user_id: userId, operation_type: "workers_ai.role.extractor" },
  });

  const parsed = (out.structured ?? { claims: [], entities: [] }) as ExtractResult;
  // Code-side grounding validation: drop any claim whose evidence_text
  // is not a verbatim slice of the chunk at the declared span. This
  // replaces a separate Verifier LLM pass.
  parsed.claims = (parsed.claims ?? []).filter(
    (c) =>
      c.evidence_text &&
      typeof c.span_start === "number" &&
      typeof c.span_end === "number" &&
      c.span_end > c.span_start &&
      c.span_end <= chunk.text.length &&
      chunk.text.slice(c.span_start, c.span_end) === c.evidence_text,
  );
  parsed.entities = parsed.entities ?? [];
  return parsed;
}
