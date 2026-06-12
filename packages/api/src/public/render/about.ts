// About — what CANOPTICON is and what's new here.
// Spare, confident, plain English. Built around the facts/analysis split,
// the mechanical-trust claim, and the publication design that makes both
// citable.

import { renderPage } from "../layout";

export function renderAbout(): string {
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About CANOPTICON",
    description:
      "A forensic intelligence publication system. Sourced claims, signed analysis, a typed graph of verified facts. Every assertion ties back to a verbatim quote from a stored source document.",
    publisher: { "@id": "https://canopticon.com/#org" },
    url: "https://canopticon.com/about",
  }).replace(/<\/script/gi, "<\\/script");

  const body = `
<script type="application/ld+json">${jsonLd}</script>

<section class="about-masthead">
  <div class="kicker"><span class="live"></span> About</div>
  <h1 class="about-h1">What CANOPTICON is.</h1>
  <p class="about-lede">
    A forensic intelligence publication system for understanding how things actually
    work — beneath the official account, beneath the headline, beneath the stated
    reason. It maps structure: the personnel, institutions, money flows, and recurring
    patterns that shape how decisions get made and who they serve.
  </p>
  <p class="about-pull">"The facts are the commodity. The analysis is the moat."</p>
</section>

<section class="about-section about-section-distinct">
  <h2 class="about-h2">What's new here</h2>
  <div class="about-distincts">
    <div class="about-distinct">
      <div class="about-distinct-k">The firewall</div>
      <p>
        Most publications mix observation and judgment in the same prose. CANOPTICON
        keeps them apart structurally. A neutral fact and an attributed assertion are
        different rows in the database, rendered differently on the page, and an
        attributed claim is never silently published as a neutral fact. Every signed
        reading is required to display the facts that complicate it.
      </p>
    </div>
    <div class="about-distinct">
      <div class="about-distinct-k">Themes</div>
      <p>
        Most knowledge graphs miss what the corpus is <em>engaging with</em> —
        the received accounts the documents push back on. CANOPTICON treats
        themes as first-class objects: they surface automatically when three or
        more documents converge on contradicting the same proposition. The
        system only names them; the convergence does the work.
      </p>
    </div>
    <div class="about-distinct">
      <div class="about-distinct-k">Faces of a reading</div>
      <p>
        When the operator signs a reading, the system pre-renders four formats
        of it — a thread, a video script, a card, and a chapter outline. These
        aren't new generation. They're selections from the signed piece. The
        truth claims live on the reading; the faces re-arrange.
      </p>
    </div>
    <div class="about-distinct">
      <div class="about-distinct-k">The operator approves, never authors</div>
      <p>
        The system reads, notices, drafts, verifies. The operator clicks Approve
        or Discard. There is no normal flow where the operator writes a page
        from scratch. The publication is editorial — but the writing is
        mechanical.
      </p>
    </div>
  </div>
</section>

<section class="about-section">
  <h2 class="about-h2">Two registers, kept apart</h2>
  <div class="about-registers">
    <div class="about-register">
      <div class="about-register-k">Facts</div>
      <p>
        Objective, unsigned, externally sourced, citable. The bedrock. A fact's
        evidence always points to a real source in the world, never to CANOPTICON
        itself.
      </p>
    </div>
    <div class="about-register">
      <div class="about-register-k">Analysis</div>
      <p>
        Signed, authored, opinionated. The operator's reading laid over the facts.
        Worth reading because it argues; citable because it rests on facts that
        aren't the argument.
      </p>
    </div>
  </div>
  <p class="about-note">
    Facts come first, uninterrupted. Analysis comes last, clearly marked. The
    information order itself is the honesty signal.
  </p>
</section>

<section class="about-section">
  <h2 class="about-h2">Why server-rendered HTML</h2>
  <p>
    Every page is real HTML, readable without JavaScript. That isn't a stylistic
    choice — it's the medium. The record must be archivable, indexable, citable,
    and legible to machines that will summarise it later. JavaScript-only sites
    disappear; this one is built so it can't.
  </p>
</section>

<section class="about-section">
  <h2 class="about-h2">A note on influence</h2>
  <p>
    The system is informed by media theory at the level of how it thinks, not how
    it looks. The theory is in the foundation, not on the walls.
  </p>
</section>

<section class="about-section">
  <h2 class="about-h2">Geography</h2>
  <p>
    The operator is based in Canada and much of the current research touches Canadian
    institutions and figures. The scope is not national — the systems that shape the
    modern state are transnational. Canada is a vantage point, not a boundary.
  </p>
</section>

<style>
  .about-masthead { margin-bottom: 44px; max-width: 760px; }
  .about-masthead .kicker { margin-bottom: 18px; }
  .about-h1 {
    font-family: var(--serif);
    font-size: 44px; line-height: 1.08; letter-spacing: -.022em;
    margin: 0 0 18px;
    color: var(--ink);
  }
  .about-lede {
    font-family: var(--serif);
    font-size: 19px; line-height: 1.55;
    color: var(--ink-2);
    margin: 0 0 18px;
  }
  .about-pull {
    font-family: var(--serif);
    font-size: 18px; line-height: 1.5;
    font-style: italic;
    color: var(--ink);
    margin: 0;
    padding-left: 18px;
    border-left: 3px solid var(--accent);
  }
  .about-section { margin-bottom: 44px; max-width: 760px; }
  .about-h2 {
    font-family: var(--serif);
    font-size: 27px; line-height: 1.15; letter-spacing: -.012em;
    margin: 0 0 20px;
    color: var(--ink);
  }
  .about-section p {
    font-family: var(--serif);
    font-size: 16.5px; line-height: 1.65;
    color: var(--ink-2);
    margin: 0;
  }

  .about-section-distinct {
    padding-top: 12px;
    padding-bottom: 4px;
  }
  .about-distincts {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .about-distinct {
    padding: 20px 22px;
    border: 1px solid var(--rule);
    border-left: 3px solid var(--accent);
    border-radius: 9px;
    background: var(--surface, #fff);
  }
  .about-distinct-k {
    font-family: var(--serif);
    font-size: 17px;
    color: var(--ink);
    font-weight: 600;
    margin-bottom: 10px;
  }
  .about-distinct p {
    font-size: 15.5px; line-height: 1.6;
  }
  .about-distinct em { font-style: italic; color: var(--ink); }

  .about-registers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    margin-bottom: 18px;
  }
  .about-register {
    padding: 22px;
    border: 1px solid var(--rule);
    border-radius: 9px;
    background: var(--paper-2, #f4f1ea);
  }
  .about-register-k {
    font-family: var(--serif);
    font-size: 16px;
    color: var(--ink);
    font-weight: 600;
    margin-bottom: 10px;
  }
  .about-register p {
    font-size: 15px; line-height: 1.6;
  }
  .about-note {
    font-style: italic;
    color: var(--ink-3) !important;
    font-size: 15px !important;
    max-width: 720px;
  }

  @media (max-width: 640px) {
    .about-h1 { font-size: 32px; }
    .about-h2 { font-size: 22px; }
    .about-registers { grid-template-columns: 1fr; }
  }
</style>
`;
  return renderPage({
    title: "About",
    description:
      "What CANOPTICON is: a forensic intelligence system. The firewall, themes, the faces of a reading, and the rule that the operator approves but never authors.",
    body,
    activeNav: "/about",
    zone: "home",
  });
}
