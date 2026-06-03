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
  params: {
    saved?: boolean | undefined;
    published?: boolean | undefined;
    bulk?: number | undefined;
  } = {},
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

  const banner = (text: string) =>
    `<div style="margin-bottom:14px;padding:10px 14px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:var(--r);color:var(--confirmed);font-size:13px">${text}</div>`;
  const banners = [
    params.saved ? banner("✓ Saved") : "",
    params.published
      ? banner(
          `✓ Published — visible at <a href="/p/${escapeHtml(active.slug)}" target="_blank" style="color:inherit">/p/${escapeHtml(active.slug)}</a>`,
        )
      : "",
    params.bulk && params.bulk > 0
      ? banner(`✓ Bulk published ${params.bulk} piece${params.bulk === 1 ? "" : "s"}`)
      : "",
  ].join("");

  const statusDot = (s: string): string => {
    const c =
      s === "canonical"
        ? "var(--confirmed)"
        : s === "published"
          ? "var(--accent)"
          : "var(--ink-faint)";
    return `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${c};flex-shrink:0"></span>`;
  };

  const list = pieces
    .map((p) => {
      const isActive = p.slug === active.slug;
      const title = p.title?.trim();
      const titleHtml = title
        ? escapeHtml(title)
        : `<span style="font-style:italic;color:var(--ink-faint)">(no title — ${escapeHtml(p.slug.slice(0, 40))})</span>`;
      return `<a href="/op/editorial/${escapeAttr(p.slug)}" class="${isActive ? "is-active" : ""}" style="display:block;padding:10px 12px;border-radius:var(--r-sm);text-decoration:none;color:${isActive ? "var(--ink)" : "var(--ink-2)"};background:${isActive ? "var(--paper-2)" : "transparent"};margin-bottom:2px;border-left:2px solid ${isActive ? "var(--accent)" : "transparent"}">
  <div style="font-size:13.5px;line-height:1.4;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${titleHtml}</div>
  <div class="coord row" style="font-size:11px;gap:6px;align-items:center">${statusDot(p.publication_status)} ${escapeHtml(p.kind)} · ${escapeHtml(p.publication_status)}</div>
</a>`;
    })
    .join("");

  const statusBadge = `<span class="chip ${active.publication_status === "canonical" ? "confirmed" : active.publication_status === "published" ? "accent" : "draft"}">${escapeHtml(active.publication_status)}</span>`;

  // formaction on a single button beats nested <form>s (HTML doesn't allow
  // those — browsers ignore the inner form and the inner button just submits
  // the outer one). With formaction, both buttons live in one form and post
  // the same title/subtitle/body_md fields; only the target URL differs.
  const publishButton =
    active.publication_status === "working-material"
      ? `<button class="btn sm accent" type="submit" formaction="/op/editorial/${escapeAttr(active.slug)}/publish" formnovalidate>${icon("check", 13)} Save &amp; publish</button>`
      : active.publication_status === "published"
        ? `<button class="btn sm" type="submit" formaction="/op/editorial/${escapeAttr(active.slug)}/publish?status=canonical">${icon("check", 13)} Save &amp; mark canonical</button>`
        : "";

  const body = `
${opHeader("Editorial", `${active.kind} · ${active.slug}`, `<a class="btn sm" href="/p/${escapeAttr(active.slug)}" target="_blank" style="text-decoration:none">${icon("doc", 13)} View public</a>`)}
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
          <div class="row" style="gap:10px;align-items:center">${statusBadge}<span class="coord">${escapeHtml(active.byline ?? "the operator")}</span><span class="coord" style="color:var(--ink-faint)">·</span><span class="coord">${escapeHtml(kindLabel(active.kind))}</span></div>
          <div class="row" style="gap:8px">${publishButton}<button class="btn sm primary" type="submit">Save</button></div>
        </div>
        <input name="title" value="${escapeAttr(active.title ?? "")}" placeholder="Title…"
               style="background:transparent;border:none;border-bottom:1px solid var(--rule);padding:8px 0;font-family:var(--serif);font-size:30px;letter-spacing:-0.02em;color:var(--ink);font-weight:600;width:100%" />
        <input name="subtitle" value="${escapeAttr(active.subtitle ?? "")}" placeholder="Subtitle…"
               style="background:transparent;border:none;border-bottom:1px solid var(--rule-soft);padding:6px 0;font-family:var(--serif);font-size:17px;color:var(--ink-2);width:100%" />
        ${renderKindHint(active.kind)}
        <textarea name="body_md" rows="22"
                  style="background:var(--surface);border:1px solid var(--rule);border-radius:var(--r);padding:16px;font-family:var(--mono);font-size:13.5px;line-height:1.65;color:var(--ink);width:100%;resize:vertical">${escapeHtml(active.body_md ?? "")}</textarea>
        ${renderEditorFoot(active.body_md ?? "")}
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

function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    essay: "Essay",
    "research-report": "Research report",
    "documented-record": "Documented record",
    thesis: "Thesis",
    synthesis: "Synthesis",
    brief: "Brief",
    note: "Library entry",
  };
  return map[kind] ?? kind;
}

function renderKindHint(kind: string): string {
  const hint =
    kind === "research-report" || kind === "brief"
      ? `<div class="card soft" style="padding:12px 14px;font-size:12.5px;color:var(--ink-2);line-height:1.55;font-family:var(--mono)">
      Structure for the rendered page: <code>## Short version</code> (bulleted), <code>## Key findings</code> with <code>### sub-headings</code>, <code>## Caveats &amp; confidence</code> (bulleted). Anything else renders as trailing prose.
    </div>`
      : kind === "documented-record"
        ? `<div class="card soft" style="padding:12px 14px;font-size:12.5px;color:var(--ink-2);line-height:1.55;font-family:var(--mono)">
      Structure: <code>## What this is</code> (bulleted), <code>## What this is not</code> (bulleted), prose, then <code>## Source log</code> (one entry per line, "Title — Org · Date").
    </div>`
        : kind === "essay" || kind === "thesis" || kind === "synthesis"
          ? `<div class="card soft" style="padding:12px 14px;font-size:12.5px;color:var(--ink-2);line-height:1.55;font-family:var(--mono)">
      Free-form serif prose. Use Markdown sections as you would in an essay; no rigid template.
    </div>`
          : "";
  return hint;
}

function renderEditorFoot(body_md: string): string {
  const words = body_md.split(/\s+/).filter(Boolean).length;
  const chars = body_md.length;
  const minutes = words < 50 ? 0 : Math.max(1, Math.round(words / 200));
  const reading = minutes > 0 ? ` · ~${minutes} min read` : "";
  return `<div class="coord" style="font-size:11px;display:flex;justify-content:space-between">
    <span>Markdown · ${words.toLocaleString()} words${reading}</span>
    <span>${chars.toLocaleString()} characters</span>
  </div>`;
}

function renderEmpty(): string {
  const body = `
