// Character helpers — seed from Wikipedia, slug builder, promote/demote.
//
// The "auto-promote on heat score" hook in cascade.ts calls seedCharacter
// directly. The chat tools wrap these helpers with operator-facing
// confirm flows for manual override and review.

import type { Env } from "../../env";
import { all, insertOne, one, parseJson, run } from "../../lib/d1";

interface WikiSummary {
  title: string;
  description: string | null;
  extract: string;
  content_urls?: { desktop?: { page?: string } };
  thumbnail?: { source?: string };
}

interface EntityRow {
  id: string;
  canonical_name: string;
  entity_type: string;
  metadata: string | null;
  is_character: number;
}

export interface SeedResult {
  entity_id: string;
  profile_id: string;
  slug: string;
  timeline_events_count: number;
  source: "wikipedia" | "minimal";
}

const ROLE_RE =
  /\b(governor|minister|secretary|premier|prime minister|president|chair|chairman|chairwoman|chief executive|ceo|cfo|coo|cto|chancellor|mp|mpp|mla|director|deputy|ambassador|judge|justice|commissioner|speaker|leader of the opposition)\b/i;

// Year-prefixed lines from Wikipedia extracts (e.g. "In 2013, Carney was
// appointed…") form the seed timeline. We scan for sentences that begin
// with or contain a 4-digit year and pull them as 'context' events.
const YEAR_LINE_RE = /(?:^|\.\s+)([^.]*?\b(19|20)\d{2}\b[^.]*?\.)/g;

/** Build a unique slug from a name. Falls back with a numeric suffix if
 *  the slug is already taken. */
export async function buildUniqueSlug(env: Env, name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  while (await one(env.DB, "SELECT 1 AS one FROM character_profiles WHERE slug = ?", [candidate])) {
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 50) {
      candidate = `${base}-${crypto.randomUUID().slice(0, 6)}`;
      break;
    }
  }
  return candidate;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Promote an entity to character status WITHOUT seeding any content.
 *  Use this when Wikipedia returns nothing — the operator fills in the
 *  bio manually later. */
export async function promoteToCharacter(
  env: Env,
  userId: string,
  entityId: string,
): Promise<SeedResult> {
  const entity = await one<EntityRow>(
    env.DB,
    "SELECT id, canonical_name, entity_type, metadata, is_character FROM entities WHERE id = ? AND user_id = ?",
    [entityId, userId],
  );
  if (!entity) throw new Error("entity not found");
  if (entity.is_character === 1) {
    const existing = await one<{ id: string; slug: string }>(
      env.DB,
      "SELECT id, slug FROM character_profiles WHERE entity_id = ?",
      [entityId],
    );
    if (existing) {
      return {
        entity_id: entityId,
        profile_id: existing.id,
        slug: existing.slug,
        timeline_events_count: 0,
        source: "minimal",
      };
    }
  }

  const slug = await buildUniqueSlug(env, entity.canonical_name);
  const now = new Date().toISOString();
  const profileId = await insertOne(env.DB, "character_profiles", {
    user_id: userId,
    entity_id: entityId,
    canonical_name: entity.canonical_name,
    slug,
    bio_md: `# ${entity.canonical_name}\n\n(No biographical summary yet. Use the operator UI to write one.)`,
    visibility: "public",
  });
  await run(env.DB, "UPDATE entities SET is_character = 1, auto_promoted_at = ? WHERE id = ?", [
    now,
    entityId,
  ]);
  return {
    entity_id: entityId,
    profile_id: profileId,
    slug,
    timeline_events_count: 0,
    source: "minimal",
  };
}

/** Seed a character profile from Wikipedia. Falls back to promote-only
 *  if no matching page exists. Idempotent — re-running on an existing
 *  character refreshes the bio. */
