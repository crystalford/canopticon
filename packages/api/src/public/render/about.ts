// About — what Canopticon is and how it thinks.
// Spare, confident, plain English. Built around the facts/analysis split,
// the lenses, and the discipline of the work.

import { renderPage } from "../layout";

export function renderAbout(): string {
  const body = `
<section style="margin-bottom:28px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> About</div>
  <h1 style="font-family:var(--serif);font-size:42px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 14px;color:var(--ink)">What CANOPTICON is</h1>
  <p style="font-family:var(--serif);font-size:19px;line-height:1.55;color:var(--ink-2);max-width:720px">
    A forensic intelligence system for understanding how things actually work — beneath the
    official account, beneath the headline, beneath the stated reason. It maps structure: the
    personnel, institutions, money flows, and recurring patterns that shape how decisions get
    made and who they serve. Every claim is sourced to an external record. Every analysis is
    signed. The graph grows; the patterns sharpen; the record is permanent.
  </p>
  <p style="font-family:var(--serif);font-size:17px;line-height:1.55;color:var(--ink-2);max-width:720px;margin-top:14px">
    <em>The facts are the commodity. The analysis is the moat.</em>
  </p>
</section>

<section style="margin-bottom:36px">
  <div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:18px"><div class="label">Two registers, kept apart</div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px" class="op-grid">
    <div class="card soft" style="padding:22px">
      <div class="label" style="margin-bottom:10px">Facts</div>
      <p style="font-family:var(--serif);font-size:15.5px;line-height:1.6;color:var(--ink-2);margin:0">
        Objective, unsigned, externally sourced, citable. The bedrock. A fact's evidence always
        points to a real source in the world, never to Canopticon itself.
      </p>
    </div>
    <div class="card soft" style="padding:22px">
      <div class="label" style="margin-bottom:10px">Analysis</div>
      <p style="font-family:var(--serif);font-size:15.5px;line-height:1.6;color:var(--ink-2);margin:0">
        Signed, authored, opinionated. The operator's reading laid over the facts. Worth reading
        because it argues; citable because it rests on facts that aren't the argument.
      </p>
    </div>
  </div>
  <p style="font-family:var(--serif);font-size:15.5px;line-height:1.6;color:var(--ink-2);margin-top:16px;max-width:720px">
    Facts come first, uninterrupted. Analysis comes last, clearly marked. The information order
    itself is the honesty signal.
  </p>
</section>

<section style="margin-bottom:36px">
  <div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:18px"><div class="label">Why server-rendered HTML</div></div>
  <p style="font-family:var(--serif);font-size:16px;line-height:1.6;color:var(--ink-2);max-width:720px">
    Every page is real HTML, readable without JavaScript. That isn't a stylistic choice — it's the
    medium. The record must be archivable, indexable, citable, and legible to machines that will
    summarise it later. JavaScript-only sites disappear; this one is built so it can't.
  </p>
</section>

<section style="margin-bottom:36px">
  <div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:18px"><div class="label">A note on influence</div></div>
  <p style="font-family:var(--serif);font-size:16px;line-height:1.6;color:var(--ink-2);max-width:720px">
    The system is informed by media theory at the level of how it thinks, not how it looks. The
    theory is in the foundation, not on the walls.
  </p>
</section>

<section>
  <div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:18px"><div class="label">Geography</div></div>
  <p style="font-family:var(--serif);font-size:16px;line-height:1.6;color:var(--ink-2);max-width:720px">
    The operator is based in Canada and much of the current research touches Canadian
    institutions and figures. The scope is not national — the systems that shape the modern
    state are transnational. Canada is a vantage point, not a boundary.
  </p>
</section>
`;
  return renderPage({
    title: "About",
    description:
      "What CANOPTICON is: a forensic intelligence system for mapping structure beneath the official account.",
    body,
    activeNav: "/about",
    zone: "home",
  });
}
