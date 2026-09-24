// Methodology — intellectual discipline + the mechanical trust model.
//
// Two ideas live on this page: the EDITORIAL stance (what canopticon is
// trying to do) and the MECHANICAL standard (how it verifies what it
// publishes). Readers and AI engines alike land here to understand why
// citations from this site are trustworthy. Schema.org JSON-LD lets the
// page be cited as the methodology document.

import { renderPage } from "../layout";

export function renderMethodology(): string {
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: "How CANOPTICON works",
    about: ["forensic verification", "knowledge graph", "citation methodology"],
    description:
      "How CANOPTICON verifies, structures, and publishes claims. Every quote is a word-for-word match in a stored source document, checked twice, before it reaches a page.",
    publisher: { "@id": "https://canopticon.com/#org" },
    url: "https://canopticon.com/method",
  }).replace(/<\/script/gi, "<\\/script");

  const body = `
<script type="application/ld+json">${jsonLd}</script>

<section class="meth-masthead">
  <div class="kicker"><span class="live"></span> Method</div>
  <h1 class="meth-h1">How the record is kept.</h1>
  <p class="meth-lede">
    Two things together: what canopticon is trying to do, and how it checks what it
    puts on a page. A claim from this site is trustworthy because both are visible,
    and both can be checked.
  </p>
</section>

<section class="meth-section">
  <h2 class="meth-h2">The standard</h2>
  <p>
    Every documented fact rests on a real source. Argument is kept separate from fact — an essay argues, a document is the evidence. Confidence is shown, not hidden — an uncertain claim says so. Nothing is
    stated that can't be traced back to a document. The record is permanent and
    correctable: mistakes are logged, not erased.
  </p>
  <p>
    What's in scope isn't a topic list — it's a question: is more said about this than
    has ever actually been checked? Wherever that's true, it applies, whether the subject
    is a politician's record, whether a therapy actually works, or whether a species is
    really recovering.
  </p>
</section>

<section class="meth-section meth-section-trust">
  <div class="meth-stamp">How verification works</div>
  <h2 class="meth-h2">Checked by machine, not vouched for.</h2>
  <p>
    A claim on this site is trusted because of <b>what happened to it before it was
    published</b>, not because of who wrote it. Every documented fact runs a chain of
    checks:
  </p>

  <div class="meth-checks">
    <div class="meth-check">
      <div class="meth-check-n">1</div>
      <div>
        <div class="meth-check-h">Stored, then read</div>
        <p>
          A source document is stored first, exactly as received. Facts are then read
          out of it, each one carrying the exact quote it came from.
        </p>
      </div>
    </div>
    <div class="meth-check">
      <div class="meth-check-n">2</div>
      <div>
        <div class="meth-check-h">A word-for-word match</div>
        <p>
          Every quote on every page is a <b>literal match</b> against the stored
          document — checked by machine, character for character, at the moment the
          page is built. Whitespace differences are tolerated; word substitutions are
          not. A quote that fails this check never reaches a page.
        </p>
      </div>
    </div>
    <div class="meth-check">
      <div class="meth-check-n">3</div>
      <div>
        <div class="meth-check-h">The document's own words, or nothing</div>
        <p>
          Wherever this site places a passage on a page — a lead passage, a finding,
          an answer to a question the record raised — it is <b>selected from the
          document, never written for it</b>. A model may propose a span; the match
          in check 2 decides. A proposed span that is not found word for word is
          discarded, and the page shows how many were.
        </p>
      </div>
    </div>
    <div class="meth-check">
      <div class="meth-check-n">4</div>
      <div>
        <div class="meth-check-h">Failures are removed, visibly</div>
        <p>
          A span that fails the match is removed before it is shown — never silently
          kept. Where the count matters, the page says how many were discarded, so
          a shaky answer never looks identical to a solid one.
        </p>
      </div>
    </div>
  </div>

  <p>
    Every receipt on every page opens to the verbatim text, the source document, and
    when it was read. Claims on this site are deep-linkable to their evidence.
  </p>
</section>

<section class="meth-section">
  <h2 class="meth-h2">What happens to a document</h2>
  <p>
    Uploading is publishing. The document is live at its own address at once, whole.
    Then the record reads it, one step at a time, while the operator's library page is
    open — nothing runs unattended, and nothing here calls a model when a page is
    rendered: whatever a model proposed was checked and frozen into a row first.
  </p>
  <ul class="meth-list">
    <li><b>Title</b> — a filename or a working title is replaced with a line lifted verbatim from the document; the original is kept.</li>
    <li><b>Read</b> — facts, events, entities and quotes are read out; every quote is checked word for word before it is stored.</li>
    <li><b>Figures</b> — the numbers with a named source and a date, each checked the same way.</li>
    <li><b>Passage</b> — one lead passage, selected from the document, never written for it.</li>
    <li><b>Section</b> — filed under one of eight sections; "everything else" is a real answer.</li>
    <li><b>Card and index</b> — a share card is drawn, and the verified passages are indexed so search can return them.</li>
  </ul>
  <p>
    A draft essay may be opened from a reading and written by a model. It is never
    published as such: it is handed to the operator as a file whose first line names the
    model and the reading it came from, to be rewritten and uploaded under the operator's
    own name — or not.
  </p>
</section>

<section class="meth-section">
  <h2 class="meth-h2">Disputed stays disputed</h2>
  <p>
    A claim someone made ("X said Y") is <b>never silently shown</b> as an
    established fact. Disputed material is stored as disputed and shown as disputed.
    An essay published here is held to the same rule: the facts that complicate its own case are shown, not left out — it
    can't leave out what doesn't fit.
  </p>
</section>

<section class="meth-section">
  <h2 class="meth-h2">The stance</h2>
  <p>
    Forensic, not journalistic. The goal isn't to report what happened but to map
    what is — the structure beneath the event, the pattern beneath the story, the
    architecture beneath the policy. Individual facts matter because they reveal
    structure. Structure is the finding.
  </p>
</section>

<section class="meth-section meth-section-shape">
  <h2 class="meth-h2">What's actually in the record</h2>
  <p>
    Two kinds of thing are published, and everything else is derived from them:
  </p>
  <ul class="meth-list">
    <li><b>Research documents</b> — primary material, kept whole and published as itself. Its own summary and its own stated gaps are moved to the top; nothing is summarised away.</li>
    <li><b>Essays</b> — arguments written to a fixed convention: a question per section, the answer in the first sentence, sources numbered at the end.</li>
    <li><b>Verified quotes</b> — every span read out of a document, checked as a literal match against the stored text. Each has a receipt at its own address.</li>
    <li><b>Findings</b> — a figure with what it measures, when, and who reported it. The best-evidenced shape a document can carry, and the one this site is built to be cited for.</li>
    <li><b>Links between documents</b> — a subject appearing in two documents is a link from one to the other. Found by a query over the record, never composed.</li>
    <li><b>Leads</b> — where the record is strange: two documents that contradict each other, a figure no document sources, a question the documents raise and do not answer. A lead is a question for the operator, not a page for a reader.</li>
    <li><b>Bridges</b> — a subject that appears in two documents filed under different sections. Found by a query, never by a model, and never ranked by how often it recurs. The record cannot make the connection; it can put the two documents side by side and ask whether anyone has made it before.</li>
    <li><b>Readings</b> — a short note the operator wrote on a passage of a document. The passage is verified like any quote; the note is the operator's own words, signed and dated. A document with a reading is marked <i>read by the operator</i>: the one thing the machine cannot supply.</li>
    <li><b>Lineage</b> — what a document grew from and what grew from it. A brief researched from a question one document raised is that document's child, and says so.</li>
  </ul>
  <p>
    Search asks the record, not a model: a question returns passages from documents on
    file, word for word, each with its receipt.
  </p>
  <p>
    A page, its plain-text twin, its structured data, the sitemap and the feed are
    all generated from the same rows. They cannot drift apart because there is only
    one of them.
  </p>
</section>









<style>
  .meth-masthead { margin-bottom: 44px; max-width: 760px; }
  .meth-masthead .kicker { margin-bottom: 18px; }
  .meth-h1 {
    font-family: var(--serif);
    font-size: 44px; line-height: 1.08; letter-spacing: -.022em;
    margin: 0 0 18px;
    color: var(--ink);
  }
  .meth-lede {
    font-family: var(--serif);
    font-size: 19px; line-height: 1.55;
    color: var(--ink-2);
    margin: 0;
  }
  .meth-section { margin-bottom: 44px; max-width: 760px; }
  .meth-h2 {
    font-family: var(--serif);
    font-size: 27px; line-height: 1.15; letter-spacing: -.012em;
    margin: 0 0 14px;
    color: var(--ink);
  }
  .meth-section p {
    font-family: var(--serif);
    font-size: 16.5px; line-height: 1.65;
    color: var(--ink-2);
    margin: 0 0 14px;
  }
  .meth-section p:last-child { margin-bottom: 0; }
  .meth-section p b { color: var(--ink); }
  .meth-list {
    list-style: none; padding: 0; margin: 0 0 18px;
  }
  .meth-list li {
    font-family: var(--serif);
    font-size: 16px; line-height: 1.65;
    color: var(--ink-2);
    padding: 9px 0;
    border-top: 1px solid var(--rule);
  }
  .meth-list li:first-child { border-top: none; }
  .meth-list li b { color: var(--ink); font-weight: 600; }

  .meth-section-trust {
    padding: 30px 32px;
    border: 1px solid var(--accent-bd);
    border-radius: 11px;
    background: var(--accent-bg);
  }
  .meth-stamp {
    font-family: var(--serif);
    font-size: 12px; letter-spacing: .16em;
    text-transform: uppercase;
    color: var(--accent-2);
    font-weight: 700;
    margin-bottom: 10px;
  }
  .meth-checks { margin: 20px 0; }
  .meth-check {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 16px;
    padding: 16px 0;
    border-top: 1px solid var(--accent-bd);
  }
  .meth-check:first-child { border-top: none; }
  .meth-check-n {
    font-family: var(--serif);
    font-size: 24px; line-height: 1;
    color: var(--accent);
    font-weight: 600;
  }
  .meth-check-h {
    font-family: var(--serif);
    font-size: 17px; line-height: 1.3;
    color: var(--ink);
    font-weight: 600;
    margin-bottom: 6px;
  }
  .meth-check p {
    font-size: 15px; line-height: 1.6;
    color: var(--ink-2);
    margin: 0;
  }

  .meth-section-shape ul { padding-left: 0; }
  .meth-lenses-sub {
    font-style: italic !important;
    color: var(--ink-3) !important;
  }
  .meth-lenses {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 12px 24px;
    margin: 18px 0 0;
    max-width: 760px;
  }
  .meth-lenses dt {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .meth-lenses dd {
    font-family: var(--serif);
    font-size: 15.5px; line-height: 1.55;
    color: var(--ink-2);
    margin: 0;
  }

  @media (max-width: 640px) {
    .meth-h1 { font-size: 32px; }
    .meth-h2 { font-size: 22px; }
    .meth-section-trust { padding: 22px 22px; }
    .meth-lenses { grid-template-columns: 1fr; gap: 4px 0; }
    .meth-lenses dt { margin-top: 14px; }
  }
</style>
`;
  return renderPage({
    title: "Method",
    description:
      "How canopticon verifies what it publishes: word-for-word quotes, a second independent check, disputed material shown as disputed, and failures removed visibly.",
    body,
    activeNav: "/method",
    zone: "method",
  });
}
