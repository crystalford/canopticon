// The export page — /op/export. A list of downloads, one per part.
//
// Why a page and not a single link: Claude Design reads about twenty files out
// of a zip and drops the rest without saying so, so one zip of fifty-three
// files arrived as the first twenty or so. The archive is therefore several
// zips of at most 15 documents each. A browser can only fetch one file per
// click, and one click that triggered four downloads is the sort of thing
// popup blockers eat, so each part is its own plain link.
//
// It also doubles as an inventory: every title in every part, in the order
// they are packed, so the operator can see what each download contains before
// opening anything.

import { escapeHtml, renderPage } from "../../layout";

export interface ExportPartSummary {
  part: number;
  /** Documents in this part. */
  count: number;
  /** 1-based position of this part's first document in the whole. */
  first: number;
  titles: string[];
}

export function renderExportPage(args: {
  parts: ExportPartSummary[];
  total: number;
  skipped: number;
  max: number;
}): string {
  const { parts, total, skipped, max } = args;

  const body = args.parts.length
    ? `<header class="phead">
  <div class="eyebrow">Operator</div>
  <h1>Download the reports</h1>
  <p class="phead-dek">
    ${total} report${total === 1 ? "" : "s"}, as markdown, in ${parts.length}
    download${parts.length === 1 ? "" : "s"} of at most ${max}. Each zip also carries an
    INDEX.md, so it stays under the twenty-odd files that tools like Claude Design
    will read from a single zip. Every file is the document exactly as uploaded.
  </p>
</header>
<section class="sec xp">
${parts
  .map(
    (p) => `  <div class="xp-part">
    <div class="xp-head">
      <div>
        <div class="xp-k">Part ${p.part} of ${parts.length}</div>
        <div class="xp-range">Documents ${p.first}–${p.first + p.count - 1} · ${p.count} files</div>
      </div>
      <a class="docrail-btn primary xp-btn" href="/op/export/research.zip?part=${p.part}">Download .zip</a>
    </div>
    <ol class="xp-titles" start="${p.first}">
${p.titles.map((t) => `      <li>${escapeHtml(t)}</li>`).join("\n")}
    </ol>
  </div>`,
  )
  .join("\n")}
${skipped ? `  <p class="xp-note">${skipped} document${skipped === 1 ? " has" : "s have"} no text and ${skipped === 1 ? "is" : "are"} left out.</p>` : ""}
</section>`
    : `<header class="phead">
  <div class="eyebrow">Operator</div>
  <h1>Download the reports</h1>
  <p class="phead-dek">There are no uploaded reports to download yet.</p>
</header>
<section class="sec"><p><a href="/desk/workbench">Back to the library →</a></p></section>`;

  return renderPage({
    title: "Download the reports",
    description: "Every uploaded report as markdown, in zips small enough to open anywhere.",
    body,
    activeNav: "/desk/workbench",
    zone: "library",
  });
}
