// Library document detail — the operator-side view of a single piece.
//
// Every document in the archive opens here regardless of publication
// status (working-material stays operator-private; the public /p/:slug
// 404s it by design). Published/canonical pieces also surface a link to
// their public page. Shows metadata, the extracted claims, sibling docs
// in the same chain, and the rendered body.

import { renderMarkdown } from "../../cms/lib/render-post";
import { all, one } from "../../lib/d1";
import { getPieceBySlug } from "../../public/data";
import { escapeAttr, escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { icon, renderOpPage } from "../layout";

interface ClaimRow {
  id: string;
  claim_text: string | null;
  layer: string;
  verification_status: string;
}

interface SiblingRow {
  slug: string;
  title: string | null;
  publication_status: string;
}

interface JobRow {
  status: string;
  step: string;
  claims_count: number;
  attempts: number;
  last_error: string | null;
  updated_at: string;
}

function statusInfo(status: string): { cls: string; label: string } {
  if (status === "canonical") return { cls: "published", label: "canonical" };
  if (status === "published") return { cls: "published", label: "published" };
  return { cls: "working", label: "working" };
}

export async function renderLibraryDocScreen(
  env: { DB: D1Database },
  slug: string,
): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const piece = await getPieceBySlug(env.DB, userId, slug);
  if (!piece) return null;

  const claims = await all<ClaimRow>(
    env.DB,
    `SELECT c.id, cv.claim_text, c.layer, c.verification_status
       FROM claims c
       LEFT JOIN claim_versions cv ON cv.id = c.current_version_id
      WHERE c.asserted_in_piece_id = ? AND c.user_id = ?
      ORDER BY c.created_at`,
    [piece.id, userId],
  );

  const siblings = piece.chain_id
    ? await all<SiblingRow>(
        env.DB,
        `SELECT slug, title, publication_status FROM pieces
          WHERE user_id = ? AND chain_id = ? AND id != ?
          ORDER BY COALESCE(published_at, updated_at) DESC`,
        [userId, piece.chain_id, piece.id],
      )
    : [];

  // Latest digest_jobs row, if any — drives the Extract/Retry button + status banner.
  const job = await one<JobRow>(
    env.DB,
    `SELECT status, step, claims_count, attempts, last_error, updated_at
       FROM digest_jobs WHERE user_id = ? AND piece_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    [userId, piece.id],
  );

  const s = statusInfo(piece.publication_status);
  const isPublic =
    piece.publication_status === "published" || piece.publication_status === "canonical";

  const titleOrSlug = piece.title?.trim() || piece.slug;
  const subtitle = piece.subtitle?.trim()
    ? `<div class="libdoc-sub">${escapeHtml(piece.subtitle)}</div>`
    : "";

  const header = `<div class="libdoc-head">
  <div class="libdoc-meta">
    <span class="lib-doc-status ${s.cls}">${escapeHtml(s.label)}</span>
    <span class="libdoc-kind mono">${escapeHtml(piece.kind)}</span>
    <span class="libdoc-kind mono">${claims.length} claim${claims.length === 1 ? "" : "s"}</span>
    ${piece.byline ? `<span class="libdoc-kind mono">${escapeHtml(piece.byline)}</span>` : ""}
  </div>
  <h2 class="libdoc-title">${escapeHtml(titleOrSlug)}</h2>
  ${subtitle}
</div>`;

  const chainBlock =
    piece.chain_id && siblings.length > 0
      ? `<div class="libdoc-section">
  <div class="libdoc-section-h">Chain · ${escapeHtml(piece.chain_id)} · ${siblings.length} other doc${siblings.length === 1 ? "" : "s"}</div>
  ${siblings
    .map(
      (sib) =>
        `<a class="libdoc-sib" href="/op/library/${escapeAttr(sib.slug)}"><span class="lib-dot ${statusInfo(sib.publication_status).cls}"></span>${escapeHtml(sib.title?.trim() || sib.slug)}</a>`,
    )
    .join("")}
</div>`
      : "";

  const claimsBlock = claims.length
    ? `<div class="libdoc-section">
  <div class="libdoc-section-h">Extracted claims · ${claims.length}</div>
  ${claims
    .map(
      (c) => `<div class="libdoc-claim">
  <span class="mono libdoc-claim-tag">${escapeHtml(c.layer)}</span>
  <span class="libdoc-claim-text">${escapeHtml(c.claim_text ?? "(no current version)")}</span>
  <span class="mono libdoc-claim-vs">${escapeHtml(c.verification_status)}</span>
</div>`,
    )
    .join("")}
</div>`
    : `<div class="libdoc-section">
  <div class="libdoc-section-h">Extracted claims</div>
  <div class="lib-empty">No claims drafted from this document yet.</div>
</div>`;

  const bodyHtml = piece.body_md?.trim()
    ? `<div class="libdoc-section">
  <div class="libdoc-section-h">Document</div>
  <div class="libdoc-body">${renderMarkdown(piece.body_md)}</div>
</div>`
    : "";

  // Extract / Retry button — surfaces unless the latest job already completed.
  // Running/queued jobs show a disabled "Extracting…" affordance.
  const canExtract = !job || job.status === "failed";
  const extractAction =
    job && (job.status === "running" || job.status === "queued")
      ? `<button class="btn" disabled>${icon("spark")} Extracting…</button>`
      : canExtract
        ? `<form method="POST" action="/op/library/extract" style="display:inline">
  <input type="hidden" name="piece_ids" value="${escapeAttr(piece.id)}" />
  <button type="submit" class="btn btn-amber">${icon("spark")} ${job?.status === "failed" ? "Retry extraction" : "Extract"}</button>
</form>`
        : "";

  const topbarActions = `<a href="/op/library" class="btn">← Library</a>${extractAction}${
    isPublic
      ? `<a href="/p/${escapeAttr(piece.slug)}" target="_blank" rel="noopener" class="btn">${icon("external")} View public page</a>`
      : ""
  }<form method="POST" action="/op/library/delete" style="display:inline" onsubmit="return confirm('Delete this document, its claims, and its sources? This cannot be undone.');"><input type="hidden" name="mode" value="selected" /><input type="hidden" name="piece_ids" value="${escapeAttr(piece.id)}" /><button type="submit" class="btn btn-danger">Delete</button></form>`;

  // Extraction state banner — honest about whether this doc has been digested.
  const extractionBanner = job
    ? `<div class="libdoc-section">
  <div class="libdoc-section-h">Extraction</div>
  <div class="libdoc-claim">
    <span class="mono libdoc-claim-tag">status</span>
    <span class="libdoc-claim-text">${escapeHtml(job.status)}${job.step !== job.status ? ` · ${escapeHtml(job.step)}` : ""}${job.attempts > 1 ? ` · attempt ${job.attempts}` : ""}${job.last_error ? ` · ${escapeHtml(job.last_error)}` : ""}</span>
    <span class="mono libdoc-claim-vs">${escapeHtml(job.updated_at.slice(0, 16).replace("T", " "))}</span>
  </div>
</div>`
    : `<div class="libdoc-section">
  <div class="libdoc-section-h">Extraction</div>
  <div class="lib-empty">This document is stored in the Vault but hasn't been extracted yet. Click <b>Extract</b> above to drive claims/entities into the graph.</div>
</div>`;

  return renderOpPage({
    title: titleOrSlug.length > 48 ? `${titleOrSlug.slice(0, 48)}…` : titleOrSlug,
    sub: "library · document detail",
    topbarActions,
    body: `${header}${extractionBanner}${chainBlock}${claimsBlock}${bodyHtml}`,
    activeNav: "/op/library",
    width: "wide",
  });
}
