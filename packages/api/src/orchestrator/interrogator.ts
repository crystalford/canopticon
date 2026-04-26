// runInterrogator — invoke the Interrogator role on a thesis and persist
// the generated questions.
//
// Used by:
//   - POST /v1/theses/:id/interrogate (manual fire from the studio screen)
//   - cascade step D (auto-fire when a thesis has new integrated claims
//     since its last interrogation)
//
// The Interrogator's output schema is the round-trip contract from
// skills-v1.0 §3 / schema-v1.0 §12.4: text, expected_information_gain,
// rationale, evidence_targets[]. We persist each generated question as a
// `questions` row scoped to the thesis.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnthropicClient } from "../lib/anthropic.ts";
import type { CostGateDecision } from "./cost_gate.ts";
import { invokeRole } from "./role_runner.ts";

export interface RunInterrogatorInput {
  user_id: string;
  thesis_id: string;
  triggered_by: string;
}

export type RunInterrogatorResult =
  | {
      status: "completed";
      questions_written: number;
      role_invocation_id: string;
    }
  | {
      status: "denied";
      decision: Extract<CostGateDecision, { approved: false }>;
    }
  | {
      status: "skipped";
      reason: string;
    };

export interface InterrogatorContext {
  service: SupabaseClient;
  anthropic: AnthropicClient;
}

interface ThesisSnapshot {
  id: string;
  title: string;
  bluf: string | null;
  concept_spine: string;
}

interface ClaimSnapshot {
  layer: string;
  data: string;
  claim_text: string;
  warrant: string | null;
  grade: string;
}

interface QuestionSnapshot {
  text: string;
  expected_information_gain: number;
}

interface InterrogatorOutput {
  questions: Array<{
    text: string;
    expected_information_gain: number;
    rationale: string;
    evidence_targets: string[];
  }>;
}

export async function runInterrogator(
  ctx: InterrogatorContext,
  input: RunInterrogatorInput,
): Promise<RunInterrogatorResult> {
  // Pull the thesis snapshot.
  const thesis = await fetchThesisSnapshot(ctx.service, input.user_id, input.thesis_id);
  if (!thesis) return { status: "skipped", reason: "thesis not found" };

  const [claims, openQuestions] = await Promise.all([
    fetchIntegratedClaims(ctx.service, input.thesis_id),
    fetchOpenQuestions(ctx.service, input.thesis_id),
  ]);

  if (claims.length === 0) {
    return { status: "skipped", reason: "no integrated claims to interrogate" };
  }

  const inv = await invokeRole(
    { service: ctx.service, anthropic: ctx.anthropic },
    {
      user_id: input.user_id,
      role_name: "interrogator",
      triggered_by: input.triggered_by,
      snapshot: {
        thesis: {
          id: thesis.id,
          title: thesis.title,
          bluf: thesis.bluf ?? "",
          concept_spine: thesis.concept_spine,
        },
        current_claims: renderClaims(claims),
        open_questions: renderQuestions(openQuestions),
        recent_role_outputs: "",
      },
      estimate: { input_tokens: 1500 + claims.length * 300, output_tokens: 1200 },
      approval_context: {
        thesis_id: input.thesis_id,
        thesis_title: thesis.title,
        step: "interrogator",
      },
    },
  );

  if (inv.status === "denied") {
    return { status: "denied", decision: inv.decision };
  }

  const structured = (inv.output.structured ?? {}) as InterrogatorOutput;
  const questions = Array.isArray(structured.questions) ? structured.questions : [];

  let written = 0;
  for (const q of questions) {
    if (!q.text || typeof q.expected_information_gain !== "number") continue;
    const { error } = await ctx.service.from("questions").insert({
      user_id: input.user_id,
      thesis_id: input.thesis_id,
      text: q.text,
      rationale: q.rationale ?? null,
      evidence_targets: q.evidence_targets ?? [],
      expected_information_gain: q.expected_information_gain,
      status: "open",
      generated_by: "interrogator",
      generated_by_role_invocation_id: inv.role_invocation_id,
    });
    if (!error) written++;
  }

  return {
    status: "completed",
    questions_written: written,
    role_invocation_id: inv.role_invocation_id,
  };
}

