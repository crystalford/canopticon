// Card face — pure rendering (spec v2.6 Part 8).
//
// One shareable image: a headline on top in serif, the single most
// damning judge-passed fact below in italic, the receipt URL in mono in
// the corner. Template + query, no LLM at render time. The "card" is
// what gets produced into a PNG via Cloudflare Browser Rendering when
// the operator hits Produce → from the face tab (Studio, Part 27).
//
// Two sources for the headline (2026-07-24): a signed reading's thesis
// (original), or — when there's no reading yet — the subject label plus
// its top judge-verified profile claim (graph/lib/profile-generator.ts's
// page_profiles/page_profile_claims). Closes the gap where a
// well-sourced neutral File had no way to become a shareable image at
// all until someone signed a reading on it. Same trust bar either way:
// every fact on the card is judge-passed, never invented at render time.

import { all, one } from "../../../lib/d1";
import { escapeAttr, escapeHtml } from "../../layout";

interface SignedReadingPage {
  id: string;
  slug: string;
  subject_node_id: string;
  thesis: string | null;
}

interface DamningClaim {
  claim_text: string;
  quote_id: string | null;
  piece_title: string | null;
}

/** Pick the single most damning judge-passed fact. Heuristic: judge_pass
 *  first (filtered in WHERE) then sort_order (the writer's intended
 *  ordering). "Most damning" is really "the lead-bearing fact" — whatever
 *  the writer put first. */
async function loadDamning(db: D1Database, pageId: string): Promise<DamningClaim | null> {
  const rows = await all<DamningClaim>(
    db,
    `SELECT pc.claim_text, pc.quote_id,
            (SELECT p.title FROM quotes q
               JOIN nodes ns ON ns.id = q.source_id
               JOIN pieces p ON p.id = ns.piece_id
              WHERE q.id = pc.quote_id LIMIT 1) AS piece_title
       FROM page_claims pc
      WHERE pc.page_id = ? AND pc.judge_pass = 1 AND pc.kind = 'fact'
      ORDER BY pc.sort_order ASC
      LIMIT 1`,
    [pageId],
  ).catch(() => []);
  return rows[0] ?? null;
}

/** Same shape as loadDamning but for a neutral subject's profile claims —
 *  no pages.id to key off since there may be no signed reading at all. */
async function loadTopProfileClaim(
  db: D1Database,
  subjectNodeId: string,
): Promise<DamningClaim | null> {
  const profile = await one<{ id: string }>(
    db,
    "SELECT id FROM page_profiles WHERE subject_node_id = ? AND status = 'ready' LIMIT 1",
    [subjectNodeId],
  ).catch(() => null);
  if (!profile) return null;
  const rows = await all<DamningClaim>(
    db,
    `SELECT pc.claim_text, pc.quote_id,
            (SELECT p.title FROM quotes q
               JOIN nodes ns ON ns.id = q.source_id
               JOIN pieces p ON p.id = ns.piece_id
              WHERE q.id = pc.quote_id LIMIT 1) AS piece_title
       FROM page_profile_claims pc
      WHERE pc.profile_id = ? AND pc.judge_pass = 1
      ORDER BY pc.sort_order ASC
      LIMIT 1`,
    [profile.id],
  ).catch(() => []);
  return rows[0] ?? null;
}

interface CardSubject {
  label: string;
}

export async function renderCardFace(
  db: D1Database,
  page: SignedReadingPage,
  subject?: CardSubject,
): Promise<string> {
  const thesis = page.thesis ?? "";
  const isNeutral = !thesis;
  const headline = isNeutral ? (subject?.label ?? "") : thesis;
  const metaLine = isNeutral
    ? "Single-image card · what's on file · pure rendering, no LLM"
    : "Single-image card · thesis + the single most damning fact · pure rendering, no LLM";

  if (isNeutral && !headline) {
    return `<div class="face-empty">No thesis on this analysis yet — the card renders once the signed analysis is in place, or once a neutral profile exists.</div>
<style>.face-empty { font-family: var(--serif); font-style: italic; color: var(--ink-3); font-size: 14px; }</style>`;
  }

  const damning = isNeutral
    ? await loadTopProfileClaim(db, page.subject_node_id)
    : await loadDamning(db, page.id);

  return `<div class="card-face">
  <div class="card-meta">${escapeHtml(metaLine)}</div>
  <div class="card-art">
    <div class="card-top">${escapeHtml(headline)}</div>
    ${damning ? `<div class="card-bottom">${escapeHtml(damning.claim_text)}</div>` : `<div class="card-bottom card-empty">[no judge-passed fact yet]</div>`}
    <div class="card-receipt">
      ${damning?.quote_id ? `<a href="/q/${escapeAttr(damning.quote_id)}">receipt ↗</a>` : ""}
      ${damning?.piece_title ? ` · ${escapeHtml(damning.piece_title)}` : ""}
      ${damning ? ` · canopticon.com/s/${escapeHtml(page.slug)}${isNeutral ? "" : "?mode=signed"}` : ""}
    </div>
  </div>
</div>
<style>
  .card-face { display: flex; flex-direction: column; gap: 10px; }
  .card-meta {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-3);
    letter-spacing: .03em;
  }
  .card-art {
    padding: 36px 32px;
    background: var(--ink);
    color: var(--paper, #faf6ef);
    border-radius: 12px;
    text-align: center;
    position: relative;
  }
  .card-top {
    font-family: var(--serif);
    font-size: 26px;
    line-height: 1.25;
    font-weight: 600;
    margin-bottom: 18px;
    color: var(--paper, #faf6ef);
  }
  .card-bottom {
    font-family: var(--serif);
    font-size: 19px;
    line-height: 1.35;
    font-style: italic;
    color: #d4c9a8;
    margin-bottom: 22px;
  }
  .card-bottom.card-empty { color: #6e6a62; font-style: italic; font-size: 14px; }
  .card-receipt {
    font-family: var(--mono);
    font-size: 10.5px;
    color: #8a867c;
    letter-spacing: .03em;
  }
  .card-receipt a { color: #d4c9a8; text-decoration: none; }
  .card-receipt a:hover { color: #faf6ef; }
</style>`;
}
