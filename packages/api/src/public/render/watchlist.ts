// Watchlist — the public surface for coverage_beats (graph/lib/
// autonomous-expand.ts). A watch is a standing, operator-declared subject
// worth coming back to — previously only reachable as an operator via
// /v1/admin/beats. This is that same table, given a real page instead of
// living behind an admin JSON endpoint.
//
// Named Watchlist, not "Monitors" — two reasons: it's the familiar,
// self-explanatory word (Wikipedia/GitHub/stock-app pattern, no jargon to
// learn), and "Monitors" was already taken — graph/routes/monitors.ts +
// the `monitors` D1 table are a separate, older, unrelated system
// (curated watchers on named institutional sources like BIS/FSB). Don't
// rename that one without a separate, explicit reason to touch it.
//
// Used to auto-check itself: every watched subject shared one sweep slot
// on a cooldown (BEAT_COOLDOWN_MS, 3 days), whichever was most overdue
// got the next check, unattended. Retired along with the rest of the
// autonomous sweep (see index.ts's scheduled()) — it was unattended
// research feeding unattended publishing, no operator in the loop
// either way. A watch is now just a marker; re-checking it means using
// "Expand this file" on that subject's own page. last_swept_at is left
// as a historical field — it'll just stop updating, not lie about a
// schedule that no longer runs.

import { all, one } from "../../lib/d1";
import { type PublicEnv, resolveOperatorId } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";
import { emptyState } from "./components";

interface BeatRow {
  id: string;
  label: string;
  created_at: string;
  last_swept_at: string | null;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export async function renderWatchlistPage(
  env: PublicEnv,
  opts: { isOperator?: boolean } = {},
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const beats = userId
    ? await all<BeatRow>(
        env.DB,
        `SELECT id, label, created_at, last_swept_at FROM coverage_beats
          WHERE user_id = ?
          ORDER BY COALESCE(last_swept_at, created_at) DESC`,
        [userId],
      ).catch(() => [])
    : [];

  // Best-effort: link a watched subject to the file it's building, if one
  // already exists (a watch can run for a while before a page grows from it).
  const linked = new Map<string, string>();
  if (userId) {
    for (const b of beats) {
      const row = await one<{ slug: string }>(
        env.DB,
        `SELECT p.slug FROM pages p JOIN nodes n ON n.id = p.subject_node_id
          WHERE p.user_id = ? AND n.label = ? LIMIT 1`,
        [userId, b.label],
      ).catch(() => null);
      if (row) linked.set(b.id, row.slug);
    }
  }

  const rows = beats.length
    ? beats
        .map((b) => {
          const slug = linked.get(b.id);
          const name = slug
            ? `<a href="/s/${escapeAttr(slug)}">${escapeHtml(b.label)}</a>`
            : escapeHtml(b.label);
          const status = b.last_swept_at
            ? `last checked ${formatRelative(b.last_swept_at)}`
            : "not checked yet";
          const researchForm = opts.isOperator
            ? `<form class="watch-research-form" method="POST" action="/op/search/research">
  <input type="hidden" name="q" value="${escapeAttr(b.label)}">
  <button class="watch-research-go" type="submit">Research now →</button>
</form>`
            : "";
          return `<div class="watch-row">
  <div class="watch-name">${name}</div>
  <div class="watch-meta">added ${formatRelative(b.created_at)} <span class="sep">·</span> ${status}${slug ? "" : ' <span class="sep">·</span> no file yet'}</div>
  ${researchForm}
</div>`;
        })
        .join("")
    : "";

  const body = `
<section class="watch-masthead">
  <div class="kicker"><span class="live"></span> Watchlist</div>
  <h1 class="watch-h1">Subjects you're standing watch on.</h1>
  <p class="watch-lede">
    A watch is a standing marker on a subject worth coming back to — not a one-time upload.
    Right now, "coming back to" means you: use "Expand this file" on the subject's own page to
    run a fresh search → fetch → verbatim-extract pass on it, same as everything else. Automatic,
    unattended re-checking is retired for now — the version of this that checked itself on a
    timer was also the version that decided things and published things without you seeing them
    first, which is why it's gone.
  </p>
</section>

<section class="watch-list-section">
  ${
    beats.length
      ? `<div class="sec-h"><span class="label">On the watchlist</span><span class="coord">${beats.length} SUBJECT${beats.length === 1 ? "" : "S"}</span></div>
  <div class="watch-list">${rows}</div>`
      : emptyState("Nothing on the watchlist yet.")
  }
</section>
`;

  return renderPage({
    title: "Watchlist · canopticon",
    description: "Subjects marked for standing attention, expanded on click.",
    body: `${body}
<style>
  .watch-masthead { max-width: 720px; margin: 40px auto 0; padding: 0 24px; }
  .watch-h1 { font-family: var(--serif); font-size: 32px; line-height: 1.15; margin: 12px 0 14px; color: var(--ink); text-wrap: balance; }
  .watch-lede { font-family: var(--serif); font-size: 16px; line-height: 1.6; color: var(--ink-2); }
  .watch-list-section { max-width: 720px; margin: 40px auto 0; padding: 0 24px 80px; }
  .watch-list { display: flex; flex-direction: column; gap: 1px; background: var(--rule); border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; }
  .watch-row { background: var(--surface); padding: 15px 18px; }
  .watch-name { font-family: var(--serif); font-size: 16.5px; color: var(--ink); }
  .watch-name a { color: var(--ink); }
  .watch-name a:hover { color: var(--accent-2); }
  .watch-meta { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); margin-top: 4px; }
  .watch-research-form { margin-top: 8px; }
  .watch-research-go { font-size: 12px; padding: 5px 12px; border-radius: 6px; border: 1px solid var(--rule);
    background: var(--surface); color: var(--accent-2); cursor: pointer; }
  .watch-research-go:hover { border-color: var(--accent-2); }
</style>`,
    activeNav: "/watchlist",
    zone: "watchlist",
  });
}