async function fetchThesisSnapshot(
  client: SupabaseClient,
  user_id: string,
  thesis_id: string,
): Promise<ThesisSnapshot | null> {
  const { data: thesis } = await client
    .from("theses")
    .select("id, title, current_version_id")
    .eq("id", thesis_id)
    .eq("user_id", user_id)
    .maybeSingle<{ id: string; title: string; current_version_id: string | null }>();
  if (!thesis) return null;

  let bluf: string | null = null;
  if (thesis.current_version_id) {
    const { data: version } = await client
      .from("thesis_versions")
      .select("bluf")
      .eq("id", thesis.current_version_id)
      .maybeSingle<{ bluf: string | null }>();
    bluf = version?.bluf ?? null;
  }

  const { data: spine } = await client
    .from("thesis_concept_spine")
    .select("concept_text")
    .eq("thesis_id", thesis_id)
    .order("ordering", { ascending: true });

  const concept_spine = (spine ?? [])
    .map((s) => (s as { concept_text: string }).concept_text)
    .join(", ");

  return { id: thesis.id, title: thesis.title, bluf, concept_spine };
}

async function fetchIntegratedClaims(
  client: SupabaseClient,
  thesis_id: string,
): Promise<ClaimSnapshot[]> {
  const { data: tcs } = await client
    .from("thesis_claims")
    .select("claim_id, layer")
    .eq("thesis_id", thesis_id)
    .is("removed_at", null);
  const ids = (tcs ?? []).map((row) => (row as { claim_id: string }).claim_id);
  if (ids.length === 0) return [];

  const { data: claims } = await client
    .from("claims")
    .select("id, admiralty_grade, current_version_id")
    .in("id", ids);

  const versionIds = (claims ?? [])
    .map((row) => (row as { current_version_id: string | null }).current_version_id)
    .filter((v): v is string => Boolean(v));
  if (versionIds.length === 0) return [];

  const { data: versions } = await client
    .from("claim_versions")
    .select("id, claim_id, data, claim_text, warrant")
    .in("id", versionIds);

  const versionByClaim: Record<
    string,
    { data: string; claim_text: string; warrant: string | null }
  > = {};
  for (const v of versions ?? []) {
    const row = v as { claim_id: string; data: string; claim_text: string; warrant: string | null };
    versionByClaim[row.claim_id] = {
      data: row.data,
      claim_text: row.claim_text,
      warrant: row.warrant,
    };
  }

  const tcLayer: Record<string, string> = {};
  for (const tc of tcs ?? []) {
    const row = tc as { claim_id: string; layer: string };
    tcLayer[row.claim_id] = row.layer;
  }

  const out: ClaimSnapshot[] = [];
  for (const claim of claims ?? []) {
    const c = claim as { id: string; admiralty_grade: string };
    const v = versionByClaim[c.id];
    if (!v) continue;
    out.push({
      layer: tcLayer[c.id] ?? "factual",
      data: v.data,
      claim_text: v.claim_text,
      warrant: v.warrant,
      grade: c.admiralty_grade,
    });
  }
  return out;
}

async function fetchOpenQuestions(
  client: SupabaseClient,
  thesis_id: string,
): Promise<QuestionSnapshot[]> {
  const { data } = await client
    .from("questions")
    .select("text, expected_information_gain")
    .eq("thesis_id", thesis_id)
    .eq("status", "open")
    .limit(50);
  return ((data ?? []) as QuestionSnapshot[]).filter((q) => q.text);
}

function renderClaims(claims: ClaimSnapshot[]): string {
  return claims
    .map((c, i) => {
      const w = c.warrant ? `\n  warrant: ${c.warrant}` : "";
      return `[${i + 1}] (${c.layer}, grade ${c.grade}) ${c.claim_text}\n  data: ${c.data}${w}`;
    })
    .join("\n\n");
}

function renderQuestions(questions: QuestionSnapshot[]): string {
  return questions
    .map((q) => `- ${q.text} (EIG ${q.expected_information_gain.toFixed(2)})`)
    .join("\n");
}
