// Ingest — door two. The premium intake. Drop a document (or a zip of
// many), see what would change in the structure (claims, entities,
// near-duplicates), confirm. The system is supposed to work organically
// from documents — no seed corpus required.

import type { Env } from "../../env";
import { all } from "../../lib/d1";
import { resolveOperatorId } from "../../public/data";
import { escapeHtml } from "../../public/layout";
import { commandBar, icon, opHeader, renderOpPage } from "../layout";

interface DbStats {
  entities: number;
  pieces: number;
  workingMaterial: number;
  published: number;
  ingested: number;
}

async function getStats(env: Env): Promise<DbStats> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return { entities: 0, pieces: 0, workingMaterial: 0, published: 0, ingested: 0 };
  const rows = await all<{ k: string; n: number }>(
    env.DB,
    `SELECT 'entities' AS k, count(*) AS n FROM entities WHERE user_id = ?
     UNION ALL SELECT 'pieces', count(*) FROM pieces WHERE user_id = ?
     UNION ALL SELECT 'working', count(*) FROM pieces WHERE user_id = ? AND publication_status = 'working-material'
     UNION ALL SELECT 'published', count(*) FROM pieces WHERE user_id = ? AND publication_status IN ('published','canonical')
     UNION ALL SELECT 'ingested', count(*) FROM pieces
        WHERE user_id = ? AND json_valid(metadata)
          AND json_extract(metadata, '$.ingested_from') IS NOT NULL`,
    [userId, userId, userId, userId, userId],
  );
  const m = new Map(rows.map((r) => [r.k, r.n]));
  return {
    entities: m.get("entities") ?? 0,
    pieces: m.get("pieces") ?? 0,
    workingMaterial: m.get("working") ?? 0,
    published: m.get("published") ?? 0,
    ingested: m.get("ingested") ?? 0,
  };
}

async function recentIngests(
  env: Env,
): Promise<Array<{ slug: string; title: string; kind: string; ts: string }>> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return [];
  return all<{ slug: string; title: string; kind: string; ts: string }>(
    env.DB,
    `SELECT slug, title, kind, COALESCE(updated_at, created_at) AS ts
       FROM pieces
      WHERE user_id = ? AND publication_status = 'working-material'
      ORDER BY COALESCE(updated_at, created_at) DESC
      LIMIT 8`,
    [userId],
  );
}

