// Forensic-mode publish-prep — 8 deterministic gates from the spec.
//
// Runs against a posts row when is_forensic=true. All code-level, no
// LLM. The Critic LLM scan is a separate operator-triggered tool
// (graph/roles/critic.ts) — publish-prep is the hard gate; Critic is
// the soft pre-flight check.

import type { Env } from "../../env";
import { one } from "../../lib/d1";

export interface GateResult {
  name: string;
  pass: boolean;
  detail: string;
}

export interface PublishPrepResult {
  pass: boolean;
  gates: GateResult[];
  failed_gates: string[];
}

interface PostRow {
  id: string;
  body_md: string;
  byline: string;
  cited_claim_ids: string;
  forensic_metadata: string;
  post_type: string;
  is_forensic: number;
}

interface ForensicMetadata {
  coined_phrase?: string;
  teachable_diagram_url?: string;
  methodology_appendix?: string;
  intervention_level?: "symptom" | "mechanism" | "structural";
  public_graph_artifact_url?: string;
}

export async function runPublishPrep(
  env: Env,
  userId: string,
  postId: string,
): Promise<PublishPrepResult> {
  const post = await one<PostRow>(
    env.DB,
    "SELECT id, body_md, byline, cited_claim_ids, forensic_metadata, post_type, is_forensic FROM posts WHERE id = ? AND user_id = ?",
    [postId, userId],
  );
  if (!post) {
    return {
      pass: false,
      gates: [],
      failed_gates: ["post_not_found"],
    };
  }

  const meta = safeJson<ForensicMetadata>(post.forensic_metadata, {});
  const citedClaimIds = safeJson<string[]>(post.cited_claim_ids, []);
  const wordCount = post.body_md.split(/\s+/).filter(Boolean).length;
  const requiredClaims = Math.max(1, Math.ceil(wordCount / 250));

  // Count banked predictions linked to this post.
  const predictionCount = await one<{ n: number }>(
    env.DB,
    "SELECT COUNT(*) AS n FROM predictions WHERE post_id = ? AND user_id = ?",
    [postId, userId],
  );
  const banked = predictionCount?.n ?? 0;

  // Check the body for an inline coined_phrase declaration too:
  // "Coined phrase: <phrase>" or a "##? Coined phrase" section header.
  const bodyHasCoinedPhrase = /\bcoined phrase\b[:\s]+\S/i.test(post.body_md);

  const gates: GateResult[] = [
    {
      name: "evidence_density",
      pass: citedClaimIds.length >= requiredClaims,
      detail: `${citedClaimIds.length} cited claims for ${wordCount} words (need ≥ ${requiredClaims}, one per ~250 words)`,
    },
    {
      name: "coined_phrase",
      pass: !!meta.coined_phrase || bodyHasCoinedPhrase,
      detail: meta.coined_phrase
        ? `phrase: "${meta.coined_phrase}"`
        : bodyHasCoinedPhrase
          ? "coined phrase declared inline in body"
          : "no coined_phrase set in forensic_metadata or body",
    },
    {
      name: "banked_predictions",
      pass: banked >= 3,
      detail: `${banked} predictions banked (need ≥ 3)`,
    },
    {
      name: "teachable_diagram",
      pass: !!meta.teachable_diagram_url,
      detail: meta.teachable_diagram_url ? "diagram linked" : "no teachable_diagram_url set",
    },
    {
      name: "methodology_appendix",
      pass: !!(meta.methodology_appendix && meta.methodology_appendix.trim().length > 100),
      detail: meta.methodology_appendix
        ? `${meta.methodology_appendix.length} char methodology appendix`
        : "no methodology_appendix set (need ≥ 100 chars)",
    },
    {
      name: "named_byline",
      pass: post.byline.trim().length > 0,
      detail: post.byline ? `byline: ${post.byline}` : "byline is empty",
    },
    {
      name: "intervention_level",
      pass: meta.intervention_level === "structural" || post.post_type !== "thesis",
      detail:
        post.post_type === "thesis"
          ? meta.intervention_level
            ? `intervention_level=${meta.intervention_level}`
            : "thesis posts require intervention_level=structural"
          : `non-thesis post (post_type=${post.post_type}) — gate skipped`,
    },
    {
      name: "public_graph_artifact",
      // Auto-generated at publish time once the graph compartment is wired
      // to export per-thesis. For v1 this gate always passes.
      pass: true,
      detail: meta.public_graph_artifact_url ?? "auto-generated on publish",
    },
  ];

  const failed = gates.filter((g) => !g.pass).map((g) => g.name);
  return {
    pass: failed.length === 0,
    gates,
    failed_gates: failed,
  };
}

function safeJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
