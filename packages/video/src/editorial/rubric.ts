// Editorial rubric — score a candidate 0–5 on each of six axes from
// the handoff doc §7b. The total (0–30) plus the per-axis scores
// determine which candidate becomes today's segment.
//
// Two gates (per the handoff):
//   - forensic_potential (0 → reject)
//   - visual_evidence_available (0 → reject)
// A candidate that scores 0 on either gate is rejected outright
// regardless of total.

import type { Candidate } from "../sourcing/gdelt";

export interface RubricScores {
  forensic_potential: number;
  visual_evidence: number;
  recency: number;
  canadian_lane: number;
  counter_voice: number;
  legibility: number;
}

export interface RubricResult {
  total: number;
  scores: RubricScores;
  /** Detected "gap_kind" — used by the template caster.
   *  "claim_vs_evidence" → Template 1 (Claim vs. Ground)
   *  "buried_number"     → Template 2 (Buried Number)
   *  "reversal"          → Template 3 (Reversal)
   *  null                → no clear gap (rejected)
   */
  gap_kind: GapKind;
  /** "rejected" when either gate scored 0; the operator sees the
   *  reason in the queue. */
  rejected_reason: string | null;
}

export type GapKind = "claim_vs_evidence" | "buried_number" | "reversal" | null;

interface Env {
  AI: Ai;
  GDELT_API_KEY?: string;
}

/** Score one candidate. Uses Workers AI when AI binding is present;
 *  falls back to deterministic heuristics otherwise so the pipeline
 *  runs end-to-end during the Phase 1 wiring window. */
export async function scoreCandidate(env: Env, c: Candidate): Promise<RubricResult> {
  const llmResult = await scoreViaLLM(env, c).catch(() => null);
  if (llmResult) return finalise(llmResult);
  return finalise(scoreHeuristically(c));
}

function finalise(raw: RubricResult): RubricResult {
  if (raw.scores.forensic_potential === 0) {
    return { ...raw, rejected_reason: "no forensic gap" };
  }
  if (raw.scores.visual_evidence === 0) {
    return { ...raw, rejected_reason: "no visual evidence" };
  }
  return { ...raw, rejected_reason: null };
}

async function scoreViaLLM(env: Env, c: Candidate): Promise<RubricResult | null> {
  if (!env.AI) return null;
  const system = `You are CANOPTICON's editorial scorer. Score the candidate news clip 0-5 on each of six axes from the rubric.

AXES (0-5 each):
- forensic_potential: is there a gap — a claim the evidence undercuts, a number nobody scaled, or a reversal? No gap → 0.
- visual_evidence: is clean broadcast footage of the principal actually fetchable today? No → 0.
- recency: did the hook move in the last 24-72h? Older → lower.
- canadian_lane: politics/economics/newsworthy with Canadian relevance.
- counter_voice: is there a real on-camera opposing clip available?
- legibility: can a non-expert grasp why it matters in one sentence?

Also classify the gap_kind:
- "claim_vs_evidence" — official statement contradicted by the record
- "buried_number" — one shocking unscaled figure
- "reversal" — official story inverted by receipts
- null — no clear gap

Output JSON only: { "forensic_potential": int, "visual_evidence": int, "recency": int, "canadian_lane": int, "counter_voice": int, "legibility": int, "gap_kind": "claim_vs_evidence"|"buried_number"|"reversal"|null }`;

  const user = `BROADCASTER: ${c.network}
HEADLINE: ${c.headline}
EXCERPT: ${c.excerpt}
CAPTURED: ${c.captured_at}
ENTITIES: ${c.entities.join(", ")}

Score it.`;

  try {
    const out = (await env.AI.run(
      "@cf/openai/gpt-oss-120b" as never,
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 200,
      } as never,
    )) as { response?: string };
    const text = out.response ?? "";
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<RubricScores> & { gap_kind?: GapKind };
    const scores: RubricScores = {
      forensic_potential: clampScore(parsed.forensic_potential),
      visual_evidence: clampScore(parsed.visual_evidence),
      recency: clampScore(parsed.recency),
      canadian_lane: clampScore(parsed.canadian_lane),
      counter_voice: clampScore(parsed.counter_voice),
      legibility: clampScore(parsed.legibility),
    };
    return {
      total: sumScores(scores),
      scores,
      gap_kind: parsed.gap_kind ?? null,
      rejected_reason: null,
    };
  } catch {
    return null;
  }
}

function clampScore(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function sumScores(s: RubricScores): number {
  return (
    s.forensic_potential +
    s.visual_evidence +
    s.recency +
    s.canadian_lane +
    s.counter_voice +
    s.legibility
  );
}

// Heuristic fallback — keyword pattern matching against the headline +
// excerpt. Not as good as the LLM but deterministic and free, so the
// pipeline can run end-to-end before the operator's account has
// Workers AI configured.
function scoreHeuristically(c: Candidate): RubricResult {
  const text = `${c.headline} ${c.excerpt}`.toLowerCase();
  const hoursAgo = Math.max(0, (Date.now() - new Date(c.captured_at).getTime()) / 3600_000);

  // Forensic potential — look for hedging language, contradictions,
  // qualifiers ("expected", "estimated", "appears to", "looks like").
  const hedges = ["expected", "estimated", "appears to", "looks like", "could be", "likely"];
  const hedgesHit = hedges.filter((h) => text.includes(h)).length;
  const forensic_potential = Math.min(5, hedgesHit * 2 + (text.includes("deny") ? 1 : 0) + 1);

  // Visual evidence — every stub gets 3 by default (the clip URL is
  // attached). Live GDELT hits get 4. Mode=stub gets 3.
  const visual_evidence = c.source === "gdelt" ? 4 : 3;

  // Recency — falls off after 72h.
  const recency = hoursAgo < 6 ? 5 : hoursAgo < 24 ? 4 : hoursAgo < 72 ? 3 : 1;

  // Canadian lane — every candidate already filtered through the
  // Canadian-politics query, so 4 baseline.
  const canadian_lane = 4;

  // Counter-voice — is there an opposition name in entities?
  const oppositionNames = ["poilievre", "singh", "freeland", "carney"];
  const counter_voice = oppositionNames.some((n) => text.includes(n)) ? 4 : 2;

  // Legibility — short, simple headline scores higher.
  const headlineWords = c.headline.split(/\s+/).length;
  const legibility = headlineWords < 12 ? 5 : headlineWords < 20 ? 4 : 3;

  // Gap kind — heuristic guess from keywords.
  let gap_kind: GapKind = null;
  if (text.includes("claim") || text.includes("said") || text.includes("looks like")) {
    gap_kind = "claim_vs_evidence";
  } else if (
    /\d+/.test(text) &&
    (text.includes("billion") || text.includes("million") || text.includes("%"))
  ) {
    gap_kind = "buried_number";
  } else if (text.includes("reverse") || text.includes("contradict")) {
    gap_kind = "reversal";
  }

  const scores: RubricScores = {
    forensic_potential,
    visual_evidence,
    recency,
    canadian_lane,
    counter_voice,
    legibility,
  };
  return {
    total: sumScores(scores),
    scores,
    gap_kind,
    rejected_reason: null,
  };
}

/** Map a gap_kind onto the §7b template name. */
export function castTemplate(gap: GapKind): string | null {
  switch (gap) {
    case "claim_vs_evidence":
      return "claim_vs_ground";
    case "buried_number":
      return "buried_number";
    case "reversal":
      return "reversal";
    default:
      return null;
  }
}
