// Studio — audio production. The natural terminus of structure-first.
// Lists scripts (studio_scripts table when enabled); link to the chat
// to propose a script from a piece. Disabled when STUDIO_ENABLED != true.

import type { Env } from "../../env";
import { all } from "../../lib/d1";
import { escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { icon, opHeader, renderOpPage } from "../layout";

interface ScriptRow {
  id: string;
  piece_slug: string;
  status: string;
  segment_count: number;
  created_at: string;
}

export async function renderStudio(env: Env): Promise<string> {
  if (env.STUDIO_ENABLED !== "true") return renderDisabled();
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return renderEmpty();

  const scripts = await all<ScriptRow>(
    env.DB,
    `SELECT s.id, p.slug AS piece_slug, s.status,
            COALESCE((SELECT COUNT(*) FROM studio_segments WHERE script_id = s.id), 0) AS segment_count,
            s.created_at
       FROM studio_scripts s
       JOIN pieces p ON p.id = s.piece_id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
      LIMIT 30`,
    [userId],
  ).catch(() => [] as ScriptRow[]);

  const list = scripts.length
    ? `<div class="col" style="gap:10px">${scripts
        .map(
          (s) => `<div class="lead-card">
  <div class="row between" style="margin-bottom:6px">
    <span class="row" style="gap:8px"><span class="chip ${s.status === "stitched" ? "confirmed" : "draft"}">${escapeHtml(s.status)}</span><span class="coord">${s.segment_count} segments</span></span>
    <span class="coord">${escapeHtml(s.id.slice(0, 8))}</span>
  </div>
  <div style="font-size:14px"><a href="/record/${escapeHtml(s.piece_slug)}" style="color:var(--ink);text-decoration:none">${escapeHtml(s.piece_slug)}</a></div>
</div>`,
        )
        .join("")}</div>`
    : `<div class="card soft" style="padding:24px;text-align:center;color:var(--ink-mute);font-size:14px">No scripts yet. Open <a href="/op/chat" style="color:var(--accent)">Chat</a> and say "propose a script from <em>piece-slug</em>" to start one.</div>`;

  const body = `
${opHeader("Studio", "script → record → stitched audio")}
<div class="op-content">
  <p class="muted" style="margin-bottom:22px;font-family:var(--serif);font-size:16px;line-height:1.55;max-width:720px">
    A signed piece projects into a segmented script — already decomposed into claims and a through-line. Read each segment in your own voice, re-record any one independently, the system stitches them into a finished sequence.
  </p>
  ${sectionHead("Scripts", `<a class="btn sm" href="/op/chat" style="text-decoration:none">${icon("play", 13)} Propose new script</a>`)}
  ${list}
</div>`;

  return renderOpPage({ title: "Studio", body, activeNav: "/op/studio", fullBleed: true });
}

function sectionHead(label: string, action: string): string {
  return `<div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:16px;gap:16px">
  <div class="label">${escapeHtml(label)}</div>
  ${action}
</div>`;
}

function renderDisabled(): string {
  return renderOpPage({
    title: "Studio",
    body: `${opHeader("Studio", "audio production")}<div class="op-content"><div class="card soft" style="padding:30px;text-align:center;max-width:560px"><div style="margin-bottom:10px">${icon("play", 28, "var(--ink-faint)")}</div><div class="label" style="margin-bottom:8px">Disabled</div><p style="font-family:var(--serif);font-size:15px;line-height:1.55;color:var(--ink-2);margin:0">Set <code style="font-family:var(--mono);font-size:13px">STUDIO_ENABLED = "true"</code> in <code>wrangler.toml</code> to enable the audio production compartment.</p></div></div>`,
    activeNav: "/op/studio",
    fullBleed: true,
  });
}

function renderEmpty(): string {
  return renderOpPage({
    title: "Studio",
    body: `${opHeader("Studio", "script → record → stitched audio")}<div class="op-content"><div class="card soft" style="padding:30px;text-align:center;color:var(--ink-mute)">${icon("play", 28, "var(--accent)")}<div style="margin-top:12px;font-size:14.5px">No operator yet. Run a deploy first.</div></div></div>`,
    activeNav: "/op/studio",
    fullBleed: true,
  });
}
