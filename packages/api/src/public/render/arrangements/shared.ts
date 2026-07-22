// Shared scaffolding for arrangement renderers (spec v2.6 Part 6).
//
// Every arrangement is a pure rendering — template + query, no LLM at
// render time. Each arrangement is BOTH a section embedded inside a
// subject page AND a standalone addressable page with its own URL +
// JSON-LD. The renderers in this folder return the inner-block HTML;
// the per-arrangement standalone route wraps them with a masthead and
// back-link. The subject-page renderer embeds the same inner-block
// without the wrapper.
//
// This file defines the shared types and the wrapper helper.

import { all, one } from "../../../lib/d1";
import { type PublicEnv, resolveOperatorId } from "../../data";
import { escapeAttr, escapeHtml, renderPage } from "../../layout";

export interface SubjectContext {
  userId: string;
  nodeId: string;
  kind: string;
  label: string;
  slug: string;
  signed_status: string;
  thesis: string | null;
  signed_at: string | null;
}

/** Look up a subject by its page slug. Used by every standalone arrangement
 *  route — the URL `/t/mark-carney` doesn't know which entity `mark-carney`
 *  resolves to until we read the `pages` table. */
export async function loadSubject(env: PublicEnv, slug: string): Promise<SubjectContext | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const row = await one<{
    node_id: string;
    kind: string;
    label: string;
    slug: string;
    signed_status: string;
    thesis: string | null;
    signed_at: string | null;
  }>(
    env.DB,
    `SELECT p.subject_node_id AS node_id, n.kind, n.label, p.slug,
            p.signed_status, p.thesis, p.signed_at
       FROM pages p JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ? AND p.slug = ?`,
    [userId, slug],
  );
  if (!row) return null;
  return {
    userId,
    nodeId: row.node_id,
    kind: row.kind,
    label: row.label,
    slug: row.slug,
    signed_status: row.signed_status,
    thesis: row.thesis,
    signed_at: row.signed_at,
  };
}

/** Wrap an arrangement's inner-block HTML in the standalone page chrome —
 *  masthead with the subject label + arrangement kicker + back-link, the
 *  inner block, the faces-of-this-arrangement strip (deferred), and the
 *  JSON-LD the caller assembled. Used by every per-arrangement route. */
export function renderArrangementStandalone(args: {
  subject: SubjectContext;
  arrangementLabel: string;
  arrangementKind: string;
  inner: string;
  jsonLd: string;
  title: string;
  description: string;
}): string {
  const body = `
<script type="application/ld+json">${args.jsonLd}</script>
<article class="arr-page">
  <header class="arr-head">
    <div class="kicker">${escapeHtml(args.arrangementLabel)} · arrangement</div>
    <h1 class="arr-h1">${escapeHtml(args.subject.label)}</h1>
    <p class="arr-sub">
      An arrangement of the graph: ${escapeHtml(args.arrangementLabel.toLowerCase())} for ${escapeHtml(args.subject.label)}.
      Every fact below is a verbatim quote from a real document we have stored.
      <a class="arr-back" href="/s/${escapeAttr(args.subject.slug)}">↩ See the full Record</a>
    </p>
  </header>

  ${args.inner}
</article>

<style>
  .arr-page { max-width: 880px; margin: 0 auto; padding: 28px 0 80px; }
  .arr-head { margin-bottom: 36px; max-width: 760px; }
  .arr-head .kicker {
    font-size: 12px; letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--accent); font-weight: 600;
    margin-bottom: 14px;
  }
  .arr-h1 {
    font-family: var(--serif);
    font-size: 44px; line-height: 1.08; letter-spacing: -.022em;
    margin: 0 0 14px;
    color: var(--ink);
  }
  .arr-sub {
    font-family: var(--serif);
    font-size: 16.5px; line-height: 1.6;
    color: var(--ink-2);
    margin: 0;
  }
  .arr-back { color: var(--accent); text-decoration: none; }
  .arr-back:hover { text-decoration: underline; }
  @media (max-width: 640px) {
    .arr-h1 { font-size: 32px; }
  }
</style>
`;
  return renderPage({
    title: args.title,
    description: args.description,
    body,
    activeNav: "/topics",
    zone: "topics",
  });
}

// Re-exports kept thin so the per-arrangement files only import from here.
export { all, escapeAttr, escapeHtml };
