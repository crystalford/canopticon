// Per-episode argument summary — Phase 2 of video-as-source-material
// ingestion (2026-07-24). A faithful, SOURCE-SIDE account of what a
// video actually argued: its thesis, its claims, what it offered as
// evidence for each. This is deliberately NOT a signed reading — a
// signed reading is the operator's own interpretation, built on demand,
// pulling corpus facts into the operator's order. This is the opposite
// direction: representing someone else's argument accurately, with no
// judgment on whether it holds up. Closer in spirit to hard_extraction's
// job (read stance out of a document) than to draft-reading's.
//
// Cron-driven, one piece per tick — same self-driving pattern as
// embeddings.ts's advanceReembedBackfill and deep-research.ts's
// advanceResearchRun. Runs only after a video-transcript piece's
// digestion has actually completed, so the summary can (eventually)
// point back at real extracted claims rather than racing extraction.

import type { Env } from "../../env";
import { one, updateById } from "../../lib/d1";
import { callResearchWriter } from "../../llm/router";

// Same order of magnitude as deep-research.ts's per-source excerpt cap —
// this is a single long document, not many short ones, so the budget is
// larger, but still bounded: an hour-long transcript can run 40-60k
// characters, and feeding all of it risks the same near-ceiling latency
// the research_writer model comparison (2026-07-24) measured on nemotron
// at a fraction of this size.
const TRANSCRIPT_CHARS_CAP = 40_000;
const SUMMARY_MAX_TOKENS = 2500;

const SYSTEM_PROMPT = `You summarize the ARGUMENT made in a single video transcript — faithfully, without judgment. This is not your own analysis. Do not evaluate whether the speaker is right, do not add outside information, do not fact-check. Stay strictly within what the transcript actually says.

Write markdown with these sections:
## Thesis
The speaker's core claim or position, in one or two sentences.

## Claims
A bulleted list of the specific claims made, each with what the speaker offered as evidence or reasoning for it (a source they cited, a comparison they drew, an inference they made — whatever they actually said, not what would be needed to prove it).

## Notable framing
Any recurring rhetorical moves, comparisons, or framing choices worth noting as characteristic of how this argument was made — still descriptive, not evaluative.

Do not include a verdict, a rating, or any language implying the argument is correct or incorrect.

Return ONLY JSON: {"summary_md": "the full markdown summary"}`;

interface PieceRow {
  id: string;
  title: string;
  body_md: string;
  metadata: string;
}

export async function advanceArgumentSummaries(env: Env, userId: string): Promise<void> {
  const piece = await one<PieceRow>(
    env.DB,
    `SELECT p.id, p.title, p.body_md, p.metadata
       FROM pieces p
      WHERE p.user_id = ?
        AND p.argument_summary_md IS NULL
        AND json_extract(p.metadata, '$.ingested_from') = 'video-transcript'
        AND EXISTS (
          SELECT 1 FROM digest_jobs j
           WHERE j.user_id = p.user_id AND j.piece_id = p.id AND j.status = 'completed'
        )
      ORDER BY p.created_at ASC
      LIMIT 1`,
    [userId],
  );
  if (!piece) return;

  let meta: { video_channel?: string | null; source_url?: string | null } = {};
  try {
    meta = JSON.parse(piece.metadata) as typeof meta;
  } catch {
    // metadata is best-effort context for the prompt, not load-bearing
  }

  const transcript = piece.body_md.slice(0, TRANSCRIPT_CHARS_CAP);
  const truncated = piece.body_md.length > TRANSCRIPT_CHARS_CAP;

  try {
    const result = await callResearchWriter(env, {
      userId,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Title: ${piece.title}${meta.video_channel ? `\nChannel: ${meta.video_channel}` : ""}\n\nTRANSCRIPT${truncated ? " (truncated to the first portion)" : ""}:\n${transcript}`,
            },
          ],
        },
      ],
      max_tokens: SUMMARY_MAX_TOKENS,
      response_schema: {
        type: "object",
        properties: { summary_md: { type: "string" } },
        required: ["summary_md"],
      },
    });
    const parsed = (result.structured ?? safeParseJson(result.text)) as {
      summary_md?: string;
    } | null;
    const summary = (parsed?.summary_md ?? "").trim();
    if (!summary) return; // non-fatal — next tick retries a different piece, this one stays NULL
    await updateById(env.DB, "pieces", piece.id, { argument_summary_md: summary });
  } catch {
    // Non-fatal by design (matches embeddings.ts/deep-research.ts's own
    // advance* functions) — a transient model/timeout failure shouldn't
    // wedge the whole cron tick; this piece is retried next tick since
    // argument_summary_md stays NULL.
  }
}

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
