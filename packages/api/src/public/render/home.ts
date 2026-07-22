// Home — masthead + five-pillar entry. Phase 1 stub.
// Uses the design system's `cardlink` + `card-type` + `card-title`
// + `card-dek` classes directly so the page is polished from day one.
// Phase 2 swaps the static blurbs for live lead/recent/topic data.

import { PRIMARY_NAV, escapeAttr, escapeHtml, renderPage } from "../layout";

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
    linked_slug: string | null;
    lead_label: string | null;
  }>;
  threads: Array<{
    id: string;
    question: string;
    status: string;
    linked_slug: string | null;
    lead_label: string | null;
  }>;
  pulse: { newPages: number; newFacts: number };
  searchMisses: Array<{ query: string; count: number; lastAsked: string }>;
  today: {
    sweeps: number;
    sourcesBanked: number;
    readingsDrafted: number;
    entitiesMerged: number;
    activeJobs: number;
  };
}

async function loadOperatorOverlays(db: D1Database, userId: string): Promise<OperatorOverlays> {
  const { all, one } = await import("../../lib/d1");
  const [drafts, findings, threads, pulse, searchMisses, today] = await Promise.all([
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
    all<{
      id: string;
      kind: string;
      title: string;
      statement_md: string;
      confidence: string;
      linked_slug: string | null;
      lead_label: string | null;
    }>(
      db,
      `SELECT p.id, p.kind, p.title, p.statement_md, p.confidence,
              pg.slug AS linked_slug, n.label AS lead_label
         FROM patterns p
         LEFT JOIN nodes n ON n.id = p.primary_node_id
         LEFT JOIN pages pg ON pg.subject_node_id = p.primary_node_id
        WHERE p.user_id = ? AND p.status = 'candidate' AND length(p.statement_md) > 80
        ORDER BY (p.confidence = 'high') DESC, p.updated_at DESC LIMIT 4`,
      [userId],
    ).catch(() => []),
    all<{
      id: string;
      question: string;
      status: string;
      linked_slug: string | null;
      lead_label: string | null;
    }>(
      db,
      `SELECT t.id, t.question, t.status, pg.slug AS linked_slug, n.label AS lead_label
         FROM inquiry_threads t
         LEFT JOIN nodes n ON n.id = (SELECT value FROM json_each(t.related_node_ids) LIMIT 1)
         LEFT JOIN pages pg ON pg.subject_node_id = n.id
        WHERE t.user_id = ? AND t.status IN ('open','being_pursued')
        ORDER BY CASE t.status WHEN 'being_pursued' THEN 0 ELSE 1 END, t.created_at DESC LIMIT 6`,
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
    // Search misses — real reader interest the record can't answer yet.
    // Grouped so a question asked five times outranks one asked once.
    all<{ query: string; count: number; lastAsked: string }>(
      db,
      `SELECT json_extract(payload, '$.query') AS query, COUNT(*) AS count, MAX(created_at) AS lastAsked
         FROM orchestrator_events
        WHERE user_id = ? AND event_type = 'search.miss'
          AND created_at > datetime('now','-14 days')
          AND json_extract(payload, '$.query') IS NOT NULL
        GROUP BY lower(trim(json_extract(payload, '$.query')))
        ORDER BY count DESC, lastAsked DESC
        LIMIT 6`,
      [userId],
    ).catch(() => []),
    // "Today" rhythm — what the standing sweep/settle machinery actually
    // did on its own, so the operator isn't left wondering whether
    // anything is happening between visits.
    one<{
      sweeps: number;
      sourcesBanked: number;
      readingsDrafted: number;
      entitiesMerged: number;
      activeJobs: number;
    }>(
      db,
      `SELECT
         (SELECT COUNT(*) FROM orchestrator_events WHERE user_id = ? AND event_type = 'autonomous.sweep.completed' AND created_at > datetime('now','-1 day')) AS sweeps,
         (SELECT COUNT(*) FROM orchestrator_events WHERE user_id = ? AND event_type = 'record.expand.source_banked' AND created_at > datetime('now','-1 day')) AS sourcesBanked,
         (SELECT COALESCE(SUM(CAST(json_extract(payload, '$.drafted') AS INTEGER)), 0) FROM orchestrator_events WHERE user_id = ? AND event_type = 'readings.drafted' AND created_at > datetime('now','-1 day')) AS readingsDrafted,
         (SELECT COUNT(*) FROM entity_merges WHERE user_id = ? AND created_at > datetime('now','-1 day')) AS entitiesMerged,
         (SELECT COUNT(*) FROM digest_jobs WHERE user_id = ? AND status IN ('queued','running')) AS activeJobs`,
      [userId, userId, userId, userId, userId],
    ).catch(() => null),
  ]);
  return {
    drafts,
    findings,
    threads,
    pulse: pulse ?? { newPages: 0, newFacts: 0 },
    searchMisses,
    today: today ?? {
      sweeps: 0,
      sourcesBanked: 0,
      readingsDrafted: 0,
      entitiesMerged: 0,
      activeJobs: 0,
    },
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

interface ActiveFile {
  slug: string;
  label: string;
  kind: string;
  signed_status: string;
  recent_facts: number;
  facts: number;
  disputed: number;
  sources: number;
}

// "Active files — what grew": subjects with real, dated new fact/event
// nodes in the last 7 days — not a fabricated narrative, an actual count
// of aboutness-linked nodes created recently. Two-step: first find WHICH
// subjects grew (one grouped query), then compute full current stats only
// for that bounded handful — the same "cheap filter, then a few bounded
// per-row queries" shape subject-page.ts already uses safely.
async function loadActiveFiles(db: D1Database, userId: string): Promise<ActiveFile[]> {
  const { all, one } = await import("../../lib/d1");
  const candidates = await all<{
    node_id: string;
    slug: string;
    label: string;
    kind: string;
    signed_status: string;
    recent_facts: number;
  }>(
    db,
    `SELECT n.id AS node_id, p.slug, n.label, n.kind, p.signed_status, COUNT(f.id) AS recent_facts
       FROM pages p
       JOIN nodes n ON n.id = p.subject_node_id
       JOIN edges e ON e.dst_node_id = n.id AND e.family = 'aboutness' AND e.user_id = p.user_id
       JOIN nodes f ON f.id = e.src_node_id AND f.user_id = p.user_id
        AND f.kind IN ('neutral_fact','event') AND f.created_at > datetime('now','-7 days')
      WHERE p.user_id = ?
      GROUP BY n.id
      ORDER BY recent_facts DESC
      LIMIT 4`,
    [userId],
  ).catch(() => []);
  if (candidates.length === 0) return [];

  // Per-candidate stats are independent of each other — fire them together
  // rather than one at a time. Serial round-trips here (bounded to 4, but
  // each with three correlated EXISTS subqueries) were the actual cause of
  // the live homepage timing out at Cloudflare's 30s request ceiling.
  const statsList = await Promise.all(
    candidates.map((c) =>
      one<{ facts: number; disputed: number; sources: number }>(
        db,
        `SELECT
           (SELECT COUNT(*) FROM nodes f WHERE f.user_id = ? AND f.kind IN ('neutral_fact','event')
             AND EXISTS (SELECT 1 FROM edges e WHERE e.user_id = ? AND e.family='aboutness'
               AND e.src_node_id = f.id AND e.dst_node_id = ?)) AS facts,
           (SELECT COUNT(*) FROM assertions a JOIN nodes an ON an.id = a.node_id
             WHERE an.user_id = ? AND a.rank = 'contested'
               AND EXISTS (SELECT 1 FROM edges e WHERE e.user_id = ? AND (
                 (e.src_node_id = an.id AND e.dst_node_id = ?) OR (e.dst_node_id = an.id AND e.src_node_id = ?)))) AS disputed,
           (SELECT COUNT(DISTINCT piece_id) FROM nodes np WHERE np.user_id = ? AND np.piece_id IS NOT NULL
             AND (np.id = ? OR EXISTS (SELECT 1 FROM edges e WHERE e.user_id = ? AND (
               (e.src_node_id = np.id AND e.dst_node_id = ?) OR (e.dst_node_id = np.id AND e.src_node_id = ?))))) AS sources`,
        [
          userId,
          userId,
          c.node_id,
          userId,
          userId,
          c.node_id,
          c.node_id,
          userId,
          c.node_id,
          userId,
          c.node_id,
          c.node_id,
        ],
      ).catch(() => null),
    ),
  );
  return candidates.map((c, i) => ({
    slug: c.slug,
    label: c.label,
    kind: c.kind,
    signed_status: c.signed_status,
    recent_facts: c.recent_facts,
    facts: statsList[i]?.facts ?? 0,
    disputed: statsList[i]?.disputed ?? 0,
    sources: statsList[i]?.sources ?? 0,
  }));
}

interface EvidenceRow {
  piece_slug: string;
  title: string;
  created_at: string;
  facts_fed: number;
  subjects_fed: number;
}

// "Latest evidence": recently published source documents and what they
// actually fed into the graph — real counts (nodes carrying that
// piece_id; distinct subjects those nodes connect to), not placeholder
// copy. Same bounded two-step shape as loadActiveFiles.
async function loadLatestEvidence(db: D1Database, userId: string): Promise<EvidenceRow[]> {
  const { all, one } = await import("../../lib/d1");
  const pieces = await all<{ slug: string; title: string; created_at: string; piece_id: string }>(
    db,
    `SELECT slug, title, created_at, id AS piece_id FROM pieces
      WHERE user_id = ? AND publication_status = 'published'
      ORDER BY created_at DESC LIMIT 3`,
    [userId],
  ).catch(() => []);
  const stats = await Promise.all(
    pieces.map((p) =>
      one<{ facts: number; subjects: number }>(
        db,
        `SELECT
           (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND piece_id = ? AND kind IN ('neutral_fact','event','assertion')) AS facts,
           (SELECT COUNT(DISTINCT e.dst_node_id) FROM edges e JOIN nodes f ON f.id = e.src_node_id
             WHERE e.user_id = ? AND e.family = 'aboutness' AND f.piece_id = ?) AS subjects`,
        [userId, p.piece_id, userId, p.piece_id],
      ).catch(() => null),
    ),
  );
  const out: EvidenceRow[] = pieces.map((p, i) => ({
    piece_slug: p.slug,
    title: p.title,
    created_at: p.created_at,
    facts_fed: stats[i]?.facts ?? 0,
    subjects_fed: stats[i]?.subjects ?? 0,
  }));
  return out.filter((e) => e.facts_fed > 0);
}

async function renderActivityFeed(env: { DB: D1Database }, isOperator: boolean): Promise<string> {
  const { all, one } = await import("../../lib/d1");
  const { resolveOperatorId } = await import("../data");
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return "";

  // Operator overlays — only loaded when the viewer is the operator. These
  // weave into the same activity feed everyone reads. No separate dashboard.
  // Independent of the block below — fired together, not awaited first.
  const opOverlaysPromise = isOperator
    ? loadOperatorOverlays(env.DB, userId)
    : Promise.resolve(null);

  // Recently active subjects with intent so the home can wear intent badges.
  // Signed-published readings rise to the top; the lead spot goes to the
  // most-recently-signed piece — this is the editor's call. Without it the
  // home is just a recency dump.
  // Substance gate: autoseed-pages.ts creates a page for every entity/event
  // node the moment it's extracted, including a bare acronym or surname
  // mentioned once in passing — that page is real (it exists so the record
  // can grow into it later) but it has nothing on it yet, and surfacing it
  // on the homepage next to actually-developed subjects reads as broken, not
  // "growing." Require at least a couple of real verbatim quotes — the
  // concrete unit of evidence this schema has — before a subject is eligible
  // to be featured here. Published readings are exempt: they're already
  // vetted by definition, however few quotes ground them.
  // These four are independent of each other and of opOverlays above — run
  // them concurrently rather than as four sequential round-trip groups.
  // Sequential awaits here (plus the serial per-row loops inside
  // loadActiveFiles/loadLatestEvidence) were what pushed the live homepage
  // past Cloudflare's request timeout after this section grew.
  const [opOverlays, subjects, counts, activeFiles, latestEvidence] = await Promise.all([
    opOverlaysPromise,
    all<{
      slug: string;
      label: string;
      kind: string;
      signed_status: string;
      thesis: string | null;
      intent: string | null;
      signed_at: string | null;
      sources: number;
      opened_at: string;
      updated_at: string;
    }>(
      env.DB,
      `SELECT p.slug, n.label, n.kind, p.signed_status, p.thesis, p.intent, p.signed_at,
              (SELECT COUNT(DISTINCT piece_id) FROM nodes
                WHERE user_id = ? AND lower(label) = lower(n.label) AND piece_id IS NOT NULL) AS sources,
              p.created_at AS opened_at, p.updated_at
         FROM pages p JOIN nodes n ON n.id = p.subject_node_id
        WHERE p.user_id = ?
          AND (
            p.signed_status = 'published'
            OR (
              SELECT COUNT(*) FROM quotes q WHERE q.user_id = ?
                AND (q.node_id = n.id OR EXISTS (
                  SELECT 1 FROM edges e WHERE
                    (e.src_node_id = q.node_id AND e.dst_node_id = n.id) OR
                    (e.dst_node_id = q.node_id AND e.src_node_id = n.id)
                ))
            ) >= 2
          )
        ORDER BY (p.signed_status = 'published') DESC,
                 COALESCE(p.signed_at, p.updated_at) DESC
        LIMIT 14`,
      [userId, userId, userId],
    ).catch(() => []),
    one<{
      subjects: number;
      themes: number;
      docs: number;
      signed: number;
      facts: number;
      contested: number;
      killed: number;
    }>(
      env.DB,
      `SELECT
         (SELECT COUNT(*) FROM pages WHERE user_id = ?) AS subjects,
         (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND kind = 'theme') AS themes,
         (SELECT COUNT(*) FROM pieces WHERE user_id = ?) AS docs,
         (SELECT COUNT(*) FROM pages WHERE user_id = ? AND signed_status = 'published') AS signed,
         (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND kind IN ('neutral_fact','event')) AS facts,
         (SELECT COUNT(*) FROM assertions a JOIN nodes n ON n.id = a.node_id
            WHERE n.user_id = ? AND a.rank = 'contested') AS contested,
         (SELECT COALESCE(SUM(claims_killed), 0) FROM pages WHERE user_id = ?) AS killed`,
      [userId, userId, userId, userId, userId, userId, userId],
    ).catch(() => null),
    loadActiveFiles(env.DB, userId),
    loadLatestEvidence(env.DB, userId),
  ]);
  if (subjects.length === 0) return "";

  const INTENT_LABEL: Record<string, string> = {
    investigation: "Investigation",
    argument: "Argument",
    pattern: "Pattern",
    hypothesis: "Hypothesis",
    assessment: "Assessment",
    critique: "Critique",
    explanation: "Explanation",
  };

  // Lead: the most recently signed piece; if nothing is signed yet, the
  // most recently active subject.
  const lead = subjects[0];

  const buildHref = (s: NonNullable<typeof lead>): string =>
    `/s/${escapeHtml(s.slug)}${s.signed_status === "published" ? "?mode=signed" : ""}`;

  const intentChip = (intent: string | null): string =>
    intent
      ? `<span class="intent-badge intent-${escapeHtml(intent)}">${escapeHtml(INTENT_LABEL[intent] ?? intent)}</span>`
      : "";

  const kindChip = (kind: string): string =>
    kind === "theme" ? "THEME" : kind === "event" ? "EVENT" : "SUBJECT";

  // ---- Hero: "the open file" — the single most prominent thing on record ----
  const hero = lead
    ? `<div class="hero">
  <span class="kicker"><span class="live"></span>THE STANDING RECORD — LIVE</span>
  <h1><a href="${buildHref(lead)}">${escapeHtml(lead.label)}</a></h1>
  <p class="thesis">${
    lead.thesis
      ? escapeHtml(lead.thesis.slice(0, 240))
      : `Reading the corpus on this subject — ${lead.sources} source${lead.sources === 1 ? "" : "s"} so far.`
  }</p>
  <div class="coord">${escapeHtml(kindChip(lead.kind))}${lead.signed_status === "published" ? " · SIGNED ANALYSIS ON FILE" : ""}</div>
  <div class="hero-cta">
    <a class="btn primary" href="${buildHref(lead)}">${lead.signed_status === "published" ? "Read the signed analysis" : "Open the file"} <span class="arr">→</span></a>
    <a class="btn" href="/topics">Browse the record <span class="arr">→</span></a>
  </div>
</div>`
    : "";

  // ---- Depth stats — four real counts, no jargon nouns ----
  const depthCells = counts
    ? `<div class="depth">
  <div class="cell"><div class="n">${counts.subjects}</div><div class="k label">Subjects on file</div></div>
  <div class="cell"><div class="n">${counts.docs}</div><div class="k label">Source documents stored</div></div>
  <div class="cell"><div class="n">${counts.facts}</div><div class="k label">Documented facts, each with its quote</div></div>
  <div class="cell killed"><div class="n">${counts.killed}</div><div class="k label">Claims removed — failed verification</div></div>
</div>`
    : "";

  // ---- Active files — what grew (real deltas, last 7 days) ----
  const activeFilesBlock =
    activeFiles.length > 0
      ? `<div class="sec">
  <div class="sec-h"><span class="label">Active files — what grew</span><span class="coord">LAST 7 DAYS</span></div>
  <div class="file-list active">
    ${activeFiles
      .map(
        (
          f,
        ) => `<a class="file-row" href="/s/${escapeAttr(f.slug)}${f.signed_status === "published" ? "?mode=signed" : ""}">
  <div><div class="fname">${escapeHtml(f.label)}<span class="kind">${escapeHtml(kindChip(f.kind))}</span></div>
  <div class="coord fcoord">${f.sources} SOURCE${f.sources === 1 ? "" : "S"} <span class="sep">·</span> ${f.facts} DOCUMENTED FACT${f.facts === 1 ? "" : "S"}${f.disputed > 0 ? ` <span class="sep">·</span> ${f.disputed} DISPUTED` : ""}</div></div>
  <div class="grew"><span class="plus">+${f.recent_facts} fact${f.recent_facts === 1 ? "" : "s"}</span> added in the last 7 days</div>
</a>`,
      )
      .join("")}
  </div>
</div>`
      : "";

  // ---- Latest evidence — recent documents and what they actually fed ----
  const evidenceBlock =
    latestEvidence.length > 0
      ? `<div class="sec">
  <div class="sec-h"><span class="label">Latest evidence</span><span class="coord">MOST RECENT FIRST</span></div>
  ${latestEvidence
    .map(
      (e) => `<a class="ev-row" href="/library/${escapeAttr(e.piece_slug)}">
  <div><div class="et">${escapeHtml(e.title)}</div><div class="eo">ADDED ${escapeHtml(e.created_at.slice(0, 10))}</div></div>
  <div class="efed">fed <span class="n">${e.facts_fed} fact${e.facts_fed === 1 ? "" : "s"}</span> into ${e.subjects_fed} file${e.subjects_fed === 1 ? "" : "s"}</div>
</a>`,
    )
    .join("")}
</div>`
      : "";

  // ---- Browse the record — the full index, plain rows ----
  const browseBlock =
    subjects.length > 0
      ? `<div class="sec">
  <div class="sec-h"><span class="label">Browse the record</span><span class="coord">${subjects.length} SUBJECT${subjects.length === 1 ? "" : "S"} <span class="sep">·</span> <a href="/search" class="plain" style="font-family:var(--mono)">ASK THE RECORD →</a></span></div>
  <div class="file-list">
    ${subjects
      .map(
        (s) => `<a class="file-row" href="${buildHref(s)}">
  <div><div class="fname">${escapeHtml(s.label)}<span class="kind">${escapeHtml(kindChip(s.kind))}</span></div>
  <div class="coord fcoord">OPENED ${escapeHtml(s.opened_at.slice(0, 10))} <span class="sep">·</span> UPDATED ${escapeHtml(s.updated_at.slice(0, 10))}</div></div>
  <div class="grew">${intentChip(s.intent)}${s.thesis ? escapeHtml(s.thesis.slice(0, 90)) : `${s.sources} source${s.sources === 1 ? "" : "s"}`}</div>
</a>`,
      )
      .join("")}
  </div>
</div>`
      : "";

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

  // What the standing machinery (autonomous sweep, settle pipeline) did on
  // its OWN today — separate from opBriefing above, which is about new
  // pages/facts/drafts regardless of source. This is specifically "is the
  // unattended part actually running," the exact question that prompted
  // building it: "i have no idea if it is even still working on stuff."
  const opToday = opOverlays
    ? (() => {
        const t = opOverlays.today;
        const bits: string[] = [];
        if (t.sweeps > 0) bits.push(`${t.sweeps} sweep${t.sweeps === 1 ? "" : "s"} run`);
        if (t.sourcesBanked > 0) {
          bits.push(`${t.sourcesBanked} source${t.sourcesBanked === 1 ? "" : "s"} banked`);
        }
        if (t.readingsDrafted > 0) {
          bits.push(`${t.readingsDrafted} reading${t.readingsDrafted === 1 ? "" : "s"} drafted`);
        }
        if (t.entitiesMerged > 0) {
          bits.push(`${t.entitiesMerged} duplicate${t.entitiesMerged === 1 ? "" : "s"} merged`);
        }
        const activity = bits.length > 0 ? bits.join(" · ") : "no autonomous activity yet today";
        const jobs =
          t.activeJobs > 0
            ? ` · ${t.activeJobs} job${t.activeJobs === 1 ? "" : "s"} running now`
            : "";
        return `<aside class="op-today">
  <div class="op-today-row">
    <div><div class="op-briefing-kicker">Today, unattended</div><p>${activity}${jobs}.</p></div>
    <form method="POST" action="/op/records/bulk-expand">
      <button class="op-bulk-expand-go" type="submit">Expand thinnest 3 now →</button>
    </form>
  </div>
</aside>`;
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
      .map((f) => {
        const body = `<div class="op-finding-kicker">${escapeHtml(f.kind)} · ${escapeHtml(f.confidence)} confidence</div>
  <div class="op-finding-title">${escapeHtml(f.title)}</div>
  <p class="op-finding-body">${escapeHtml(f.statement_md.slice(0, 240))}</p>`;
        if (f.linked_slug) {
          return `<a class="op-finding op-finding-linked" href="/s/${escapeAttr(f.linked_slug)}">
  ${body}
  <div class="op-finding-cta">Open file →</div>
</a>`;
        }
        const researchQuery = f.lead_label ?? f.title;
        return `<div class="op-finding">
  ${body}
  <form class="op-finding-research" method="POST" action="/op/search/research">
    <input type="hidden" name="q" value="${escapeAttr(researchQuery)}">
    <button class="op-finding-research-go" type="submit">Research this →</button>
  </form>
</div>`;
      })
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
      .map((t) => {
        const statusBadge = `<span class="op-thread-status${t.status === "being_pursued" ? " pursuing" : ""}">${t.status === "being_pursued" ? "Pursuing" : "Open"}</span>`;
        if (t.linked_slug) {
          return `<a class="op-thread op-thread-linked" href="/s/${escapeAttr(t.linked_slug)}">
  ${statusBadge}
  <span class="op-thread-q">${escapeHtml(t.question)}</span>
  <span class="op-thread-cta">Open file →</span>
</a>`;
        }
        const researchQuery = t.lead_label ?? t.question;
        return `<div class="op-thread">
  ${statusBadge}
  <span class="op-thread-q">${escapeHtml(t.question)}</span>
  <form class="op-thread-research" method="POST" action="/op/search/research">
    <input type="hidden" name="q" value="${escapeAttr(researchQuery)}">
    <button class="op-thread-research-go" type="submit">Research this →</button>
  </form>
</div>`;
      })
      .join("")}
  </div>
</section>`
      : "";

  // Real reader interest the record can't answer yet — search.miss events
  // (public/render/search.ts) grouped by question. Assignment-desk logic:
  // what people are asking about steers what gets researched next, the
  // same "Research this" action as everywhere else on the page.
  const opSearchMisses =
    opOverlays && opOverlays.searchMisses.length > 0
      ? `<section class="op-threads op-search-misses">
  <div class="section-label">What readers are asking that the record can't answer yet</div>
  <div class="op-threads-list">
    ${opOverlays.searchMisses
      .map(
        (m) => `<div class="op-thread">
  <span class="op-thread-status">${m.count}×</span>
  <span class="op-thread-q">${escapeHtml(m.query)}</span>
  <form class="op-thread-research" method="POST" action="/op/search/research">
    <input type="hidden" name="q" value="${escapeAttr(m.query)}">
    <button class="op-thread-research-go" type="submit">Research this →</button>
  </form>
</div>`,
      )
      .join("")}
  </div>
</section>`
      : "";

  const body = `
<script type="application/ld+json">${jsonLd}</script>
${hero}
${depthCells}

${opBriefing}
${opToday}
${opDrafts}

${activeFilesBlock}
${evidenceBlock}
${browseBlock}

${opFindings}
${opThreads}
${opSearchMisses}

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
    border: 1px solid var(--accent-bd, var(--rule));
    background: var(--accent-bg, rgba(58, 99, 160, 0.06));
    border-radius: 8px;
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

  .op-today {
    margin: -14px 0 28px;
    padding: 10px 22px;
    border: 1px solid var(--rule);
    background: var(--paper-2, var(--surface));
    border-radius: 8px;
  }
  .op-today p { margin: 0; font-family: var(--mono); font-size: 12px; color: var(--ink-3); }
  .op-today-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .op-bulk-expand-go {
    flex-shrink: 0;
    padding: 7px 14px; font-family: var(--mono); font-size: 11.5px;
    background: transparent; color: var(--accent);
    border: 1px solid var(--accent-bd, var(--rule)); border-radius: 5px; cursor: pointer;
  }
  .op-bulk-expand-go:hover { background: var(--accent); color: var(--paper); }

  .op-drafts { margin-bottom: 36px; }
  .op-draft {
    display: block;
    text-decoration: none;
    padding: 22px 24px;
    margin-bottom: 12px;
    border: 1px solid var(--rule);
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
    margin: 0 0 10px;
    font-size: 13.5px; line-height: 1.55;
    color: var(--ink-2);
  }
  a.op-finding-linked {
    display: block; text-decoration: none; color: inherit;
    transition: border-color .15s;
  }
  a.op-finding-linked:hover { border-color: var(--ink-3); }
  .op-finding-cta, .op-thread-cta {
    font-family: var(--mono); font-size: 11px; color: var(--accent);
  }
  .op-finding-research, .op-thread-research { margin-top: 4px; }
  .op-finding-research-go, .op-thread-research-go {
    padding: 6px 12px; font-family: var(--mono); font-size: 11px;
    background: transparent; color: var(--accent);
    border: 1px solid var(--accent-bd, var(--rule)); border-radius: 5px; cursor: pointer;
  }
  .op-finding-research-go:hover, .op-thread-research-go:hover {
    background: var(--accent); color: var(--paper);
  }

  .op-threads { margin-bottom: 36px; }
  .op-threads-list { display: flex; flex-direction: column; }
  .op-thread {
    display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
    padding: 10px 0;
    border-top: 1px solid var(--rule);
  }
  a.op-thread-linked {
    display: flex; gap: 14px; align-items: baseline;
    text-decoration: none; color: inherit;
    padding: 10px 0;
    border-top: 1px solid var(--rule);
  }
  .op-thread:first-child, a.op-thread-linked:first-child { border-top: none; }
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
    flex: 1;
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
