// Home — masthead + five-pillar entry. Phase 1 stub.
// Uses the design system's `cardlink` + `card-type` + `card-title`
// + `card-dek` classes directly so the page is polished from day one.
// Phase 2 swaps the static blurbs for live lead/recent/topic data.

import { PRIMARY_NAV, escapeHtml, renderPage } from "../layout";

interface PillarSpec {
  href: string;
  label: string;
  typeLabel: string;
  typeClass: string;
  blurb: string;
}

// The four ways into the fabric. Matches the public nav (spec v2.5 Part 10):
// Investigations · Topics · Library · About-Methodology. The old "Record" and
// "Patterns" pillars dissolved with v2.4 — those URLs 301-redirect into the
// surfaces below; this fallback used to list them as live entries, which was
// a stale-link debt.
const PILLARS: PillarSpec[] = [
  {
    href: "/topics",
    label: "Browse the record",
    typeLabel: "The index",
    typeClass: "t-topic",
    blurb:
      "Every file in the record — people, companies, events, and the widely-held stories the documents push back on. Nobody wrote these pages; they grew as sources were read.",
  },
  {
    href: "/investigations",
    label: "Investigations",
    typeLabel: "Signed analysis",
    typeClass: "t-essay",
    blurb:
      "The signed analyses. Each one wears its intent as a badge; every load-bearing claim ties back to the file it stands on.",
  },
  {
    href: "/library",
    label: "Library",
    typeLabel: "The raw research",
    typeClass: "t-research-report",
    blurb: "Every source document the record is built on — kept whole, kept honest.",
  },
  {
    href: "/method",
    label: "Method",
    typeLabel: "How this works",
    typeClass: "t-pattern",
    blurb:
      "How verification works: word-for-word quotes, independent judging, and disputed material shown as disputed, never quietly as fact.",
  },
];

// Operator overlay data — drafts to sign, recent findings, open threads,
// plus the numbers needed to compose the plain-language briefing line.
// Loaded only when isOperator=true; never queried for anonymous viewers.
interface OperatorOverlays {
  drafts: Array<{
    page_id: string;
    slug: string;
    label: string;
    intent: string | null;
    thesis: string | null;
    confidence: string | null;
    claims_verified: number;
  }>;
  findings: Array<{
    id: string;
    kind: string;
    title: string;
    statement_md: string;
    confidence: string;
  }>;
  threads: Array<{ id: string; question: string; status: string }>;
  pulse: { newPages: number; newFacts: number };
}

async function loadOperatorOverlays(db: D1Database, userId: string): Promise<OperatorOverlays> {
  const { all, one } = await import("../../lib/d1");
  const [drafts, findings, threads, pulse] = await Promise.all([
    all<{
      page_id: string;
      slug: string;
      label: string;
      intent: string | null;
      thesis: string | null;
      confidence: string | null;
      claims_verified: number;
    }>(
      db,
      `SELECT p.id AS page_id, p.slug, n.label, p.intent, p.thesis, p.confidence, p.claims_verified
         FROM pages p JOIN nodes n ON n.id = p.subject_node_id
        WHERE p.user_id = ? AND p.signed_status = 'draft' AND p.body_md IS NOT NULL
        ORDER BY p.updated_at DESC LIMIT 6`,
      [userId],
    ).catch(() => []),
    all<{ id: string; kind: string; title: string; statement_md: string; confidence: string }>(
      db,
      `SELECT id, kind, title, statement_md, confidence FROM patterns
        WHERE user_id = ? AND status = 'candidate' AND length(statement_md) > 80
        ORDER BY (confidence = 'high') DESC, updated_at DESC LIMIT 4`,
      [userId],
    ).catch(() => []),
    all<{ id: string; question: string; status: string }>(
      db,
      `SELECT id, question, status FROM inquiry_threads
        WHERE user_id = ? AND status IN ('open','being_pursued')
        ORDER BY CASE status WHEN 'being_pursued' THEN 0 ELSE 1 END, created_at DESC LIMIT 6`,
      [userId],
    ).catch(() => []),
    one<{ newPages: number; newFacts: number }>(
      db,
      `SELECT
         (SELECT COUNT(*) FROM pages WHERE user_id = ? AND created_at > datetime('now','-1 day')) AS newPages,
         (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND kind IN ('neutral_fact','assertion','event')
            AND created_at > datetime('now','-1 day')) AS newFacts`,
      [userId, userId],
    ).catch(() => null),
  ]);
  return {
    drafts,
    findings,
    threads,
    pulse: pulse ?? { newPages: 0, newFacts: 0 },
  };
}