${opHeader("Editorial", "write & finish signed pieces")}
<div class="op-content">
  <div class="card soft" style="padding:40px 36px;max-width:680px;margin:24px auto 0;text-align:center">
    <div style="margin-bottom:14px;display:inline-flex;width:48px;height:48px;align-items:center;justify-content:center;background:var(--paper-2);border-radius:50%;color:var(--accent)">${icon("edit", 22)}</div>
    <h3 style="font-size:18px;margin:0 0 8px;color:var(--ink);font-family:var(--serif);font-weight:600">No pieces yet</h3>
    <p style="font-family:var(--serif);font-size:15px;line-height:1.6;color:var(--ink-2);margin:0 0 22px;max-width:480px;margin-left:auto;margin-right:auto">
      Editorial is where pieces get titled, sub-titled, and finished before they ship.
      Drop a document in Ingest or draft one through Chat to get started.
    </p>
    <div class="row" style="gap:10px;justify-content:center;flex-wrap:wrap">
      <a class="btn accent" href="/op/ingest" style="text-decoration:none">${icon("arrowUR", 14)} Ingest documents</a>
      <a class="btn" href="/op/chat" style="text-decoration:none">${icon("chat", 14)} Open chat</a>
    </div>
  </div>
</div>`;
  return renderOpPage({ title: "Editorial", body, activeNav: "/op/editorial", fullBleed: true });
}
