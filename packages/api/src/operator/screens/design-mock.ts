// DESIGN PROTOTYPE — /op/design (unlinked, throwaway, zero wiring).
//
// The whole system envisioned, five screens. This is the translation layer
// between the vision and the build: tear it apart screen by screen, and the
// real app gets rebuilt to match what survives.
//
//   /op/design          — the vision, one screen
//   /op/design/page     — REFERENCE: a living wiki page (entity)
//   /op/design/story    — INVESTIGATIONS: a signed piece standing on it
//   /op/design/out      — OUT: the single operator stream
//   /op/design/in       — IN: drop and forget
//
// Plain names (operator: "the record and the voice" was too abstract):
// the wiki layer is "Reference"; the signed layer is "Investigations".
// Content is hand-written against the operator's real corpus (Carney, BMO,
// Purdue, C-11, carbon markets) at honest 50-document proportions.

const CSS = `
  :root {
    --bg:#0b0c0f; --panel:#111318; --panel2:#15181f; --line:#232732;
    --ink:#e8eaef; --ink2:#b6bcc9; --ink3:#8a91a0; --faint:#5d6472;
    --amber:#e09a3a; --amber-dim:#8a6526; --green:#69b076; --red:#c4564f;
    --serif:Georgia,"Times New Roman",serif;
    --sans:-apple-system,"Segoe UI",system-ui,sans-serif;
    --mono:ui-monospace,Menlo,monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.55}
  a{color:inherit}
  .frame{max-width:760px;margin:0 auto;padding:0 24px 120px}
  .top{display:flex;align-items:baseline;gap:28px;padding:28px 0 10px}
  .wordmark{font-weight:700;letter-spacing:-.02em;font-size:17px;text-decoration:none}
  .wordmark i{color:var(--amber);font-style:normal}
  .nav{display:flex;gap:20px;margin-left:auto;font-size:14px}
  .nav a{text-decoration:none;color:var(--ink3);padding-bottom:2px}
  .nav a.on{color:var(--ink);border-bottom:2px solid var(--amber)}
  .k{font-size:11px;letter-spacing:.14em;color:var(--amber);text-transform:uppercase;margin:34px 0 10px}
  .k.dim{color:var(--faint)}
  h1{font-family:var(--serif);font-size:31px;line-height:1.16;letter-spacing:-.01em;font-weight:600;margin-bottom:14px}
  .lede{font-size:16px;color:var(--ink2);max-width:640px}
  .btn{display:inline-block;text-decoration:none;font-size:14.5px;font-weight:600;padding:11px 22px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink2);cursor:pointer}
  .btn.primary{background:var(--amber);border-color:var(--amber);color:#18120a}
  .btn.quiet{background:none;border:none;color:var(--faint);font-weight:500;padding:11px 10px}
  .chip{display:inline-block;font-size:11px;letter-spacing:.05em;padding:2px 9px;border:1px solid var(--line);border-radius:99px;color:var(--ink3);text-transform:uppercase}
  .chip.amber{border-color:var(--amber-dim);color:var(--amber)}
  .chip.gray{background:var(--panel2)}
  blockquote{margin:18px 0;padding:4px 0 4px 18px;border-left:2px solid var(--amber-dim);font-family:var(--serif);font-size:16.5px;font-style:italic;color:var(--ink2)}
  blockquote .src{display:block;margin-top:7px;font-family:var(--sans);font-style:normal;font-size:12.5px;color:var(--faint)}
  .rule{border-bottom:1px solid var(--line)}
  .foot{margin-top:70px;padding-top:18px;border-top:1px dashed var(--amber-dim);font-size:12.5px;color:var(--faint)}
  .foot b{color:var(--amber)}
  sup{color:var(--amber);font-size:11px;cursor:pointer}
  .fact{padding:11px 0;border-top:1px solid var(--line);font-size:15px;color:var(--ink2)}
  .fact b{color:var(--ink);font-weight:600}
  .twocol{display:grid;grid-template-columns:1fr 240px;gap:36px}
  @media(max-width:720px){.twocol{grid-template-columns:1fr}}
`;

