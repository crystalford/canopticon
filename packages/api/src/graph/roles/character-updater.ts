// Character updater — proposes timeline events, bio revisions, and role
// changes for an existing character based on recent confirmed claims.
//
// Only proposes. Nothing modifies `character_profiles` or
// `character_timeline_events` until the operator approves a proposal via
// the chat tools or the operator UI.
//
// Llama 3.3 70B, schema-constrained JSON.

import type { Env } from "../../env";
import { all, insertOne, parseJson } from "../../lib/d1";
import { callLLM } from "../../llm/index";

const PROMPT = `You are the Character Updater. You read recent confirmed claims about a public figure and propose updates to their dossier.

ABSOLUTE RULES:
1. Propose ONLY what the supplied claims support. Cite source_claim_ids on every proposal.
2. Do NOT invent dates. If a claim does not state a date, do not produce a timeline_event.
3. Hedged language stays hedged. If a claim is hedged, the proposal's rationale must say so.
4. Prefer "major" significance only for verifiable career milestones (appointments, resignations, formal statements, decisions). Otherwise 'context'.
5. role_change requires explicit before/after evidence in the claims. If absent, omit it.

OUTPUT: JSON matching the schema. No prose. If the claims don't justify any proposals, return an empty proposals array.

CHARACTER: {NAME}
CURRENT ROLE: {ROLE}
RECENT CLAIMS:
{CLAIMS}`;

const SCHEMA = {
  type: "object",
  required: ["proposals"],
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        required: ["kind", "rationale", "source_claim_ids"],
        properties: {
          kind: { enum: ["timeline_event", "bio_revision", "role_change"] },
          event_date: { type: "string", description: "ISO date for timeline_event" },
          event_title: { type: "string" },
          event_body: { type: "string" },
          significance: { enum: ["major", "context"] },
          paragraph_md: { type: "string", description: "New paragraph for bio_revision" },
          from_role: { type: "string" },
          to_role: { type: "string" },
          effective_date: { type: "string" },
          rationale: { type: "string" },
          source_claim_ids: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

interface Proposal {
  kind: "timeline_event" | "bio_revision" | "role_change";
  event_date?: string;
  event_title?: string;
  event_body?: string;
  significance?: "major" | "context";
  paragraph_md?: string;
  from_role?: string;
  to_role?: string;
  effective_date?: string;
  rationale: string;
  source_claim_ids: string[];
}

export interface UpdateRunResult {
  proposals_created: number;
  proposal_ids: string[];
}

/** Run the character updater for one entity using recent claims under
 *  the given source. Inserts pending proposals — does not modify the
 *  profile or timeline directly. */
export async function runCharacterUpdater(
  env: Env,
  userId: string,
  entityId: string,
  sourceId: string,
): Promise<UpdateRunResult> {
  const profile = await all<{
    canonical_name: string;
    current_role: string | null;
  }>(
    env.DB,
    "SELECT canonical_name, current_role FROM character_profiles WHERE entity_id = ? LIMIT 1",
    [entityId],
  );
  const head = profile[0];
  if (!head) {
    return { proposals_created: 0, proposal_ids: [] };
  }

  const claims = await all<{
    id: string;
    claim_text: string;
    evidence_text: string;
    stance: string | null;
  }>(
    env.DB,
    `SELECT c.id, cv.claim_text, cv.data AS evidence_text,
            json_extract(cv.data, '$.stance') AS stance
       FROM claims c
       JOIN claim_versions cv ON cv.id = c.current_version_id
       JOIN claim_entities ce ON ce.claim_id = c.id
       JOIN claim_sources cs ON cs.claim_id = c.id
      WHERE ce.entity_id = ? AND ce.user_id = ? AND cs.source_id = ?
      ORDER BY cv.created_at DESC
      LIMIT 40`,
    [entityId, userId, sourceId],
  );
  if (claims.length === 0) {
    return { proposals_created: 0, proposal_ids: [] };
  }

  const filled = PROMPT.replace("{NAME}", head.canonical_name)
    .replace("{ROLE}", head.current_role ?? "(unknown)")
    .replace(
      "{CLAIMS}",
      claims
        .map(
          (c) =>
            `- [id=${c.id}] ${c.claim_text}${c.evidence_text ? `\n  evidence: ${c.evidence_text}` : ""}`,
        )
        .join("\n"),
    );

  const out = await callLLM(env, {
    provider: "workers_ai",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    system: PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: filled }] }],
    max_tokens: 3000,
    temperature: 0.2,
    response_schema: SCHEMA as unknown as Record<string, unknown>,
    ledger: { user_id: userId, operation_type: "workers_ai.role.character_updater" },
  });

  const parsed = (out.structured ?? parseJson(out.text, { proposals: [] })) as {
    proposals: Proposal[];
  };
  const proposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];

  const validClaimIds = new Set(claims.map((c) => c.id));
  const proposalIds: string[] = [];
  for (const p of proposals) {
    const sourceClaimIds = (p.source_claim_ids ?? []).filter((id) => validClaimIds.has(id));
    if (sourceClaimIds.length === 0) continue;
    if (!isProposalValid(p)) continue;
    const id = await insertOne(env.DB, "character_update_proposals", {
      entity_id: entityId,
      kind: p.kind,
      proposed_payload: stripPayload(p),
      rationale: p.rationale ?? null,
      source_claim_ids: sourceClaimIds,
      status: "pending",
    });
    proposalIds.push(id);
  }

  return { proposals_created: proposalIds.length, proposal_ids: proposalIds };
}

function isProposalValid(p: Proposal): boolean {
  if (p.kind === "timeline_event") {
    return Boolean(p.event_date && p.event_title);
  }
  if (p.kind === "bio_revision") {
    return Boolean(p.paragraph_md && p.paragraph_md.length > 20);
  }
  if (p.kind === "role_change") {
    return Boolean(p.to_role);
  }
  return false;
}

function stripPayload(p: Proposal): Record<string, unknown> {
  const out: Record<string, unknown> = { kind: p.kind };
  if (p.kind === "timeline_event") {
    out.event_date = p.event_date;
    out.event_title = p.event_title;
    out.event_body = p.event_body ?? "";
    out.significance = p.significance ?? "context";
  } else if (p.kind === "bio_revision") {
    out.paragraph_md = p.paragraph_md;
  } else if (p.kind === "role_change") {
    out.from_role = p.from_role ?? null;
    out.to_role = p.to_role;
    out.effective_date = p.effective_date ?? null;
  }
  return out;
}
