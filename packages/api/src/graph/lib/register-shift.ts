// Register-shift translator — memetic content #5 + #6 (2026-07-25). One
// pipeline, two modes, since a "one-line hook" is the exact same move as a
// "plain-language translation" — just applied to a signed thesis instead of
// a formal quote, compressing instead of merely de-jargoning. Same trust
// discipline as self-contradictions.ts: the model rewrites, it never
// invents — the writer is instructed to preserve the claim exactly, and an
// INDEPENDENT judge call (different model family, same spec hard
// constraint as everywhere else) confirms nothing was added, dropped, or
// softened before a rewrite is ever surfaced. Rejected rewrites are kept
// (judge_pass=0), not deleted, so a source isn't re-evaluated every tick.
//
// Cron-driven, one source per tick per mode — same execution-ceiling
// discipline as self-contradictions.ts and every other step in this
// pipeline.

import type { Env } from "../../env";
import { all, insertOne, one } from "../../lib/d1";
import { callRole } from "../../llm/router";

const MIN_QUOTE_LEN = 50;
const MAX_QUOTE_LEN = 400;

export interface RegisterShiftReport {
  candidates_examined: number;
  found: boolean;
  judge_pass: boolean | null;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Mode 1: assertion quotes -> plain language, keyed to whichever subject
// page the assertion is connected to (same "find a connected page" pattern
// as the versus/timeline-drop faces).
// ---------------------------------------------------------------------------
export async function advanceRegisterShifts(
  env: Env,
  userId: string,
): Promise<RegisterShiftReport> {
  const report: RegisterShiftReport = {
    candidates_examined: 0,
    found: false,
    judge_pass: null,
    errors: [],
  };

  const candidates = await all<{
    assertion_node_id: string;
    quote_id: string | null;
    quote_text: string;
    piece_title: string | null;
  }>(
    env.DB,
    `SELECT n.id AS assertion_node_id, q.id AS quote_id, q.verbatim_text AS quote_text,
            (SELECT title FROM pieces WHERE id = n.piece_id) AS piece_title
       FROM nodes n
       JOIN assertions a ON a.node_id = n.id
       JOIN quotes q ON q.node_id = n.id
      WHERE n.user_id = ?
        AND length(q.verbatim_text) BETWEEN ? AND ?
        AND NOT EXISTS (
          SELECT 1 FROM register_shifts rs
           WHERE rs.source_node_id = n.id AND rs.source_kind = 'assertion'
        )
      ORDER BY n.created_at DESC
      LIMIT 20`,
    [userId, MIN_QUOTE_LEN, MAX_QUOTE_LEN],
  ).catch(() => []);
  report.candidates_examined = candidates.length;
  if (candidates.length === 0) return report;

  for (const candidate of candidates) {
    if (!candidate.quote_text) continue;
    const subjectNodeId = await findConnectedSubject(env, candidate.assertion_node_id);
    if (!subjectNodeId) continue;

    try {
      const rewrite = await rewriteText(env, userId, candidate.quote_text, "plain");
      if (!rewrite) continue;
      report.found = true;

      const judged = await judgeRewrite(env, userId, candidate.quote_text, rewrite, "plain");
      report.judge_pass = judged.pass;

      await insertOne(env.DB, "register_shifts", {
        user_id: userId,
        source_kind: "assertion",
        source_node_id: candidate.assertion_node_id,
        subject_node_id: subjectNodeId,
        original_text: candidate.quote_text,
        plain_text: rewrite,
        quote_id: candidate.quote_id,
        piece_title: candidate.piece_title,
        judge_pass: judged.pass ? 1 : 0,
        judge_notes: judged.notes,
      });
    } catch (err) {
      report.errors.push(`${candidate.assertion_node_id}: ${(err as Error).message}`);
    }
    return report;
  }
  return report;
}

async function findConnectedSubject(env: Env, assertionNodeId: string): Promise<string | null> {
  const row = await one<{ subject_node_id: string }>(
    env.DB,
    `SELECT pg.subject_node_id FROM edges e
       JOIN pages pg ON pg.subject_node_id = e.dst_node_id
      WHERE e.src_node_id = ?
      UNION
     SELECT pg.subject_node_id FROM edges e
       JOIN pages pg ON pg.subject_node_id = e.src_node_id
      WHERE e.dst_node_id = ?
      LIMIT 1`,
    [assertionNodeId, assertionNodeId],
  ).catch(() => null);
  return row?.subject_node_id ?? null;
}

// ---------------------------------------------------------------------------
// Mode 2: a signed reading's thesis -> a one-line hook. Only pages that
// already carry an argued thesis are eligible — this is a compression of
// an existing signed claim, not a new one.
// ---------------------------------------------------------------------------
export async function advanceHeadlineHooks(env: Env, userId: string): Promise<RegisterShiftReport> {
  const report: RegisterShiftReport = {
    candidates_examined: 0,
    found: false,
    judge_pass: null,
    errors: [],
  };

  const candidates = await all<{ id: string; subject_node_id: string; thesis: string }>(
    env.DB,
    `SELECT id, subject_node_id, thesis FROM pages
      WHERE user_id = ? AND signed_status = 'published' AND thesis IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM register_shifts rs
           WHERE rs.source_node_id = pages.id AND rs.source_kind = 'thesis'
        )
      ORDER BY signed_at DESC
      LIMIT 20`,
    [userId],
  ).catch(() => []);
  report.candidates_examined = candidates.length;
  if (candidates.length === 0) return report;

  const page = candidates[0];
  if (!page) return report;

  try {
    const rewrite = await rewriteText(env, userId, page.thesis, "hook");
    if (!rewrite) return report;
    report.found = true;

    const judged = await judgeRewrite(env, userId, page.thesis, rewrite, "hook");
    report.judge_pass = judged.pass;

    await insertOne(env.DB, "register_shifts", {
      user_id: userId,
      source_kind: "thesis",
      source_node_id: page.id,
      subject_node_id: page.subject_node_id,
      original_text: page.thesis,
      plain_text: rewrite,
      quote_id: null,
      piece_title: null,
      judge_pass: judged.pass ? 1 : 0,
      judge_notes: judged.notes,
    });
  } catch (err) {
    report.errors.push(`${page.id}: ${(err as Error).message}`);
  }

  return report;
}

// ---------------------------------------------------------------------------
// Shared writer + judge — the model rewrites, never invents.
// ---------------------------------------------------------------------------
type Mode = "plain" | "hook";

async function rewriteText(
  env: Env,
  userId: string,
  original: string,
  mode: Mode,
): Promise<string | null> {
  const instruction =
    mode === "plain"
      ? `Rewrite this quote in plain, direct, everyday language. Preserve the EXACT claim — don't add anything, don't drop anything, don't soften or sharpen it. No editorializing, no jokes. Just the same claim in words a person would actually use.`
      : `Compress this thesis into ONE short, punchy sentence a reader would actually share. Preserve the EXACT claim — nothing added, nothing softened, nothing implied that isn't already there. No editorializing beyond the compression itself.`;

  const out = await callRole(env, "writer", {
    userId,
    system: `You rewrite text for register, not content. ${instruction}\n\nReturn ONLY JSON: {"rewrite": "..."}`,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: `Original:\n"${original}"` }],
      },
    ],
    max_tokens: 300,
    response_schema: {
      type: "object",
      properties: { rewrite: { type: "string" } },
      required: ["rewrite"],
    },
  });

  const parsed = (out.structured ?? safeParse(out.text)) as { rewrite?: string } | null;
  const rewrite = parsed?.rewrite?.trim();
  if (!rewrite || rewrite.length < 10) return null;
  if (mode === "hook" && rewrite.length > 220) return null;
  if (mode === "plain" && rewrite.length > 500) return null;
  return rewrite;
}

async function judgeRewrite(
  env: Env,
  userId: string,
  original: string,
  rewrite: string,
  mode: Mode,
): Promise<{ pass: boolean; notes: string }> {
  const criterion =
    mode === "plain"
      ? "a faithful plain-language rewrite of the same claim"
      : "a faithful one-line compression of the same thesis";
  const out = await callRole(env, "judge", {
    userId,
    system: `You independently verify a rewrite. Confirm ONLY if the rewrite is ${criterion} — nothing added, nothing dropped, nothing softened or sharpened beyond what the mode requires.\n\nReturn ONLY JSON: {"pass": true|false, "notes": "one short sentence explaining your call"}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Original:\n"${original}"\n\nRewrite:\n"${rewrite}"\n\nDoes the rewrite preserve the exact claim?`,
          },
        ],
      },
    ],
    max_tokens: 300,
    response_schema: {
      type: "object",
      properties: { pass: { type: "boolean" }, notes: { type: "string" } },
      required: ["pass"],
    },
  });
  const parsed = (out.structured ?? safeParse(out.text)) as {
    pass?: boolean;
    notes?: string;
  } | null;
  return { pass: parsed?.pass === true, notes: (parsed?.notes ?? "").slice(0, 500) };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
