// The upload end of /library: the drop zone, the video-import form, the folded
// Maintenance panel, and the "Just uploaded" banner the page opens on after a
// POST /op/feed/upload redirect.

import { escapeAttr, escapeHtml } from "../../layout";
import type { LibraryModel, LibraryUploaded } from "../../models/library";
import { renderLiveStatusBanner } from "../status-banner";
import { renderLeads } from "./leads";
import { renderConsolidation, renderProcessingCell } from "./rows";

/**
 * What just happened, where it happened. After an upload the operator lands
 * here, and the page's first line about the new document(s) is: it is live
 * at its URL (upload IS publication), the pipeline is at this step, and —
 * when the pipeline has finished — this is what the record made of it.
 *
 * Each part is the SAME renderer the row below uses: the status cell carries
 * the row's data-piece so the poller (process-live.ts) repaints both; the
 * consolidation line and the leads are the row's own, and the model only
 * fills them once the row is done, because before that the record has not
 * read the document. Nothing here is a second copy of a number.
 */
export function renderUploadBanner(uploaded: LibraryUploaded[]): string {
  if (!uploaded.length) return "";
  const items = uploaded
    .map(
      (p) => `<li class="uploaded-doc" data-uploaded="${escapeAttr(p.id)}">
  <a href="/p/${escapeAttr(p.slug)}" class="uploaded-title">${escapeHtml(p.title)}</a>
  <span class="uploaded-live">Published — live now</span>
  ${renderProcessingCell(p.id, p.status)}
  ${renderConsolidation(p.consolidation)}${renderLeads(p.leads)}
</li>`,
    )
    .join("\n");
  return `<section class="op-banner uploaded" id="uploaded" aria-label="Just uploaded">
  <div class="uploaded-k">Just uploaded</div>
  <ul class="uploaded-list">
${items}
  </ul>
</section>`;
}

/** The upload strip: dropzone, video import, and the folded Maintenance panel. */
export function renderOpStrip(m: LibraryModel): string {
  // One button drives the whole queue; the poller presses /op/process/advance
  // while the tab is open. Hidden when there is nothing left to queue.
  const processBtn =
    m.maintenance.processEverything.count > 0
      ? `<form method="POST" action="/op/process/all" style="display:inline;margin-right:8px">
  <button type="submit" class="op-strip-btn op-strip-btn-primary">Process everything (${m.maintenance.processEverything.count})</button>
</form>`
      : "";
  // Pass 2 of on-demand research was dispatched only by the cron, so with
  // the cron off a run that finds follow-up queries parks at pass2_pending.
  // Shown unconditionally rather than gated on a count, because the cheap
  // thing to get wrong here is not knowing a run is stuck.
  const advanceBtn = m.maintenance.advanceResearch
    ? `<form method="POST" action="/op/research/advance" style="display:inline;margin-right:8px">
  <button type="submit" class="op-strip-btn">Advance research</button>
</form>`
    : "";
  // The upload dropzone. Same backend (POST /op/feed/upload), auto-submits
  // on choose.
  const dropzone = `<form method="POST" action="/op/feed/upload" enctype="multipart/form-data" id="feed-form" class="op-dropzone-form">
  <label class="op-dropzone" for="feed-file" id="op-dz-label">
    <div class="op-dz-1">Drop a document here, or click to choose</div>
    <div class="op-dz-2">Markdown · plain text · PDF · Word · a .zip of any of these</div>
    <input type="file" id="feed-file" name="file" accept=".md,.txt,.pdf,.docx,.zip,text/markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed" required style="display:none" />
  </label>
  <div class="op-dz-uploading" id="op-dz-uploading" hidden>Uploading — banking into the Library. You can leave this page.</div>
</form>
<script>
(function () {
  var form = document.getElementById("feed-form");
  var input = document.getElementById("feed-file");
  var label = document.getElementById("op-dz-label");
  var busy = document.getElementById("op-dz-uploading");
  if (!form || !input || !label || !busy) return;
  input.addEventListener("change", function () {
    if (!input.files || input.files.length === 0) return;
    label.setAttribute("hidden", "");
    busy.removeAttribute("hidden");
    if (form.dataset.submitting === "1") return;
    form.dataset.submitting = "1";
    form.submit();
  });
})();
</script>`;

  // Video-as-source-material: the same "drop it in, no confirmation
  // gauntlet" philosophy, pointed at a video URL. POSTs to
  // /op/library/import-video — see graph/lib/video-intake.ts.
  const videoImportBanner = m.videoError
    ? `<div class="op-banner op-banner-error">${escapeHtml(m.videoError)}</div>`
    : "";
  const videoStatus = m.importing
    ? renderLiveStatusBanner(
        `/op/library/import-video/${encodeURIComponent(m.importing)}/status`,
        "Fetching and transcribing…",
      )
    : "";
  const videoImportForm = m.importing
    ? ""
    : `<form method="POST" action="/op/library/import-video" class="op-video-form">
  <input type="url" name="url" placeholder="Paste a video URL to transcribe and add" required class="op-video-input" />
  <button type="submit" class="op-strip-btn">Import video</button>
</form>`;

  // UPLOADING IS THE POINT OF THIS PAGE, so it is the first thing on it. The
  // batch buttons are maintenance, not the job, so they fold away behind a
  // native <details>. No JavaScript, so standing rule 7 holds.
  return `<div class="op-strip">
  ${dropzone}
  ${videoImportBanner}
  ${videoStatus}
  ${videoImportForm}
  <details class="op-more">
    <summary>Maintenance</summary>
    <div class="op-strip-actions">${processBtn}${advanceBtn}</div>
  </details>
</div>`;
}
