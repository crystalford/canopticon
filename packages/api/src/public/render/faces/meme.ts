// Meme face — pure rendering (spec v2.6 Part 8).
//
// Two lines: thesis on top, the single most damning judge-passed fact on
// bottom, with receipt URL in the corner. Template + query. No LLM at
// render time.

import { all } from "../../../lib/d1";
import { escapeAttr, escapeHtml } from "../../layout";

interface SignedReadingPage {
  id: string;
  slug: string;
  thesis: string | null;
}

interface DamningClaim {
  claim_text: string;
  quote_id: string | null;
  piece_title: string | null;
}

/** Pick the single most damning judge-passed fact. Heuristic: order by
 *  judge_pass first (already filtered) then sort_order (the operator's
 *  intended ordering). "Most damning" is really "the lead-bearing fact" —
 *  whatever the writer put first. */
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

export async function renderMemeFace(db: D1Database, page: SignedReadingPage): Promise<string> {
  const thesis = page.thesis ?? "";
  if (!thesis) {
    return `<div class="face-empty">No thesis on this reading yet — meme renders once the signed reading is in place.</div>
<style>.face-empty { font-family: var(--serif); font-style: italic; color: var(--ink-3); font-size: 14px; }</style>`;
  }
  const damning = await loadDamning(db, page.id);

  return `<div class="meme-face">
  <div class="meme-meta">Two-line meme · thesis + the single most damning fact · pure rendering, no LLM</div>
  <div class="meme-card">
    <div class="meme-top">${escapeHtml(thesis)}</div>
    ${damning ? `<div class="meme-bottom">${escapeHtml(damning.claim_text)}</div>` : `<div class="meme-bottom meme-empty">[no judge-passed fact yet]</div>`}
    <div class="meme-receipt">
      ${damning?.quote_id ? `<a href="/q/${escapeAttr(damning.quote_id)}">receipt ↗</a>` : ""}
      ${damning?.piece_title ? ` · ${escapeHtml(damning.piece_title)}` : ""}
      ${damning ? ` · canopticon.com/s/${escapeHtml(page.slug)}?mode=signed` : ""}
    </div>
  </div>
</div>
<style>
  .meme-face { display: flex; flex-direction: column; gap: 10px; }
  .meme-meta {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-3);
    letter-spacing: .03em;
  }
  .meme-card {
    padding: 36px 32px;
    background: var(--ink);
    color: var(--paper, #faf6ef);
    border-radius: 12px;
    text-align: center;
    position: relative;
  }
  .meme-top {
    font-family: var(--serif);
    font-size: 26px;
    line-height: 1.25;
    font-weight: 600;
    margin-bottom: 18px;
    color: var(--paper, #faf6ef);
  }
  .meme-bottom {
    font-family: var(--serif);
    font-size: 19px;
    line-height: 1.35;
    font-style: italic;
    color: #d4c9a8;
    margin-bottom: 22px;
  }
  .meme-bottom.meme-empty { color: #6e6a62; font-style: italic; font-size: 14px; }
  .meme-receipt {
    font-family: var(--mono);
    font-size: 10.5px;
    color: #8a867c;
    letter-spacing: .03em;
  }
  .meme-receipt a { color: #d4c9a8; text-decoration: none; }
  .meme-receipt a:hover { color: #faf6ef; }
</style>`;
}
