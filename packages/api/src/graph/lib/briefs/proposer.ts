// Brief proposer — turns graph coverage gaps and Synthesis findings
// into proposal cards.
//
// Per the spec, proposals come from two surfaces:
//   - graph gaps — an entity referenced in ≥N claims but no standalone
//                  page; a recurring term without coverage
//   - synthesis findings — a pattern/connection suggests a Brief shape
//
// Each call upserts proposal-status briefs by slug. The operator picks
// what to build; nothing fires automatically.

import type { Env } from "../../../env";
import { all, insertOne, one } from "../../../lib/d1";

const ENTITY_BRIEF_MIN_CLAIMS = 5;

export interface ProposerReport {
  proposed: number;
  updated: number;
  errors: string[];
}

export async function proposeBriefs(env: Env, userId: string): Promise<ProposerReport> {
  const report: ProposerReport = { proposed: 0, updated: 0, errors: [] };

  // ---- coverage gaps: entities with ≥N claims but no Brief yet ----
  const entityHits = await all<{
    entity_id: string;
    public_slug: string;
    canonical_name: string;
    kind: string;
    n_claims: number;
  }>(
    env.DB,
    `SELECT e.id AS entity_id, e.public_slug, e.canonical_name, e.kind,
            COUNT(DISTINCT ce.claim_id) AS n_claims
       FROM entities e
       JOIN claim_entities ce ON ce.entity_id = e.id
      WHERE e.user_id = ?
      GROUP BY e.id
      HAVING n_claims >= ?
      ORDER BY n_claims DESC
      LIMIT 30`,
    [userId, ENTITY_BRIEF_MIN_CLAIMS],
  );

  for (const e of entityHits) {
    try {
      const slug = `what-is-${e.public_slug}`;
      const existing = await one<{ id: string; status: string }>(
        env.DB,
        "SELECT id, status FROM briefs WHERE user_id = ? AND slug = ?",
        [userId, slug],
      );
      const contentType = e.kind === "concept" ? "definition" : "definition";
      const title =
        e.kind === "concept" ? `What is the ${e.canonical_name}?` : `Who is ${e.canonical_name}?`;
      const why = `${e.canonical_name} is referenced in ${e.n_claims} claims across the corpus but has no standalone explainer Brief. A definition Brief is the safest content type (46% citation rate; ChatGPT favors encyclopedic).`;
      if (existing) {
        // Only refresh the why_proposed_md while still a proposal.
        if (existing.status === "proposal") {
          await env.DB.prepare(
            "UPDATE briefs SET title = ?, why_proposed_md = ?, updated_at = ? WHERE id = ?",
          )
            .bind(title, why, new Date().toISOString(), existing.id)
            .run();
          report.updated += 1;
        }
      } else {
        await insertOne(env.DB, "briefs", {
          user_id: userId,
          slug,
          title,
          content_type: contentType,
          status: "proposal",
          why_proposed_md: why,
          body_md: "",
          body_html: "",
          schema_jsonld: "{}",
        });
        report.proposed += 1;
      }
    } catch (err) {
      report.errors.push(`${e.public_slug}: ${(err as Error).message}`);
    }
  }

  // ---- synthesis-derived proposals: pattern → comparison/timeline ----
  const patterns = await all<{
    id: string;
    slug: string;
    kind: string;
    title: string;
  }>(
    env.DB,
    `SELECT id, slug, kind, title FROM patterns
      WHERE user_id = ? AND status = 'candidate'
      ORDER BY updated_at DESC LIMIT 20`,
    [userId],
  );
  for (const p of patterns) {
    try {
      let contentType: string | null = null;
      let title = "";
      if (p.kind === "connection") {
        contentType = "comparison";
        title = `Comparison: ${p.title.replace(/co-occur in.*/, "").trim()}`;
      } else if (p.kind === "recurring-actor") {
        contentType = "timeline";
        title = `Timeline: ${p.title}`;
      }
      if (!contentType) continue;
      const briefSlug = `from-${p.slug}`;
      const existing = await one<{ id: string; status: string }>(
        env.DB,
        "SELECT id, status FROM briefs WHERE user_id = ? AND slug = ?",
        [userId, briefSlug],
      );
      const why = `Synthesis surfaced a ${p.kind} pattern (${p.title}). A ${contentType} Brief shape would crystallize it as a citable reference page.`;
      if (existing) {
        if (existing.status === "proposal") {
          await env.DB.prepare(
            "UPDATE briefs SET title = ?, why_proposed_md = ?, updated_at = ? WHERE id = ?",
          )
            .bind(title, why, new Date().toISOString(), existing.id)
            .run();
          report.updated += 1;
        }
      } else {
        await insertOne(env.DB, "briefs", {
          user_id: userId,
          slug: briefSlug,
          title,
          content_type: contentType,
          status: "proposal",
          why_proposed_md: why,
          body_md: "",
          body_html: "",
          schema_jsonld: "{}",
        });
        report.proposed += 1;
      }
    } catch (err) {
      report.errors.push(`pattern-${p.slug}: ${(err as Error).message}`);
    }
  }

  return report;
}
