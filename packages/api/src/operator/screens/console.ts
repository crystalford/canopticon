// Console — the operator's home screen.
//
// Mirrors the design build's Console: a command bar at top, then a
// two-column layout — leads + recent activity. Real data: counts from
// D1, recent pieces, pending entity-update proposals as leads.

import { all } from "../../lib/d1";
import { escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { commandBar, icon, opHeader, renderOpPage } from "../layout";

interface Counts {
  pieces: number;
  entities: number;
  proposals: number;
  topics: number;
  workingMaterial: number;
  publishedPieces: number;
}
interface RecentItem {
  tag: string;
  text: string;
  when: string;
  href?: string | undefined;
}
interface Lead {
  id: string;
  kind: string;
  text: string;
  entity_slug?: string | null | undefined;
}

export async function renderConsole(env: { DB: D1Database }): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const [counts, recent, leads] = userId
    ? await Promise.all([loadCounts(env.DB, userId), loadRecent(env.DB, userId), loadLeads(env.DB)])
    : [zeroCounts(), [] as RecentItem[], [] as Lead[]];

  const leadsBlock = leads.length
    ? `<div class="col" style="gap:10px;margin-bottom:32px">${leads
        .map(
          (l) => `<div class="lead-card">
  <div class="row between" style="margin-bottom:8px">
    <span class="label">Lead · ${escapeHtml(l.kind)}</span>
    <span class="coord">${escapeHtml(l.id)}</span>
  </div>
  <div style="font-size:14.5px;line-height:1.45;margin-bottom:12px;color:var(--ink-2)">${escapeHtml(l.text)}</div>
  <div class="row" style="gap:8px">
    <a class="btn sm on" href="${l.entity_slug ? `/op/workbench/${escapeHtml(l.entity_slug)}` : "/op/leads"}">Chase</a>
  </div>
</div>`,
        )
        .join("")}</div>`
    : `<div class="lead-card" style="opacity:.7">
  <div style="font-size:14.5px;line-height:1.5;color:var(--ink-3)">
    No leads yet. As entities are mentioned across pieces or as patterns surface, they'll appear here as triage cards.
  </div>
</div>`;

  const recentBlock = recent.length
    ? `<div class="col" style="gap:0">${recent
        .map(
          (r) => `<div style="padding:12px 0;border-bottom:1px solid var(--rule-soft)">
  <div class="row between" style="margin-bottom:4px">
    <span class="coord">${escapeHtml(r.tag)}</span>
    <span class="coord">${escapeHtml(r.when)}</span>
  </div>
  <div style="font-size:13.5px;color:var(--ink-2);line-height:1.4">${
    r.href
      ? `<a href="${escapeHtml(r.href)}" style="color:inherit;text-decoration:none">${escapeHtml(r.text)}</a>`
      : escapeHtml(r.text)
  }</div>
</div>`,
        )
        .join("")}</div>`
    : `<div class="coord faint" style="padding:18px 0">Nothing recent yet.</div>`;

  const quickStart = [
    ["Build a node", "/op/build", "plus"],
    ["Ingest a piece", "/op/ingest", "arrowUR"],
    ["Open Editorial", "/op/editorial", "edit"],
    ["Record in Studio", "/op/studio", "play"],
  ]
    .map(
      ([
        label,
        href,
        ic,
      ]) => `<a class="lead-card row between" href="${href}" style="text-decoration:none;color:var(--ink-2)">
    <span class="row" style="gap:10px;align-items:center">${icon(ic ?? "doc", 15, "var(--accent)")} ${escapeHtml(label ?? "")}</span>
    ${icon("chevron", 14, "var(--ink-faint)")}
  </a>`,
    )
    .join("");

  const attentionCard =
    counts.workingMaterial > 0
      ? `<div class="card soft" style="margin-bottom:24px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-left:2px solid var(--accent)">
    <div>
      <div style="font-family:var(--serif);font-size:15.5px;color:var(--ink);margin-bottom:2px">${counts.workingMaterial} pieces sitting in working-material</div>
      <div class="coord">Promote them all to published in one click — they appear on the public site immediately.</div>
    </div>
    <form method="POST" action="/op/editorial/bulk-publish" style="margin:0" onsubmit="return confirm('Publish all ${counts.workingMaterial} working-material pieces?');">
      <button type="submit" class="btn primary">Publish all ${counts.workingMaterial}</button>
    </form>
  </div>`
      : "";

  const body = `
${opHeader("Console", "the standing record · operator")}
<div class="op-content">
  ${commandBar()}
  ${attentionCard}
  <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:28px;margin-top:6px" class="op-grid">
    <div>
      ${sectionHead("Leads — the last thing built points at the next", '<a class="coord" href="/op/leads" style="color:var(--ink-mute);text-decoration:none">All leads →</a>')}
      ${leadsBlock}
      ${sectionHead("Corpus at a glance", "")}
      <div class="cards-4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:6px">
        ${statCard("Published", counts.publishedPieces, "/op/editorial")}
        ${statCard("Working", counts.workingMaterial, "/op/editorial")}
        ${statCard("Entities", counts.entities, "/op/workbench")}
        ${statCard("Topics", counts.topics, "/topics")}
      </div>
    </div>
    <aside style="display:flex;flex-direction:column;gap:28px">
      <div>
        ${sectionHead("Recent activity", "")}
        ${recentBlock}
      </div>
      <div>
        ${sectionHead("Quick start", "")}
        <div class="col" style="gap:8px">${quickStart}</div>
      </div>
    </aside>
  </div>
</div>`;
  return renderOpPage({ title: "Console", body, activeNav: "/op", fullBleed: true });
}

