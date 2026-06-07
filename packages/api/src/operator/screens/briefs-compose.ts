// Manual Brief composer — the architecture-of-knowledge entry point.
//
// The auto-proposer mines the (often-empty) graph for "definition" briefs
// per entity. That's the wrong primitive — Briefs are the product, you
// COMPOSE them. This surface is the manual on-ramp: pick a content type,
// write a body, attach verifiable citations. The existing verify pipeline
// (verbatim substring + independent judge) grades the citations on save.
//
// Phase 5 PR 1 ships Q&A (content_type=faq) only. Position-Comparison
// needs the three-level grounding (Phase 4) to cluster pro/critical stance.

import { escapeAttr, escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { eyebrow, renderOpPage } from "../layout";

export async function renderBriefsComposeScreen(env: {
  DB: D1Database;
}): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;

  // Q&A (FAQ schema) ships first. Other types are visible-but-disabled so
  // the operator sees the roadmap, not a single-option chooser.
  const TYPES: Array<{ key: string; label: string; ready: boolean; hint: string }> = [
    {
      key: "faq",
      label: "Q&A",
      ready: true,
      hint: "Hub of real questions + concise sourced answers. schema.org FAQPage.",
    },
    {
      key: "definition",
      label: "Definition",
      ready: true,
      hint: "Authoritative sourced definition of a term. schema.org DefinedTerm.",
    },
    {
      key: "timeline",
      label: "Timeline",
      ready: true,
      hint: "Dated sequence of events. schema.org ItemList of Event.",
    },
    {
      key: "comparison",
      label: "Position-Comparison",
      ready: false,
      hint: "Pro vs critical positions, each with grounds. Needs three-level extraction (Phase 4).",
    },
    {
      key: "stat-roundup",
      label: "Stat roundup",
      ready: true,
      hint: "Sourced figures + values. schema.org Dataset.",
    },
  ];

  const typeRadios = TYPES.map(
    (t, i) => `<label class="bc-type${t.ready ? "" : " bc-type-disabled"}">
  <input type="radio" name="content_type" value="${escapeAttr(t.key)}" ${i === 0 && t.ready ? "checked" : ""} ${t.ready ? "" : "disabled"} />
  <span class="bc-type-name">${escapeHtml(t.label)}</span>
  <span class="bc-type-hint">${escapeHtml(t.hint)}</span>
</label>`,
  ).join("");

  const body = `
<div class="bc-head">
  ${eyebrow("Compose Brief")}
  <p class="bc-sub">Write the answer. Attach verbatim citations from external sources. The verifier catches anything that isn't a literal substring of the fetched page; an independent judge grades each quote against its claim. Nothing publishes automatically.</p>
</div>

<form method="POST" action="/op/briefs/compose" class="bc-form">
  <div class="bc-section">
    <label class="bc-label">Content type</label>
    <div class="bc-types">${typeRadios}</div>
  </div>

  <div class="bc-section">
    <label class="bc-label" for="bc-title">Title</label>
    <input id="bc-title" name="title" type="text" required maxlength="200"
      placeholder="What is the domestic stability buffer?" class="bc-input" />
    <div class="bc-help">For a Q&amp;A this is usually the headline question. For a Definition, the term.</div>
  </div>

  <div class="bc-section">
    <label class="bc-label" for="bc-slug">URL slug</label>
    <input id="bc-slug" name="slug" type="text" required maxlength="120"
      placeholder="what-is-the-domestic-stability-buffer" pattern="[a-z0-9-]+"
      class="bc-input mono" />
    <div class="bc-help">Lowercase, digits, hyphens. Published Brief lives at <span class="mono">/briefs/&lt;slug&gt;</span>.</div>
  </div>

  <div class="bc-section">
    <label class="bc-label" for="bc-body">Body (markdown)</label>
    <textarea id="bc-body" name="body_md" required rows="14" class="bc-input bc-textarea"
      placeholder="## What it is\n\nThe Domestic Stability Buffer (DSB) is a capital reserve OSFI requires Canadian D-SIBs to hold over and above base regulatory capital. Routledge raised it 50bp effective Q1 2026.\n\n## Why it matters\n\nThe DSB modulates with the credit cycle..."></textarea>
    <div class="bc-help">Front-load the direct answer in the first paragraph — 44% of AI citations come from the top 30% of a page.</div>
  </div>

  <div class="bc-section">
    <label class="bc-label">Citations</label>
    <div class="bc-help" style="margin-bottom:10px">
      Each citation is one (assertion, source URL, verbatim quote) tuple. On save, we fetch
      the URL, check that your quote is a literal substring, and run an independent model
      to grade whether the quote actually supports the assertion. Citations that fail are
      marked killed and don't appear in the published Sources block.
    </div>
    <div id="bc-citations" class="bc-citations">
      ${citationRow(0)}
    </div>
    <button type="button" id="bc-add-citation" class="btn">+ Add citation</button>
  </div>

  <div class="bc-actions">
    <a href="/op/briefs" class="btn">Cancel</a>
    <button type="submit" class="btn btn-amber">Save as draft &amp; verify</button>
  </div>
</form>

<script>
(function () {
  var box = document.getElementById("bc-citations");
  var btn = document.getElementById("bc-add-citation");
  var n = 1;
  if (!box || !btn) return;
  btn.addEventListener("click", function () {
    var t = document.createElement("template");
    t.innerHTML = ${JSON.stringify(citationRow("__N__"))};
    var html = t.innerHTML.replace(/__N__/g, String(n++));
    box.insertAdjacentHTML("beforeend", html);
  });
  box.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".bc-citation-remove");
    if (!b) return;
    var row = b.closest(".bc-citation");
    if (row && box.querySelectorAll(".bc-citation").length > 1) row.remove();
  });
})();
</script>`;

  return renderOpPage({
    title: "Compose Brief",
    sub: "manual on-ramp · pick a type, write a body, cite sources",
    body,
    activeNav: "/op/briefs",
    width: "wide",
  });
}

// Single citation row template. Indexed array names so multiple rows submit
// as parallel arrays the POST handler can zip together.
function citationRow(idx: number | string): string {
  const i = String(idx);
  return `<div class="bc-citation">
  <div class="bc-citation-grid">
    <input name="claim_text[]" type="text" required placeholder="Assertion (one fact this citation supports)"
      class="bc-input" data-idx="${i}" />
    <input name="source_url[]" type="url" required placeholder="https://example.com/source-article"
      class="bc-input mono" data-idx="${i}" />
    <textarea name="source_quote[]" required rows="2" placeholder="Verbatim quote from the source — must be a literal substring"
      class="bc-input bc-textarea" data-idx="${i}"></textarea>
  </div>
  <button type="button" class="btn bc-citation-remove" title="Remove this citation">×</button>
</div>`;
}
