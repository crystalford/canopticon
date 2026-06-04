// Library — the full document archive.
//
// P0 ships the stats bar shell, search input, filter chips, and an empty
// list. The real archive with chain grouping and expandable detail rows
// lands in P2 (backed by the existing pieces + chain_passes tables).

import { all } from "../../lib/d1";
import { resolveOperatorId } from "../data";
import { emptyState, icon, renderOpPage } from "../layout";

interface Stats {
  documents: number;
  claims: number;
  chains: number;
  published: number;
  working: number;
}

async function loadStats(db: D1Database, userId: string): Promise<Stats> {
  const scalar = async (sql: string, binds: unknown[]): Promise<number> => {
    const row = await db
      .prepare(sql)
      .bind(...binds)
      .first<{ n: number }>();
    return row?.n ?? 0;
  };
  const [documents, claims, chains, published, working] = await Promise.all([
    scalar("SELECT count(*) AS n FROM pieces WHERE user_id = ?", [userId]),
    scalar("SELECT count(*) AS n FROM claims WHERE user_id = ?", [userId]),
    scalar(
      "SELECT count(DISTINCT chain_id) AS n FROM pieces WHERE user_id = ? AND chain_id IS NOT NULL",
      [userId],
    ),
    scalar(
      "SELECT count(*) AS n FROM pieces WHERE user_id = ? AND publication_status IN ('published','canonical')",
      [userId],
    ),
    scalar(
      "SELECT count(*) AS n FROM pieces WHERE user_id = ? AND publication_status = 'working-material'",
      [userId],
    ),
  ]);
  return { documents, claims, chains, published, working };
}

export async function renderLibraryScreen(env: { DB: D1Database }): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const stats = userId
    ? await loadStats(env.DB, userId)
    : { documents: 0, claims: 0, chains: 0, published: 0, working: 0 };
  // We can also peek at chain names for the filter chips.
  const chains = userId
    ? await all<{ chain_id: string; n: number }>(
        env.DB,
        `SELECT chain_id, COUNT(*) AS n FROM pieces
          WHERE user_id = ? AND chain_id IS NOT NULL
          GROUP BY chain_id ORDER BY n DESC LIMIT 8`,
        [userId],
      )
    : [];

  const statsBar = `<div class="lib-stats">
  <div class="lib-stat"><div class="ls-n">${stats.documents}</div><div class="ls-l">Documents</div></div>
  <div class="lib-sep"></div>
  <div class="lib-stat"><div class="ls-n">${stats.claims}</div><div class="ls-l">Claims</div></div>
  <div class="lib-sep"></div>
  <div class="lib-stat"><div class="ls-n">${stats.chains}</div><div class="ls-l">Chains</div></div>
  <div class="lib-sep"></div>
  <div class="lib-stat"><div class="ls-n" style="color:var(--c-thesis)">${stats.published}</div><div class="ls-l">Published</div></div>
  <div class="lib-sep"></div>
  <div class="lib-stat"><div class="ls-n" style="color:var(--amber)">${stats.working}</div><div class="ls-l">Working</div></div>
</div>`;

  const search = `<div class="lib-search" style="margin-bottom:14px">
  ${icon("search")}
  <input class="lib-search-input" type="search" placeholder="Search documents, chains, entities…" disabled />
</div>`;

  const filterChips = `<div class="lib-filters" style="margin-bottom:16px">
  <button class="lib-fchip on">All <span class="mono" style="font-size:10px;color:var(--faint);margin-left:6px">${stats.documents}</span></button>
  <button class="lib-fchip">Published</button>
  <button class="lib-fchip">Working</button>
  ${chains
    .map(
      (c) =>
        `<button class="lib-fchip">${c.chain_id} <span class="mono" style="font-size:10px;color:var(--faint);margin-left:6px">${c.n}</span></button>`,
    )
    .join("")}
</div>`;

  const list =
    stats.documents > 0
      ? `<div class="lib-list">
  <div class="lib-empty">The full archive with chain grouping and expandable detail rows lands in P2. Stats above are live.</div>
</div>`
      : emptyState({
          iconName: "library",
          title: "No documents in the archive yet.",
          body: "Drop research reports in Feed and they appear here as the digestion pipeline catalogues them.",
          action: { href: "/op", label: "Open Feed" },
        });

  const topbarActions = `<button class="btn" style="display:inline-flex"><a href="/op" style="color:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:6px">${icon("upload")} Add document</a></button>`;

  return renderOpPage({
    title: "Library",
    sub: "the full document archive",
    topbarActions,
    body: `${statsBar}${search}${filterChips}${list}`,
    activeNav: "/op/library",
    width: "wide",
  });
}