// Live fabric feed: recently active subjects + signed readings. The home is
// the doorway INTO the fabric, not a list of nav pillars.
//
// When the operator is logged in, this is ALSO their home — operator-only
// sections (system briefing, drafts awaiting signature, findings, open
// threads) overlay onto the same page. There is no separate dashboard.
// Spec v2.5 Part 9, revised: the operator browses the publication; the
// graph grows from what they do on it.
export async function renderHome(
  env?: { DB: D1Database },
  opts: { isOperator?: boolean } = {},
): Promise<string> {
  if (env) {
    const feed = await renderActivityFeed(env, !!opts.isOperator).catch(() => "");
    if (feed) return feed;
  }
  // Fallback (no env / empty corpus): the pillar masthead.
  const cards = PILLARS.map(
    (p) => `<a class="cardlink" href="${p.href}">
  <div class="card-type ${p.typeClass}">${escapeHtml(p.typeLabel)}</div>
  <div class="card-title">${escapeHtml(p.label)}</div>
  <div class="card-dek">${escapeHtml(p.blurb)}</div>
</a>`,
  ).join("");
  // Touch PRIMARY_NAV to silence any future "unused import" lint.
  void PRIMARY_NAV;
  const body = `
<section style="margin-bottom:18px">
  <div class="kicker" style="margin-bottom:18px">
    <span class="live"></span> Forensic intelligence · sourced, structured, permanent
  </div>
  <h1 style="font-family:var(--serif);font-size:48px;line-height:1.1;letter-spacing:-0.02em;margin:0 0 18px;color:var(--ink)">Canopticon keeps files on power.</h1>
  <p style="font-family:var(--serif);font-size:19px;line-height:1.55;color:var(--ink-2);max-width:680px">
    A forensic intelligence system — mapping the architecture of systems and
    institutions through sourced claims, signed analysis, and a growing graph of
    verified connections. The facts are the foundation. The patterns are the point.
  </p>
</section>

<section style="margin-bottom:40px">
  <div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:16px">
    <div class="label">Four ways in</div>
  </div>
  <div class="cards-3">${cards}</div>
</section>
`;
  return renderPage({
    title: "",
    description:
      "Forensic intelligence. Sourced, structured, permanent. Mapping the architecture of systems and institutions through sourced claims and signed analysis.",
    body,
    activeNav: "/",
    zone: "home",
  });
}

