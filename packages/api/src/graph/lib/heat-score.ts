// Heat scorer — computes a 0–1 "importance" score for a person entity.
// Used by the cascade to decide who deserves auto-promotion into a
// first-class character profile (threshold >= 0.6).
//
// All signals are additive and capped at 1.0. The score is recomputed
// (debounced once per cascade) when new claims arrive that mention an
// entity, then written back to `entities.heat_score`.

import type { Env } from "../../env";
import { all, one, parseJson, run } from "../../lib/d1";
import { wikipediaSearch } from "../tools/web_research";

// Heat thresholds and weights — tuned so a person who is named in source
// titles, has a recognizable role, and matches a Wikipedia page lands
// well above the 0.6 promotion cut.
export const PROMOTION_THRESHOLD = 0.6;

const W_MENTION_MAX = 0.4; // saturates around 10 mentions
const W_ROLE = 0.2;
const W_WIKIPEDIA = 0.2;
const W_THESIS = 0.1;
const W_TITLE_POSITION = 0.1;
const W_RELATION_DEPTH = 0.1;

const ROLE_RE =
  /\b(governor|minister|secretary|premier|prime minister|president|chair|chairman|chairwoman|chief executive|ceo|cfo|coo|cto|chancellor|mp|mpp|mla|director|deputy|ambassador|judge|justice|commissioner|speaker|leader of the opposition)\b/i;

interface HeatBreakdown {
  total: number;
  mention_contribution: number;
  role_contribution: number;
  wikipedia_contribution: number;
  thesis_contribution: number;
  title_contribution: number;
  relation_contribution: number;
  mention_count: number;
  wikipedia_url?: string;
  role_matched?: string;
}

interface EntityRow {
  id: string;
  canonical_name: string;
  entity_type: string;
  metadata: string | null;
  is_character?: number;
}

interface MetadataShape {
  wikipedia_checked_at?: string;
  wikipedia_url?: string;
  wikipedia_match?: string;
  heat_breakdown?: HeatBreakdown;
  [k: string]: unknown;
}

/** Compute heat score from current substrate state. Pure read except for
 *  the Wikipedia probe, which writes its result into `entities.metadata`
 *  to avoid hammering Wikipedia on every recompute. */
export async function computeHeatScore(
  env: Env,
  userId: string,
  entityId: string,
): Promise<HeatBreakdown> {
  const entity = await one<EntityRow>(
    env.DB,
    "SELECT id, canonical_name, entity_type, metadata FROM entities WHERE id = ? AND user_id = ?",
    [entityId, userId],
  );
  if (!entity) {
    return zeroBreakdown();
  }
  const metadata = parseJson<MetadataShape>(entity.metadata, {});

  // 1) Mention count across claim_entities (saturating).
  const mentionRow = await one<{ n: number }>(
    env.DB,
    "SELECT COUNT(*) AS n FROM claim_entities WHERE entity_id = ? AND user_id = ?",
    [entityId, userId],
  );
  const mentionCount = Number(mentionRow?.n ?? 0);
  // saturating curve: 1 - exp(-x/4) ≈ 0.4 at 10 mentions.
  const mentionContribution = W_MENTION_MAX * (1 - Math.exp(-mentionCount / 4));

  // 2) Role context — scan recent claim versions mentioning this entity.
  let roleContribution = 0;
  let roleMatched: string | undefined;
  if (entity.entity_type === "person") {
    const claimRows = await all<{ claim_text: string }>(
      env.DB,
      `SELECT cv.claim_text FROM claim_entities ce
         JOIN claims c ON c.id = ce.claim_id
         JOIN claim_versions cv ON cv.id = c.current_version_id
        WHERE ce.entity_id = ? AND ce.user_id = ?
        ORDER BY cv.created_at DESC LIMIT 20`,
      [entityId, userId],
    );
    for (const row of claimRows) {
      const m = ROLE_RE.exec(row.claim_text ?? "");
      if (m) {
        roleContribution = W_ROLE;
        roleMatched = m[1];
        break;
      }
    }
  }

  // 3) Wikipedia eligibility — cached so we don't re-probe on every claim.
  let wikipediaContribution = 0;
  let wikipediaUrl = metadata.wikipedia_url;
  const cachedAt = metadata.wikipedia_checked_at
    ? Date.parse(metadata.wikipedia_checked_at)
    : null;
  const STALE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
  const cacheFresh = cachedAt && Date.now() - cachedAt < STALE_MS;
  if (cacheFresh) {
    if (metadata.wikipedia_url) wikipediaContribution = W_WIKIPEDIA;
  } else if (entity.entity_type === "person") {
    const probe = await probeWikipedia(env, entity.canonical_name);
    metadata.wikipedia_checked_at = new Date().toISOString();
    if (probe) {
      metadata.wikipedia_url = probe.url;
      metadata.wikipedia_match = probe.title;
      wikipediaUrl = probe.url;
      wikipediaContribution = W_WIKIPEDIA;
    } else {
      delete metadata.wikipedia_url;
      delete metadata.wikipedia_match;
    }
  }

  // 4) Active thesis involvement.
  const thesisRow = await one<{ n: number }>(
    env.DB,
    `SELECT COUNT(DISTINCT tc.thesis_version_id) AS n
       FROM thesis_claims tc
       JOIN claim_entities ce ON ce.claim_id = tc.claim_id
       JOIN theses t ON t.current_version_id = tc.thesis_version_id
      WHERE ce.entity_id = ? AND ce.user_id = ? AND t.archived_at IS NULL`,
    [entityId, userId],
  );
  const thesisContribution = (thesisRow?.n ?? 0) > 0 ? W_THESIS : 0;

  // 5) Title-position bonus: named in any source title.
  const titleRow = await one<{ n: number }>(
    env.DB,
    `SELECT COUNT(DISTINCT s.id) AS n
       FROM sources s
       JOIN claims c ON c.id IN (
         SELECT claim_id FROM claim_sources WHERE source_id = s.id
       )
       JOIN claim_entities ce ON ce.claim_id = c.id
      WHERE ce.entity_id = ? AND ce.user_id = ?
        AND lower(s.title) LIKE '%' || lower(?) || '%'`,
    [entityId, userId, entity.canonical_name],
  );
  const titleContribution = (titleRow?.n ?? 0) > 0 ? W_TITLE_POSITION : 0;

  // 6) Relation depth — connected to other entities that are already
  //    heat >= 0.5. Cheap query using the existing entity_relations table.
  const relationRow = await one<{ n: number }>(
    env.DB,
    `SELECT COUNT(*) AS n FROM entity_relations er
       JOIN entities e ON e.id = CASE
           WHEN er.from_entity_id = ? THEN er.to_entity_id
           ELSE er.from_entity_id END
      WHERE er.user_id = ? AND (er.from_entity_id = ? OR er.to_entity_id = ?)
        AND e.heat_score >= 0.5`,
    [entityId, userId, entityId, entityId],
  );
  const relationContribution = (relationRow?.n ?? 0) > 0 ? W_RELATION_DEPTH : 0;

  const total = Math.min(
    1,
    mentionContribution +
      roleContribution +
      wikipediaContribution +
      thesisContribution +
      titleContribution +
      relationContribution,
  );

  const breakdown: HeatBreakdown = {
    total,
    mention_contribution: mentionContribution,
    role_contribution: roleContribution,
    wikipedia_contribution: wikipediaContribution,
    thesis_contribution: thesisContribution,
    title_contribution: titleContribution,
    relation_contribution: relationContribution,
    mention_count: mentionCount,
    ...(wikipediaUrl ? { wikipedia_url: wikipediaUrl } : {}),
    ...(roleMatched ? { role_matched: roleMatched } : {}),
  };
  metadata.heat_breakdown = breakdown;

  await run(
    env.DB,
    "UPDATE entities SET heat_score = ?, metadata = ?, updated_at = ? WHERE id = ?",
    [total, JSON.stringify(metadata), new Date().toISOString(), entityId],
  );

  return breakdown;
}

