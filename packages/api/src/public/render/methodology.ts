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
      "How CANOPTICON verifies, structures, and publishes claims. Mechanical trust: every quote a literal substring of a stored source document. Independent judgment. The fact / interpretation firewall.",
    publisher: { "@id": "https://canopticon.com/#org" },
    url: "https://canopticon.com/methodology",
  }).replace(/<\/script/gi, "<\\/script");

  const body = `
<script type="application/ld+json">${jsonLd}</script>

<section class="meth-masthead">
  <div class="kicker"><span class="live"></span> Methodology</div>
  <h1 class="meth-h1">How CANOPTICON works.</h1>
  <p class="meth-lede">
    Two things together: the editorial stance — what we're trying to do — and the
    mechanical standard — how the publication verifies what it puts on the page.
    Citation from this site is trustworthy because both are visible and both can be
    checked.
  </p>
</section>

<section class="meth-section">
  <h2 class="meth-h2">The standard</h2>
  <p>
    Every claim rests on an external source. Analysis is signed and kept separate from
    fact. Confidence is shown, not hidden — a claim that is uncertain says so. Nothing
    is asserted that cannot be grounded. The record is permanent and correctable:
    errors are logged, not erased.
  </p>
</section>

<section class="meth-section meth-section-trust">
  <div class="meth-stamp">How verification works</div>
  <h2 class="meth-h2">Mechanical trust, not vouched trust.</h2>
  <p>
    The publication's claims are trusted because of <b>what it does</b>, not because
    of who wrote them. Three checks run on every published page:
  </p>

  <div class="meth-checks">
    <div class="meth-check">
      <div class="meth-check-n">1</div>
      <div>
        <div class="meth-check-h">Verbatim substring</div>
        <p>
          Every quote on every page is a <b>literal substring</b> of a real document we
          have stored. The document is preserved at upload time in object storage; the
          quote is a byte-offset span inside it. Whitespace differences are tolerated.
          Word substitutions are not. A quote that fails this check never reaches a
          public page.
        </p>
      </div>
    </div>
    <div class="meth-check">
      <div class="meth-check-n">2</div>
      <div>
        <div class="meth-check-h">Independent judgment</div>
        <p>
          A different model than the one that drafted the page reads each load-bearing
          claim and answers: does the quote actually support this claim? Self-verification
          is forbidden by the publication's rules — the judge must be a different model
          family from every generator that touches the writing.
        </p>
      </div>
    </div>
    <div class="meth-check">
      <div class="meth-check-n">3</div>
      <div>
        <div class="meth-check-h">The firewall</div>
        <p>
          An attributed assertion ("X claimed Y") is <b>never silently rendered</b>
          as a neutral fact. Contested claims are stored as contested and shown
          gray. The system cannot bury what doesn't fit — every signed reading
          is required to display the facts that complicate it.
        </p>
      </div>
    </div>
  </div>

  <p>
    Every superscript on every page links to the quote receipt — the verbatim text,
    the source document, the byte offset, the date extracted. Citations from this
    site are deep-linkable to their evidence.
  </p>
</section>

<section class="meth-section">
  <h2 class="meth-h2">The stance</h2>
  <p>
    Forensic, not journalistic. The goal is not to report what happened but to map what
    is — the structure beneath the event, the pattern beneath the story, the architecture
    beneath the policy. Individual facts matter because they reveal structure. Structure
    is the finding.
  </p>
</section>

<section class="meth-section meth-section-shape">
  <h2 class="meth-h2">What the system actually does</h2>
  <p>
    The publication grows from a typed graph of extracted facts. Documents are read into:
  </p>
  <ul class="meth-list">
    <li><b>Entities</b> — people, organisations, places that persist.</li>
    <li><b>Events</b> — dated occurrences with verbatim quotes.</li>
    <li><b>Neutral facts</b> — sourced, established, uncontested propositions.</li>
    <li><b>Attributed assertions</b> — what an actor CLAIMS, with stance and rank, kept distinct from neutral fact.</li>
    <li><b>Sources</b> — the documents themselves; the quote-receipts pin every fact to them.</li>
    <li><b>Themes</b> — received accounts the corpus engages with, surfaced when three or more documents converge on contradicting the same proposition.</li>
  </ul>
  <p>
    Edges between these are typed too: aboutness, relationship, temporal, evidential,
    causal, attribution. The graph is queryable; the publication's pages are renderings
    of it.
  </p>
</section>

<section class="meth-section">
  <h2 class="meth-h2">One subject, one page, two modes</h2>
  <p>
    Every subject — a person, an event, a theme — has a single page in two modes:
    a <b>Reference</b> (neutral facts with receipts, contested shown as contested,
    timeline, connections) and the operator's <b>Reading</b> (a signed argument
    over the same facts, with intent badge, confidence band, and the mandatory
    complicating-facts box). The investigation is not a separate object — it's
    the same page with a thesis pulling the facts into order.
  </p>
</section>

<section class="meth-section">
  <h2 class="meth-h2">Faces of a reading</h2>
  <p>
    When the operator signs a reading, the system pre-renders four formats of it:
    a <b>thread</b> (4 posts), a <b>video script</b> (locked reasoning skeleton),
    a <b>card</b> (thesis + the single most damning fact, as one shareable image), and a <b>chapter</b>
    outline. These aren't new generation — they're selections from the signed
    piece. The truth claims live on the reading; the faces re-arrange them.
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
    The operator owns every verdict. The system surfaces reasons for and against — it
    never decides. Patterns are hypotheses until verified and signed. Disconfirming
    evidence is shown, not buried. The analysis is the moat precisely because it can
    be wrong, and says so when it might be.
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
    border: 1px solid #d8cba9;
    border-left: 4px solid var(--accent);
    border-radius: 11px;
    background: #f8f1df;
  }
  .meth-stamp {
    font-family: var(--serif);
    font-size: 12px; letter-spacing: .16em;
    text-transform: uppercase;
    color: #7a5a1a;
    font-weight: 700;
    margin-bottom: 10px;
  }
  .meth-checks { margin: 20px 0; }
  .meth-check {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 16px;
    padding: 16px 0;
    border-top: 1px solid #d8cba9;
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
    title: "Methodology",
    description:
      "How CANOPTICON conducts analysis: mechanical trust, the firewall, the typed graph, the lenses, and the discipline of the work.",
    body,
    activeNav: "/methodology",
    zone: "home",
  });
}
