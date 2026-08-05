// Point segmentation — chunks a timestamped transcript into discrete
// "points" worth reacting to, each with a suggested fact-check or
// fallacy-check angle.
//
// Same generate-then-verify shape as the publication's
// self-contradictions.ts/register-shift.ts: a writer-role call proposes
// (referencing short segment ids the server resolves back to real
// verbatim text, never trusting the model to reproduce a quote itself),
// then an independent judge call — a genuinely different model family,
// same discipline the api Worker's router enforces for its own "judge"
// role — sanity-checks the suggested angle is a coherent, good-faith
// read of the transcript. This is explicitly NOT the same rigor as
// Canopticon's citable-fact firewall: there's no external stored source
// to verbatim-check the angle's real-world accuracy against. It's a
// suggestion the operator accepts, edits, or replaces — never something
// that reaches the page on its own.
//
// Chunked at ~3000 chars per LLM call — the publication's digestion.ts
// established this as the practical per-call text limit given Workers
// AI's ~25s wall-clock ceiling; a 10-minute transcript is far too long
// for one call.
//
// Direct env.AI.run() + manual JSON extraction, matching this package's
// existing editorial/brain.ts convention (no response_format usage
// anywhere in packages/video) rather than importing a different style
// from the publication's llm/router.ts (separate package, not a shared
// dependency).

import type { TranscriptSegment } from "../render/client";
import { insertReactPoint } from "./db";

interface Env {
  AI: Ai;
  DB: D1Database;
}

const CHUNK_CHARS = 3000;
const WRITER_MODEL = "@cf/openai/gpt-oss-120b";
// Judge MUST be a different model family than the writer — same
// discipline as the api Worker's llm/router.ts (Qwen vs. Llama/GPT-OSS
// families). Qwen mirrors that router's own judge-model pick exactly.
const JUDGE_MODEL = "@cf/qwen/qwq-32b";

export interface SegmentPointsReport {
  chunks_processed: number;
  points_created: number;
  errors: string[];
}

export async function segmentTranscriptIntoPoints(
  env: Env,
  projectId: string,
  segments: TranscriptSegment[],
): Promise<SegmentPointsReport> {
  const report: SegmentPointsReport = { chunks_processed: 0, points_created: 0, errors: [] };
  const chunks = chunkSegments(segments, CHUNK_CHARS);
  let sortOrder = 0;

  for (const chunk of chunks) {
    report.chunks_processed++;
    try {
      const candidates = await proposePoints(env, chunk);
      for (const c of candidates) {
        const verdict = await judgeAngle(env, c);
        await insertReactPoint(env.DB, {
          projectId,
          sortOrder: sortOrder++,
          startS: c.startS,
          endS: c.endS,
          transcriptText: c.transcriptText,
          summary: c.summary,
          suggestedAngleKind: c.angleKind,
          suggestedAngleText: c.angleText,
          angleJudgePass: verdict.pass,
          angleJudgeNotes: verdict.notes,
        });
        report.points_created++;
      }
    } catch (err) {
      report.errors.push((err as Error).message);
    }
  }
  return report;
}

