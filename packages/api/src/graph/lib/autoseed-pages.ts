// Page autoseeder — every entity, event, and theme node deserves a page row.
//
// When extraction lands, it creates nodes but not pages. This function
// catches up: for any subject node (entity, event, theme) without a page,
// create one with a unique slug. Idempotent — runs after extraction settles
// and at /op/library page load as a safety net.
//
// The renderer is the same for all three kinds; only the page row needs to
// exist for the URL to resolve.

import type { Env } from "../../env";
import { all, insertOne, one } from "../../lib/d1";

export async function autoseedPages(env: Env, userId: string): Promise<{ created: number }> {
  // Find subject nodes that don't have a page yet.
  const orphans = await all<{ id: string; label: string; kind: string }>(
    env.DB,
    `SELECT n.id, n.label, n.kind FROM nodes n
      WHERE n.user_id = ?
        AND n.kind IN ('entity', 'event', 'theme')
        AND n.label IS NOT NULL AND n.label != ''
        AND NOT EXISTS (SELECT 1 FROM pages p WHERE p.subject_node_id = n.id)
      LIMIT 200`,
    [userId],
  );

  // Group by canonical label (lowercased) so multiple "Mark Carney" nodes
  // from different documents share ONE page. The first one to seed wins
  // the slug; later duplicates point at the same canonical slug.
  const byCanonical = new Map<string, { id: string; label: string; kind: string }[]>();
  for (const o of orphans) {
    const key = canonicalize(o.label);
    if (!key) continue;
    const list = byCanonical.get(key) ?? [];
    list.push(o);
    byCanonical.set(key, list);
  }

  // Existing page labels (from prior seed runs) so new short names can fold
  // into an already-seeded longer one.
  const existingLabels = await all<{ label: string }>(
    env.DB,
    `SELECT DISTINCT n.label FROM pages p JOIN nodes n ON n.id = p.subject_node_id WHERE p.user_id = ?`,
    [userId],
  ).catch(() => []);

  // Seed longest names first so "Mark Carney" wins before "Carney" is seen;
  // a shorter name that is a whole-word subset of an already-seeded longer
  // name folds into it (no separate page).
  const ordered = [...byCanonical.entries()].sort((a, b) => b[0].length - a[0].length);
  const seededCanon: string[] = existingLabels.map((r) => canonicalize(r.label));

  let created = 0;
  for (const [canonical, group] of ordered) {
    const primary = group[0];
    if (!primary) continue;

    // Fold a short name into a longer already-seeded name (entity dedup).
    // "carney" folds into "mark carney"; events are never folded (dates differ).
    if (primary.kind === "entity" && seededCanon.some((s) => isAliasOf(canonical, s))) {
      continue;
    }

    const baseSlug = slugify(canonical);
    const existing = await one<{ id: string }>(
      env.DB,
      "SELECT id FROM pages WHERE user_id = ? AND slug = ?",
      [userId, baseSlug],
    );
    if (existing) {
      seededCanon.push(canonical);
      continue;
    }

    try {
      await insertOne(env.DB, "pages", {
        user_id: userId,
        subject_node_id: primary.id,
        slug: baseSlug,
        signed_status: "none",
      });
      seededCanon.push(canonical);
      created++;
    } catch {
      // unique violation = race; skip
    }
  }

  return { created };
}

// True when `short` is a whole-word subset of `long` (so "carney" folds into
// "mark carney", "poilievre" into "pierre poilievre"). Requires the short
// name to be at least one full word AND every one of its words to appear in
// the longer name — avoids folding "bank of canada" into "bank of england".
function isAliasOf(short: string, long: string): boolean {
  if (short === long || short.length >= long.length) return false;
  const longWords = new Set(long.split(/\s+/).filter(Boolean));
  const shortWords = short.split(/\s+/).filter(Boolean);
  if (shortWords.length === 0 || shortWords.length >= longWords.size) return false;
  // Single-word short names must be a "significant" surname-length token.
  if (shortWords.length === 1 && (shortWords[0]?.length ?? 0) < 4) return false;
  return shortWords.every((w) => longWords.has(w));
}

function canonicalize(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "subject"
  );
}
