// DESIGN PROTOTYPE — /op/design (unlinked, throwaway).
//
// Nothing here is wired to data. This is the design artifact for the app
// reframe: the system reads, writes, and brings FINISHED things to the
// operator; the operator reads and decides. One home ("Today"), editorial
// presentation, and a hard substance gate — silence over filler.
//
// Tear it apart, keep what's right, then the real app gets rebuilt to match.
// Content below is hand-written against the operator's actual corpus themes
// so the feel is honest.

export function renderDesignMock(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Today — Canopticon (design prototype)</title>
<style>
  :root {
    --bg: #0b0c0f;
    --panel: #111318;
    --panel-2: #15181f;
    --line: #232732;
    --ink: #e8eaef;
    --ink-2: #b6bcc9;
    --ink-3: #8a91a0;
    --faint: #5d6472;
    --amber: #e09a3a;
    --amber-dim: #8a6526;
    --green: #69b076;
    --serif: "Georgia", "Times New Roman", serif;
    --sans: -apple-system, "Segoe UI", system-ui, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--ink); font-family: var(--sans); line-height: 1.55; }
  a { color: inherit; }

  .frame { max-width: 720px; margin: 0 auto; padding: 0 24px 120px; }

  /* ---- top bar: wordmark + three destinations, nothing else ---- */
  .top { display: flex; align-items: baseline; gap: 28px; padding: 28px 0 10px; }
  .wordmark { font-weight: 700; letter-spacing: -0.02em; font-size: 17px; }
  .wordmark i { color: var(--amber); font-style: normal; }
  .nav { display: flex; gap: 22px; margin-left: auto; font-size: 14px; }
  .nav a { text-decoration: none; color: var(--ink-3); padding-bottom: 2px; }
  .nav a.on { color: var(--ink); border-bottom: 2px solid var(--amber); }

  .date { color: var(--faint); font-size: 13px; padding: 18px 0 4px; }
  .pulse { color: var(--ink-3); font-size: 14px; padding-bottom: 34px; border-bottom: 1px solid var(--line); }
  .pulse b { color: var(--ink-2); font-weight: 600; }

  /* ---- the lead: ONE thing, written like an editor's note ---- */
  .lead { padding: 38px 0 30px; border-bottom: 1px solid var(--line); }
  .lead .k { font-size: 11px; letter-spacing: 0.14em; color: var(--amber); text-transform: uppercase; margin-bottom: 14px; }
  .lead h1 { font-family: var(--serif); font-size: 31px; line-height: 1.18; letter-spacing: -0.01em; font-weight: 600; margin-bottom: 16px; }
  .lead p { font-size: 16px; color: var(--ink-2); max-width: 640px; margin-bottom: 14px; }
  .lead p b { color: var(--ink); font-weight: 600; }
  blockquote {
    margin: 22px 0; padding: 4px 0 4px 20px; border-left: 2px solid var(--amber-dim);
    font-family: var(--serif); font-size: 17px; font-style: italic; color: var(--ink-2);
  }
  blockquote .src { display: block; margin-top: 8px; font-family: var(--sans); font-style: normal; font-size: 12.5px; color: var(--faint); }
  .lead .drafted { font-size: 14px; color: var(--ink-3); margin: 18px 0 22px; }
  .lead .drafted em { color: var(--green); font-style: normal; }

  .acts { display: flex; gap: 12px; align-items: center; }
  .btn {
    display: inline-block; text-decoration: none; font-size: 14.5px; font-weight: 600;
    padding: 11px 22px; border-radius: 9px; border: 1px solid var(--line);
    background: var(--panel); color: var(--ink-2); cursor: pointer;
  }
  .btn.primary { background: var(--amber); border-color: var(--amber); color: #18120a; }
  .btn.quiet { background: none; border: none; color: var(--faint); font-weight: 500; padding: 11px 10px; }

  /* ---- also noticed: a FEW one-liners with a real hook ---- */
  .section-k { font-size: 11px; letter-spacing: 0.14em; color: var(--faint); text-transform: uppercase; padding: 34px 0 6px; }
  .noticed { border-bottom: 1px solid var(--line); padding-bottom: 10px; }
  .notice { display: flex; gap: 16px; align-items: baseline; padding: 16px 0; border-top: 1px solid var(--line); }
  .notice:first-of-type { border-top: none; }
  .notice p { flex: 1; font-size: 15px; color: var(--ink-2); }
  .notice p b { color: var(--ink); font-weight: 600; }
  .notice .mini { display: flex; gap: 4px; }
  .mini a { text-decoration: none; font-size: 13px; color: var(--ink-3); padding: 5px 10px; border-radius: 7px; }
  .mini a.go { color: var(--amber); }
  .mini a:hover { background: var(--panel-2); }

  /* ---- the silence line: the substance gate, visible ---- */
  .silence { padding: 20px 0 0; font-size: 13.5px; color: var(--faint); }
  .silence a { color: var(--faint); }

  /* ---- awaiting decision: finished drafts, read & decide ---- */
  .draft {
    margin-top: 14px; background: var(--panel); border: 1px solid var(--line);
    border-radius: 12px; padding: 22px 24px;
  }
  .draft .t { font-family: var(--serif); font-size: 20px; font-weight: 600; margin-bottom: 6px; }
  .draft .m { font-size: 13.5px; color: var(--ink-3); margin-bottom: 16px; }
  .draft .m em { color: var(--green); font-style: normal; }
  .draft .preview { font-size: 14.5px; color: var(--ink-2); border-top: 1px solid var(--line); padding-top: 14px; margin-bottom: 16px; }

  .foot { margin-top: 70px; padding-top: 18px; border-top: 1px dashed var(--amber-dim); font-size: 12.5px; color: var(--faint); }
  .foot b { color: var(--amber); }
</style>
</head>
<body>
<div class="frame">

  <div class="top">
    <div class="wordmark">canopticon<i>.</i></div>
    <nav class="nav">
      <a class="on" href="#">Today</a>
      <a href="#">Library</a>
      <a href="#">Published</a>
    </nav>
  </div>

  <div class="date">Wednesday, June 10</div>
  <div class="pulse">
    I read <b>2 new documents</b> while you were away — both on Canadian cultural policy.
    The library holds <b>14 documents</b>, all read. One thing is worth your attention.
  </div>

  <!-- ============ THE LEAD — one thing, with its evidence ============ -->
  <section class="lead">
    <div class="k">Worth your attention</div>
    <h1>Purdue Canada was never criminally prosecuted — and your documents point at why.</h1>
    <p>
      In the US, Purdue pleaded guilty to federal criminal charges twice — 2007 and 2020.
      Your documents show the Canadian arm faced only a <b>$150M civil class-action settlement</b>,
      and that Health Canada's own review never referred the matter for prosecution.
      The gap isn't an oversight; two of your sources describe the same structural reason:
    </p>
    <blockquote>
      “No federal regulator in Canada holds the investigative mandate that the
      US Department of Justice exercised — opioid marketing fell between Health
      Canada’s safety remit and the provinces’ consumer-protection statutes.”
      <span class="src">— from “The Opioid File: Regulatory Capture in Canadian Pharma,” p. 14 · in your library</span>
    </blockquote>
    <p>
      Your third document complicates it further: the CoRE recovery-excellence study —
      <b>funded in part by McKinsey</b> — shaped the federal response while the firm
      was still under contract with Purdue. Nobody in your corpus connects these
      two facts. That connection is the piece.
    </p>
    <div class="drafted">
      I’ve drafted the investigation — <em>7 claims verified</em> against 3 of your source documents,
      contested assertions attributed. ~6 minute read.
    </div>
    <div class="acts">
      <a class="btn primary" href="#">Read the draft →</a>
      <a class="btn quiet" href="#">Not interested</a>
    </div>
  </section>

  <!-- ============ ALSO NOTICED — a few, each with a real hook ============ -->
  <div class="section-k">Also noticed</div>
  <div class="noticed">
    <div class="notice">
      <p><b>Your two C-11 documents disagree</b> — one cites measurable discoverability harm to Canadian
      creators, the other states no such evidence exists. Same regulation, opposite claims.</p>
      <span class="mini"><a class="go" href="#">Look into it</a><a href="#">Ignore</a></span>
    </div>
    <div class="notice">
      <p><b>BMO appears on both sides</b> of your carbon-market documents — once as a transition-fund
      financier, once as the subject of the audit it helped design.</p>
      <span class="mini"><a class="go" href="#">Look into it</a><a href="#">Ignore</a></span>
    </div>
  </div>
  <div class="silence">
    Nothing else met the bar today — 11 lower-signal observations stayed quiet. <a href="#">Show them anyway</a>
  </div>

  <!-- ============ AWAITING YOUR DECISION — finished drafts ============ -->
  <div class="section-k">Awaiting your decision</div>
  <div class="draft">
    <div class="t">Timeline: How the Carney QP-attendance story moved</div>
    <div class="m">Reference page · <em>5 claims verified</em> · built from 2 sources · ready to publish</div>
    <div class="preview">
      “The story ran for eleven days. It began with a Global News count of missed Question
      Periods and ended as a Power Panel segment on recession messaging — by then the
      original number had changed twice…”
    </div>
    <div class="acts">
      <a class="btn primary" href="#">Read &amp; approve →</a>
      <a class="btn" href="#">Edit</a>
      <a class="btn quiet" href="#">Discard</a>
    </div>
  </div>

  <div class="foot">
    <b>DESIGN PROTOTYPE</b> — nothing on this page is wired to real data. It exists to settle
    the feel: one home · the system writes, you decide · evidence visible · silence over filler.
    Tear it apart.
  </div>

</div>
</body>
</html>`;
}