async function renderActivityFeed(env: { DB: D1Database }, isOperator: boolean): Promise<string> {
  const { all, one } = await import("../../lib/d1");
  const { resolveOperatorId } = await import("../data");
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return "";

  // Operator overlays — only loaded when the viewer is the operator. These
  // weave into the same activity feed everyone reads. No separate dashboard.
  const opOverlays = isOperator ? await loadOperatorOverlays(env.DB, userId) : null;

  // Recently active subjects with intent so the home can wear intent badges.
  // Signed-published readings rise to the top; the lead spot goes to the
  // most-recently-signed piece — this is the editor's call. Without it the
  // home is just a recency dump.
  const subjects = await all<{
    slug: string;
    label: string;
    kind: string;
    signed_status: string;
    thesis: string | null;
    intent: string | null;
    signed_at: string | null;
    sources: number;
  }>(
    env.DB,
    `SELECT p.slug, n.label, n.kind, p.signed_status, p.thesis, p.intent, p.signed_at,
            (SELECT COUNT(DISTINCT piece_id) FROM nodes
              WHERE user_id = ? AND lower(label) = lower(n.label) AND piece_id IS NOT NULL) AS sources
       FROM pages p JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ?
      ORDER BY (p.signed_status = 'published') DESC,
               COALESCE(p.signed_at, p.updated_at) DESC
      LIMIT 14`,
    [userId, userId],
  ).catch(() => []);
  if (subjects.length === 0) return "";

  const counts = await one<{
    subjects: number;
    themes: number;
    docs: number;
    signed: number;
    contested: number;
    killed: number;
  }>(
    env.DB,
    `SELECT
       (SELECT COUNT(*) FROM pages WHERE user_id = ?) AS subjects,
       (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND kind = 'theme') AS themes,
       (SELECT COUNT(*) FROM pieces WHERE user_id = ?) AS docs,
       (SELECT COUNT(*) FROM pages WHERE user_id = ? AND signed_status = 'published') AS signed,
       (SELECT COUNT(*) FROM assertions a JOIN nodes n ON n.id = a.node_id
          WHERE n.user_id = ? AND a.rank = 'contested') AS contested,
       (SELECT COALESCE(SUM(claims_killed), 0) FROM pages WHERE user_id = ?) AS killed`,
    [userId, userId, userId, userId, userId, userId],
  ).catch(() => null);

  const INTENT_LABEL: Record<string, string> = {
    investigation: "Investigation",
    argument: "Argument",
    pattern: "Pattern",
    hypothesis: "Hypothesis",
    assessment: "Assessment",
    critique: "Critique",
    explanation: "Explanation",
  };

  // Editorial hierarchy: pick a lead, two secondaries, then a tail grid.
  // Lead is the most recently signed piece; if nothing is signed yet, the
  // most recently active subject leads.
  const lead = subjects[0];
  const secondaries = subjects.slice(1, 3);
  const tail = subjects.slice(3);

  const buildHref = (s: NonNullable<typeof lead>): string =>
    `/s/${escapeHtml(s.slug)}${s.signed_status === "published" ? "?mode=signed" : ""}`;

  const intentChip = (intent: string | null): string =>
    intent
      ? `<span class="intent-badge intent-${escapeHtml(intent)}">${escapeHtml(INTENT_LABEL[intent] ?? intent)}</span>`
      : "";

  const kindLine = (s: NonNullable<typeof lead>): string => {
    const kindLabel = s.kind === "theme" ? "Theme" : s.kind === "event" ? "Event" : "Subject";
    const signed = s.signed_status === "published";
    return `${kindLabel}${signed ? " · signed analysis" : ""}`;
  };

  // The LEAD — a full-width editorial card. Bigger type, thesis prominent,
  // intent badge first. When unsigned, the lede comes from the source count.
  const leadCard = lead
    ? `<a class="lead-card" href="${buildHref(lead)}">
  <div class="lead-kicker">
    ${intentChip(lead.intent)}
    <span class="lead-meta">${escapeHtml(kindLine(lead))}</span>
  </div>
  <h2 class="lead-title">${escapeHtml(lead.label)}</h2>
  ${
    lead.thesis
      ? `<p class="lead-thesis">${escapeHtml(lead.thesis.slice(0, 200))}</p>`
      : `<p class="lead-thesis lead-thesis-quiet">Reading the corpus on this subject — ${lead.sources} source${lead.sources === 1 ? "" : "s"} so far.</p>`
  }
</a>`
    : "";

  // SECONDARIES — two medium cards side by side. Less type, less weight.
  const secondaryCards = secondaries
    .map(
      (s) => `<a class="secondary-card" href="${buildHref(s)}">
  <div class="secondary-kicker">${intentChip(s.intent)}<span class="secondary-meta">${escapeHtml(kindLine(s))}</span></div>
  <h3 class="secondary-title">${escapeHtml(s.label)}</h3>
  ${
    s.thesis
      ? `<p class="secondary-thesis">${escapeHtml(s.thesis.slice(0, 130))}</p>`
      : `<p class="secondary-thesis secondary-thesis-quiet">${s.sources} source${s.sources === 1 ? "" : "s"}</p>`
  }
</a>`,
    )
    .join("");

  // TAIL — the existing 3-column grid for everything else. Smaller cards,
  // less prose, more index-y.
  const tailCards = tail
    .map((s) => {
      const signed = s.signed_status === "published";
      const dek =
        signed && s.thesis
          ? escapeHtml(s.thesis.slice(0, 110))
          : `${s.sources} source${s.sources === 1 ? "" : "s"}`;
      return `<a class="cardlink" href="${buildHref(s)}">
  <div class="card-type">${intentChip(s.intent)}<span style="margin-left:6px">${escapeHtml(kindLine(s))}</span></div>
  <div class="card-title">${escapeHtml(s.label)}</div>
  <div class="card-dek">${dek}</div>
</a>`;
    })
    .join("");

  // Home JSON-LD: WebSite + Organization. (No SearchAction yet — /search is a
  // placeholder. Adding it back when search actually ships avoids pointing AI
  // engines at a dead endpoint.) Per-page schema (Article, ItemList, Event,
  // CreativeWork) lives on subject / brief renderers; this gives AI engines
  // the canopticon-the-publication graph node so citations have a publisher
  // to attribute.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://canopticon.com/#site",
        url: "https://canopticon.com/",
        name: "CANOPTICON",
        description:
          "A forensic intelligence publication system. Sourced claims, signed analysis, a typed graph of verified facts. Every assertion ties back to a verbatim quote from a stored source document.",
        publisher: { "@id": "https://canopticon.com/#org" },
      },
      {
        "@type": "Organization",
        "@id": "https://canopticon.com/#org",
        name: "CANOPTICON",
        url: "https://canopticon.com/",
        sameAs: ["https://twitter.com/canoptics"],
      },
    ],
  }).replace(/<\/script/gi, "<\\/script");

  // Stats line under the masthead. Two key numbers, sized and worded so a
  // reader skims them as the proof of weight: "this is a real record" vs
  // "this is a side project".
  // Depth-of-record numbers. Plain words, self-explanatory to a first-time
  // reader — the stamp-line rule applies here too. No raw jargon nouns.
  const stats = counts
    ? `<div class="home-stats">
  <span><b>${counts.subjects}</b> subjects on file</span>
  <span><b>${counts.docs}</b> source documents stored</span>
  ${counts.signed > 0 ? `<span><b>${counts.signed}</b> signed analyses</span>` : ""}
  ${counts.contested > 0 ? `<span><b>${counts.contested}</b> disputed claims</span>` : ""}
  ${counts.killed > 0 ? `<span><b>${counts.killed}</b> claims removed — failed verification</span>` : ""}
</div>`
    : "";

  // ---- OPERATOR OVERLAYS — woven into the same page everyone reads -------
  // These render ONLY when the operator is logged in. Their position is
  // editorial: the drafts-to-sign block sits above the lead (it's the most
  // important act the operator can take); the briefing is a small line up
  // top; findings + threads appear as tail sections so they're easy to
  // reach but don't dominate the reading view.

  const INTENT_BADGE = (intent: string | null | undefined): string =>
    intent
      ? `<span class="intent-badge intent-${escapeHtml(intent)}">${escapeHtml(INTENT_LABEL[intent] ?? intent)}</span>`
      : "";

  const opBriefing = opOverlays
    ? (() => {
        const bits: string[] = [];
        if (opOverlays.pulse.newPages > 0) {
          bits.push(
            `<b>${opOverlays.pulse.newPages}</b> new page${opOverlays.pulse.newPages === 1 ? "" : "s"}`,
          );
        }
        if (opOverlays.pulse.newFacts > 0) {
          bits.push(
            `<b>${opOverlays.pulse.newFacts}</b> new fact${opOverlays.pulse.newFacts === 1 ? "" : "s"}`,
          );
        }
        if (opOverlays.drafts.length > 0) {
          bits.push(
            `<b>${opOverlays.drafts.length}</b> reading${opOverlays.drafts.length === 1 ? "" : "s"} drafted and waiting for your signature`,
          );
        }
        if (opOverlays.findings.length > 0) {
          bits.push(
            `<b>${opOverlays.findings.length}</b> finding${opOverlays.findings.length === 1 ? "" : "s"} worth your eye`,
          );
        }
        if (opOverlays.threads.length > 0) {
          bits.push(
            `<b>${opOverlays.threads.length}</b> open thread${opOverlays.threads.length === 1 ? "" : "s"}`,
          );
        }
        if (bits.length === 0) {
          return `<aside class="op-briefing"><div class="op-briefing-kicker">From the system, this morning</div><p>Quiet. Nothing new since yesterday.</p></aside>`;
        }
        return `<aside class="op-briefing"><div class="op-briefing-kicker">From the system, this morning</div><p>${bits.join(" · ")}.</p></aside>`;
      })()
    : "";

  const opDrafts =
    opOverlays && opOverlays.drafts.length > 0
      ? `<section class="op-drafts">
  <div class="section-label">Awaiting your signature</div>
  ${opOverlays.drafts
    .map(
      (d) => `<a class="op-draft" href="/s/${escapeHtml(d.slug)}?mode=signed">
  <div class="op-draft-kicker">${INTENT_BADGE(d.intent)}${d.confidence ? `<span class="op-draft-meta">${escapeHtml(d.confidence)} confidence</span>` : ""}<span class="op-draft-meta">${d.claims_verified} verified claim${d.claims_verified === 1 ? "" : "s"}</span></div>
  <div class="op-draft-title">${escapeHtml(d.label)}</div>
  ${d.thesis ? `<p class="op-draft-thesis">${escapeHtml(d.thesis.slice(0, 180))}</p>` : ""}
  <div class="op-draft-cta">Read &amp; sign →</div>
