// The Library page — /library, the operator's workbench — assembled from its
// parts: the upload strip (./upload), the document table (./rows), the
// worklist and leads (./leads) and the answered-questions index (./answered).
// The piece page itself is rendered by piece-template.ts, not here — see that
// file for the public face of a single document.

import { type PublicEnv, resolveOperatorId } from "../../data";
import { escapeAttr, escapeHtml, renderPage } from "../../layout";
import { type LibraryModel, emptyLibraryModel, libraryModel } from "../../models/library";
import { emptyState, sectionHeader } from "../components";
import { PROCESS_LIVE_JS } from "../process-live";
import { renderAnswered } from "./answered";
import { renderWorklist } from "./leads";
import { renderRow } from "./rows";
import { renderOpStrip, renderUploadBanner } from "./upload";

// Library — the operator's workbench. Everything it shows is gathered ONCE by
// public/models/library.ts (libraryModel) and rendered from that model here;
// GET /library.json serves the same model, so a front end built against it
// sees exactly what this page sees. Nothing below runs a query.
//
// A stored piece's title is sometimes the raw upload filename — e.g.
// "compass_artifact_wf-c96cfa7c-3f5d-…_text_markdown.md" — when the
// operator dropped a file whose name was never meant to be read. The model
// swaps in a plain placeholder and keeps the real filename visible
// underneath in mono, never hidden.

/** The page, from the model. Exported so a test can render a model it built. */
export function renderLibraryFromModel(m: LibraryModel): string {
  const operator = m.operator;

  const uploadBanner = m.notice
    ? `<div class="op-banner${m.notice.kind === "error" ? " op-banner-error" : ""}">${escapeHtml(m.notice.text)}</div>`
    : "";

  const opStrip = operator ? renderOpStrip(m) : "";

  const queueBlock = renderAnswered(m.answered);

  const uploadedBanner = operator ? renderUploadBanner(m.uploaded) : "";

  const rows = m.rows.map((r) => renderRow(r, operator)).join("");

  // One line above the table: what the pipeline is doing right now. The
  // poller writes into it; data-lib-active is what tells the poller to start.
  const queueParts = [
    m.counts.queued ? `${m.counts.queued} queued` : "",
    m.counts.processing ? `${m.counts.processing} processing` : "",
    m.counts.failed ? `${m.counts.failed} failed` : "",
  ].filter(Boolean);
  const queueLine = operator
    ? `<p id="lib-queue" class="lib-queue" data-lib-active="${m.counts.active}"${queueParts.length ? "" : " hidden"}>${escapeHtml(queueParts.join(" · "))}</p>`
    : "";

  const table = m.rows.length
    ? `<table class="lib-table">
  <thead><tr>
    <th class="label">Title</th>
    <th class="label">Kind</th>
    <th class="label">Status</th>
    <th class="label">Date</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`
    : emptyState(
        "No documents yet. Once research reports are dropped into the Library, every one will land here with what it fed showing in its row.",
      );

  // THE WEIGHT BAND IS GONE. It ran across the top: 57 source documents,
  // 8,642 facts extracted, 4,712 subject pages fed, 1,682 open threads. Two
  // of those numbers meant nothing to the person reading them, and all four
  // pushed the upload box below the fold. Per-document counts live in each
  // row's receipt, where they answer a question somebody has.

  // Which model does the reading. Named on the page rather than assumed, and
  // "not configured" is said, never hidden behind a quiet downgrade.
  const modelLine = operator
    ? `<p class="lib-model${m.model.gatewayConfigured ? "" : " lib-model-fallback"}"><span class="label">Model</span> ${escapeHtml(m.model.name)}</p>`
    : "";

  const body = `
<header class="phead">
  <div class="eyebrow">The raw research</div>
  <h1>Library</h1>
  <p class="phead-dek">
    Every document the rest is built on, kept whole. Each row shows what it fed —
    facts extracted, subjects it touched. Working material feeds the rest but
    doesn't get its own public page.
  </p>
  ${modelLine}
</header>
<div class="wb">
<nav class="wb-rail" aria-label="Library sections">
  <a href="#upload">Upload</a>
  <a href="#documents">Documents <span class="wb-n">${m.counts.documents}</span></a>
  <a href="#op-wants">Worklist</a>
  <a href="${escapeAttr(m.research.href)}">Research</a>
</nav>
<div class="wb-main">
<section class="wb-sec" id="upload">
${uploadBanner}
${opStrip}
</section>
<section class="wb-sec" id="documents">${sectionHeader(
    `All material (${m.counts.documents})`,
    operator ? "/op/export/research.zip" : undefined,
    operator ? "Download all as .zip" : undefined,
  )}${uploadedBanner}${queueLine}${table}</section>
${operator ? renderWorklist(m.worklist, m.resurfaced) : ""}
${queueBlock}
</div>
</div>
${operator ? PROCESS_LIVE_JS : ""}
`;
  return renderPage({
    title: "Library",
    description:
      "Every source document the rest is built on. Each row shows what it fed — facts extracted, subjects it touched.",
    body,
    activeNav: "/library",
    zone: "library",
  });
}

export async function renderLibraryIndex(
  env: PublicEnv,
  opts: {
    isOperator?: boolean;
    ingested?: string;
    error?: string;
    importing?: string;
    videoError?: string;
    published?: string;
    /** Set after a title was replaced or put back from /op/pieces/:id/title. */
    renamed?: string;
    /** How many documents "Process everything" / Re-process just queued. */
    queued?: string;
    /**
     * The piece ids the upload just made, comma-separated, from the redirect
     * POST /op/feed/upload issues. The page opens on them (renderUploadBanner).
     */
    uploaded?: string;
  } = {},
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const model: LibraryModel = userId
    ? await libraryModel(env, { ...opts, userId, isOperator: opts.isOperator === true })
    : emptyLibraryModel(env, { ...opts, isOperator: opts.isOperator === true });
  return renderLibraryFromModel(model);
}
