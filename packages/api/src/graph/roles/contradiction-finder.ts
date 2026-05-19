// Contradiction Finder — surfaces pairs of claims that contradict each
// other. Read-only proposer; does NOT auto-write contradictions. The
// operator confirms via UI before a row lands in `contradictions`.

import type { Env } from "../../env";
import { all } from "../../lib/d1";
import { callLLM } from "../../llm/index";

const CONTRADICTION_PROMPT = `You scan a set of claims for pairs that contradict. A contradiction is a pair (A, B) where if A is true, B cannot also be true in its claimed form — or vice versa.

POSTURES:
- 'open' — both claims look credible; the operator decides which to keep.
- 'machloket' — both stand. Both come from credible sources but reflect a genuine disagreement that should be preserved (Talmudic register: machloket means both sides remain on the page).
- 'resolved_a' / 'resolved_b' — the operator's prior work already resolved this one way.

For each contradiction, output:
- claim_a_id, claim_b_id
- posture: your best guess ('open' is the default if you can't tell)
- rationale: one sentence explaining how they contradict (cite the specific terms in tension)

DO NOT output:
- Mere differences in framing without a logical contradiction.
- Pairs that are merely incomplete (one mentions X, the other doesn't — that's not a contradiction).
- Pairs from the same source (those would be the source contradicting itself; usually a quoting error).

OUTPUT JSON only.`;

const CONTRADICTION_SCHEMA = {
  type: "object",
  required: ["contradictions"],
  properties: {
    contradictions: {
      type: "array",
      items: {
        type: "object",
        required: ["claim_a_id", "claim_b_id", "rationale"],
        properties: {
          claim_a_id: { type: "string" },
          claim_b_id: { type: "string" },
          posture: { enum: ["open", "machloket", "resolved_a", "resolved_b"] },
          rationale: { type: "string" },
        },
      },
    },
  },
} as const;

export interface ContradictionPair {
  claim_a_id: string;
  claim_b_id: string;
  posture: "open" | "machloket" | "resolved_a" | "resolved_b";
  rationale: string;
}

export interface FindArgs {
  userId: string;
  entityId?: string;
  sinceIso?: string;
  limit?: number;
}

export async function findContradictions(env: Env, args: FindArgs): Promise<ContradictionPair[]> {
  const conditions = ["c.user_id = ?"];
  const params: unknown[] = [args.userId];
  if (args.sinceIso) {
    conditions.push("c.created_at >= ?");
    params.push(args.sinceIso);
  }
  let entityJoin = "";
  if (args.entityId) {
    entityJoin = "JOIN claim_entities ce ON ce.claim_id = c.id";
    conditions.push("ce.entity_id = ?");
    params.push(args.entityId);
  }
  const limit = args.limit ?? 80;
  params.push(limit);

  const claims = await all<{
    id: string;
    text: string;
    claim_type: string;
    source_id: string;
  }>(
    env.DB,
    `SELECT DISTINCT c.id, c.text, c.claim_type, c.source_id
       FROM claims c ${entityJoin}
      WHERE ${conditions.join(" AND ")}
      ORDER BY c.created_at DESC LIMIT ?`,
    params,
  );
  if (claims.length < 2) return [];

  const body = `Scan these claims for contradiction pairs:\n\n${JSON.stringify(claims, null, 2)}`;
  const out = await callLLM(env, {
    provider: "workers_ai",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    system: CONTRADICTION_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: body }] }],
    max_tokens: 2000,
    temperature: 0.3,
    response_schema: CONTRADICTION_SCHEMA as unknown as Record<string, unknown>,
    ledger: { user_id: args.userId, operation_type: "workers_ai.role.contradiction_finder" },
  });
  const parsed = (out.structured ?? { contradictions: [] }) as {
    contradictions: ContradictionPair[];
  };
  return parsed.contradictions ?? [];
}