function sectionHead(label: string, action: string): string {
  return `<div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:16px;gap:16px">
  <div class="label">${escapeHtml(label)}</div>
  ${action}
</div>`;
}

function statCard(label: string, value: number, href: string): string {
  return `<a class="cardlink" href="${href}" style="text-align:center;padding:20px;text-decoration:none">
  <div style="font-family:var(--mono);font-size:30px;color:var(--ink);font-variant-numeric:tabular-nums">${value}</div>
  <div class="label" style="margin-top:6px">${escapeHtml(label)}</div>
</a>`;
}

async function loadCounts(db: D1Database, userId: string): Promise<Counts> {
  // D1's SQLite limits UNION ALL to ~5 terms (SQLITE_LIMIT_COMPOUND_SELECT
  // = 5). Run individual counts in parallel against the same connection
  // instead — Workers AI / D1 handles concurrent reads fine.
  const scalar = async (sql: string, binds: unknown[]): Promise<number> => {
    const row = await db
      .prepare(sql)
      .bind(...binds)
      .first<{ n: number }>();
    return row?.n ?? 0;
  };
  const [pieces, entities, proposals, topics, workingMaterial, publishedPieces] = await Promise.all(
    [
      scalar("SELECT COUNT(*) AS n FROM pieces WHERE user_id = ?", [userId]),
      scalar("SELECT COUNT(*) AS n FROM entities WHERE user_id = ?", [userId]),
      scalar("SELECT COUNT(*) AS n FROM character_update_proposals WHERE status = 'pending'", []),
      scalar("SELECT COUNT(*) AS n FROM topics WHERE user_id = ?", [userId]),
      scalar(
        "SELECT COUNT(*) AS n FROM pieces WHERE user_id = ? AND publication_status = 'working-material'",
        [userId],
      ),
      scalar(
        "SELECT COUNT(*) AS n FROM pieces WHERE user_id = ? AND publication_status IN ('published','canonical')",
        [userId],
      ),
    ],
  );
  return { pieces, entities, proposals, topics, workingMaterial, publishedPieces };
}

async function loadRecent(db: D1Database, userId: string): Promise<RecentItem[]> {
  const rows = await all<{
    slug: string;
    title: string;
    publication_status: string;
    updated_at: string;
  }>(
    db,
    `SELECT slug, title, publication_status, COALESCE(published_at, updated_at, created_at) AS updated_at
       FROM pieces
      WHERE user_id = ?
      ORDER BY COALESCE(published_at, updated_at, created_at) DESC
      LIMIT 8`,
    [userId],
  );
  return rows.map((r) => ({
    tag: r.publication_status,
    text: r.title,
    when: formatRelative(r.updated_at),
    href: r.publication_status === "working-material" ? undefined : `/p/${r.slug}`,
  }));
}

async function loadLeads(db: D1Database): Promise<Lead[]> {
  // Pending entity-update proposals surface as actionable leads.
  const rows = await all<{
    id: string;
    entity_slug: string;
    kind: string;
    rationale: string | null;
  }>(
    db,
    `SELECT p.id, e.public_slug AS entity_slug, p.kind, p.rationale
       FROM character_update_proposals p
       JOIN entities e ON e.id = p.entity_id
      WHERE p.status = 'pending'
      ORDER BY p.created_at DESC
      LIMIT 4`,
  );
  return rows.map((r) => ({
    id: r.id.slice(0, 8),
    kind: r.kind.replace(/_/g, " "),
    text: r.rationale ?? "pending update",
    entity_slug: r.entity_slug,
  }));
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const delta = Date.now() - t;
  const min = Math.round(delta / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d`;
  return iso.slice(0, 10);
}

function zeroCounts(): Counts {
  return {
    pieces: 0,
    entities: 0,
    proposals: 0,
    topics: 0,
    workingMaterial: 0,
    publishedPieces: 0,
  };
}
