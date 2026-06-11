// Theme surfacer — finds what the corpus is engaging with.
//
// A theme is the "received account" the documents are pushing back against.
// Without themes, the system has facts but no orientation; pages can list,
// but pieces can't argue. This is what was missing — the primitive that lets
// writing actually say something.
//
// Surfaced deterministically: when 3+ assertions from different documents
// converge on contradicting the same external proposition, that convergence
// itself is the evidence a theme exists. The model only NAMES the theme
// (writes the received-account string) — it can't invent the convergence.
//
// Runs when the corpus settles (after the last extraction job completes),
// alongside surfacing L1 + the proposer. Idempotent: themes are upserted by
// slug; convergence_count refreshes; previously-surfaced themes that no
// longer have evidence stay (the corpus may speak to them again later).

import type { Env } from "../../env";
import { all, insertOne, one, run } from "../../lib/d1";
import { callRole } from "../../llm/router";

export interface ThemeSurfaceReport {
  themes_surfaced: number;
  themes_updated: number;
  candidates_examined: number;
  errors: string[];
}

const MIN_CONVERGENCE = 3;
const MAX_THEMES_PER_RUN = 6;

interface ConvergenceCandidate {
  // The assertion-node labels and their actors — the raw material the
  // model is asked to interpret. Each entry is a contradicting assertion
  // from a distinct source piece.
  assertions: Array<{
    node_id: string;
    label: string;
    actor: string | null;
    piece_id: string | null;
    quote_id: string | null;
    quote_text: string | null;
  }>;
  // Heuristic centroid label — the most-frequently-cited entity these
  // assertions touch. Names the candidate for the model.
  centroid: string;
}

export async function runThemeSurfacer(env: Env, userId: string): Promise<ThemeSurfaceReport> {
  const report: ThemeSurfaceReport = {
    themes_surfaced: 0,
    themes_updated: 0,
    candidates_examined: 0,
    errors: [],
  };

  let candidates: ConvergenceCandidate[];
  try {
    candidates = await findConvergenceCandidates(env, userId);
  } catch (err) {
    report.errors.push(`convergence: ${(err as Error).message}`);
    return report;
  }
  report.candidates_examined = candidates.length;
  if (candidates.length === 0) return report;

  for (const c of candidates.slice(0, MAX_THEMES_PER_RUN)) {
    try {
      const named = await nameTheme(env, userId, c);
      if (!named) continue;
      const upserted = await upsertTheme(env, userId, named, c);
      if (upserted === "new") report.themes_surfaced++;
      else if (upserted === "updated") report.themes_updated++;
    } catch (err) {
      report.errors.push(`theme: ${(err as Error).message}`);
    }
  }

  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "themes.surfaced",
    subject_kind: "graph",
    subject_id: null,
    payload: report,
  }).catch(() => {});

  return report;
}

// ---------------------------------------------------------------------------
// Step 1: deterministic — find convergence candidates.
//
// An assertion is a candidate centroid if 3+ DIFFERENT source pieces contain
// assertions that share a substantial entity-mention overlap. We group by
// the most-cited entity across each cluster and require cross-piece spread.
// ---------------------------------------------------------------------------
async function findConvergenceCandidates(
  env: Env,
  userId: string,
): Promise<ConvergenceCandidate[]> {
  // Get all assertion nodes with their piece, actor label, and one quote.
  const rows = await all<{
    node_id: string;
    label: string;
    piece_id: string | null;
    actor: string | null;
    quote_id: string | null;
    quote_text: string | null;
  }>(
    env.DB,
    `SELECT n.id AS node_id, n.label, n.piece_id,
            (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS actor,
            (SELECT id FROM quotes WHERE node_id = n.id LIMIT 1) AS quote_id,
            (SELECT verbatim_text FROM quotes WHERE node_id = n.id LIMIT 1) AS quote_text
       FROM nodes n
       JOIN assertions a ON a.node_id = n.id
      WHERE n.user_id = ? AND n.kind = 'assertion'
      ORDER BY n.created_at DESC
      LIMIT 250`,
    [userId],
  );
  if (rows.length < MIN_CONVERGENCE) return [];

  // Cluster by entity centroid: the most-frequent multi-character word in the
  // label that appears in other assertions too. Crude but stable; the model
  // step refines it.
  const centroidIndex = new Map<string, typeof rows>();
  for (const r of rows) {
    const words = (r.label || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !STOPWORDS.has(w));
    const unique = [...new Set(words)];
    for (const w of unique) {
      const list = centroidIndex.get(w) ?? [];
      list.push(r);
      centroidIndex.set(w, list);
    }
  }

  const candidates: ConvergenceCandidate[] = [];
  const seenCentroids = new Set<string>();
  // Sort centroids by cluster size desc so the strongest convergences win.
  const sortedCentroids = [...centroidIndex.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [centroid, cluster] of sortedCentroids) {
    if (cluster.length < MIN_CONVERGENCE) continue;
    // Cross-piece check: must span >=3 distinct source pieces.
    const pieces = new Set(cluster.map((c) => c.piece_id).filter((p): p is string => !!p));
    if (pieces.size < MIN_CONVERGENCE) continue;
    // De-dup against narrower centroids we've already taken.
    if ([...seenCentroids].some((s) => s.includes(centroid) || centroid.includes(s))) continue;
    seenCentroids.add(centroid);

    candidates.push({
      assertions: cluster.slice(0, 10).map((r) => ({
        node_id: r.node_id,
        label: r.label,
        actor: r.actor,
        piece_id: r.piece_id,
        quote_id: r.quote_id,
        quote_text: r.quote_text,
      })),
      centroid,
    });
    if (candidates.length >= MAX_THEMES_PER_RUN * 2) break;
  }
  return candidates;
}

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "around",
  "because",
  "before",
  "being",
  "below",
  "between",
  "could",
  "doing",
  "during",
  "every",
  "first",
  "going",
  "having",
  "might",
  "other",
  "owned",
  "should",
  "since",
  "their",
  "there",
  "these",
  "those",
  "through",
  "under",
  "until",
  "where",
  "which",
  "while",
  "would",
  "their",
  "they",
  "them",
  "this",
  "that",
  "with",
  "from",
  "into",
  "your",
  "claim",
  "asserts",
  "stated",
  "argued",
  "suggests",
]);

