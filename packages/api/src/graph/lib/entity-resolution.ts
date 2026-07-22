// Entity resolution — consolidates fragmented entity nodes onto one
// canonical node per real-world thing, before autoseed/theme/draft-reading
// ever see the graph.
//
// The gap this closes: extraction pulls names verbatim from text, so
// "Mark Carney" mentioned across 20 documents (or "Carney" after the first
// mention, or "PBO" standing in for "the Parliamentary Budget Officer")
// creates a SEPARATE nodes row every time, each carrying only the handful
// of quotes/edges from that one extraction. autoseed-pages.ts already
// folds short names into long ones so they don't get separate PAGES (see
// its isAliasOf) — but that's page-level only: it picks ONE node id to be
// `pages.subject_node_id` and leaves the rest of the evidence (quotes,
// edges, assertions) sitting on the OTHER, now-orphaned node rows.
// draft-reading.ts's MIN_QUOTES check only counts quotes on that ONE node
// id, so a subject that's genuinely well-documented across many mentions
// can still look under-quoted to every downstream step. This is why only
// one reading had drafted despite 15,000+ nodes and 3,700+ quotes: the
// evidence was real but fragmented, never actually pooled onto one node.
//
// Three merge rules, ordered from zero-risk to highest-risk, ALL
// unambiguous-only — anything not clearly one of these is left alone
// rather than guessed at. A wrong merge here (conflating two different
// real people or companies) is a real trust violation for a forensic
// record; being conservative and leaving genuine ambiguity unresolved is
// the correct failure mode, not a compromise.
//
//   1. exact-duplicate — same label (case/whitespace-normalized). Zero
//      ambiguity: it's the identical string.
//   2. alias-fold — one label is a whole-word subset of exactly one other
//      ("Carney" -> "Mark Carney", "Poilievre" -> "Pierre Poilievre").
//      Reuses the exact isAliasOf logic already proven in
//      autoseed-pages.ts. Skipped if the short name could fold into MORE
//      THAN ONE longer name (ambiguous — e.g. two different Fords).
//   3. acronym — a 2-6 letter all-caps label whose letters are EXACTLY the
//      initials of exactly one other label's significant words ("PBO" ->
//      "Parliamentary Budget Officer", "BIS" -> "Bank for International
//      Settlements"). Skipped if more than one candidate matches.
//
// Merging redirects every foreign-key reference to the alias node (edges,
// quotes, assertions, node_props, and the alias's own page row if
// autoseed already created one) onto the canonical node, then deletes the
// now-unreferenced alias node. entity_merges (migration 0034) keeps a
// permanent, readable audit trail of what was merged and why, since the
// alias node itself won't exist to inspect afterward.

import type { Env } from "../../env";
import { all, insertOne, run } from "../../lib/d1";

export interface EntityResolutionReport {
  examined: number;
  merged: number;
  errors: string[];
}

interface EntityNode {
  id: string;
  label: string;
  created_at: string;
}

// Each merge is 7 sequential D1 writes (mergeNode below). On a large graph
// (this corpus: 14,000+ nodes) a single run can find hundreds of merge
// candidates, and hundreds of merges' worth of sequential D1 round trips is
// enough on its own to exceed the execution ceiling — confirmed live: the
// settle pipeline's own "advance to the next step" write never ran because
// resolveEntities itself never finished, invocation after invocation
// (node count kept dropping between checks, meaning real merge work WAS
// happening, just never completing). Capped like every other settle step
// now: do a bounded batch, return, let the next invocation pick up the
// rest — the candidate query re-scans fresh each time so nothing is lost,
// only deferred.
const MAX_MERGES_PER_RUN = 40;

