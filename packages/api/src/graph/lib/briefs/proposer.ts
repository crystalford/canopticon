// Output proposer — the LLM-driven research assistant (canonical-spec v2.4
// Part 7). Reads the TYPED GRAPH and the OPEN INQUIRY THREADS and proposes
// specific, well-shaped outputs across BOTH layers — factual arrangements AND
// interpretive intents — each with substantive reasoning.
//
// Replaces the SQL heuristic (entities with >=5 claims -> Definition). The
// proposer's cards are the PRIMARY content of /op/outputs; the operator's
// main act is read -> click Build. One proposer; the graph and the threads
// are inputs to it, never competing proposers.

import type { Env } from "../../../env";
import { all, insertOne, one } from "../../../lib/d1";
import { callRole } from "../../../llm/router";

export interface ProposerReport {
  proposed: number;
  updated: number;
  errors: string[];
}

const FACTUAL_TYPES = new Set([
  "definition",
  "comparison",
  "timeline",
  "faq",
  "stat-roundup",
  "entity-profile",
  "claim-table",
]);
const INTERPRETIVE_TYPES = new Set(["investigation", "argument", "assessment"]);

interface Proposal {
  title: string;
  slug: string;
  content_type: string;
  layer: string;
  reasoning_md: string;
  novelty: number;
}

export async function proposeBriefs(env: Env, userId: string): Promise<ProposerReport> {
  const report: ProposerReport = { proposed: 0, updated: 0, errors: [] };

  // ---- assemble the graph summary the proposer reasons over ----
  const summary = await summarizeGraph(env, userId);
  if (summary.totalNodes === 0) {
    report.errors.push("no extracted material yet — extract documents in Library first");
    return report;
  }

  // ---- ask the writer role for proposals across both layers ----
  let proposals: Proposal[];
  try {
    proposals = await llmPropose(env, userId, summary.text);
  } catch (err) {
    report.errors.push(`proposer: ${(err as Error).message}`);
    return report;
  }

  // ---- upsert as proposal-status outputs ----
  const refreshedSlugs: string[] = [];
  for (const p of proposals) {
    try {
      const layer = INTERPRETIVE_TYPES.has(p.content_type) ? "interpretive" : "factual";
      if (!FACTUAL_TYPES.has(p.content_type) && !INTERPRETIVE_TYPES.has(p.content_type)) continue;
      const slug = slugify(p.slug || p.title);
      if (!slug || !p.title) continue;
      const existing = await one<{ id: string; status: string }>(
        env.DB,
        "SELECT id, status FROM briefs WHERE user_id = ? AND slug = ?",
        [userId, slug],
      );
      refreshedSlugs.push(slug);
      if (existing) {
        if (existing.status === "proposal") {
          await env.DB.prepare(
            "UPDATE briefs SET title = ?, content_type = ?, layer = ?, why_proposed_md = ?, updated_at = ? WHERE id = ?",
          )
            .bind(
              p.title,
              p.content_type,
              layer,
              p.reasoning_md,
              new Date().toISOString(),
              existing.id,
            )
            .run();
          report.updated += 1;
        }
      } else {
        await insertOne(env.DB, "briefs", {
          user_id: userId,
          slug,
          title: p.title,
          content_type: p.content_type,
          layer,
          status: "proposal",
          why_proposed_md: p.reasoning_md,
          body_md: "",
          body_html: "",
          schema_jsonld: "{}",
        });
        report.proposed += 1;
      }
    } catch (err) {
      report.errors.push(`${p.slug}: ${(err as Error).message}`);
    }
  }

  // Queue hygiene: proposals are ephemeral suggestions. Any still-unbuilt
  // proposal NOT refreshed by this run is superseded (discarded) so duds
  // don't accumulate — the operator curates a live queue, not a backlog.
  try {
    if (refreshedSlugs.length > 0) {
      const ph = refreshedSlugs.map(() => "?").join(",");
      await env.DB.prepare(
        `UPDATE briefs SET status = 'discarded', updated_at = ?
          WHERE user_id = ? AND status = 'proposal' AND slug NOT IN (${ph})`,
      )
        .bind(new Date().toISOString(), userId, ...refreshedSlugs)
        .run();
    }
  } catch (err) {
    report.errors.push(`supersede: ${(err as Error).message}`);
  }

  return report;
}

