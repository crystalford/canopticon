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

  let created = 0;
  for (const [canonical, group] of byCanonical) {
    // The "canonical" node is the first in the group; rest become aliases
    // (still seedable but they share the same page slug — collisions are
    // tolerated by the unique index on subject_node_id, not on canonical).
    const primary = group[0];
    if (!primary) continue;

    // Check if a page with this canonical slug already exists (from a prior
    // seed run that hit the canonical-name space).
    const baseSlug = slugify(canonical);
    const existing = await one<{ id: string }>(
      env.DB,
      "SELECT id FROM pages WHERE user_id = ? AND slug = ?",
      [userId, baseSlug],
    );

    if (existing) {
      // The canonical page exists; do nothing. Other group members get their
      // own pages-per-node (the unique index allows it) but the operator's
      // entry point is the canonical one.
      continue;
    }

    try {
      await insertOne(env.DB, "pages", {
        user_id: userId,
        subject_node_id: primary.id,
        slug: baseSlug,
        signed_status: "none",
      });
      created++;
    } catch {
      // unique violation = race; skip
    }
  }

  return { created };
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
