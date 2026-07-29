// Evidential scope-check — fabric redesign Phase 3 (see
// /root/.claude/plans/humming-questing-backus.md). assertions.rank is set
// purely from `evidential` edges (surfacing.ts's runSurfacingL1), and those
// edges come from a single unverified extraction pass
// (digestion-typed.ts's HARD_EXTRACTION_PROMPT) that only ever sees nodes
// from the same ~3000-char chunk, with zero instruction to check whether
// two claims are genuinely about the same question. One spurious
// `contradicts` edge is enough to flip a claim to 'contested' forever.
//
// This module is the independent verification pass that fixes that:
// modeled directly on self-contradictions.ts's judge pattern (a claimed
// relationship gets one independent judge call before it's trusted), but
// simpler — no "pick" step, just verify an edge that extraction already
// created. Confirm ONLY if both claims are genuinely about the SAME
// specific question; reject if merely topically similar, a different
// scope, a different sub-question, or a broader/narrower mismatch —
// exactly the "female/male sex vs. a separate identity argument" failure
// mode this was built to catch. Rejected edges are kept (scope_check =
// 'rejected'), not deleted, so a checked edge is never re-evaluated.
//
// Cron-driven via settle-pipeline.ts, same execution-ceiling discipline
// as every other step: a bounded batch per tick, not the whole backlog.

import type { Env } from "../../env";
import { all, run } from "../../lib/d1";
import { callRole } from "../../llm/router";

const MAX_EDGES_PER_TICK = 8;

export interface EvidentialScopeCheckReport {
  candidates_examined: number;
  verified: number;
  rejected: number;
  errors: string[];
}

interface CandidateEdge {
  edge_id: string;
  edge_type: string;
  src_label: string;
  dst_label: string;
  src_quote: string | null;
  dst_quote: string | null;
}

export async function advanceEvidentialScopeCheck(
  env: Env,
  userId: string,
): Promise<EvidentialScopeCheckReport> {
  const report: EvidentialScopeCheckReport = {
    candidates_examined: 0,
    verified: 0,
    rejected: 0,
    errors: [],
  };

  let candidates: CandidateEdge[];
  try {
    candidates = await all<CandidateEdge>(
      env.DB,
      `SELECT e.id AS edge_id, e.edge_type,
              sn.label AS src_label, dn.label AS dst_label,
              (SELECT verbatim_text FROM quotes WHERE node_id = sn.id LIMIT 1) AS src_quote,
              (SELECT verbatim_text FROM quotes WHERE node_id = dn.id LIMIT 1) AS dst_quote
         FROM edges e
         JOIN nodes sn ON sn.id = e.src_node_id
         JOIN nodes dn ON dn.id = e.dst_node_id
        WHERE e.user_id = ? AND e.family = 'evidential' AND e.scope_check IS NULL
          AND e.edge_type IN ('supports','corroborates','contradicts','rebuts','undercuts')
        ORDER BY e.created_at ASC
        LIMIT ?`,
      [userId, MAX_EDGES_PER_TICK],
    );
  } catch (err) {
    report.errors.push(`candidates: ${(err as Error).message}`);
    return report;
  }
  report.candidates_examined = candidates.length;

  for (const edge of candidates) {
    try {
      const verdict = await judgeScope(env, userId, edge);
      await run(env.DB, "UPDATE edges SET scope_check = ?, scope_check_notes = ? WHERE id = ?", [
        verdict.sameQuestion ? "verified" : "rejected",
        verdict.notes,
        edge.edge_id,
      ]);
      if (verdict.sameQuestion) report.verified++;
      else report.rejected++;
    } catch (err) {
      report.errors.push(`${edge.edge_id}: ${(err as Error).message}`);
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// Independent judge — a DIFFERENT model family confirms the two claims are
// genuinely about the same question, same spec hard constraint (Part 10 #4)
// as every other verification pass in this codebase. Never asked to judge
// which side is more correct — only whether the two claims share a scope.
// ---------------------------------------------------------------------------
async function judgeScope(
  env: Env,
  userId: string,
  edge: CandidateEdge,
): Promise<{ sameQuestion: boolean; notes: string }> {
  const claimA = (edge.src_quote ?? edge.src_label).slice(0, 500);
  const claimB = (edge.dst_quote ?? edge.dst_label).slice(0, 500);

  const out = await callRole(env, "judge", {
    userId,
    system: `You verify whether two claims are genuinely about the SAME specific question — not whether either claim is true. An extraction pass flagged claim A as "${edge.edge_type}" claim B. Confirm ONLY if both claims genuinely address the same specific question and directly bear on each other. Reject if they're merely topically similar, address different scopes, answer different sub-questions, or one is broader/narrower than the other in a way that means they don't actually conflict or corroborate (example: a claim about a legal/biological category and a claim about a separate social-identity question are NOT the same question, even if they use overlapping words). Never judge which claim is more correct — only whether they're actually talking about the same thing.

Return ONLY JSON: {"same_question": true|false, "notes": "one short sentence explaining your call"}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Claim A: "${claimA}"\n\nClaim B: "${claimB}"\n\nAre these genuinely about the same specific question?`,
          },
        ],
      },
    ],
    max_tokens: 300,
    response_schema: {
      type: "object",
      properties: { same_question: { type: "boolean" }, notes: { type: "string" } },
      required: ["same_question"],
    },
  });

  const parsed = (out.structured ?? safeParse(out.text)) as {
    same_question?: boolean;
    notes?: string;
  } | null;
  return {
    sameQuestion: parsed?.same_question === true,
    notes: (parsed?.notes ?? "").slice(0, 500),
  };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