interface GraphSummary {
  totalNodes: number;
  text: string;
}

async function summarizeGraph(env: Env, userId: string): Promise<GraphSummary> {
  const counts = await all<{ kind: string; n: number }>(
    env.DB,
    "SELECT kind, COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind != 'source' GROUP BY kind",
    [userId],
  );
  const totalNodes = counts.reduce((s, c) => s + c.n, 0);
  if (totalNodes === 0) return { totalNodes: 0, text: "" };

  // Top entities by degree + DOCUMENT SPAN. Cross-document presence is the
  // highest-value proposer signal: an entity asserted about differently in
  // two sources is where the tensions live.
  const topEntities = await all<{ label: string; degree: number; doc_span: number }>(
    env.DB,
    `SELECT n.label, COUNT(DISTINCT e.id) AS degree,
            COUNT(DISTINCT n2.piece_id) AS doc_span
       FROM nodes n
       LEFT JOIN edges e ON (e.src_node_id = n.id OR e.dst_node_id = n.id)
       LEFT JOIN nodes n2 ON lower(n2.label) = lower(n.label) AND n2.user_id = n.user_id
      WHERE n.user_id = ? AND n.kind = 'entity'
      GROUP BY lower(n.label) ORDER BY doc_span DESC, degree DESC LIMIT 15`,
    [userId],
  );

  // Events with dates — timeline material.
  const events = await all<{ label: string }>(
    env.DB,
    `SELECT label FROM nodes WHERE user_id = ? AND kind = 'event' ORDER BY created_at DESC LIMIT 15`,
    [userId],
  );

  // Assertions with attribution + stance — contested material.
  const assertions = await all<{ label: string; stance: string; actor: string | null }>(
    env.DB,
    `SELECT n.label, a.stance,
            (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS actor
       FROM nodes n JOIN assertions a ON a.node_id = n.id
      WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 15`,
    [userId],
  );

  // Sample neutral facts.
  const facts = await all<{ label: string }>(
    env.DB,
    `SELECT label FROM nodes WHERE user_id = ? AND kind = 'neutral_fact' ORDER BY created_at DESC LIMIT 20`,
    [userId],
  );

  // Open inquiry threads.
  const threads = await all<{ question: string }>(
    env.DB,
    "SELECT question FROM inquiry_threads WHERE user_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 12",
    [userId],
  );

  // Source documents in the corpus.
  const pieces = await all<{ title: string }>(
    env.DB,
    "SELECT title FROM pieces WHERE user_id = ? ORDER BY created_at DESC LIMIT 12",
    [userId],
  );

  const text = `GRAPH SHAPE: ${counts.map((c) => `${c.n} ${c.kind}`).join(", ")} across ${pieces.length} source document(s).

SOURCE DOCUMENTS:
${pieces.map((p) => `- ${p.title}`).join("\n")}

TOP ENTITIES (by document span + connectedness — cross-document tensions are the most valuable):
${topEntities.map((e) => `- ${e.label} (${e.doc_span} document${e.doc_span === 1 ? "" : "s"}, ${e.degree} edges)`).join("\n")}

DATED EVENTS:
${events.map((e) => `- ${e.label}`).join("\n") || "(none)"}

ATTRIBUTED ASSERTIONS (contested material):
${assertions.map((a) => `- ${a.actor ?? "unknown actor"} (${a.stance}): ${a.label}`).join("\n") || "(none)"}

NEUTRAL FACTS (sample):
${facts.map((f) => `- ${f.label}`).join("\n") || "(none)"}

OPEN INQUIRY THREADS:
${threads.map((t) => `- ${t.question}`).join("\n") || "(none)"}`;

  return { totalNodes, text };
}

