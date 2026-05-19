// Thesis Proposer — clusters recent claims and proposes thesis-shapes
// the operator might want to develop. Operator-triggered ("what theses
// are forming?"). Read-only — does NOT write to the theses table.
// Operator decides whether to act on any proposal.

import type { Env } from "../../env";
import { all } from "../../lib/d1";
import { callLLM } from "../../llm/index";

const THESIS_PROPOSER_PROMPT = `You are the Thesis Proposer. The operator has accumulated a body of grounded claims. Your job is to find clusters of claims that together suggest a thesis-shape — a load-bearing structural argument — and propose 1-3 of them.

A thesis is NOT just a topic. It is a falsifiable, structural argument with a coined phrase, layers (factual/framing/architectural/distributive), and an intervention level.

GOOD PROPOSALS:
- Have at least 5 grounded claims that together compose the argument.
- Span more than one source (otherwise it's just "the source said X").
- Have a clear coined phrase candidate (the "neologism" naming the structural pattern).
- Are FALSIFIABLE — name what observation would refute them.

BAD PROPOSALS:
- "There is corruption in housing policy" (no structure, no falsifiability).
- "X person did Y" (a finding, not a thesis).
- Restatements of existing theses.

For each proposal, output:
- title: the working title
- thesis_statement: one declarative sentence
- coined_phrase_candidate: a noun phrase the operator might use as the name
- claim_ids: array of supporting claim IDs from the supplied set
- intervention_level: 'symptom' | 'mechanism' | 'structural'
- reasoning: 2-3 sentences on why these claims compose this thesis

OUTPUT JSON only. No prose. Max 3 proposals; quality > quantity.`;

const THESIS_PROPOSAL_SCHEMA = {
  type: "object",
  required: ["proposals"],
  properties: {
    proposals: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        required: ["title", "thesis_statement", "claim_ids", "reasoning"],
        properties: {
          title: { type: "string" },
          thesis_statement: { type: "string" },
          coined_phrase_candidate: { type: "string" },
          claim_ids: { type: "array", items: { type: "string" } },
          intervention_level: { enum: ["symptom", "mechanism", "structural", ""] },
          reasoning: { type: "string" },
        },
      },
    },
  },
} as const;

export interface ThesisProposal {
  title: string;
  thesis_statement: string;
  coined_phrase_candidate?: string;
  claim_ids: string[];
  intervention_level?: string;
  reasoning: string;
}

export interface ProposeArgs {
  userId: string;
  domain?: string;
  sinceIso?: string;
  limit?: number;
}

export async function proposeTheses(env: Env, args: ProposeArgs): Promise<ThesisProposal[]> {
  // Pull recent claims for the operator. Optionally filter by a domain
  // (full-text in claim or layer label) and a since-cutoff.
  const conditions = ["c.user_id = ?"];
  const params: unknown[] = [args.userId];
  if (args.sinceIso) {
    conditions.push("c.created_at >= ?");
    params.push(args.sinceIso);
  }
  const limit = args.limit ?? 100;
  params.push(limit);
  const claims = await all<{
    id: string;
    text: string;
    evidence_text: string;
    claim_type: string;
    layer: string | null;
    source_id: string;
  }>(
    env.DB,
    `SELECT id, text, evidence_text, claim_type, layer, source_id
       FROM claims c WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC LIMIT ?`,
    params,
  );
  if (claims.length < 5) return [];

  const filter = args.domain ? `\n\nDOMAIN FILTER: focus on claims about "${args.domain}".` : "";
  const body = `Operator's recent claims (${claims.length}):${filter}\n\n${JSON.stringify(claims, null, 2)}`;

  const out = await callLLM(env, {
    provider: "workers_ai",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    system: THESIS_PROPOSER_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: body }] }],
    max_tokens: 3000,
    temperature: 0.5,
    response_schema: THESIS_PROPOSAL_SCHEMA as unknown as Record<string, unknown>,
    ledger: { user_id: args.userId, operation_type: "workers_ai.role.thesis_proposer" },
  });
  const parsed = (out.structured ?? { proposals: [] }) as { proposals: ThesisProposal[] };
  return parsed.proposals ?? [];
}
