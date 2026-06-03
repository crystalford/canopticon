// Publish — projects a piece to its public face. Preview iframe of the
// real public template. Promotes status (working-material → published →
// canonical) via POST.

import { all, one } from "../../lib/d1";
import { escapeAttr, escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { icon, opHeader, renderOpPage } from "../layout";

interface PubPiece {
  id: string;
  slug: string;
  title: string;
  kind: string;
  publication_status: string;
}

export async function renderPublish(env: { DB: D1Database }, slug?: string): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return renderEmpty();

  const pieces = await all<PubPiece>(
    env.DB,
    `SELECT id, slug, title, kind, publication_status FROM pieces
      WHERE user_id = ?
      ORDER BY CASE publication_status
                 WHEN 'working-material' THEN 0
                 WHEN 'published' THEN 1
                 WHEN 'canonical' THEN 2 ELSE 3 END,
               COALESCE(updated_at, created_at) DESC
      LIMIT 80`,
    [userId],
  );

  if (pieces.length === 0) return renderEmpty();

  const targetSlug = slug ?? pieces[0]?.slug ?? "";
  const active =
    pieces.find((p) => p.slug === targetSlug) ??
    (await one<PubPiece>(
      env.DB,
      "SELECT id, slug, title, kind, publication_status FROM pieces WHERE user_id = ? AND slug = ?",
      [userId, targetSlug],
    ));

  if (!active) return renderEmpty();

  const switcher = `<form method="GET" action="/op/publish" onchange="this.submit()" style="display:flex;gap:6px;align-items:center">
  <label class="coord" style="font-size:11px">piece:</label>
  <select name="slug" style="background:var(--surface);border:1px solid var(--rule);border-radius:var(--r-sm);padding:5px 8px;color:var(--ink);font-size:12.5px">${pieces
    .map(
      (p) =>
        `<option value="${escapeAttr(p.slug)}"${p.slug === active.slug ? " selected" : ""}>${escapeHtml(p.title)}</option>`,
    )
    .join("")}</select>
</form>`;

  const isWorking = active.publication_status === "working-material";
  const isPublished = active.publication_status === "published";
  const previewUrl = isWorking ? "" : `/p/${active.slug}`;

  const actions = `
    ${
      isWorking
        ? `<form method="POST" action="/op/publish/${escapeAttr(active.slug)}" style="display:inline"><input type="hidden" name="status" value="published" /><button class="btn primary" type="submit">${icon("check", 14)} Publish living page</button></form>`
        : ""
    }
    ${
      isPublished
        ? `<form method="POST" action="/op/publish/${escapeAttr(active.slug)}" style="display:inline"><input type="hidden" name="status" value="canonical" /><button class="btn accent" type="submit">${icon("check", 14)} Freeze as canonical</button></form>`
        : ""
    }
    ${
      !isWorking
        ? `<form method="POST" action="/op/publish/${escapeAttr(active.slug)}" style="display:inline"><input type="hidden" name="status" value="working-material" /><button class="btn ghost" type="submit">↩ Move back to working</button></form>`
        : ""
    }`;

  const statusTone = isPublished
    ? "accent"
    : active.publication_status === "canonical"
      ? "confirmed"
      : "draft";

  const body = `
${opHeader("Publish", "project a node to its public face", switcher)}
<div class="op-content">
  <p class="muted" style="margin-bottom:20px;font-family:var(--serif);font-size:16px;line-height:1.55;max-width:680px">
    Project a piece to its public face. The preview below is the real public template — what you see is literally what ships. Publishing is a deliberate action; the assistant never publishes on its own.
  </p>
  <div class="row between" style="margin-bottom:16px;flex-wrap:wrap;gap:12px">
    <div class="row" style="gap:10px">
      <span class="chip ${statusTone}">${escapeHtml(active.publication_status)}</span>
      <span class="coord">/p/${escapeHtml(active.slug)}</span>
    </div>
    <div class="row" style="gap:8px;flex-wrap:wrap">${actions}</div>
  </div>
  ${
    previewUrl
      ? `<div style="border:1px solid var(--rule);border-radius:var(--r-lg);overflow:hidden;height:70vh">
          <iframe src="${escapeAttr(previewUrl)}" title="public preview" style="width:100%;height:100%;border:none;background:#fff"></iframe>
        </div>`
      : `<div class="card soft" style="padding:30px;text-align:center;color:var(--ink-mute)">
          <div style="margin-bottom:10px">${icon("doc", 28, "var(--accent)")}</div>
          <div style="font-size:14.5px;margin-bottom:6px">No public preview yet</div>
          <div style="font-size:13px">This piece is working-material. Publish to see it on the public site.</div>
        </div>`
  }
</div>`;

  return renderOpPage({
    title: `Publish · ${active.title}`,
    body,
    activeNav: "/op/publish",
    fullBleed: true,
  });
}

export async function changePublicationStatus(
  env: { DB: D1Database },
  slug: string,
  status: "working-material" | "published" | "canonical",
): Promise<void> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) throw new Error("no operator user");
  const now = new Date().toISOString();
  const publishedAtUpdate =
    status === "working-material" ? "published_at" : "COALESCE(published_at, ?)";
  if (status === "working-material") {
    await env.DB.prepare(
      "UPDATE pieces SET publication_status = ?, updated_at = ? WHERE user_id = ? AND slug = ?",
    )
      .bind(status, now, userId, slug)
      .run();
  } else {
    await env.DB.prepare(
      `UPDATE pieces SET publication_status = ?, published_at = ${publishedAtUpdate}, updated_at = ? WHERE user_id = ? AND slug = ?`,
    )
      .bind(status, now, now, userId, slug)
      .run();
  }
}

function renderEmpty(): string {
  const body = `
${opHeader("Publish", "project a piece to its public face")}
<div class="op-content">
  <div class="card soft" style="padding:40px 36px;max-width:680px;margin:24px auto 0;text-align:center">
    <div style="margin-bottom:14px;display:inline-flex;width:48px;height:48px;align-items:center;justify-content:center;background:var(--paper-2);border-radius:50%;color:var(--accent)">${icon("check", 22)}</div>
    <h3 style="font-size:18px;margin:0 0 8px;color:var(--ink);font-family:var(--serif);font-weight:600">No pieces to publish yet</h3>
    <p style="font-family:var(--serif);font-size:15px;line-height:1.6;color:var(--ink-2);margin:0 0 22px;max-width:480px;margin-left:auto;margin-right:auto">
      Publish is where pieces move from working-material → published → canonical. Once a piece exists, you'll preview the real public render here and ship it with one click.
    </p>
    <a class="btn accent" href="/op/ingest" style="text-decoration:none">${icon("arrowUR", 14)} Ingest documents</a>
  </div>
</div>`;
  return renderOpPage({ title: "Publish", body, activeNav: "/op/publish", fullBleed: true });
}
