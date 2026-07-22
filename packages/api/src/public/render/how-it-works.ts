// "How this works" — the orientation page that distills the internal
// design docs into something readable on the site itself. Public (no
// harm in anyone reading it), but written for the operator: what /method
// explains for readers (why a claim can be trusted), this explains for
// the person running it (what's actually happening, unattended, between
// visits, and what each operator action does).

import { renderPage } from "../layout";

export function renderHowItWorks(): string {
  const body = `
<section class="hiw-masthead">
  <div class="kicker"><span class="live"></span> How this works</div>
  <h1 class="hiw-h1">What's actually happening.</h1>
  <p class="hiw-lede">
    /method explains why a claim on this site can be trusted. This page explains what
    the system is doing on its own, between your visits, and what each button you can
    press actually does.
  </p>
</section>

<section class="hiw-section">
  <h2 class="hiw-h2">The fabric</h2>
  <p>
    Everything on this site is one body of content, read four ways. Documents you
    upload (or the system fetches on its own) get read into a typed graph of facts —
    people, events, claims, and the sources they trace back to. That graph grows into
    pages automatically: every subject with enough material gets a page, in two modes —
    <b>neutral</b> (the facts and their receipts, disputed material shown gray) and
    <b>signed</b> (your reading — a thesis pulling the same facts into an argument,
    with the strongest complicating fact always included). Nobody writes a page by
    hand; they grow as documents are read.
  </p>
</section>

<section class="hiw-section">
  <h2 class="hiw-h2">The firewall, briefly</h2>
  <p>
    A fact only exists on this site if it's a word-for-word quote from a document
    actually stored here, checked mechanically. An attributed claim (someone said X)
    is never silently stated as settled fact. This is the one rule everything else is
    built around — see <a href="/method">/method</a> for the full mechanics.
  </p>
</section>

<section class="hiw-section">
  <h2 class="hiw-h2">The standing newsroom</h2>
  <p>
    The system doesn't just wait for uploads. Several things run on their own, on a
    schedule, without you:
  </p>
  <div class="hiw-list">
    <div class="hiw-item">
      <div class="hiw-item-h">The sweep</div>
      <p>Every few hours, one pass picks the single most worth-pursuing thin subject
      and runs a real search → fetch → verbatim-extract cycle on it — the same
      pipeline as the "Expand this file" button, just fired automatically. Priority
      goes to beats first, then subjects the graph already talks about a lot but
      hasn't verified yet (edge_degree), with an extra boost for subjects a surfaced
      contradiction or cross-document connection is specifically about.</p>
    </div>
    <div class="hiw-item">
      <div class="hiw-item-h">Beats</div>
      <p>Standing coverage areas you name — a person, an institution, a topic you want
      watched continuously, not just filled in once. A due beat gets first refusal on
      the sweep's one slot. Managed via <code>/v1/admin/beats</code> right now (no UI
      form yet).</p>
    </div>
    <div class="hiw-item">
      <div class="hiw-item-h">Deep research</div>
      <p>After a beat's sweep banks new sources, a separate pass writes a synthesized
      research brief from them — the "free-ish" equivalent of the Research toggle you'd
      otherwise run by hand — and that brief goes through the exact same verbatim
      extraction as anything you upload.</p>
    </div>
    <div class="hiw-item">
      <div class="hiw-item-h">The settle pipeline</div>
      <p>After documents come in, six steps run in the background to turn raw
      extraction into a usable record: merging duplicate entities and events, scoring
      contested evidence, surfacing themes and cross-document patterns, seeding pages,
      proposing briefs, and drafting signed readings. One step runs per tick — chaining
      them all at once is exactly what silently broke this for a while; splitting it up
      is what fixed it.</p>
    </div>
  </div>
  <p>
    The homepage's <b>"Today, unattended"</b> line is the honest status check: how many
    sweeps ran, sources banked, readings drafted, and duplicates merged today, so you're
    never left wondering if any of this is actually running.
  </p>
</section>

<section class="hiw-section">
  <h2 class="hiw-h2">What you can do</h2>
  <div class="hiw-list">
    <div class="hiw-item">
      <div class="hiw-item-h">Sign a reading</div>
      <p>A drafted reading waits under "Awaiting your signature" until you read it and
      sign or discard it. The system writes; you're the only one who publishes.</p>
    </div>
    <div class="hiw-item">
      <div class="hiw-item-h">Expand a thin file</div>
      <p>On any subject page, "Expand this file" fires the same search+fetch+extract
      cycle the sweep uses, right now, for that one subject.</p>
    </div>
    <div class="hiw-item">
      <div class="hiw-item-h">Research a question</div>
      <p>On a search that comes up empty, or on an open thread / finding with nowhere
      to click yet, "Research this" fires the same pipeline keyed to that exact
      question.</p>
    </div>
    <div class="hiw-item">
      <div class="hiw-item-h">Bulk-expand the thinnest 3</div>
      <p>One button on the homepage's status line, for when you want to nudge several
      gaps at once instead of waiting for the sweep's one-at-a-time cadence.</p>
    </div>
  </div>
</section>

<section class="hiw-section">
  <h2 class="hiw-h2">What it costs</h2>
  <p>
    None of the automatic parts are free: Brave Search calls and Workers AI inference
    both cost real money, metered. Everything above is deliberately capped — one
    subject per sweep tick, one candidate per settle step, bulk-expand capped at 3 —
    on purpose, so unattended operation stays bounded rather than open-ended.
  </p>
</section>
`;

  return renderPage({
    title: "How this works · canopticon",
    description:
      "What the system does on its own between visits, and what each operator action does.",
    body: `${body}
<style>
  .hiw-masthead { max-width: 720px; margin: 40px auto 0; padding: 0 24px; }
  .hiw-h1 { font-family: var(--serif); font-size: 34px; margin: 12px 0 14px; color: var(--ink); }
  .hiw-lede { font-family: var(--serif); font-size: 17px; line-height: 1.6; color: var(--ink-2); }
  .hiw-section { max-width: 720px; margin: 0 auto; padding: 22px 24px; }
  .hiw-h2 { font-family: var(--serif); font-size: 21px; color: var(--ink); margin: 0 0 12px; }
  .hiw-section p { font-family: var(--serif); font-size: 15.5px; line-height: 1.65; color: var(--ink-2); }
  .hiw-section code { font-family: var(--mono); font-size: 13px; background: var(--paper-2, var(--surface)); padding: 1px 5px; border-radius: 3px; }
  .hiw-list { display: flex; flex-direction: column; gap: 18px; margin: 16px 0; }
  .hiw-item { padding: 14px 18px; border-left: 3px solid var(--rule-bright, var(--rule)); background: var(--paper-2, var(--surface)); border-radius: 4px; }
  .hiw-item-h { font-family: var(--mono); font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; }
  .hiw-item p { margin: 0; font-size: 14.5px; }
</style>`,
  });
}
