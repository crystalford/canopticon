// Patterns — the lighthouse, operator side. Signed patterns + the
// triage queue. Real data from the patterns table.

import { renderMarkdown } from "../../cms/lib/render-post";
import { all } from "../../lib/d1";
import { escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { icon, opHeader, renderOpPage } from "../layout";

interface PatternRow {
  id: string;
  slug: string;
  title: string;
  kind: string;
  statement_md: string | null;
  confidence: string | null;
  signed_at: string | null;
  disconfirming_md: string | null;
}

export async function renderPatterns(env: { DB: D1Database }): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return renderEmpty();

  const rows = await all<PatternRow>(
    env.DB,
    `SELECT id, slug, title, kind, statement_md, confidence, signed_at, disconfirming_md
       FROM patterns WHERE user_id = ?
      ORDER BY signed_at IS NULL, signed_at DESC, created_at DESC
      LIMIT 40`,
    [userId],
  );

  if (rows.length === 0) return renderEmpty();

  const signed = rows.filter((p) => p.signed_at);
  const queue = rows.filter((p) => !p.signed_at);

  const renderCard = (
    p: PatternRow,
    isSigned: boolean,
  ): string => `<div class="lead-card${isSigned ? "" : " project"}">
  <div class="row between" style="margin-bottom:10px;gap:12px;flex-wrap:wrap">
    <span class="row" style="gap:8px">
      <span class="chip">${escapeHtml(p.kind ?? "pattern")}</span>
      ${p.confidence ? `<span class="chip">${escapeHtml(p.confidence)}</span>` : ""}
      <span class="chip ${isSigned ? "confirmed" : "draft"}">${isSigned ? "signed" : "candidate"}</span>
    </span>
    <span class="coord">${escapeHtml(p.id.slice(0, 8))}</span>
  </div>
  <div style="font-family:var(--serif);font-size:17px;line-height:1.4;margin-bottom:8px">${escapeHtml(p.title)}</div>
  ${p.statement_md ? `<div class="prose" style="font-size:13.5px;line-height:1.55;color:var(--ink-2);margin-bottom:10px">${renderMarkdown(p.statement_md.slice(0, 400))}${p.statement_md.length > 400 ? "…" : ""}</div>` : ""}
  ${p.disconfirming_md ? `<div class="diff-row" style="margin-bottom:12px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.18);border-radius:var(--r);padding:10px 14px"><div style="flex:1"><div class="coord" style="color:var(--correction);margin-bottom:4px">Disconfirming evidence</div><div style="font-size:13px;color:var(--ink-2);line-height:1.5">${escapeHtml(p.disconfirming_md.slice(0, 240))}${p.disconfirming_md.length > 240 ? "…" : ""}</div></div></div>` : ""}
  <div class="row" style="gap:8px">
    ${isSigned ? `<a class="btn sm" href="/patterns/${escapeHtml(p.slug)}" target="_blank" style="text-decoration:none">${icon("doc", 13)} View public</a>` : `<form method="POST" action="/op/patterns/${escapeHtml(p.id)}/sign" style="display:inline"><button class="btn sm accent" type="submit">${icon("check", 13)} Sign</button></form>`}
  </div>
</div>`;

  const body = `
${opHeader("Patterns", "the lighthouse · triage candidates, sign or dismiss")}
<div class="op-content">
  <p class="muted" style="max-width:730px;margin-bottom:26px;font-family:var(--serif);font-size:16px;line-height:1.55">
    The lighthouse reads the whole corpus and hands you candidate patterns. Every candidate is a hypothesis until you sign it; nothing here is public until signed.
  </p>

  ${sectionHead(`Candidates · triage queue (${queue.length})`, `<span class="coord">unsigned</span>`)}
  ${queue.length ? `<div class="col" style="gap:12px;margin-bottom:36px">${queue.map((p) => renderCard(p, false)).join("")}</div>` : `<div class="card soft" style="padding:18px 22px;color:var(--ink-mute);font-size:13.5px;margin-bottom:36px">No candidates yet. Patterns are surfaced by the lighthouse worker as the corpus grows.</div>`}

  ${sectionHead(`Signed · public (${signed.length})`, "")}
  ${signed.length ? `<div class="col" style="gap:12px">${signed.map((p) => renderCard(p, true)).join("")}</div>` : `<div class="card soft" style="padding:18px 22px;color:var(--ink-mute);font-size:13.5px">No signed patterns yet.</div>`}
</div>`;

  return renderOpPage({ title: "Patterns", body, activeNav: "/op/patterns", fullBleed: true });
}

export async function signPattern(env: { DB: D1Database }, patternId: string): Promise<void> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) throw new Error("no operator user");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE patterns SET signed_at = ?, signed_by = ?, updated_at = ?
      WHERE user_id = ? AND id = ?`,
  )
    .bind(now, "the operator", now, userId, patternId)
    .run();
}

function sectionHead(label: string, action: string): string {
  return `<div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:16px;gap:16px">
  <div class="label">${escapeHtml(label)}</div>
  ${action}
</div>`;
}

function renderEmpty(): string {
  const body = `
${opHeader("Patterns", "the lighthouse · triage candidates")}
<div class="op-content">
  <div class="card soft" style="padding:40px 36px;max-width:680px;margin:24px auto 0;text-align:center">
    <div style="margin-bottom:14px;display:inline-flex;width:48px;height:48px;align-items:center;justify-content:center;background:var(--paper-2);border-radius:50%;color:var(--accent)">${icon("grid", 22)}</div>
    <h3 style="font-size:18px;margin:0 0 8px;color:var(--ink);font-family:var(--serif);font-weight:600">No patterns yet</h3>
    <p style="font-family:var(--serif);font-size:15px;line-height:1.6;color:var(--ink-2);margin:0 0 22px;max-width:480px;margin-left:auto;margin-right:auto">
      Patterns are insights that emerge across documents — no single piece contains them. The lighthouse needs corpus to read; ingest some documents and run the detector to surface candidate patterns.
    </p>
    <a class="btn accent" href="/op/ingest" style="text-decoration:none">${icon("arrowUR", 14)} Ingest documents</a>
  </div>
</div>`;
  return renderOpPage({ title: "Patterns", body, activeNav: "/op/patterns", fullBleed: true });
}
