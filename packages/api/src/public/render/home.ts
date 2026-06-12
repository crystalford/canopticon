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
    label: "Topics",
    typeLabel: "The index",
    typeClass: "t-topic",
    blurb:
      "Subjects in the knowledge graph — entities, events, and the received accounts the corpus engages with. Each page grows from extraction; nobody wrote it.",
  },
  {
    href: "/investigations",
    label: "Investigations",
    typeLabel: "Signed analysis",
    typeClass: "t-essay",
    blurb:
      "The signed reading on the substrate. Each piece wears its intent as a badge; every load-bearing assertion ties back to the evidence it rests on.",
  },
  {
    href: "/library",
    label: "Library",
    typeLabel: "The raw research",
    typeClass: "t-research-report",
    blurb:
      "Every source document the rest is built on — kept whole, kept honest. Each shows what it fed into the fabric.",
  },
  {
    href: "/methodology",
    label: "Methodology",
    typeLabel: "How this works",
    typeClass: "t-pattern",
    blurb:
      "The trust model — verbatim verification, independent judging, the firewall between neutral fact and attributed assertion. Why citations from this site are mechanical, not vouched.",
  },
];

// Live fabric feed: recently active subjects + signed readings. The home is
// the doorway INTO the fabric, not a list of nav pillars.
export async function renderHome(env?: { DB: D1Database }): Promise<string> {
  if (env) {
    const feed = await renderActivityFeed(env).catch(() => "");
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
  <h1 style="font-family:var(--serif);font-size:48px;line-height:1.1;letter-spacing:-0.02em;margin:0 0 18px;color:var(--ink)">How things actually work, beneath the official account.</h1>
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

async function renderActivityFeed(env: { DB: D1Database }): Promise<string> {
  const { all, one } = await import("../../lib/d1");
  const { resolveOperatorId } = await import("../data");
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return "";

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
  }>(
    env.DB,
    `SELECT
       (SELECT COUNT(*) FROM pages WHERE user_id = ?) AS subjects,
       (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND kind = 'theme') AS themes,
       (SELECT COUNT(*) FROM pieces WHERE user_id = ?) AS docs,
       (SELECT COUNT(*) FROM pages WHERE user_id = ? AND signed_status = 'published') AS signed,
       (SELECT COUNT(*) FROM assertions a JOIN nodes n ON n.id = a.node_id
          WHERE n.user_id = ? AND a.rank = 'contested') AS contested`,
    [userId, userId, userId, userId, userId],
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
    return `${kindLabel}${signed ? " · the operator's reading" : ""}`;
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
  const stats = counts
    ? `<div class="home-stats">
  <span><b>${counts.docs}</b> source documents</span>
  <span><b>${counts.subjects}</b> subject pages</span>
  ${counts.themes > 0 ? `<span><b>${counts.themes}</b> themes</span>` : ""}
  ${counts.signed > 0 ? `<span><b>${counts.signed}</b> signed readings</span>` : ""}
  ${counts.contested > 0 ? `<span><b>${counts.contested}</b> contested claims</span>` : ""}
</div>`
    : "";

  const body = `
<script type="application/ld+json">${jsonLd}</script>
<section class="home-masthead">
  <div class="kicker"><span class="live"></span> A forensic record of Canadian power — facts first, readings signed</div>
  <h1 class="home-hero">How things actually work, beneath the official account.</h1>
  ${stats}
</section>

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
  .lead-card:hover { border-color: #c9bfa9; }
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
  .secondary-card:hover { border-color: #c9bfa9; }
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
  .intent-investigation { background: #e6efe9; color: #1d6a5e; }
  .intent-argument { background: #f4e9e6; color: #8a3324; }
  .intent-pattern { background: #e8eef7; color: #33567e; }
  .intent-hypothesis { background: #ece6f2; color: #5a4a7e; }
  .intent-assessment { background: #f1ead9; color: #7a6324; }
  .intent-critique { background: #f4e3e0; color: #964434; }
  .intent-explanation { background: #e4ecef; color: #3a6a7e; }
  @media (max-width: 720px) {
    .home-hero { font-size: 36px; }
    .lead-title { font-size: 28px; }
    .lead-thesis { font-size: 17px; }
    .secondary-grid { grid-template-columns: 1fr; }
  }
</style>
`;

  return renderPage({
    title: "",
    description:
      "A forensic record of Canadian power — facts first, readings signed. Recently active subjects and themes across the fabric.",
    body,
    activeNav: "/",
    zone: "home",
  });
}