</a>`,
    )
    .join("")}
</section>`
      : "";

  const opFindings =
    opOverlays && opOverlays.findings.length > 0
      ? `<section class="op-findings">
  <div class="section-label">Worth your eye</div>
  <div class="op-findings-grid">
    ${opOverlays.findings
      .map(
        (f) => `<div class="op-finding">
  <div class="op-finding-kicker">${escapeHtml(f.kind)} · ${escapeHtml(f.confidence)} confidence</div>
  <div class="op-finding-title">${escapeHtml(f.title)}</div>
  <p class="op-finding-body">${escapeHtml(f.statement_md.slice(0, 240))}</p>
</div>`,
      )
      .join("")}
  </div>
</section>`
      : "";

  const opThreads =
    opOverlays && opOverlays.threads.length > 0
      ? `<section class="op-threads">
  <div class="section-label">Still chasing — open questions the record raised</div>
  <div class="op-threads-list">
    ${opOverlays.threads
      .map(
        (t) => `<div class="op-thread">
  <span class="op-thread-status${t.status === "being_pursued" ? " pursuing" : ""}">${t.status === "being_pursued" ? "Pursuing" : "Open"}</span>
  <span class="op-thread-q">${escapeHtml(t.question)}</span>
</div>`,
      )
      .join("")}
  </div>
</section>`
      : "";

  const body = `
<script type="application/ld+json">${jsonLd}</script>
<section class="home-masthead">
  <div class="kicker"><span class="live"></span> A forensic record of power — facts on file, analysis signed</div>
  <h1 class="home-hero">Canopticon keeps files on power.</h1>
  ${stats}
</section>

${opBriefing}
${opDrafts}

${
  leadCard
    ? `<section class="home-lead">
  <div class="section-label">The lead</div>
  ${leadCard}