export async function resolveEntities(env: Env, userId: string): Promise<EntityResolutionReport> {
  const report: EntityResolutionReport = { examined: 0, merged: 0, errors: [] };

  const nodes = await all<EntityNode>(
    env.DB,
    `SELECT id, label, created_at FROM nodes
      WHERE user_id = ? AND kind = 'entity' AND label IS NOT NULL AND label != ''
      ORDER BY created_at ASC`,
    [userId],
  ).catch(() => []);
  report.examined = nodes.length;
  if (nodes.length < 2) return report;

  // canonical (normalized label) -> the list of node rows still standing
  // for it as merging proceeds. Starts one group per distinct node; exact
  // duplicates collapse into groups immediately below.
  const groups = new Map<string, EntityNode[]>();
  for (const n of nodes) {
    const key = canonicalize(n.label);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(n);
    groups.set(key, list);
  }

  // Rule 1 — exact duplicates. Oldest node in the group survives as
  // canonical (it's the one most likely already linked from elsewhere).
  outer: for (const [, group] of groups) {
    if (group.length < 2) continue;
    const canonical = group[0];
    if (!canonical) continue;
    for (const alias of group.slice(1)) {
      if (report.merged >= MAX_MERGES_PER_RUN) break outer;
      try {
        await mergeNode(env, userId, canonical.id, canonical.label, alias, "exact-duplicate");
        report.merged++;
      } catch (err) {
        report.errors.push(`${alias.label} -> ${canonical.label}: ${(err as Error).message}`);
      }
    }
  }
  if (report.merged >= MAX_MERGES_PER_RUN) return report;

  // One representative node per surviving canonical label, for rules 2+3.
  const survivors = [...groups.entries()]
    .map(([key, group]) => ({ key, node: group[0] }))
    .filter((s): s is { key: string; node: EntityNode } => !!s.node);

  // Rule 2 — alias fold (short name is a whole-word subset of exactly one
  // longer name). Longest labels first so "Mark Carney" is a fold TARGET
  // before a shorter fragment is considered against it.
  const byLengthDesc = [...survivors].sort((a, b) => b.key.length - a.key.length);
  const merged = new Set<string>(); // canonical keys already folded away
  for (const { key: shortKey, node: aliasNode } of byLengthDesc) {
    if (report.merged >= MAX_MERGES_PER_RUN) break;
    if (merged.has(shortKey)) continue;
    const candidates = byLengthDesc.filter(
      (c) => !merged.has(c.key) && c.key !== shortKey && isAliasOf(shortKey, c.key),
    );
    if (candidates.length !== 1) continue; // no match, or ambiguous — skip
    const target = candidates[0];
    if (!target) continue;
    try {
      await mergeNode(env, userId, target.node.id, target.node.label, aliasNode, "alias-fold");
      merged.add(shortKey);
      report.merged++;
    } catch (err) {
      report.errors.push(`${aliasNode.label} -> ${target.node.label}: ${(err as Error).message}`);
    }
  }
  if (report.merged >= MAX_MERGES_PER_RUN) return report;

  // Rule 3 — acronym match, over whatever survived rules 1+2.
  const remaining = survivors.filter((s) => !merged.has(s.key));
  for (const { key: acronymKey, node: aliasNode } of remaining) {
    if (report.merged >= MAX_MERGES_PER_RUN) break;
    if (!looksLikeAcronym(aliasNode.label)) continue;
    const letters = aliasNode.label.trim().toUpperCase();
    const candidates = remaining.filter(
      (c) => c.key !== acronymKey && !merged.has(c.key) && initialsOf(c.node.label) === letters,
    );
    if (candidates.length !== 1) continue; // no match, or ambiguous — skip
    const target = candidates[0];
    if (!target) continue;
    try {
      await mergeNode(env, userId, target.node.id, target.node.label, aliasNode, "acronym");
      merged.add(acronymKey);
      report.merged++;
    } catch (err) {
      report.errors.push(`${aliasNode.label} -> ${target.node.label}: ${(err as Error).message}`);
    }
  }

  return report;
}

async function mergeNode(
  env: Env,
  userId: string,
  canonicalId: string,
  canonicalLabel: string,
  alias: EntityNode,
  method: string,
): Promise<void> {
  if (alias.id === canonicalId) return;

  await insertOne(env.DB, "entity_merges", {
    user_id: userId,
    canonical_node_id: canonicalId,
    canonical_label: canonicalLabel,
    alias_label: alias.label,
    method,
  });

  // The alias may already have its own autoseeded page (pages_subject_idx
  // is unique per subject_node_id, so the canonical keeping its own page
  // means the alias's page — if any — has to go, not merge).
  await run(env.DB, "DELETE FROM pages WHERE subject_node_id = ?", [alias.id]);

  await run(env.DB, "UPDATE edges SET src_node_id = ? WHERE src_node_id = ?", [
    canonicalId,
    alias.id,
  ]);
  await run(env.DB, "UPDATE edges SET dst_node_id = ? WHERE dst_node_id = ?", [
    canonicalId,
    alias.id,
  ]);
  await run(env.DB, "UPDATE quotes SET node_id = ? WHERE node_id = ?", [canonicalId, alias.id]);
  await run(env.DB, "UPDATE quotes SET source_id = ? WHERE source_id = ?", [canonicalId, alias.id]);
  await run(env.DB, "UPDATE assertions SET node_id = ? WHERE node_id = ?", [canonicalId, alias.id]);
  await run(env.DB, "UPDATE assertions SET asserted_by_node_id = ? WHERE asserted_by_node_id = ?", [
    canonicalId,
    alias.id,
  ]);
  await run(env.DB, "UPDATE node_props SET node_id = ? WHERE node_id = ?", [canonicalId, alias.id]);

  await run(env.DB, "DELETE FROM nodes WHERE id = ?", [alias.id]);
}

// ---------------------------------------------------------------------------
// Matching rules — pure, deterministic, no LLM. False positives here are a
// correctness bug in a forensic record, not a quality nit, so every rule
// below is designed to return "no match" on anything it isn't sure about.
// ---------------------------------------------------------------------------

export function canonicalize(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

// Identical to autoseed-pages.ts's isAliasOf — true when `short` is a
// whole-word subset of `long` ("carney" folds into "mark carney"). Kept as
// its own copy rather than a shared import: the two call sites operate on
// different collections (page-eligible labels vs. every entity node) and
// diverging later shouldn't require unpicking a shared dependency.
export function isAliasOf(short: string, long: string): boolean {
  if (short === long || short.length >= long.length) return false;
  const longWords = new Set(long.split(/\s+/).filter(Boolean));
  const shortWords = short.split(/\s+/).filter(Boolean);
  if (shortWords.length === 0 || shortWords.length >= longWords.size) return false;
  if (shortWords.length === 1 && (shortWords[0]?.length ?? 0) < 4) return false;
  return shortWords.every((w) => longWords.has(w));
}

export function looksLikeAcronym(label: string): boolean {
  return /^[A-Z]{2,6}$/.test(label.trim());
}

const INITIAL_STOPWORDS = new Set(["the", "of", "and", "for", "a", "an", "in", "on", "to"]);

// "Bank for International Settlements" -> "BIS" (stopwords skipped so "for"
// doesn't count toward the initials).
export function initialsOf(label: string): string {
  return label
    .split(/\s+/)
    .filter((w) => w.length > 0 && !INITIAL_STOPWORDS.has(w.toLowerCase()))
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
