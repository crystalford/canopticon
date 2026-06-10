// Surfacing Intelligence Engine — canonical-spec v2.4 Part 17.
//
// Level 1 (deterministic, cheap, runs after every extraction): mechanical,
// verifiable operations over the typed graph — no LLM judgment.
//   - evidence-balance per assertion (supporting vs contradicting evidential
//     edges) -> assertions.evidence_balance; both-sides-nontrivial -> rank
//     'contested' (the gray area, shown AS gray — the firewall's data source)
//   - contradiction candidates: evidential 'contradicts'/'rebuts' edges ->
//     patterns rows (kind 'contradiction')
//   - connection detection: entities co-appearing across >=2 source pieces ->
//     patterns rows (kind 'connection')
//
// Level 2 (ambitious, deliberate trigger): the system assembles a VERIFIED
// subgraph; the high-effort reasoning model proposes candidate patterns.
// MANDATORY VERIFICATION: every node id the model cites is checked against
// the graph; insights citing unverifiable ids are DISCARDED (LLMs hallucinate
// graph structure — the model interprets, never traverses).
//
// Naive frequency promotion is rejected (spec): meaning lives in structure
// and stance, not repetition counts.

import type { Env } from "../../env";
import { all, insertOne, one, run } from "../../lib/d1";
import { callRole } from "../../llm/router";

export interface SurfacingReport {
  balances_updated: number;
  contested: number;
  contradictions: number;
  connections: number;
  l2_candidates: number;
  l2_discarded: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Level 1 — deterministic
// ---------------------------------------------------------------------------

export async function runSurfacingL1(env: Env, userId: string): Promise<SurfacingReport> {
  const report: SurfacingReport = {
    balances_updated: 0,
    contested: 0,
    contradictions: 0,
    connections: 0,
    l2_candidates: 0,
    l2_discarded: 0,
    errors: [],
  };

  // ---- evidence balance per assertion ----
  // supports/corroborates = +weight; contradicts/rebuts/undercuts = -weight.
  try {
    const balances = await all<{ node_id: string; balance: number; pos: number; neg: number }>(
      env.DB,
      `SELECT a.node_id,
              COALESCE(SUM(CASE WHEN e.edge_type IN ('supports','corroborates') THEN e.weight ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN e.edge_type IN ('contradicts','rebuts','undercuts') THEN e.weight ELSE 0 END), 0) AS balance,
              COALESCE(SUM(CASE WHEN e.edge_type IN ('supports','corroborates') THEN 1 ELSE 0 END), 0) AS pos,
              COALESCE(SUM(CASE WHEN e.edge_type IN ('contradicts','rebuts','undercuts') THEN 1 ELSE 0 END), 0) AS neg
         FROM assertions a
         LEFT JOIN edges e ON e.dst_node_id = a.node_id AND e.family = 'evidential'
        WHERE a.node_id IN (SELECT id FROM nodes WHERE user_id = ?)
        GROUP BY a.node_id`,
      [userId],
    );
    for (const b of balances) {
      // Contested = nontrivial evidence on BOTH sides (the gray area).
      const contested = b.pos > 0 && b.neg > 0;
      await run(
        env.DB,
        "UPDATE assertions SET evidence_balance = ?, rank = ?, updated_at = ? WHERE node_id = ?",
        [b.balance, contested ? "contested" : "normal", new Date().toISOString(), b.node_id],
      );
      report.balances_updated++;
      if (contested) report.contested++;
    }
  } catch (err) {
    report.errors.push(`balance: ${(err as Error).message}`);
  }

  // ---- contradiction candidates -> patterns ----
  try {
    const contradictions = await all<{
      src_label: string;
      dst_label: string;
      src_id: string;
      dst_id: string;
    }>(
      env.DB,
      `SELECT s.label AS src_label, d.label AS dst_label, s.id AS src_id, d.id AS dst_id
         FROM edges e
         JOIN nodes s ON s.id = e.src_node_id
         JOIN nodes d ON d.id = e.dst_node_id
        WHERE e.user_id = ? AND e.family = 'evidential'
          AND e.edge_type IN ('contradicts','rebuts','undercuts')
        LIMIT 25`,
      [userId],
    );
    for (const c of contradictions) {
      const slug = `contradiction-${shortHash(c.src_id + c.dst_id)}`;
      const upserted = await upsertPattern(env, userId, {
        slug,
        kind: "contradiction",
        title: `Contradiction: "${c.src_label.slice(0, 60)}" vs "${c.dst_label.slice(0, 60)}"`,
        statement_md: `The graph holds contradicting material:\n\n- **A:** ${c.src_label}\n- **B:** ${c.dst_label}\n\nSurfaced deterministically from an evidential \`contradicts\` edge (Level 1). Verify the underlying quotes before treating either side as settled.`,
        confidence: "medium",
      });
      if (upserted) report.contradictions++;
    }
  } catch (err) {
    report.errors.push(`contradictions: ${(err as Error).message}`);
  }

  // ---- connection detection: entities spanning >=2 pieces ----
  try {
    const connections = await all<{ label: string; pieces: number }>(
      env.DB,
      `SELECT label, COUNT(DISTINCT piece_id) AS pieces
         FROM nodes
        WHERE user_id = ? AND kind = 'entity' AND piece_id IS NOT NULL
        GROUP BY lower(label)
        HAVING pieces >= 2
        ORDER BY pieces DESC LIMIT 15`,
      [userId],
    );
    for (const c of connections) {
      const slug = `connection-${slugify(c.label)}`;
      const upserted = await upsertPattern(env, userId, {
        slug,
        kind: "connection",
        title: `Cross-document presence: ${c.label}`,
        statement_md: `**${c.label}** appears in ${c.pieces} separate source documents — a structural bridge in the corpus. Worth an entity profile or an investigation into its role across contexts.`,
        confidence: c.pieces >= 4 ? "high" : "medium",
      });
      if (upserted) report.connections++;
    }
  } catch (err) {
    report.errors.push(`connections: ${(err as Error).message}`);
  }

  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "surfacing.l1.completed",
    subject_kind: "graph",
    subject_id: null,
    payload: { ...report, errors: report.errors.slice(0, 3) },
  }).catch(() => {});

  return report;
}