</section>`
    : ""
}

${
  secondaryCards
    ? `<section class="home-secondaries">
  <div class="section-label">Also developing</div>
  <div class="secondary-grid">${secondaryCards}</div>
</section>`
    : ""
}

${
  tailCards
    ? `<section class="home-tail">
  <div class="section-label">Across the fabric</div>
  <div class="cards-3">${tailCards}</div>
</section>`
    : ""
}

${opFindings}
${opThreads}

<style>
  .home-masthead { margin-bottom: 40px; }
  .home-masthead .kicker { margin-bottom: 18px; }
  .home-hero {
    font-family: var(--serif);
    font-size: 48px; line-height: 1.08;
    letter-spacing: -0.025em;
    margin: 0 0 22px;
    color: var(--ink);
    max-width: 880px;
  }
  .home-stats {
    display: flex; flex-wrap: wrap; gap: 14px 28px;
    font-family: var(--serif);
    font-size: 16px;
    color: var(--ink-3);
  }
  .home-stats span b {
    color: var(--ink);
    font-size: 20px;
    font-weight: 600;
    margin-right: 4px;
  }
  .section-label {
    font-size: 12px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--ink-3);
    font-weight: 600;
    margin-bottom: 14px;
  }
  .home-lead { margin-bottom: 36px; }
  .lead-card {
    display: block;
    text-decoration: none;
    padding: 30px 32px;
    border: 1px solid var(--rule);
    border-radius: 14px;
    background: var(--surface, #fff);
    transition: border-color .12s;
  }
  .lead-card:hover { border-color: var(--accent-bd); }
  .lead-kicker {
    display: flex; align-items: center; gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .lead-meta {
    font-size: 12.5px;
    color: var(--ink-3);
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .lead-title {
    font-family: var(--serif);
    font-size: 36px;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--ink);
    margin: 0 0 14px;
  }
  .lead-thesis {
    font-family: var(--serif);
    font-size: 19px;
    line-height: 1.55;
    color: var(--ink-2);
    font-style: italic;
    max-width: 760px;
    margin: 0;
  }
  .lead-thesis-quiet { font-style: normal; color: var(--ink-3); }
  .home-secondaries { margin-bottom: 40px; }
  .secondary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .secondary-card {
    display: block;
    text-decoration: none;
    padding: 22px 24px;
    border: 1px solid var(--rule);
    border-radius: 11px;
    background: var(--surface, #fff);
    transition: border-color .12s;
  }
  .secondary-card:hover { border-color: var(--accent-bd); }
  .secondary-kicker {
    display: flex; align-items: center; gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .secondary-meta {
    font-size: 11.5px;
    color: var(--ink-3);
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .secondary-title {
    font-family: var(--serif);
    font-size: 22px;
    line-height: 1.22;
    color: var(--ink);
    margin: 0 0 10px;
  }
  .secondary-thesis {
    font-family: var(--serif);
    font-size: 14.5px;
    line-height: 1.55;
    color: var(--ink-2);
    margin: 0;
  }
  .secondary-thesis-quiet { color: var(--ink-3); }
  .home-tail { margin-bottom: 40px; }
  .intent-badge {
    display: inline-block;
    font-size: 10px;
    padding: 2px 9px;
    border-radius: 4px;
    font-weight: 600;
    letter-spacing: .04em;
  }
  .intent-investigation { background: rgba(77,156,111,.16); color: #4d9c6f; }
  .intent-argument { background: rgba(201,106,83,.16); color: #c96a53; }
  .intent-pattern { background: rgba(126,166,216,.16); color: #7ea6d8; }
  .intent-hypothesis { background: rgba(183,158,224,.16); color: #b79ee0; }
  .intent-assessment { background: rgba(209,171,92,.16); color: #d1ab5c; }
  .intent-critique { background: rgba(196,123,152,.16); color: #c47b98; }
  .intent-explanation { background: rgba(126,200,227,.16); color: #7ec8e3; }

  /* Operator overlays — visible only when the session cookie is set.
     Woven into the same page everyone reads; no parallel dashboard. */
  .op-briefing {
    margin: 0 0 28px;
    padding: 18px 22px;
    border-left: 3px solid var(--accent);
    background: var(--accent-bg, rgba(58, 99, 160, 0.06));
    border-radius: 4px;
  }
  .op-briefing-kicker {
    font-size: 11px; letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--ink-3); font-weight: 600;
    margin-bottom: 6px;
  }
  .op-briefing p {
    margin: 0;
    font-family: var(--serif);
    font-size: 16.5px; line-height: 1.55;
    color: var(--ink-2);
  }
  .op-briefing p b { color: var(--ink); font-weight: 600; }

  .op-drafts { margin-bottom: 36px; }
  .op-draft {
    display: block;
    text-decoration: none;
    padding: 22px 24px;
    margin-bottom: 12px;
    border: 1px solid var(--rule);
    border-left: 3px solid var(--accent);
    border-radius: 10px;
    background: var(--paper-2, var(--surface));
    transition: border-color .12s;
  }
  .op-draft:hover { border-color: var(--accent); }
  .op-draft-kicker {
    display: flex; gap: 10px; flex-wrap: wrap;
    align-items: center;
    margin-bottom: 10px;
  }
  .op-draft-meta {
    font-size: 11.5px;
    color: var(--ink-3);
    letter-spacing: .03em;
    text-transform: uppercase;
  }
  .op-draft-title {
    font-family: var(--serif);
    font-size: 22px;
    line-height: 1.2;
    color: var(--ink);
    margin-bottom: 8px;
  }
  .op-draft-thesis {
    font-family: var(--serif);
    font-size: 15.5px;
    line-height: 1.55;
    font-style: italic;
    color: var(--ink-2);
    margin: 0 0 10px;
  }
  .op-draft-cta {
    font-size: 13px;
    color: var(--accent);
    font-weight: 600;
  }

  .op-findings { margin-top: 12px; margin-bottom: 36px; padding-top: 28px; border-top: 1px solid var(--rule); }
  .op-findings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .op-finding {
    padding: 16px 18px;
    border: 1px solid var(--rule);
    border-radius: 9px;
    background: var(--surface, #fff);
  }
  .op-finding-kicker {
    font-size: 10.5px; letter-spacing: .11em;
    text-transform: uppercase;
    color: var(--ink-3); font-weight: 600;
    margin-bottom: 6px;
  }
  .op-finding-title {
    font-family: var(--serif);
    font-size: 16px; line-height: 1.3;
    color: var(--ink);
    margin-bottom: 6px;
  }
  .op-finding-body {
    margin: 0;
    font-size: 13.5px; line-height: 1.55;
    color: var(--ink-2);
  }

  .op-threads { margin-bottom: 36px; }
  .op-threads-list { display: flex; flex-direction: column; }
  .op-thread {
    display: flex; gap: 14px; align-items: baseline;
    padding: 10px 0;
    border-top: 1px solid var(--rule);
  }
  .op-thread:first-child { border-top: none; }
  .op-thread-status {
    flex-shrink: 0;
    font-size: 10.5px; letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--ink-3); font-weight: 600;
    min-width: 80px;
  }
  .op-thread-status.pursuing { color: var(--accent); }
  .op-thread-q {
    font-family: var(--serif);
    font-size: 15px; line-height: 1.5;
    color: var(--ink-2);
  }

  @media (max-width: 720px) {
    .home-hero { font-size: 36px; }
    .lead-title { font-size: 28px; }
    .lead-thesis { font-size: 17px; }
    .secondary-grid { grid-template-columns: 1fr; }
    .op-findings-grid { grid-template-columns: 1fr; }
  }
</style>
`;

  return renderPage({
    title: "",
    description:
      "Canopticon keeps files on power — documented facts with their receipts, disputes shown as disputes, and signed analysis.",
    body,
    activeNav: "/",
    zone: "home",
  });
}