function page(active: string, title: string, body: string): string {
  const nav = (slug: string, label: string) =>
    `<a href="/op/design${slug}" class="${active === slug ? "on" : ""}">${label}</a>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex" /><title>${title} — Canopticon design prototype</title>
<style>${CSS}</style></head>
<body><div class="frame">
  <div class="top">
    <a class="wordmark" href="/op/design">canopticon<i>.</i></a>
    <nav class="nav">
      ${nav("", "The Vision")}
      ${nav("/in", "IN")}
      ${nav("/out", "OUT")}
      ${nav("/page", "Reference")}
      ${nav("/story", "Investigations")}
    </nav>
  </div>
  ${body}
  <div class="foot"><b>DESIGN PROTOTYPE</b> — nothing here is wired. Five screens that ARE the vision; tear apart what's wrong, keep what's right, and the real system gets rebuilt to match.</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// THE VISION — the whole system on one screen
// ---------------------------------------------------------------------------
function visionScreen(): string {
  return page(
    "",
    "The Vision",
    `
  <div class="k">The system, on one screen</div>
  <h1>You feed it documents.<br/>The wiki builds itself.<br/>It drafts the investigations.<br/>You sign.</h1>

  <div style="margin:34px 0;padding:26px;border:1px solid var(--line);border-radius:14px;background:var(--panel)">
    <div style="display:flex;align-items:center;gap:14px;font-size:15px">
      <span class="chip amber">IN</span>
      <span style="color:var(--ink2)">Research reports, filings, articles. Drop them. <b style="color:var(--ink)">That is your entire job on the way in.</b></span>
    </div>
    <div style="margin:18px 0 18px 14px;border-left:1px dashed var(--amber-dim);padding:14px 0 14px 22px;color:var(--ink3);font-size:14px">
      The system reads everything. Every fact, claim, actor, date, and number is extracted with its
      <b style="color:var(--ink2)">verbatim quote</b> — anything it can't anchor to a literal passage in a source is discarded.
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div style="border:1px solid var(--line);border-radius:11px;padding:18px;background:var(--bg)">
        <div style="font-family:var(--serif);font-size:19px;font-weight:600;margin-bottom:8px">Reference — the wiki</div>
        <div style="font-size:13.5px;color:var(--ink2);line-height:1.6">
          Entity pages, timelines, claim-tables — <b>nobody writes them; they grow</b>
          the moment extraction lands, because they're the knowledge graph <i>rendered</i>, not documents authored.
          Neutral, interlinked, citable. Contested claims are first-class: <i>X asserts, Y disputes</i> —
          the thing Wikipedia flattens.
          <div style="margin-top:10px;color:var(--faint);font-size:12.5px">No approval gate — nothing here is opinion. <b style="color:var(--green)">This is where 50 documents becomes 47 living pages.</b></div>
        </div>
      </div>
      <div style="border:1px solid var(--amber-dim);border-radius:11px;padding:18px;background:var(--bg)">
        <div style="font-family:var(--serif);font-size:19px;font-weight:600;margin-bottom:8px">Investigations — signed</div>
        <div style="font-size:13.5px;color:var(--ink2);line-height:1.6">
          Investigations, arguments, assessments — <b>drafted by the system, standing on
          the reference pages</b>, every load-bearing fact linking down into them.
          Deliberately few: from 50 documents, a handful of pieces worth a signature is <i>correct</i>.
          <div style="margin-top:10px;color:var(--faint);font-size:12.5px"><b style="color:var(--amber)">Nothing publishes without your signature.</b> The gate guards the analysis, not the facts.</div>
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:14px;font-size:15px;margin-top:18px">
      <span class="chip amber">OUT</span>
      <span style="color:var(--ink2)">One stream: <b style="color:var(--ink)">what grew · what awaits your signature · what it's chasing.</b> Findings only speak when they carry evidence; everything else stays quiet.</span>
    </div>
  </div>

  <div class="k dim">The proportion law — why the 50-doc test felt wrong</div>
  <p class="lede" style="font-size:14.5px">
    50 documents in → the <b>wiki</b> absorbs the scale (dozens of pages, hundreds of sourced facts, growing silently)
    → <b>investigations</b> stay selective (a few finished drafts) → findings pass a substance gate (a couple that matter; the rest stay quiet).
    The last build inverted this: scale landed in the noise (a wall of synthesis cards) while the value layer showed five cards.
    The architecture under the hood was right; the product on top of it was missing.
  </p>

  <div style="display:flex;gap:12px;margin-top:30px">
    <a class="btn primary" href="/op/design/page">See a reference page →</a>
    <a class="btn" href="/op/design/out">See OUT →</a>
  </div>
`,
  );
}

// ---------------------------------------------------------------------------
// REFERENCE — a living wiki page (Mark Carney), the showpiece
// ---------------------------------------------------------------------------
function referenceScreen(): string {
  return page(
    "/page",
    "Mark Carney — Reference",
    `
  <div class="k">Reference · Entity</div>
  <div class="twocol">
    <div>
      <h1>Mark Carney</h1>
      <p class="lede" style="font-size:15.5px">
        Prime Minister of Canada since March 2025.<sup>1</sup> Former Governor of the Bank of Canada
        and the Bank of England;<sup>2</sup> chaired Brookfield Asset Management's transition-investing
        arm and co-founded GFANZ before entering politics.<sup>3</sup>
      </p>

      <div class="k dim">Established</div>
      <div class="fact"><b>Cut the 2025 permanent-resident target from 500,000 to 395,000</b> in the October immigration plan.<sup>4</sup></div>
      <div class="fact"><b>Missed 14 of 22 Question Periods</b> between April and June 2025, per the Global News attendance count.<sup>5</sup></div>
      <div class="fact"><b>GFANZ membership covered $130T in assets</b> at its 2021 launch under his co-chairmanship.<sup>6</sup></div>
      <div class="fact rule"><b>Advisory Council on Economic Growth recommended 450k/yr immigration</b> during his time advising the Trudeau government.<sup>7</sup></div>

      <div class="k dim" style="margin-top:30px">Contested — shown as contested</div>
      <div style="background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:18px 20px;margin-bottom:10px">
        <div style="font-size:15px;color:var(--ink2);margin-bottom:10px">“Carney <b style="color:var(--ink)">neutralized Poilievre's carbon-tax attack</b> by scrapping the consumer charge.”</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px">
          <span class="chip">asserted by · Liberal campaign strategists<sup>8</sup></span>
          <span class="chip">disputed by · Conservative caucus<sup>9</sup></span>
          <span class="chip gray">evidence · 2 supporting / 1 contradicting</span>
        </div>
      </div>
      <div style="background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:18px 20px">
        <div style="font-size:15px;color:var(--ink2);margin-bottom:10px">“The QP attendance record reflects <b style="color:var(--ink)">contempt for Parliament</b>.”</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px">
          <span class="chip">asserted by · Andrew Scheer<sup>5</sup></span>
          <span class="chip">disputed by · PMO spokesperson<sup>10</sup></span>
          <span class="chip gray">evidence · 1 / 1 — unresolved</span>
        </div>
      </div>

      <div class="k dim" style="margin-top:30px">Timeline</div>
      <div style="font-size:14px;color:var(--ink2)">
        <div class="fact" style="display:flex;gap:14px"><span style="color:var(--faint);font-family:var(--mono);font-size:12px;min-width:74px">2020-08</span> Vice-chair, Brookfield — heads transition investing<sup>3</sup></div>
        <div class="fact" style="display:flex;gap:14px"><span style="color:var(--faint);font-family:var(--mono);font-size:12px;min-width:74px">2021-04</span> Co-launches GFANZ ahead of COP26<sup>6</sup></div>
        <div class="fact" style="display:flex;gap:14px"><span style="color:var(--faint);font-family:var(--mono);font-size:12px;min-width:74px">2025-03</span> Sworn in as Prime Minister<sup>1</sup></div>
        <div class="fact rule" style="display:flex;gap:14px"><span style="color:var(--faint);font-family:var(--mono);font-size:12px;min-width:74px">2025-10</span> Immigration targets cut in first fall plan<sup>4</sup></div>
      </div>
    </div>

    <div>
      <div class="k dim" style="margin-top:0">Connections</div>
      <div style="font-size:13.5px;color:var(--ink2);display:flex;flex-direction:column;gap:12px">
        <div><a href="#" style="color:var(--amber);text-decoration:none">BMO</a><br/><span style="color:var(--ink3)">financier in the transition-fund filings; audit subject in the carbon-market report</span></div>
        <div><a href="#" style="color:var(--amber);text-decoration:none">GFANZ</a><br/><span style="color:var(--ink3)">co-founded; later cited in 3 of your documents on voluntary carbon markets</span></div>
        <div><a href="#" style="color:var(--amber);text-decoration:none">Pierre Poilievre</a><br/><span style="color:var(--ink3)">opposing actor in 6 contested claims</span></div>
      </div>
      <div class="k dim">Appears in</div>
      <div style="font-size:13px;color:var(--ink3)">9 source documents · cited by 2 investigations:<br/>
        <a href="/op/design/story" style="color:var(--amber);text-decoration:none">“The gatekeeper who became the gate”</a>
      </div>
      <div class="k dim">Cite this page</div>
      <div style="font-size:12px;color:var(--faint);font-family:var(--mono)">canopticon.com/reference/mark-carney<br/>dateModified: 2026-06-11</div>
    </div>
  </div>

  <div style="margin-top:44px;padding:16px 20px;background:var(--panel);border:1px solid var(--line);border-radius:11px;font-size:13.5px;color:var(--ink3)">
    This page is not written — <b style="color:var(--ink2)">it is the knowledge graph, rendered.</b> It rebuilt itself
    14 minutes ago when “Transition Finance and the New Gatekeepers” finished extracting. Every numbered
    mark<sup>n</sup> opens the verbatim source quote. Contested claims stay gray until the evidence resolves.
  </div>
`,
  );
}

// ---------------------------------------------------------------------------
// INVESTIGATIONS — a signed piece standing on the reference pages
// ---------------------------------------------------------------------------
function storyScreen(): string {
  return page(
    "/story",
    "Investigation",
    `
  <div class="k">Investigations · signed analysis</div>
  <div style="display:flex;gap:8px;margin-bottom:14px">
    <span class="chip amber">Investigation</span>
    <span class="chip">signed · the operator</span>
    <span class="chip gray">confidence · moderate</span>
  </div>
  <h1>The gatekeeper who became the gate</h1>
  <p class="lede">
    Mark Carney spent a decade building the architecture of transition finance — GFANZ, the disclosure
    regimes, the voluntary carbon markets. Now he runs the country those rules govern. Your documents
    don't allege wrongdoing. They show something quieter: <b>every regulator who might examine that
    architecture now reports, directly or indirectly, to its architect.</b>
  </p>

  <p style="font-size:15.5px;color:var(--ink2);margin:22px 0 14px">
    Start with what's established. <a href="/op/design/page" style="color:var(--amber)">GFANZ covered $130T
    in member assets at launch</a> — an alliance Carney co-founded and whose membership criteria three of
    your documents describe as self-certified. The
    <a href="/op/design/page" style="color:var(--amber)">BMO transition fund</a> — financed under those
    criteria — was audited under a framework whose terms of reference list two GFANZ alumni…
  </p>
  <blockquote>
    “The review panel's independence requirements do not extend to prior employment within member
    institutions of the alliance under review.”
    <span class="src">— Carbon Market Watch report, p. 31 · the quote opens the source in the Library</span>
  </blockquote>

  <div style="margin:28px 0;padding:16px 20px;background:var(--panel);border:1px solid var(--line);border-radius:11px;font-size:13.5px;color:var(--ink3)">
    <b style="color:var(--ink2)">Stands on 11 facts from 4 sources</b> — every load-bearing fact above links
    down to a reference page, where it carries its verbatim quote. Contested material appears attributed, never
    as fact. The system drafted this; the operator signed it.
  </div>

  <div class="k dim">Open questions this piece does not resolve</div>
  <div style="font-size:14.5px;color:var(--ink2)">
    <div class="fact">Who set the review panel's terms of reference — and were alternatives drafted?</div>
    <div class="fact rule">Does the CUSMA cultural exemption interact with the disclosure regime at all?</div>
  </div>
`,
  );
}

// ---------------------------------------------------------------------------
// OUT — the single operator stream, at honest 50-doc proportions
// ---------------------------------------------------------------------------
function outScreen(): string {
  return page(
    "/out",
    "OUT",
    `
  <div class="k">OUT</div>
  <h1 style="font-size:24px">Extraction finished 22:41 — 52 documents read.</h1>

  <div class="k dim">Awaiting your signature · 3</div>
  <div style="display:flex;flex-direction:column;gap:12px">
    ${[
      {
        t: "The gatekeeper who became the gate",
        m: "Investigation · 11 claims verified · 4 sources · ~7 min read",
        p: "Every regulator who might examine the transition-finance architecture now reports, directly or indirectly, to its architect…",
      },
      {
        t: "Why was Purdue Canada never criminally prosecuted?",
        m: "Investigation · 7 claims verified · 3 sources · ~6 min read",
        p: "No federal regulator held the investigative mandate the US DOJ exercised — and the recovery study that shaped the response was McKinsey-funded…",
      },
      {
        t: "Claim table: what's asserted about C-11's discoverability rules",
        m: "Reference · 9 claims, both sides attributed · ready to publish",
        p: "One of your documents cites measurable harm to Canadian creators; another states no such evidence exists. Same regulation, opposite claims, sources for each…",
      },
    ]
      .map(
        (d) => `<div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px 22px">
      <div style="font-family:var(--serif);font-size:19px;font-weight:600;margin-bottom:4px">${d.t}</div>
      <div style="font-size:13px;color:var(--ink3);margin-bottom:12px">${d.m}</div>
      <div style="font-size:14px;color:var(--ink2);border-top:1px solid var(--line);padding-top:11px;margin-bottom:14px">“${d.p}”</div>
      <div style="display:flex;gap:10px"><a class="btn primary" href="#">Read &amp; sign →</a><a class="btn" href="#">Edit</a><a class="btn quiet" href="#">Discard</a></div>
    </div>`,
      )
      .join("")}
  </div>

  <div class="k dim">The wiki grew — no action needed</div>
  <div style="font-size:14.5px;color:var(--ink2);border:1px solid var(--line);border-radius:11px;padding:16px 20px;background:var(--bg)">
    <b style="color:var(--green)">+6 new pages</b> (Carbon Market Watch, CoRE, GFANZ, Robert Kavcic, Bill C-11, Purdue Canada)
    · <b>34 pages gained facts</b> · <b>12 new contested claims</b> shown as contested ·
    <a href="/op/design/page" style="color:var(--amber)">browse the reference pages →</a>
  </div>

  <div class="k dim">Worth your attention · 1</div>
  <div style="font-size:14.5px;color:var(--ink2);padding:4px 0 14px">
    <b style="color:var(--ink)">Your two C-11 documents directly contradict each other</b> on discoverability harm —
    one cites a measured 23% reach decline for Canadian creators, the other states “no empirical evidence of harm exists.”
    <div style="margin-top:10px;display:flex;gap:4px"><a class="btn" style="font-size:13px;padding:7px 14px" href="#">Draft the comparison</a><a class="btn quiet" style="font-size:13px" href="#">Ignore</a></div>
  </div>
  <div style="font-size:13.5px;color:var(--faint);padding-top:6px;border-top:1px solid var(--line)">
    41 lower-signal observations stayed quiet (cross-document mentions, weak couplings). <a href="#" style="color:var(--faint)">Show them anyway</a>
  </div>

  <div class="k dim">Still chasing</div>
  <div style="font-size:13.5px;color:var(--ink3)">
    Who funded the CoRE study reviewers · Whether the BMO audit terms were ever public — these resurface only if new documents speak to them.
  </div>
`,
  );
}

// ---------------------------------------------------------------------------
// IN — drop and forget
// ---------------------------------------------------------------------------
function inScreen(): string {
  return page(
    "/in",
    "IN",
    `
  <div class="k">IN</div>
  <h1 style="font-size:24px">Drop documents. That's the whole job.</h1>
  <div style="margin:24px 0;border:1.5px dashed var(--amber-dim);border-radius:14px;padding:54px 20px;text-align:center;color:var(--ink3);font-size:15px">
    <div style="font-size:22px;margin-bottom:8px;color:var(--amber)">⌅</div>
    Markdown · PDF · zip of 100<br/>
    <span style="font-size:13px;color:var(--faint)">Everything else — reading, extraction, the wiki, the drafts — happens on its own.</span>
  </div>
  <div style="font-size:14px;color:var(--ink2);display:flex;gap:26px;border-top:1px solid var(--line);padding-top:16px">
    <span><b style="color:var(--ink)">52</b> documents</span>
    <span><b style="color:var(--green)">all read</b> · last 22:41</span>
    <span><b style="color:var(--ink)">312</b> sourced facts on the wiki</span>
  </div>
  <div class="k dim">The library</div>
  <div style="font-size:14px;color:var(--ink2)">
    <div class="fact" style="display:flex;justify-content:space-between"><span>Transition Finance and the New Gatekeepers</span><span style="color:var(--green);font-size:12.5px">read · 38 facts</span></div>
    <div class="fact" style="display:flex;justify-content:space-between"><span>The Opioid File: Regulatory Capture in Canadian Pharma</span><span style="color:var(--green);font-size:12.5px">read · 41 facts</span></div>
    <div class="fact rule" style="display:flex;justify-content:space-between"><span>C-11 Discoverability: Evidence Review</span><span style="color:var(--green);font-size:12.5px">read · 22 facts</span></div>
  </div>
`,
  );
}

const SCREENS: Record<string, () => string> = {
  "": visionScreen,
  page: referenceScreen,
  story: storyScreen,
  out: outScreen,
  in: inScreen,
};

export function renderDesignMock(screen = ""): string | null {
  const fn = SCREENS[screen];
  return fn ? fn() : null;
}