// ---------------------------------------------------------------------------
// Level 2 — ambitious (verified subgraph -> reasoning model -> verification)
// ---------------------------------------------------------------------------

export async function runSurfacingL2(env: Env, userId: string): Promise<SurfacingReport> {
  const report: SurfacingReport = {
    balances_updated: 0,
    contested: 0,
    contradictions: 0,
    connections: 0,
    l2_candidates: 0,
    l2_discarded: 0,
    errors: [],
  };

  // Assemble the verified subgraph deterministically (the model never
  // traverses the graph itself).
  const nodes = await all<{ id: string; kind: string; label: string }>(
    env.DB,
    `SELECT n.id, n.kind, n.label FROM nodes n
      WHERE n.user_id = ? AND n.kind != 'source'
      ORDER BY (SELECT COUNT(*) FROM edges e WHERE e.src_node_id = n.id OR e.dst_node_id = n.id) DESC
      LIMIT 80`,
    [userId],
  );
  if (nodes.length < 5) {
    report.errors.push("graph too small for Level 2 analysis");
    return report;
  }
  const nodeIds = new Set(nodes.map((n) => n.id));
  const ph = [...nodeIds].map(() => "?").join(",");
  const edges = await all<{ src: string; dst: string; edge_type: string; family: string }>(
    env.DB,
    `SELECT src_node_id AS src, dst_node_id AS dst, edge_type, family
       FROM edges WHERE user_id = ? AND src_node_id IN (${ph}) AND dst_node_id IN (${ph})
       LIMIT 200`,
    [userId, ...nodeIds, ...nodeIds],
  );

  const subgraph = `NODES:\n${nodes.map((n) => `${n.id} | ${n.kind} | ${n.label.slice(0, 140)}`).join("\n")}\n\nEDGES:\n${edges.map((e) => `${e.src} -[${e.family}:${e.edge_type}]-> ${e.dst}`).join("\n")}`;

  let candidates: Array<{
    title: string;
    statement_md: string;
    cited_node_ids: string[];
    confidence: string;
    open_question?: string | undefined;
  }> = [];
  try {
    const out = await callRole(env, "surfacing_ambitious", {
      userId,
      system: `You are an intelligence analyst examining a VERIFIED knowledge subgraph. Propose 1-4 candidate patterns or assessments a human may not have flagged — recurring structures, suspicious alignments, gaps between what actors assert and what the facts show. ACH discipline: consider competing explanations; seek disconfirmation; separate the information from your judgment.

HARD RULE: cite evidence ONLY as node ids from the NODES list. Insights citing ids not in the list are discarded mechanically. Return ONLY JSON:
{"candidates":[{"title","statement_md","cited_node_ids":["..."],"confidence":"low|medium|high","open_question":"optional follow-up question"}]}`,
      messages: [{ role: "user", content: [{ type: "text", text: subgraph }] }],
      max_tokens: 3000,
    });
    let root: unknown = out.structured;
    if (root == null && out.text) {
      try {
        root = JSON.parse(out.text);
      } catch {
        const fence = out.text.match(/```(?:json)?\s*([\s\S]*?)```/);
        root = fence?.[1] ? JSON.parse(fence[1]) : null;
      }
    }
    const arr = ((root ?? {}) as { candidates?: unknown[] }).candidates;
    candidates = (Array.isArray(arr) ? arr : [])
      .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
      .map((c) => ({
        title: String(c.title ?? "").slice(0, 180),
        statement_md: String(c.statement_md ?? "").slice(0, 3000),
        cited_node_ids: Array.isArray(c.cited_node_ids)
          ? c.cited_node_ids.filter((x): x is string => typeof x === "string")
          : [],
        confidence: ["low", "medium", "high"].includes(String(c.confidence))
          ? String(c.confidence)
          : "low",
        open_question: typeof c.open_question === "string" ? c.open_question : undefined,
      }))
      .filter((c) => c.title && c.statement_md);
  } catch (err) {
    report.errors.push(`l2: ${(err as Error).message}`);
    return report;
  }

  // MANDATORY VERIFICATION: discard any candidate citing an unknown node id,
  // and require a minimum evidential basis (>=2 verified citations).
  for (const c of candidates) {
    const verified = c.cited_node_ids.filter((id) => nodeIds.has(id));
    if (verified.length < 2 || verified.length < c.cited_node_ids.length) {
      report.l2_discarded++;
      continue;
    }
    const citedLabels = verified
      .map((id) => nodes.find((n) => n.id === id)?.label ?? id)
      .slice(0, 6);
    const slug = `l2-${slugify(c.title)}`;
    const upserted = await upsertPattern(env, userId, {
      slug,
      kind: "other",
      title: c.title,
      statement_md: `${c.statement_md}\n\n---\n*Level 2 candidate (reasoning model over a verified subgraph). Verified citations: ${citedLabels.map((l) => `“${l.slice(0, 60)}”`).join(" · ")}. Confidence: ${c.confidence}. Treat as a CANDIDATE insight pending operator judgment.*`,
      confidence: c.confidence,
    });
    if (upserted) report.l2_candidates++;
    // Open questions become inquiry threads — the engine feeds the loop.
    if (c.open_question) {
      await insertOne(env.DB, "inquiry_threads", {
        user_id: userId,
        question: c.open_question.slice(0, 500),
        status: "open",
        related_node_ids: JSON.stringify(verified.slice(0, 8)),
      }).catch(() => {});
    }
  }

  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "surfacing.l2.completed",
    subject_kind: "graph",
    subject_id: null,
    payload: { candidates: report.l2_candidates, discarded: report.l2_discarded },
  }).catch(() => {});

  return report;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function upsertPattern(
  env: Env,
  userId: string,
  p: { slug: string; kind: string; title: string; statement_md: string; confidence: string },
): Promise<boolean> {
  const existing = await one<{ id: string; status: string }>(
    env.DB,
    "SELECT id, status FROM patterns WHERE user_id = ? AND slug = ?",
    [userId, p.slug],
  );
  if (existing) {
    if (existing.status === "candidate") {
      await run(
        env.DB,
        "UPDATE patterns SET title = ?, statement_md = ?, confidence = ?, updated_at = ? WHERE id = ?",
        [p.title, p.statement_md, p.confidence, new Date().toISOString(), existing.id],
      );
    }
    return false;
  }
  await insertOne(env.DB, "patterns", {
    user_id: userId,
    slug: p.slug,
    kind: p.kind,
    title: p.title,
    statement_md: p.statement_md,
    confidence: p.confidence,
    status: "candidate",
  });
  return true;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "x"
  );
}

function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