export async function renderIngestScreen(
  env: Env,
  params: { result?: string | undefined; error?: string | undefined } = {},
): Promise<string> {
  const [stats, recent] = await Promise.all([getStats(env), recentIngests(env)]);

  const resultBanner = params.result
    ? `<div style="margin-bottom:24px;padding:14px 18px;border-radius:var(--r);background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);color:var(--ink);font-size:13.5px;white-space:pre-wrap;font-family:var(--mono)">${escapeHtml(params.result)}</div>`
    : "";

  const errorBanner = params.error
    ? `<div style="margin-bottom:24px;padding:14px 18px;border-radius:var(--r);background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:var(--correction);font-size:13.5px;font-family:var(--mono)">${escapeHtml(params.error)}</div>`
    : "";

  const statCard = (label: string, value: number) =>
    `<div style="text-align:center;padding:16px 20px;border-radius:var(--r-lg);background:var(--surface);border:1px solid var(--rule)">
      <div style="font-family:var(--mono);font-size:26px;color:var(--ink);font-variant-numeric:tabular-nums">${value}</div>
      <div class="label" style="margin-top:4px">${escapeHtml(label)}</div>
    </div>`;

  const recentList = recent.length
    ? `<div class="col" style="gap:0">${recent
        .map(
          (r) => `<div style="padding:10px 0;border-bottom:1px solid var(--rule-soft)">
  <div class="row between" style="margin-bottom:3px">
    <a href="/op/editorial/${escapeHtml(r.slug)}" style="font-size:14px;color:var(--ink);text-decoration:none">${escapeHtml(r.title)}</a>
    <span class="coord">${escapeHtml(formatRelative(r.ts))}</span>
  </div>
  <div class="coord" style="font-size:11px">${escapeHtml(r.kind)} · working-material</div>
</div>`,
        )
        .join("")}</div>`
    : `<div class="coord faint">No working-material pieces yet. Drop a document above to get started.</div>`;

  const body = `
${opHeader("Ingest", "drop documents · land on the public site")}
<div class="op-content">
  <p class="muted" style="margin-bottom:24px;font-family:var(--serif);font-size:16px;line-height:1.6;max-width:680px">
    Drop a file (or a zip of files). Each becomes a piece. By default new pieces are
    <strong>published</strong> immediately — the public site shows them as soon as ingest finishes.
    Drop into <strong>working-material</strong> if you want to edit them in <a href="/op/editorial" style="color:var(--accent)">Editorial</a> first.
  </p>

  ${resultBanner}${errorBanner}

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:32px">
    ${statCard("Entities", stats.entities)}
    ${statCard("Pieces total", stats.pieces)}
    ${statCard("Working-material", stats.workingMaterial)}
    ${statCard("Published", stats.published)}
  </div>

  ${
    stats.workingMaterial > 0
      ? `<div class="card soft" style="margin-bottom:14px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-left:2px solid var(--accent)">
    <div>
      <div style="font-family:var(--serif);font-size:15px;color:var(--ink);margin-bottom:2px">${stats.workingMaterial} pieces sitting in working-material</div>
      <div class="coord">Promote them all to published in one click — appears on the public site immediately.</div>
    </div>
    <form method="POST" action="/op/editorial/bulk-publish" style="margin:0" onsubmit="return confirm('Publish all ${stats.workingMaterial} working-material pieces?');">
      <button type="submit" class="btn primary">Publish all ${stats.workingMaterial}</button>
    </form>
  </div>`
      : ""
  }
  ${
    stats.ingested > 0
      ? `<div class="card soft" style="margin-bottom:28px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-left:2px solid var(--correction)">
    <div>
      <div style="font-family:var(--serif);font-size:15px;color:var(--ink);margin-bottom:2px">${stats.ingested} pieces previously imported through Ingest</div>
      <div class="coord">Reset wipes only pieces that came in here — seed corpus and chat-drafted pieces stay. Then re-upload clean.</div>
    </div>
    <form method="POST" action="/op/ingest/reset" style="margin:0" onsubmit="return confirm('Permanently delete all ${stats.ingested} previously imported pieces? Seed corpus and chat-drafted pieces are not affected. This cannot be undone.');">
      <button type="submit" class="btn" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:var(--correction)">Reset imported pieces (${stats.ingested})</button>
    </form>
  </div>`
      : ""
  }

  <section style="margin-bottom:36px">
    ${sectionHead("Drop a document", '<span class="coord">.md · .txt · .zip</span>')}
    <form method="POST" action="/op/ingest/upload" enctype="multipart/form-data"
          style="display:flex;flex-direction:column;gap:14px"
          onsubmit="this.querySelector('button[type=submit]').textContent='Ingesting…';this.querySelector('button[type=submit]').disabled=true">
      <label class="card soft" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px;border:1px dashed var(--rule);cursor:pointer;text-align:center;gap:8px">
        ${icon("arrowUR", 28, "var(--accent)")}
        <div style="font-family:var(--serif);font-size:16px;color:var(--ink);margin-top:6px">Pick file(s) or drop a zip</div>
        <div class="coord">single .md/.txt, or a .zip containing many — the worker extracts and ingests each</div>
        <input type="file" name="file" accept=".md,.txt,.zip,text/markdown,text/plain,application/zip" multiple
               style="margin-top:12px;font-size:13px;color:var(--ink-2)" />
      </label>
      <div class="row between" style="gap:14px;flex-wrap:wrap">
        <label class="row" style="gap:8px;align-items:center;font-size:13px;color:var(--ink-2)">
          <span style="color:var(--ink-mute)">Publication status:</span>
          <select name="status" style="background:var(--surface);border:1px solid var(--rule);border-radius:var(--r-sm);padding:5px 8px;color:var(--ink);font-size:13px">
            <option value="published" selected>Published (public immediately)</option>
            <option value="working-material">Working-material (draft, edit first)</option>
          </select>
        </label>
        <label class="row" style="gap:8px;align-items:center;font-size:13px;color:var(--ink-2)">
          <input type="checkbox" name="force" value="1" style="accent-color:var(--accent)" />
          Force overwrite existing
        </label>
        <button type="submit" class="btn primary">Ingest</button>
      </div>
    </form>
  </section>

  ${commandBar('Or describe what you want to ingest — "Save this URL as a piece", "Extract claims from the attached PDF"…')}

  <section style="margin-top:36px">
    ${sectionHead("Recent working-material", "")}
    ${recentList}
  </section>
</div>`;

  return renderOpPage({ title: "Ingest", body, activeNav: "/op/ingest", fullBleed: true });
}

function sectionHead(label: string, action: string): string {
  return `<div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:16px;gap:16px">
  <div class="label">${escapeHtml(label)}</div>
  ${action}
</div>`;
}

function formatRelative(iso: string | null | undefined): string {
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