export async function seedCharacterFromWikipedia(
  env: Env,
  userId: string,
  entityId: string,
  opts: { wikipediaTitle?: string } = {},
): Promise<SeedResult> {
  const entity = await one<EntityRow>(
    env.DB,
    "SELECT id, canonical_name, entity_type, metadata, is_character FROM entities WHERE id = ? AND user_id = ?",
    [entityId, userId],
  );
  if (!entity) throw new Error("entity not found");

  const metadata = parseJson<{ wikipedia_url?: string; wikipedia_match?: string }>(
    entity.metadata,
    {},
  );
  const title = opts.wikipediaTitle ?? metadata.wikipedia_match ?? entity.canonical_name;

  const summary = await fetchWikiSummary(title);
  if (!summary) {
    return promoteToCharacter(env, userId, entityId);
  }

  const wikiUrl =
    summary.content_urls?.desktop?.page ??
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`;
  const portrait = summary.thumbnail?.source;
  const currentRole = extractRole(summary.description, summary.extract);
  const bioMd = buildSeedBio(entity.canonical_name, summary, wikiUrl);

  const existing = await one<{ id: string; slug: string }>(
    env.DB,
    "SELECT id, slug FROM character_profiles WHERE entity_id = ?",
    [entityId],
  );

  let profileId: string;
  let slug: string;
  const now = new Date().toISOString();
  if (existing) {
    profileId = existing.id;
    slug = existing.slug;
    await run(
      env.DB,
      `UPDATE character_profiles
          SET bio_md = ?, wikipedia_url = ?, portrait_url = ?,
              current_role = COALESCE(?, current_role),
              last_synced_at = ?, updated_at = ?
        WHERE id = ?`,
      [bioMd, wikiUrl, portrait ?? null, currentRole ?? null, now, now, profileId],
    );
  } else {
    slug = await buildUniqueSlug(env, entity.canonical_name);
    profileId = await insertOne(env.DB, "character_profiles", {
      user_id: userId,
      entity_id: entityId,
      canonical_name: entity.canonical_name,
      slug,
      current_role: currentRole ?? null,
      bio_md: bioMd,
      wikipedia_url: wikiUrl,
      portrait_url: portrait ?? null,
      last_synced_at: now,
      visibility: "public",
    });
  }

  // Save a version snapshot so the bio is restorable after edits.
  const versionCountRow = await one<{ n: number }>(
    env.DB,
    "SELECT COUNT(*) AS n FROM character_profile_versions WHERE entity_id = ?",
    [entityId],
  );
  const versionNumber = (versionCountRow?.n ?? 0) + 1;
  await insertOne(env.DB, "character_profile_versions", {
    entity_id: entityId,
    version_number: versionNumber,
    bio_md: bioMd,
    change_summary: existing ? "Re-seeded from Wikipedia" : "Seeded from Wikipedia",
  });
  await run(env.DB, "UPDATE character_profiles SET version_count = ? WHERE id = ?", [
    versionNumber,
    profileId,
  ]);

  // Seed timeline events from year-prefixed sentences in the extract.
  const timelineCount = await seedTimelineFromExtract(env, entityId, summary.extract);

  await run(
    env.DB,
    "UPDATE entities SET is_character = 1, auto_promoted_at = COALESCE(auto_promoted_at, ?) WHERE id = ?",
    [now, entityId],
  );

  return {
    entity_id: entityId,
    profile_id: profileId,
    slug,
    timeline_events_count: timelineCount,
    source: "wikipedia",
  };
}

/** Demote a character — clears the flag but keeps the profile row so the
 *  bio isn't lost. Use the operator UI to delete fully. */
export async function demoteCharacter(env: Env, userId: string, entityId: string): Promise<void> {
  await run(env.DB, "UPDATE entities SET is_character = 0 WHERE id = ? AND user_id = ?", [
    entityId,
    userId,
  ]);
}

async function fetchWikiSummary(title: string): Promise<WikiSummary | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, "_"))}`;
    const r = await fetch(url, { headers: { "user-agent": "Canopticon/1.0 (character-seed)" } });
    if (!r.ok) return null;
    return (await r.json()) as WikiSummary;
  } catch {
    return null;
  }
}

