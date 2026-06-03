// Editorial — the writing interface. Lists pieces (working-material first,
// then published); pick one to load its body into a textarea. Save
// updates body_md + body_html. Publish promotes status.

import { renderMarkdown } from "../../cms/lib/render-post";
import { all, one } from "../../lib/d1";
import { escapeAttr, escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { icon, opHeader, renderOpPage } from "../layout";

interface EditPiece {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  kind: string;
  publication_status: string;
  body_md: string | null;
  byline: string | null;
}

interface PieceListRow {
  slug: string;
  title: string;
  kind: string;
  publication_status: string;
}

export async function renderEditorial(
  env: { DB: D1Database },
  slug?: string,
  params: { saved?: boolean; published?: boolean } = {},
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return renderEmpty();

  const pieces = await all<PieceListRow>(
    env.DB,
    `SELECT slug, title, kind, publication_status FROM pieces
      WHERE user_id = ?
      ORDER BY CASE publication_status
                 WHEN 'working-material' THEN 0
                 WHEN 'published' THEN 1
                 WHEN 'canonical' THEN 2 ELSE 3 END,
               COALESCE(updated_at, created_at) DESC
      LIMIT 80`,
    [userId],
  );

  if (pieces.length === 0) {
    return renderEmpty();
  }

  const targetSlug = slug ?? pieces[0]?.slug ?? "";
  const active = await one<EditPiece>(
    env.DB,
    `SELECT id, slug, title, subtitle, kind, publication_status, body_md, byline
       FROM pieces WHERE user_id = ? AND slug = ?`,
    [userId, targetSlug],
  );

  if (!active) {
    return renderEmpty();
  }

  const banners = [
    params.saved
      ? `<div style="margin-bottom:14px;padding:10px 14px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:var(--r);color:var(--confirmed);font-size:13px">✓ Saved</div>`
      : "",
    params.published
      ? `<div style="margin-bottom:14px;padding:10px 14px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:var(--r);color:var(--confirmed);font-size:13px">✓ Published — visible at /record/${escapeHtml(active.slug)}</div>`
      : "",
  ].join("");

  const list = pieces
    .map((p) => {
      const isActive = p.slug === active.slug;
      return `<a href="/op/editorial/${escapeAttr(p.slug)}" class="${isActive ? "is-active" : ""}" style="display:block;padding:10px 12px;border-radius:var(--r-sm);text-decoration:none;color:${isActive ? "var(--ink)" : "var(--ink-2)"};background:${isActive ? "var(--paper-2)" : "transparent"};margin-bottom:2px">
  <div style="font-size:13.5px;line-height:1.4;margin-bottom:3px">${escapeHtml(p.title)}</div>
  <div class="coord" style="font-size:11px">${escapeHtml(p.kind)} · ${escapeHtml(p.publication_status)}</div>
</a>`;
    })
    .join("");

  const statusBadge = `<span class="chip ${active.publication_status === "canonical" ? "confirmed" : active.publication_status === "published" ? "accent" : "draft"}">${escapeHtml(active.publication_status)}</span>`;

  const publishForm =
    active.publication_status === "working-material"
      ? `<form method="POST" action="/op/editorial/${escapeAttr(active.slug)}/publish" style="display:inline">
        <button class="btn sm accent" type="submit">${icon("check", 13)} Publish</button>
      </form>`
      : active.publication_status === "published"
        ? `<form method="POST" action="/op/editorial/${escapeAttr(active.slug)}/publish" style="display:inline">
          <input type="hidden" name="status" value="canonical" />
          <button class="btn sm" type="submit">${icon("check", 13)} Mark canonical</button>
        </form>`
        : "";

  const body = `
${opHeader("Editorial", `${active.kind} · ${active.slug}`, `<a class="btn sm" href="/record/${escapeAttr(active.slug)}" target="_blank" style="text-decoration:none">${icon("doc", 13)} View public</a>`)}
<div class="op-content">
  ${banners}
  <div style="display:grid;grid-template-columns:280px 1fr;gap:24px">
    <aside style="border-right:1px solid var(--rule);padding-right:18px">
      <div class="label" style="margin-bottom:10px">Pieces (${pieces.length})</div>
      <div style="max-height:70vh;overflow-y:auto">${list}</div>
    </aside>
    <div>
      <form method="POST" action="/op/editorial/${escapeAttr(active.slug)}/save" style="display:flex;flex-direction:column;gap:14px">
        <div class="row between" style="gap:10px;flex-wrap:wrap">
          <div class="row" style="gap:10px;align-items:center">${statusBadge}<span class="coord">${escapeHtml(active.byline ?? "the operator")}</span></div>
          <div class="row" style="gap:8px">${publishForm}<button class="btn sm primary" type="submit">Save</button></div>
        </div>
        <input name="title" value="${escapeAttr(active.title)}" required
               style="background:transparent;border:none;border-bottom:1px solid var(--rule);padding:8px 0;font-family:var(--serif);font-size:30px;letter-spacing:-0.02em;color:var(--ink);font-weight:600;width:100%" />
        <input name="subtitle" value="${escapeAttr(active.subtitle ?? "")}" placeholder="Subtitle…"
               style="background:transparent;border:none;border-bottom:1px solid var(--rule-soft);padding:6px 0;font-family:var(--serif);font-size:17px;color:var(--ink-2);width:100%" />
        <textarea name="body_md" rows="22"
                  style="background:var(--surface);border:1px solid var(--rule);border-radius:var(--r);padding:16px;font-family:var(--mono);font-size:13px;line-height:1.6;color:var(--ink);width:100%;resize:vertical">${escapeHtml(active.body_md ?? "")}</textarea>
        <div class="coord" style="font-size:11px">Markdown · ${(active.body_md ?? "").split(/\s+/).filter(Boolean).length} words</div>
      </form>
    </div>
  </div>
</div>`;

  return renderOpPage({
    title: `Editorial · ${active.title}`,
    body,
    activeNav: "/op/editorial",
    fullBleed: true,
  });
}

export async function saveEditorial(
  env: { DB: D1Database },
  slug: string,
  form: {
    title?: string | undefined;
    subtitle?: string | undefined;
    body_md?: string | undefined;
  },
): Promise<{ slug: string }> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) throw new Error("no operator user");
  const title = (form.title ?? "").trim();
  const subtitle = (form.subtitle ?? "").trim() || null;
  const body_md = form.body_md ?? "";
  const body_html = renderMarkdown(body_md);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE pieces SET title = ?, subtitle = ?, body_md = ?, body_html = ?, updated_at = ?
      WHERE user_id = ? AND slug = ?`,
  )
    .bind(title, subtitle, body_md, body_html, now, userId, slug)
    .run();
  return { slug };
}

export async function publishEditorial(
  env: { DB: D1Database },
  slug: string,
  targetStatus: "published" | "canonical",
): Promise<void> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) throw new Error("no operator user");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE pieces SET publication_status = ?, published_at = COALESCE(published_at, ?), updated_at = ?
      WHERE user_id = ? AND slug = ?`,
  )
    .bind(targetStatus, now, now, userId, slug)
    .run();
}

function renderEmpty(): string {
  const body = `
${opHeader("Editorial", "write & finish signed pieces")}
<div class="op-content">
  <div class="card soft" style="padding:30px;max-width:640px;text-align:center">
    <h3 style="font-size:16px;margin:0 0 8px;color:var(--ink)">No pieces yet</h3>
    <p style="font-family:var(--serif);font-size:15px;line-height:1.55;color:var(--ink-2);margin:0 0 16px">
      Drop a document in <a href="/op/ingest" style="color:var(--accent)">Ingest</a> or draft one through <a href="/op/chat" style="color:var(--accent)">Chat</a>.
    </p>
  </div>
</div>`;
  return renderOpPage({ title: "Editorial", body, activeNav: "/op/editorial", fullBleed: true });
}