// ---------------------------------------------------------------------------
// Chunking — group consecutive transcript segments into ~3000-char
// windows without ever splitting a segment's own text.
// ---------------------------------------------------------------------------
function chunkSegments(segments: TranscriptSegment[], maxChars: number): TranscriptSegment[][] {
  const chunks: TranscriptSegment[][] = [];
  let current: TranscriptSegment[] = [];
  let currentChars = 0;
  for (const seg of segments) {
    if (current.length > 0 && currentChars + seg.text.length > maxChars) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(seg);
    currentChars += seg.text.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// ---------------------------------------------------------------------------
// Step 1: propose points for one chunk.
// ---------------------------------------------------------------------------
interface PointCandidate {
  startS: number;
  endS: number;
  transcriptText: string;
  summary: string;
  angleKind: "fact_check" | "fallacy_check" | "none";
  angleText: string | null;
}

async function proposePoints(env: Env, chunk: TranscriptSegment[]): Promise<PointCandidate[]> {
  const byShortId = new Map<string, TranscriptSegment>();
  const lines = chunk.map((seg, i) => {
    const shortId = `s${i + 1}`;
    byShortId.set(shortId, seg);
    return `[${shortId}] (${seg.start_s.toFixed(1)}s–${seg.end_s.toFixed(1)}s) "${seg.text.slice(0, 400)}"`;
  });

  const system = `You break a video transcript into discrete POINTS worth reacting to — specific claims or moments a commentator would want to respond to on camera, not a full re-summary of everything said.

For each point you find (1-4 per chunk; skip filler/transition text that has nothing worth reacting to):
- Group one or more CONSECUTIVE transcript segments (by their short id) into a single point.
- Write a one-line summary of what's said in that span.
- Suggest an angle: "fact_check" (this claim can be checked against known facts), "fallacy_check" (this contains a reasoning flaw worth naming), or "none" (there's no natural check angle, just something worth reacting to). Write ONE sentence for the angle itself if kind is fact_check or fallacy_check — the specific thing to check or the specific flaw, not generic advice.

This is a SUGGESTION for a human commentator to accept, edit, or ignore — never a verified fact. Do not claim certainty about real-world accuracy; just identify what's worth checking.

Return ONLY JSON:
{"points": [{"start_segment": "sN", "end_segment": "sM", "summary": "...", "angle_kind": "fact_check"|"fallacy_check"|"none", "angle_text": "..."}]}`;

  const user = `TRANSCRIPT SEGMENTS:\n${lines.join("\n")}\n\nFind the points worth reacting to.`;

  const out = (await env.AI.run(
    WRITER_MODEL as never,
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      reasoning_effort: "medium",
      max_tokens: 1200,
    } as never,
  )) as { response?: string };

  const parsed = safeParseJson(out.response ?? "") as {
    points?: Array<{
      start_segment?: string;
      end_segment?: string;
      summary?: string;
      angle_kind?: string;
      angle_text?: string;
    }>;
  } | null;
  if (!parsed?.points?.length) return [];

  const candidates: PointCandidate[] = [];
  for (const p of parsed.points) {
    const startSeg = byShortId.get((p.start_segment ?? "").trim().toLowerCase());
    const endSeg = byShortId.get((p.end_segment ?? p.start_segment ?? "").trim().toLowerCase());
    if (!startSeg || !endSeg) continue;
    const summary = (p.summary ?? "").trim();
    if (!summary) continue;
    const angleKind = (["fact_check", "fallacy_check", "none"] as const).includes(
      p.angle_kind as never,
    )
      ? (p.angle_kind as "fact_check" | "fallacy_check" | "none")
      : "none";
    // Reconstruct the verbatim span server-side from the real stored
    // segment texts — never trust the model to reproduce the quote.
    const spanSegs = chunk.filter((s) => s.start_s >= startSeg.start_s && s.end_s <= endSeg.end_s);
    const transcriptText = (spanSegs.length ? spanSegs : [startSeg]).map((s) => s.text).join(" ");
    candidates.push({
      startS: startSeg.start_s,
      endS: endSeg.end_s,
      transcriptText,
      summary: summary.slice(0, 300),
      angleKind,
      angleText: angleKind === "none" ? null : (p.angle_text ?? "").trim().slice(0, 500) || null,
    });
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Step 2: independent judge — different model family, confirms the
// suggested angle is a coherent, good-faith read of the transcript span,
// not that it's real-world accurate (no external source to check that
// against here).
// ---------------------------------------------------------------------------
async function judgeAngle(
  env: Env,
  candidate: PointCandidate,
): Promise<{ pass: boolean | null; notes: string | null }> {
  if (candidate.angleKind === "none" || !candidate.angleText) return { pass: null, notes: null };

  const system = `You independently review a suggested ${candidate.angleKind === "fact_check" ? "fact-check" : "fallacy-check"} angle for a transcript span. Confirm pass=true ONLY if the angle is a coherent, good-faith, ON-TOPIC response to what the transcript actually says — not a non-sequitur, not about something else the span didn't say, not vague generic advice. You are NOT verifying whether the underlying claim is actually true or false in the real world — only whether this is a sensible thing to check given what was said.

Return ONLY JSON: {"pass": true|false, "notes": "one short sentence explaining your call"}`;

  const user = `Transcript span: "${candidate.transcriptText.slice(0, 800)}"\n\nSuggested ${candidate.angleKind} angle: "${candidate.angleText}"\n\nIs this a coherent, on-topic angle?`;

  try {
    const out = (await env.AI.run(
      JUDGE_MODEL as never,
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 300,
      } as never,
    )) as { response?: string };
    const parsed = safeParseJson(out.response ?? "") as { pass?: boolean; notes?: string } | null;
    return { pass: parsed?.pass === true, notes: (parsed?.notes ?? "").slice(0, 400) || null };
  } catch (err) {
    return { pass: false, notes: `judge call failed: ${(err as Error).message}`.slice(0, 400) };
  }
}

function safeParseJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