function extractRole(description: string | null, extract: string): string | undefined {
  if (description) {
    const m = ROLE_RE.exec(description);
    if (m) return titleCase((description.split(/[,.]/)[0] ?? "").trim()).slice(0, 100);
  }
  const firstSentence = extract.split(/\.\s+/)[0] ?? "";
  const m = ROLE_RE.exec(firstSentence);
  if (m) return titleCase(m[0]);
  return undefined;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSeedBio(name: string, summary: WikiSummary, wikiUrl: string): string {
  const lines: string[] = [];
  lines.push(`# ${name}`);
  if (summary.description) lines.push(`_${summary.description}_`);
  lines.push("");
  lines.push(summary.extract.trim());
  lines.push("");
  lines.push(`Seed source: [Wikipedia — ${summary.title}](${wikiUrl})`);
  return lines.join("\n");
}

async function seedTimelineFromExtract(
  env: Env,
  entityId: string,
  extract: string,
): Promise<number> {
  const matches = Array.from(extract.matchAll(YEAR_LINE_RE));
  if (matches.length === 0) return 0;

  const existingRow = await one<{ n: number }>(
    env.DB,
    "SELECT COUNT(*) AS n FROM character_timeline_events WHERE entity_id = ? AND proposed_by = 'wikipedia_seed'",
    [entityId],
  );
  if ((existingRow?.n ?? 0) > 0) return 0; // already seeded once

  let inserted = 0;
  for (const m of matches.slice(0, 8)) {
    const sentence = (m[1] ?? "").trim();
    const yearMatch = /\b((?:19|20)\d{2})\b/.exec(sentence);
    if (!yearMatch) continue;
    const year = yearMatch[1];
    const eventDate = `${year}-01-01`;
    const title = sentence.length > 80 ? `${sentence.slice(0, 77)}...` : sentence;
    await insertOne(env.DB, "character_timeline_events", {
      entity_id: entityId,
      event_date: eventDate,
      event_title: title,
      event_body: sentence,
      source_claim_ids: [],
      significance: "context",
      status: "confirmed",
      proposed_by: "wikipedia_seed",
    });
    inserted += 1;
  }
  return inserted;
}

/** Fetch character profiles ordered by heat. Convenience read for the
 *  operator list page and the public index. */
export async function listCharacters(
  env: Env,
  userId: string,
  opts: { limit?: number; publicOnly?: boolean } = {},
): Promise<
  Array<{
    profile_id: string;
    entity_id: string;
    canonical_name: string;
    slug: string;
    current_role: string | null;
    portrait_url: string | null;
    heat_score: number;
    mention_count: number;
    pending_proposals: number;
  }>
> {
  const limit = Math.min(opts.limit ?? 100, 500);
  const visClause = opts.publicOnly ? "AND cp.visibility = 'public'" : "";
  const rows = await all<{
    profile_id: string;
    entity_id: string;
    canonical_name: string;
    slug: string;
    current_role: string | null;
    portrait_url: string | null;
    heat_score: number;
  }>(
    env.DB,
    `SELECT cp.id AS profile_id, cp.entity_id, cp.canonical_name, cp.slug,
            cp.current_role, cp.portrait_url, e.heat_score
       FROM character_profiles cp
       JOIN entities e ON e.id = cp.entity_id
      WHERE cp.user_id = ? ${visClause}
      ORDER BY e.heat_score DESC, cp.updated_at DESC
      LIMIT ?`,
    [userId, limit],
  );

  const enriched = [];
  for (const r of rows) {
    const mentions = await one<{ n: number }>(
      env.DB,
      "SELECT COUNT(*) AS n FROM claim_entities WHERE entity_id = ?",
      [r.entity_id],
    );
    const pending = await one<{ n: number }>(
      env.DB,
      "SELECT COUNT(*) AS n FROM character_update_proposals WHERE entity_id = ? AND status = 'pending'",
      [r.entity_id],
    );
    enriched.push({
      ...r,
      mention_count: Number(mentions?.n ?? 0),
      pending_proposals: Number(pending?.n ?? 0),
    });
  }
  return enriched;
}
