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
    Every documented fact rests on a real source. Analysis is signed and kept separate
    from fact. Confidence is shown, not hidden — an uncertain claim says so. Nothing is
    stated that can't be traced back to a document. The record is permanent and
    correctable: mistakes are logged, not erased.
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
          document — checked by machine, byte for byte. Whitespace differences are
          tolerated; word substitutions are not. A quote that fails this check never
          reaches a page.
        </p>
      </div>
    </div>
    <div class="meth-check">
      <div class="meth-check-n">3</div>
      <div>
        <div class="meth-check-h">A second, independent judge</div>
        <p>
          Before a signed analysis publishes, a different model than the one that
          drafted it reads each claim and answers one question: does the quote
          actually support this? The judge is always a different model family from
          whatever wrote the page — self-checking is not allowed.
        </p>
      </div>
    </div>
    <div class="meth-check">
      <div class="meth-check-n">4</div>
      <div>
        <div class="meth-check-h">Failures are removed, visibly</div>
        <p>
          A claim that fails either check is removed before publishing — never
          silently kept. Where it's useful to show, a removed claim stays visible on
          its file with a plain note: <b>failed verification — removed</b>.
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
  <h2 class="meth-h2">Disputed stays disputed</h2>
  <p>
    A claim someone made ("X said Y") is <b>never silently shown</b> as an
    established fact. Disputed material is stored as disputed and shown as disputed.
    A signed analysis is required to show the facts that complicate its own case — it
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
    Every file grows from a typed record of facts read out of source documents:
  </p>
  <ul class="meth-list">
    <li><b>People and companies</b> — the persistent subjects a file is opened on.</li>
    <li><b>Events</b> — dated occurrences with verbatim quotes.</li>
    <li><b>Documented facts</b> — sourced, established, undisputed statements.</li>
    <li><b>Disputed claims</b> — what someone claims, with who said it and their stance, kept distinct from documented fact.</li>
    <li><b>Sources</b> — the documents themselves; every fact's receipt points back to one.</li>
    <li><b>Official stories</b> — widely-held accounts flagged when three or more separate documents push back on them.</li>
  </ul>
  <p>
    The links between all of these are typed too — who's connected to what, when,
    and how. The record is queryable; every page is a rendering of it.
  </p>
</section>

<section class="meth-section">
  <h2 class="meth-h2">One file, two views</h2>
  <p>
    Every subject — a person, a company, an event, a widely-held story — has a
    single file with two views: <b>on the record</b> (documented facts with
    receipts, disputes shown as disputes, a timeline, connections) and, once one
    exists, a <b>signed analysis</b> — an argument over the same facts, with an
    intent badge, a confidence level, and the mandatory box showing what complicates
    it. The analysis isn't a separate document — it's the same file with a thesis
    pulling the facts into order.
  </p>
</section>

<section class="meth-section">
  <h2 class="meth-h2">Formats of a signed analysis</h2>
  <p>
    Once an analysis is signed, it's rendered into a few formats: a short thread, a
    video script, a shareable card with the single strongest fact, and a chapter
    outline. None of these are new writing — they're selections from the signed
    piece. The claims live on the analysis; the formats just re-arrange them.
  </p>
</section>

<section class="meth-section">
  <h2 class="meth-h2">The lenses</h2>
  <p class="meth-lenses-sub">
    A small fixed set — not a framework canon. Applied selectively, not mechanically.
  </p>
  <dl class="meth-lenses">
    <dt>Fact vs. framing</dt>
    <dd>Separate the thing said from the backdrop it's said against.</dd>
    <dt>Root-striking</dt>
    <dd>Trace a surface fact to the structural cause underneath.</dd>
    <dt>Steelman</dt>
    <dd>State the strongest version of the opposing case before answering it.</dd>
    <dt>Cui bono</dt>
    <dd>Ask who benefits from this being the question.</dd>
    <dt>Base-rate</dt>
    <dd>Check the claim against how often such things are actually true.</dd>
    <dt>Dispute or question the logic</dt>
    <dd>Argue the facts are wrong, or that the reasoning doesn't follow even if the facts are right.</dd>
  </dl>
</section>

<section class="meth-section">
  <h2 class="meth-h2">The discipline</h2>
  <p>
    A person owns every verdict. The system surfaces reasons for and against — it
    never decides. Patterns are hypotheses until verified and signed. Evidence that
    cuts against a claim is shown, not buried. The analysis is worth reading
    precisely because it can be wrong, and says so when it might be.
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
    border-left: 4px solid var(--accent);
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