// ---------------------------------------------------------------------------
// Step 2: name the theme — what received account is the corpus engaging with?
//
// The model only WRITES the received-account string. It can't invent the
// convergence (we already proved that deterministically) and it can't
// fabricate evidence (the quote ids come from the candidate). The output is
// a one-sentence proposition + a slug.
// ---------------------------------------------------------------------------
interface NamedTheme {
  received_account: string;
  slug: string;
  title: string;
}

async function nameTheme(
  env: Env,
  userId: string,
  candidate: ConvergenceCandidate,
): Promise<NamedTheme | null> {
  const evidence = candidate.assertions
    .slice(0, 8)
    .map(
      (a, i) =>
        `${i + 1}. ${a.actor ? `[${a.actor}]: ` : ""}${a.label}${a.quote_text ? ` — "${a.quote_text.slice(0, 200)}"` : ""}`,
    )
    .join("\n");

  const out = await callRole(env, "writer", {
    userId,
    system: `You name THEMES the corpus is engaging with — the "received accounts" the documents are pushing back against. A theme is NOT a question, a topic, or a summary. It is a specific external proposition the documents complicate.

Given a cluster of assertions from multiple source documents that converge on the same subject, identify what they are arguing AGAINST. The received account is what someone OUTSIDE the corpus would assume, that the corpus complicates.

Examples of good received accounts:
- "Transition finance disclosure regimes are working as intended."
- "Bill C-11 measurably harms Canadian creators' discoverability."
- "Diefenbaker is the model conservative Canadian conservatives should emulate."

Examples of BAD outputs (do not return these):
- "Carney's record" (this is a topic, not a thesis)
- "Is the disclosure regime working?" (this is a question, not an account)
- "Various views on Bill C-11" (this is a summary, not an account)

Return ONLY JSON: {"received_account": "...", "title": "How the corpus engages with [X]", "slug": "lowercase-hyphenated"}. If the assertions are not actually engaging with a coherent received account — they're just a cluster of unrelated claims — return {"received_account": null}.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Cluster centroid: ${candidate.centroid}\n\nConverging assertions from ${new Set(candidate.assertions.map((a) => a.piece_id)).size} different documents:\n\n${evidence}\n\nWhat received account are these pushing back against?`,
          },
        ],
      },
    ],
    max_tokens: 600,
    response_schema: {
      type: "object",
      properties: {
        received_account: { type: ["string", "null"] },
        title: { type: "string" },
        slug: { type: "string" },
      },
      required: ["received_account"],
    },
  });

  const parsed = (out.structured ?? safeParse(out.text)) as {
    received_account?: string | null;
    title?: string;
    slug?: string;
  } | null;
  if (!parsed || !parsed.received_account || !parsed.slug) return null;
  const received_account = parsed.received_account.trim();
  if (received_account.length < 20 || received_account.length > 300) return null;
  // Reject question marks — the rule is "account, not question."
  if (received_account.endsWith("?")) return null;
  return {
    received_account,
    title: (parsed.title ?? `How the corpus engages with ${candidate.centroid}`).slice(0, 200),
    slug: slugify(parsed.slug),
  };
}

// ---------------------------------------------------------------------------
// Step 3: upsert the theme node + the themes row. Idempotent by slug.
// ---------------------------------------------------------------------------
async function upsertTheme(
  env: Env,
  userId: string,
  named: NamedTheme,
  candidate: ConvergenceCandidate,
): Promise<"new" | "updated" | null> {
  // Theme node — kind='theme', piece_id null (themes are cross-document).
  const existingNode = await one<{ id: string }>(
    env.DB,
    `SELECT n.id FROM nodes n
       JOIN themes t ON t.node_id = n.id
      WHERE n.user_id = ?
        AND EXISTS (SELECT 1 FROM pages p WHERE p.subject_node_id = n.id AND p.slug = ?)`,
    [userId, named.slug],
  ).catch(() => null);

  const quoteIds = candidate.assertions.map((a) => a.quote_id).filter((q): q is string => !!q);
  const pieceCount = new Set(candidate.assertions.map((a) => a.piece_id).filter((p) => !!p)).size;

  if (existingNode) {
    await run(
      env.DB,
      "UPDATE themes SET received_account = ?, convergence_count = ?, evidence_quote_ids = ?, updated_at = ? WHERE node_id = ?",
      [
        named.received_account,
        pieceCount,
        JSON.stringify(quoteIds),
        new Date().toISOString(),
        existingNode.id,
      ],
    );
    return "updated";
  }

  const nodeId = await insertOne(env.DB, "nodes", {
    user_id: userId,
    kind: "theme",
    label: named.title,
    metadata: JSON.stringify({ centroid: candidate.centroid }),
  });
  await insertOne(env.DB, "themes", {
    node_id: nodeId,
    received_account: named.received_account,
    convergence_count: pieceCount,
    evidence_quote_ids: JSON.stringify(quoteIds),
  });
  // Page row for the theme (so the unified renderer can find it).
  await insertOne(env.DB, "pages", {
    user_id: userId,
    subject_node_id: nodeId,
    slug: named.slug,
    signed_status: "none",
  });
  return "new";
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "theme"
  );
}
