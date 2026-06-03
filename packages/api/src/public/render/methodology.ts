// Methodology — intellectual discipline. Forensic stance, the standard
// every claim is held to, the lenses applied, and how the analysis owns
// its verdicts.

import { renderPage } from "../layout";

export function renderMethodology(): string {
  const body = `
<section style="margin-bottom:32px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> Methodology</div>
  <h1 style="font-family:var(--serif);font-size:42px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 14px;color:var(--ink)">Methodology</h1>
  <p style="font-family:var(--serif);font-size:19px;line-height:1.55;color:var(--ink-2);max-width:720px">
    A statement of principles. The discipline beneath the work.
  </p>
</section>

<section style="margin-bottom:30px">
  <h2 style="font-family:var(--serif);font-size:24px;line-height:1.2;margin:0 0 10px;color:var(--ink)">The stance</h2>
  <p style="font-family:var(--serif);font-size:16.5px;line-height:1.65;color:var(--ink-2);max-width:720px">
    Forensic, not journalistic. The goal is not to report what happened but to map what is — the
    structure beneath the event, the pattern beneath the story, the architecture beneath the
    policy. Individual facts matter because they reveal structure. Structure is the finding.
  </p>
</section>

<section style="margin-bottom:30px">
  <h2 style="font-family:var(--serif);font-size:24px;line-height:1.2;margin:0 0 10px;color:var(--ink)">The standard</h2>
  <p style="font-family:var(--serif);font-size:16.5px;line-height:1.65;color:var(--ink-2);max-width:720px">
    Every claim rests on an external source. Analysis is signed and kept separate from fact.
    Confidence is shown, not hidden — a claim that is uncertain says so. Nothing is asserted that
    cannot be grounded. The record is permanent and correctable: errors are logged, not erased.
  </p>
</section>

<section style="margin-bottom:30px">
  <h2 style="font-family:var(--serif);font-size:24px;line-height:1.2;margin:0 0 10px;color:var(--ink)">The lenses</h2>
  <p style="font-family:var(--serif);font-size:16.5px;line-height:1.65;color:var(--ink-2);max-width:720px;margin-bottom:18px">
    A small fixed set — not a framework canon. Applied selectively, not mechanically.
  </p>
  <dl style="display:grid;grid-template-columns:200px 1fr;gap:14px 22px;max-width:780px;margin:0">
    <dt style="font-family:var(--mono);font-size:13px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.06em">Fact vs. framing</dt>
    <dd style="font-family:var(--serif);font-size:15.5px;line-height:1.6;color:var(--ink-2);margin:0">Separate the thing said from the backdrop it's said against.</dd>

    <dt style="font-family:var(--mono);font-size:13px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.06em">Root-striking</dt>
    <dd style="font-family:var(--serif);font-size:15.5px;line-height:1.6;color:var(--ink-2);margin:0">Trace a surface fact to the structural cause underneath.</dd>

    <dt style="font-family:var(--mono);font-size:13px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.06em">Steelman</dt>
    <dd style="font-family:var(--serif);font-size:15.5px;line-height:1.6;color:var(--ink-2);margin:0">State the strongest version of the opposing case before answering it.</dd>

    <dt style="font-family:var(--mono);font-size:13px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.06em">Cui bono</dt>
    <dd style="font-family:var(--serif);font-size:15.5px;line-height:1.6;color:var(--ink-2);margin:0">Ask who benefits from this being the question.</dd>

    <dt style="font-family:var(--mono);font-size:13px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.06em">Base-rate</dt>
    <dd style="font-family:var(--serif);font-size:15.5px;line-height:1.6;color:var(--ink-2);margin:0">Check the claim against how often such things are actually true.</dd>

    <dt style="font-family:var(--mono);font-size:13px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.06em">Dispute vs. question the logic</dt>
    <dd style="font-family:var(--serif);font-size:15.5px;line-height:1.6;color:var(--ink-2);margin:0">Argue the facts are wrong, or that the reasoning doesn't follow even if the facts are right.</dd>
  </dl>
</section>

<section>
  <h2 style="font-family:var(--serif);font-size:24px;line-height:1.2;margin:0 0 10px;color:var(--ink)">The discipline</h2>
  <p style="font-family:var(--serif);font-size:16.5px;line-height:1.65;color:var(--ink-2);max-width:720px">
    The operator owns every verdict. The system surfaces reasons for and against — it never
    decides. Patterns are hypotheses until verified and signed. Disconfirming evidence is shown,
    not buried. The analysis is the moat precisely because it can be wrong, and says so when it
    might be.
  </p>
</section>
`;
  return renderPage({
    title: "Methodology",
    description:
      "How CANOPTICON conducts analysis: forensic stance, sourced claims, signed analysis, owned verdicts.",
    body,
    activeNav: "/methodology",
    zone: "home",
  });
}