async function llmPropose(env: Env, userId: string, graphSummary: string): Promise<Proposal[]> {
  const out = await callRole(env, "writer", {
    userId,
    system: `You are CANOPTICON's research-assistant proposer. Given a knowledge-graph summary, propose 3-7 specific, well-shaped publishable outputs the operator should build next — across BOTH layers:

FACTUAL arrangements (neutral, unsigned): definition | comparison | timeline | faq | stat-roundup | entity-profile | claim-table
INTERPRETIVE intents (signed readings): investigation | argument | assessment

VALUE CRITERIA (every proposal must pass ALL of these):
1. THE CITATION TEST: propose only pages an AI engine or researcher would cite OVER existing general sources. Use your own knowledge of the world as the baseline — if the answer is already well-established public knowledge (a famous politician's signature policy stance, a widely-reported fact), do NOT propose it. The reader gains nothing; the page earns no citations.
2. EXCEPTION: if the graph contains material that COMPLICATES or CONTRADICTS the established public account, propose THAT tension explicitly ("X is known for Y — but the record shows Z").
3. INVESTIGATIONS target a genuine unresolved tension IN THE GRAPH: contradicting assertions, a gap between what an actor asserts and what the facts show, or an open inquiry thread. "What is X's stance on Y?" is a lookup, not an investigation — never propose it as one.
4. PUT THE QUESTION WHERE THE TENSION IS. If actor A claims they neutralized actor B's attack, the question is "did A actually neutralize it?" — not "what is B's position?".

Rules:
- Each proposal must be grounded in the ACTUAL graph material shown — name the entities/assertions/threads it builds on in your reasoning.
- A claim-table proposal is warranted whenever there are attributed assertions (it makes the contested material visible neutrally).
- Titles are reader-facing ("Timeline: ...", "Does Y's stated rationale hold up?").
- Score each proposal's "novelty" 1-5: 5 = nothing like this exists publicly and the graph uniquely supports it; 1 = the answer is common knowledge. Be harsh — proposals scoring below 3 are discarded mechanically.
- Return ONLY JSON: {"proposals":[{"title","slug","content_type","reasoning_md","novelty"}]}. slug = lowercase-hyphenated.`,
    messages: [{ role: "user", content: [{ type: "text", text: graphSummary }] }],
    max_tokens: 2500,
    response_schema: {
      type: "object",
      properties: {
        proposals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              slug: { type: "string" },
              content_type: { type: "string" },
              reasoning_md: { type: "string" },
              novelty: { type: "number" },
            },
            required: ["title", "slug", "content_type", "reasoning_md", "novelty"],
          },
        },
      },
      required: ["proposals"],
    },
  });

  let root: unknown = out.structured;
  if (root == null && out.text) {
    try {
      root = JSON.parse(out.text);
    } catch {
      const fence = out.text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence?.[1]) {
        try {
          root = JSON.parse(fence[1]);
        } catch {
          root = null;
        }
      }
    }
  }
  const obj = (root ?? {}) as { proposals?: unknown };
  const arr = Array.isArray(obj.proposals) ? obj.proposals : [];
  return arr
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => ({
      title: String(p.title ?? "").slice(0, 200),
      slug: String(p.slug ?? ""),
      content_type: String(p.content_type ?? "").toLowerCase(),
      layer: "",
      reasoning_md: String(p.reasoning_md ?? "").slice(0, 2000),
      novelty: Number(p.novelty ?? 0),
    }))
    .filter((p) => p.title && p.content_type)
    // Novelty floor — the model is told scores below 3 are discarded; hold it
    // to that mechanically. Missing/invalid scores are treated as failing.
    .filter((p) => p.novelty >= 3);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
