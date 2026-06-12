// Thread face — pure rendering (spec v2.6 Part 8).
//
// Template + query. No LLM at render time. Thesis as the hook, top 2
// judge-passed fact-claims as the anchors, a closer that points at the
// full reading. Renders in <100ms.

import { all, one } from "../../../lib/d1";
import { escapeAttr, escapeHtml } from "../../layout";

interface SignedReadingPage {
  id: string;
  slug: string;
  thesis: string | null;
  signed_by: string | null;
}

interface ClaimRow {
  claim_text: string;
  quote_id: string | null;
  asserted_by: string | null;
  piece_title: string | null;
}

/** Load the top judge-passed fact claims from the signed reading, in
 *  sort_order. Excludes assertion-kind claims because they need attribution
 *  formatting that's awkward in a 280-char post. */
async function loadTopClaims(db: D1Database, pageId: string, limit: number): Promise<ClaimRow[]> {
  return all<ClaimRow>(
    db,
    `SELECT pc.claim_text, pc.quote_id, pc.asserted_by,
            (SELECT p.title FROM quotes q
               JOIN nodes ns ON ns.id = q.source_id
               JOIN pieces p ON p.id = ns.piece_id
              WHERE q.id = pc.quote_id LIMIT 1) AS piece_title
       FROM page_claims pc
      WHERE pc.page_id = ? AND pc.judge_pass = 1 AND pc.kind = 'fact'
      ORDER BY pc.sort_order ASC
      LIMIT ?`,
    [pageId, limit],
  ).catch(() => []);
}

/** Render the thread face. Caller passes the signed page row; we don't
 *  re-query the page itself. */
export async function renderThreadFace(db: D1Database, page: SignedReadingPage): Promise<string> {
  const thesis = page.thesis ?? "";
  if (!thesis) {
    return `<div class="face-empty">No thesis on this reading yet — thread renders once the signed reading is in place.</div>
<style>.face-empty { font-family: var(--serif); font-style: italic; color: var(--ink-3); font-size: 14px; }</style>`;
  }
  const claims = await loadTopClaims(db, page.id, 2);

  const post1 = thesis;
  const post2 = claims[0]
    ? `${claims[0].claim_text}${claims[0].piece_title ? ` — ${claims[0].piece_title}` : ""}`
    : "";
  const post3 = claims[1]
    ? `${claims[1].claim_text}${claims[1].piece_title ? ` — ${claims[1].piece_title}` : ""}`
    : "";
  const post4 = `Read the full reading — canopticon.com/s/${page.slug}?mode=signed`;

  const posts = [post1, post2, post3, post4].filter((p) => p.length > 0);
  const totalChars = posts.reduce((sum, p) => sum + p.length, 0);

  return `<div class="thread-face">
  <div class="thread-meta">A 4-post thread · ${totalChars} characters total · pure rendering, no LLM</div>
  ${posts
    .map(
      (post, i) => `<div class="thread-post">
  <div class="thread-n">${i + 1}/${posts.length}</div>
  <div class="thread-body">${escapeHtml(post)}</div>
  <div class="thread-len">${post.length} chars${i === 1 && claims[0]?.quote_id ? ` · <a href="/q/${escapeAttr(claims[0].quote_id)}">receipt</a>` : ""}${i === 2 && claims[1]?.quote_id ? ` · <a href="/q/${escapeAttr(claims[1].quote_id)}">receipt</a>` : ""}</div>
</div>`,
    )
    .join("")}
</div>
<style>
  .thread-face { display: flex; flex-direction: column; gap: 12px; }
  .thread-meta {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-3);
    letter-spacing: .03em;
    margin-bottom: 6px;
  }
  .thread-post {
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: 14px;
    padding: 14px 16px;
    background: var(--surface, #fff);
    border: 1px solid var(--rule);
    border-radius: 9px;
  }
  .thread-n {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink-3);
    padding-top: 4px;
  }
  .thread-body {
    font-family: var(--serif);
    font-size: 16px;
    line-height: 1.55;
    color: var(--ink);
    margin-bottom: 6px;
  }
  .thread-len {
    grid-column: 2;
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--ink-3);
  }
  .thread-len a { color: var(--accent); text-decoration: none; }
  .thread-len a:hover { text-decoration: underline; }
</style>`;
}

// `one` re-exported for completeness even though this renderer doesn't use it;
// kept here so the import pattern matches the other faces files.
export { one };