/** Recompute heat for every person entity mentioned by claims under the
 *  given source. Auto-promotes entities crossing the threshold. Returns
 *  the list of entities that were newly promoted this run so the caller
 *  can fire the character_updater on each. */
export async function recomputeHeatForSource(
  env: Env,
  userId: string,
  sourceId: string,
): Promise<{ recomputed: string[]; promoted: string[] }> {
  const entities = await all<{ entity_id: string }>(
    env.DB,
    `SELECT DISTINCT ce.entity_id
       FROM claim_entities ce
       JOIN claim_sources cs ON cs.claim_id = ce.claim_id
       JOIN entities e ON e.id = ce.entity_id
      WHERE cs.source_id = ? AND ce.user_id = ? AND e.entity_type = 'person'`,
    [sourceId, userId],
  );
  const recomputed: string[] = [];
  const promoted: string[] = [];
  for (const { entity_id } of entities) {
    const before = await one<{ is_character: number }>(
      env.DB,
      "SELECT is_character FROM entities WHERE id = ?",
      [entity_id],
    );
    const wasCharacter = before?.is_character === 1;
    const breakdown = await computeHeatScore(env, userId, entity_id);
    recomputed.push(entity_id);
    if (!wasCharacter && breakdown.total >= PROMOTION_THRESHOLD) {
      promoted.push(entity_id);
    }
  }
  return { recomputed, promoted };
}

async function probeWikipedia(
  env: Env,
  name: string,
): Promise<{ url: string; title: string } | null> {
  try {
    // Reuse the wikipedia_search tool's underlying behaviour: top match,
    // first hit. We re-implement the HTTP call here to avoid pulling in
    // the full tool exec signature (env-only, no user context needed).
    void wikipediaSearch;
    const url = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(name)}&limit=1`;
    const r = await fetch(url, { headers: { "user-agent": "Canopticon/1.0 (heat-score)" } });
    if (!r.ok) return null;
    const data = (await r.json()) as { pages?: Array<{ title: string; key: string }> };
    const hit = data.pages?.[0];
    if (!hit) return null;
    // Require the canonical name to appear in the page title (loose
    // substring) to avoid false positives from disambiguation.
    const firstWord = name.toLowerCase().split(/\s+/)[0] ?? "";
    if (firstWord && !hit.title.toLowerCase().includes(firstWord)) {
      return null;
    }
    return {
      title: hit.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.key)}`,
    };
  } catch {
    return null;
  }
  // env unused here; kept in signature for future per-language config.
  void env;
}

function zeroBreakdown(): HeatBreakdown {
  return {
    total: 0,
    mention_contribution: 0,
    role_contribution: 0,
    wikipedia_contribution: 0,
    thesis_contribution: 0,
    title_contribution: 0,
    relation_contribution: 0,
    mention_count: 0,
  };
}
