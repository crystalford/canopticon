// FIXTURE — the seeded in-memory D1 that look.mts and audit.mts both render
// against.
//
// Extracted so the two tools cannot disagree about what the corpus contains.
// It was inline in look.mts; audit.mts needs the same env, and a second copy
// would have drifted the first time either fixture changed — which is exactly
// how a visual check and an inventory check end up describing different sites.
//
// Not a test fixture. tests/ builds its own stubs; this one exists to make the
// real app render something worth looking at.

import type { D1Database } from "@cloudflare/workers-types";

const ESSAYS = [
  [
    "the-logic-costume",
    "The Logic Costume",
    "Authority performed as logic is still a performance — and a performance leaves a record.",
  ],
  ["the-quiet-part", "The Quiet Part", "What a budget says out loud, and what it only does."],
  [
    "measurement-as-argument",
    "Measurement as Argument",
    "Choosing what to count is the whole of the claim.",
  ],
  [
    "the-costume-comes-off",
    "When the Costume Comes Off",
    "No single slip is decisive. The pattern is.",
  ],
  ["rules-for-thee", "Rules for Thee", "A standard applied in one direction is not a standard."],
];

const RESEARCH = [
  [
    "budget-2026-estimates",
    "Budget 2026: Main Estimates",
    "Tabled departmental spending, with the year-over-year deltas.",
  ],
  ["housing-starts-q3", "Housing Starts, Q3", "CMHC monthly series, seasonally adjusted."],
  [
    "lobbying-registry-extract",
    "Lobbying Registry Extract",
    "Twelve months of filings, by registrant.",
  ],
  ["transfer-payments-2025", "Transfer Payments 2025", "Every transfer over one million dollars."],
  [
    "wealth-estimates-review",
    "Wealth Estimates: A Review",
    "Three methods, three answers, one population.",
  ],
  // A WORKING TITLE, verbatim in shape from the live corpus. The document
  // publishes under its research session's name, and /library must offer a way
  // out of it. Without one of these in the fixture the suggestion box could
  // never appear in a screenshot.
  [
    "pass-7-mini-hardening-dossier",
    "PASS 7-MINI — HARDENING DOSSIER",
    "Sole-source contracts above the threshold.",
  ],
];

const BODY = `A person who claims to run on logic has made a testable claim, and it is tested every time they speak — not once, when the credential was asserted.

## What is the logic costume?

The logic costume is authority borrowed from a method by someone who does not submit to that method's checks. It is worn, not earned.

Actual logic is a discipline with failure conditions. A valid argument can be shown invalid; every fallacy has a name and a form. The costume keeps the vocabulary and discards the exposure.

## Why does performing logic work on an audience?

Performed logic works because audiences reward the signals of rigour faster than they can check the rigour itself.

Checking takes time; the signal is instant. A live audience cannot pause to verify a syllogism, so the performance is judged on affect.

## Sources

1. Copi, I. Introduction to Logic. Pearson, 2016.
2. Postman, N. Amusing Ourselves to Death. Viking, 1985.
`;

// A RESEARCH DOCUMENT IS NOT SHAPED LIKE AN ESSAY, and for a long time this
// fixture pretended it was: every piece, research included, rendered the essay
// body above. So look.mts screenshotted a tidy Q&A page six times and reported
// that the site looked fine, while the actual research pages rendered as walls
// of text with raw pipe characters in them. The operator found that; the tool
// built to find it could not, for the same reason the comment below already
// gives about the provenance banner.
//
// This is what a deep-research run actually hands over: pipe tables,
// hard-wrapped paragraphs, nested lists, a long section with no subheading, a
// blockquote, and a sources list. Every one of those is a construct that was
// silently unsupported. If a change makes documents look worse, it should be
// visible in .look/research.png before anyone else has to see it.
// A research run mid-flight: the opening question, two follow-up searches the
// writer proposed (one already run), and the pages it has read. Every field
// here is one the live system genuinely writes — record-builder emits url,
// title and chars per source; the plan lives in research_runs.followup_queries.
const RESEARCH_LABEL = "What is the genuine white space in ad-serving and attribution?";

const RESEARCH_PLAN = [
  "post-cookie attribution vendors market share 2026",
  "retail media network incrementality measurement gaps",
];

const RESEARCH_RUN = {
  id: "run-1",
  label: RESEARCH_LABEL,
  angle: null,
  status: "pass2_pending",
  pass1_piece_ids: JSON.stringify(["s1", "s2", "s3", "s4", "s5"]),
  pass2_piece_ids: JSON.stringify(["s6"]),
  followup_queries: JSON.stringify(RESEARCH_PLAN),
  followups_done: JSON.stringify([RESEARCH_PLAN[0]]),
  final_piece_id: null,
  error: null,
  created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
};

const RESEARCH_SOURCES: Array<[string, string, string, number]> = [
  [
    RESEARCH_LABEL,
    "https://www.iab.com/guidelines/attribution-2026/",
    "IAB attribution guidance 2026",
    41200,
  ],
  [
    RESEARCH_LABEL,
    "https://digiday.com/marketing/post-cookie-measurement/",
    "The post-cookie measurement scramble",
    18700,
  ],
  [
    RESEARCH_LABEL,
    "https://adexchanger.com/data-driven-thinking/mta-is-dead/",
    "Multi-touch attribution is dead. What replaces it?",
    12400,
  ],
  [
    RESEARCH_LABEL,
    "https://en.wikipedia.org/wiki/Attribution_(marketing)",
    "Attribution (marketing)",
    9800,
  ],
  [
    RESEARCH_LABEL,
    "https://www.thetradedesk.com/us/about-us/industry-initiatives",
    "Industry initiatives — Unified ID",
    7100,
  ],
  [
    RESEARCH_PLAN[0] as string,
    "https://www.emarketer.com/content/retail-media-measurement",
    "Retail media measurement, 2026 outlook",
    15300,
  ],
];

const RESEARCH_EVENTS = [
  {
    event_type: "record.expand.started",
    payload: JSON.stringify({ subject: RESEARCH_LABEL }),
    created_at: RESEARCH_RUN.created_at,
  },
  {
    event_type: "record.expand.search_done",
    payload: JSON.stringify({ subject: RESEARCH_LABEL }),
    created_at: RESEARCH_RUN.created_at,
  },
  ...RESEARCH_SOURCES.map(([subject, url, title, chars], i) => ({
    event_type:
      i === RESEARCH_SOURCES.length - 1
        ? "record.expand.source_fetching"
        : "record.expand.source_banked",
    payload: JSON.stringify({ subject, url, title, chars }),
    created_at: new Date(Date.now() - (60 - i) * 1000).toISOString(),
  })),
  // banked_piece_ids is what getExpandStatus counts extraction against — the
  // facts number is derived from these ids, not from anything in this payload.
  {
    event_type: "record.expand.completed",
    payload: JSON.stringify({
      subject: RESEARCH_LABEL,
      banked_piece_ids: ["s1", "s2", "s3", "s4", "s5"],
    }),
    created_at: new Date().toISOString(),
  },
];

const RESEARCH_BODY = `Departmental spending for the 2026 cycle was tabled on 4 March. This
extract covers the main estimates only; supplementary estimates A and B
are not included and had not been tabled at time of writing.

## Summary — what the estimates show

Three departments account for most of the year-over-year movement. The
remainder are within normal variance and are listed in the appendix for
completeness rather than because anything turns on them.

| Department | 2025 ($M) | 2026 ($M) | Change |
| --- | ---: | ---: | ---: |
| Health | 1,204 | 1,430 | +18.8% |
| Transport | 880 | 812 | −7.7% |
| Housing | 455 | 602 | +32.3% |
| Defence | 2,310 | 2,344 | +1.5% |

The housing figure is the one worth pausing on. It is the largest
proportional increase in the table, and the estimate document attributes
it to a single program transfer rather than to new money:

> The increase reflects the consolidation of the Affordable Housing
> Initiative into the departmental envelope. It does not represent
> incremental appropriation.

That distinction matters for any comparison against prior years, because
the same dollars appeared under a different vote in 2025.

## Method and limits

- Figures are as tabled, not as spent. Actuals diverge from estimates,
  historically by 3–6% at the departmental level.
  - Lapsed funding is the usual cause.
  - Reprofiling accounts for most of the remainder.
- Percentages are computed from the unrounded source values, so they will
  not always reproduce exactly from the rounded columns shown above.
- No adjustment has been made for inflation.

## Documentary gaps remaining

- Supplementary estimates A and B were not tabled at time of writing, so the
  full-year picture cannot be stated.
- The housing transfer's originating vote is not named in the source document.

## Appendix: departments within variance

Every remaining department moved by less than two percent in either
direction. They are listed here so that the absence of a department from
the table above is a statement rather than an omission.

## Sources

1. Main Estimates 2026-27. Treasury Board Secretariat, 4 March 2026.
2. Public Accounts 2025. Receiver General, 2025.
`;

// Findings, so the screenshots show the thing that was built rather than an
// empty block. Two of these are deliberate:
//
//   · The first three quote RESEARCH_BODY word-for-word, including one span
//     that STRADDLES A HARD WRAP, which is the case that made render-time
//     matching necessary in the first place.
//   · The last one quotes a sentence that is NOT in the body. That is not an
//     oversight — body_md can be rewritten after extraction with no
//     re-verification, so a finding whose quote has gone missing is a real
//     state, and the page must show it in the findings list while quietly
//     linking nothing inline. If that path ever starts throwing or linking
//     text that is not there, a screenshot will show it.
const FINDINGS = [
  {
    id: "f1",
    figure: "+18.8%",
    measures: "Health department estimate, year over year",
    period: "2025-2026",
    attributed_to: "Treasury Board Secretariat",
    quote_id: "q-health",
    verbatim_text: "Three departments account for most of the year-over-year movement",
    model: null,
  },
  {
    id: "f2",
    figure: "+32.3%",
    measures: "Housing department estimate, year over year",
    period: "2025-2026",
    attributed_to: "Treasury Board Secretariat",
    // Straddles a newline in RESEARCH_BODY.
    quote_id: "q-housing",
    verbatim_text: "The housing figure is the one worth pausing on",
    model: null,
  },
  {
    id: "f3",
    figure: "3-6%",
    measures: "Divergence of actuals from tabled estimates",
    period: "historical",
    attributed_to: "Public Accounts",
    quote_id: "q-variance",
    verbatim_text: "Percentages are computed from the unrounded source values",
    model: null,
  },
  {
    id: "f4",
    figure: "$1.2B",
    measures: "A figure whose sentence is no longer in the document",
    period: "2024",
    // No attribution, deliberately: this makes f4 serve twice over. It is the
    // quote-has-gone-missing case for the inline splice AND the
    // unsourced-figure lead, so both render without a fifth fixture row.
    attributed_to: null,
    quote_id: "q-missing",
    verbatim_text: "This sentence does not appear anywhere in the body text.",
    model: null,
  },
];

// A contradiction between TWO documents — the lead type that cannot exist
// inside a single document by definition, and therefore the one a
// single-document fixture can never show.
const CONTRADICTIONS = [
  {
    src_label: "Housing rose 32.3% year over year",
    dst_label: "Housing funding was unchanged in 2026",
    edge_type: "contradicts",
    quote_id: "q-housing",
    verbatim_text: "The housing figure is the one worth pausing on",
    piece_id: "budget-2026-estimates",
    piece_slug: "budget-2026-estimates",
    piece_title: "Budget 2026: Main Estimates",
    other_slug: "transfer-payments-2025",
    other_title: "Transfer Payments 2025",
    created_at: "2026-09-12T00:00:00.000Z",
  },
];

// A SETTLED LEAD. The answer the narrow answerer produces for the
// contradiction above, as it is stored: three sentences and quotes that have
// already passed locateVerbatim against the two documents. One proposed quote
// was discarded, because a screenshot that never shows the discard count would
// hide the single most useful signal on the block — that the model reached.
//
// lead_key must match answer-lead.ts's leadKey("contradiction", src_label);
// it is computed at fixture load rather than pasted, so it cannot drift.
const LEAD_ANSWER_SEED = CONTRADICTIONS[0]?.src_label ?? "";
const { leadKey } = await import("../src/graph/lib/answer-lead.ts");
const LEAD_ANSWER_KEY = await leadKey("contradiction", LEAD_ANSWER_SEED);

const LEAD_ANSWER = {
  status: "answered",
  answer_md:
    "They are measuring different things, and both are accurate. The 32.3% is " +
    "the departmental envelope, which grew because an existing program was " +
    "consolidated into it; the transfer series counts money moved, which did " +
    "not change. Nothing here establishes any new housing spending.",
  quotes: JSON.stringify([
    {
      text: "The housing figure is the one worth pausing on",
      piece_id: "budget-2026-estimates",
      slug: "budget-2026-estimates",
      title: "Budget 2026: Main Estimates",
    },
    {
      text: "Every transfer over one million dollars.",
      piece_id: "transfer-payments-2025",
      slug: "transfer-payments-2025",
      title: "Transfer Payments 2025",
    },
  ]),
  discarded: 1,
  error: null,
};

// Per-piece extraction counts. Keyed by slug because the fixture uses the slug
// as the piece id.
//
// budget-2026-estimates reports a body far larger than the fixture's actual
// text. That is on purpose and it is the only way to render the TRUNCATED
// branch of the receipt without carrying a 70KB string in this file — and the
// truncated branch is the one that matters most, because it is the one that
// admits the system did not read the whole document.
// Topics, so the grouped index and homepage render. One document is left
// UNTOPICED on purpose: "Everything else" is a real state the page has to
// handle, and a fixture where everything is filed would never show it.
const TOPIC_BY_SLUG = new Map<string, string>([
  ["budget-2026-estimates", "Money & markets"],
  ["transfer-payments-2025", "Money & markets"],
  ["housing-starts-q3", "Housing & cities"],
  ["lobbying-registry-extract", "Politics & government"],
  ["wealth-estimates-review", "Money & markets"],
  // pass-7-mini-hardening-dossier deliberately absent.
]);

const EXTRACTION = new Map<string, { quotes: number; nodes: number; body_chars: number }>([
  ["budget-2026-estimates", { quotes: 47, nodes: 112, body_chars: 145300 }],
  ["housing-starts-q3", { quotes: 12, nodes: 31, body_chars: 8400 }],
  ["transfer-payments-2025", { quotes: 9, nodes: 22, body_chars: 15200 }],
]);

const row = (slug: string, title: string, subtitle: string, kind: string, i: number) => ({
  id: slug,
  slug,
  title,
  subtitle,
  kind,
  subtype: null,
  publication_status: "published",
  byline: null,
  published_at: `2026-0${(i % 9) + 1}-1${i % 9}T00:00:00.000Z`,
  signed_by: null,
  body_md: kind === "essay" ? BODY : RESEARCH_BODY,
  body_html: null,
  chain_id: null,
  // The first research fixture carries `auto-research`, which is what gates
  // the provenance banner (piece-template.ts's isAutoGenerated). Without one
  // fixture setting it, the screenshot could never show that block — and that
  // is exactly how a layout bug in it survived two rounds of "fixed": it
  // passed typecheck, lint and 323 tests every time, because nothing rendered
  // it. A visual check that cannot see a component does not check it.
  tags: i === 3 ? '["auto-research"]' : "[]",
  metadata: "{}",
  argument_summary_md: null,
  created_at: `2026-0${(i % 9) + 1}-1${i % 9}T00:00:00.000Z`,
  updated_at: "2026-09-10T00:00:00.000Z",
  body_chars: EXTRACTION.get(slug)?.body_chars ?? (kind === "essay" ? BODY : RESEARCH_BODY).length,
  topic: TOPIC_BY_SLUG.get(slug) ?? null,
});

const ALL = [
  ...ESSAYS.map(([s, t, d], i) => row(s as string, t as string, d as string, "essay", i)),
  ...RESEARCH.map(([s, t, d], i) =>
    row(s as string, t as string, d as string, "research-report", i + 3),
  ),
];

function makeDb(): D1Database {
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) {
        bound = a;
        return stmt;
      },
      async first() {
        if (/FROM research_runs/i.test(sql)) return RESEARCH_RUN;
        if (/FROM nodes/i.test(sql) && /neutral_fact/i.test(sql)) return { n: 273 };
        if (/FROM users/i.test(sql)) return { id: "u1" };
        if (/FROM pieces WHERE user_id = \? AND slug = \?/i.test(sql)) {
          return ALL.find((p) => p.slug === bound[1]) ?? null;
        }
        if (/MAX\(/i.test(sql)) return { d: "2026-09-10T00:00:00.000Z" };
        // The counts query asks three different questions with the same
        // COUNT(*) shape, so answer by what each one filters on — otherwise
        // the state strip shows the same number in every cell and looks
        // plausible while being meaningless.
        if (/COUNT\(\*\)/i.test(sql)) {
          if (/kind = 'essay'/i.test(sql)) return { n: ESSAYS.length };
          if (/kind <> 'essay'/i.test(sql)) return { n: RESEARCH.length };
          if (/FROM sources/i.test(sql)) return { n: ALL.length };
          return { n: ALL.length };
        }
        return null;
      },
      async all() {
        if (/FROM pieces/i.test(sql) && /publication_status IN/i.test(sql)) {
          const kinds = bound.slice(1).filter((b): b is string => typeof b === "string");
          if (!kinds.length) return { results: ALL };
          // NOT IN must actually exclude. Matching the bound values as an
          // allow-list regardless of the operator made /research render the
          // essays back — a fixture that quietly contradicts the query it is
          // standing in for is worse than no fixture.
          const negated = /kind NOT IN/i.test(sql);
          return {
            results: ALL.filter((p) =>
              negated ? !kinds.includes(p.kind) : kinds.includes(p.kind),
            ),
          };
        }
        // listLibrary, in its OPERATOR form. With includeUnpublished it drops
        // the publication_status filter entirely, so it matches neither the
        // branch above nor the one below and fell through to an empty list —
        // which rendered /library as "No documents yet" for the operator while
        // the public indexes were full.
        if (/FROM pieces/i.test(sql) && /ORDER BY COALESCE\(published_at/i.test(sql)) {
          return { results: ALL };
        }
        // Bodies for the working-title rows. /library fetches body_md for just
        // the flagged pieces to build rename candidates; without this branch
        // the candidates come back empty and the suggestion silently never
        // renders — which is exactly how it looked the first time.
        if (/FROM pieces/i.test(sql) && /body_md/i.test(sql) && /id IN/i.test(sql)) {
          const ids = bound.slice(1);
          return {
            results: ALL.filter((p) => ids.includes(p.id)).map((p) => ({
              id: p.id,
              body_md: p.body_md,
            })),
          };
        }
        // The receipt's own body_chars lookup: no publication_status filter,
        // so it falls past the branch above.
        if (/FROM pieces/i.test(sql) && /body_chars/i.test(sql)) {
          return { results: ALL.map((p) => ({ id: p.id, body_chars: p.body_chars })) };
        }
        // Three different queries hit aeo_findings and they need different
        // shapes. Distinguish by what each one asks for, not by argument
        // position — a fixture that answers the wrong shape renders a
        // confident, meaningless page.
        if (/FROM aeo_findings/i.test(sql)) {
          // Unsourced-figure leads.
          if (/attributed_to IS NULL/i.test(sql)) {
            return {
              results: FINDINGS.filter((f) => !f.attributed_to).map((f) => ({
                ...f,
                piece_id: "budget-2026-estimates",
                piece_slug: "budget-2026-estimates",
                piece_title: "Budget 2026: Main Estimates",
                created_at: "2026-09-13T00:00:00.000Z",
              })),
            };
          }
          // Grouped counts, per piece.
          if (/GROUP BY piece_id/i.test(sql)) {
            return {
              results: [...EXTRACTION.keys()].map((slug) => ({
                piece_id: slug,
                n: FINDINGS.length,
              })),
            };
          }
          // findingsForPiece: the piece id is the second bound value. Only
          // research carries findings, so the essay page still exercises the
          // no-findings path.
          const pieceId = bound[1];
          const piece = ALL.find((p) => p.id === pieceId);
          return { results: piece && piece.kind !== "essay" ? FINDINGS : [] };
        }
        // Contradiction leads.
        if (/FROM edges/i.test(sql) && /evidential/i.test(sql)) {
          return { results: CONTRADICTIONS };
        }
        if (/FROM lead_answers/i.test(sql)) {
          return {
            results: [{ lead_key: LEAD_ANSWER_KEY, ...LEAD_ANSWER }],
          };
        }
        // Verified-span counts, per piece.
        if (/FROM quotes/i.test(sql) && /GROUP BY sn\.piece_id/i.test(sql)) {
          return {
            results: [...EXTRACTION].map(([slug, e]) => ({ piece_id: slug, n: e.quotes })),
          };
        }
        // A RESEARCH RUN IN FLIGHT, so the workspace can be photographed.
        //
        // Three separate queries back that screen and all three need answers,
        // or the page renders its empty frame and the screenshot proves
        // nothing: the expand event log, the research_runs row (the plan), and
        // the same event log again filtered across every subject in that plan.
        if (/FROM orchestrator_events/i.test(sql)) {
          return { results: RESEARCH_EVENTS };
        }
        if (/FROM research_runs/i.test(sql)) {
          return { results: [RESEARCH_RUN] };
        }
        // The run's extraction jobs. factsAdded is counted off these, not off
        // the event payload, so without them the workspace photographs
        // "Verbatim facts 0" beside five banked sources — which is the exact
        // kind of quietly-wrong screenshot a fixture exists to prevent.
        if (/FROM digest_jobs/i.test(sql)) {
          return {
            results: ["s1", "s2", "s3", "s4", "s5", "s6"].map((id) => ({
              piece_id: id,
              // "completed", not "done" — checkExtraction tests for that exact
              // string, so the wrong one counts as still pending and the
              // screenshot shows zero facts beside five read sources.
              status: "completed",
              step: null,
              last_error: null,
            })),
          };
        }
        // Cross-document links: subjects this piece shares with others.
        // Both labels below appear VERBATIM in RESEARCH_BODY — a label that
        // did not would be located, fail, and silently link nothing, which is
        // correct behaviour but photographs identically to the feature being
        // broken. The point of a fixture is that a state can be seen.
        if (/JOIN mine/i.test(sql) && /spread\.pieces/i.test(sql)) {
          return {
            results: [
              {
                label: "Reprofiling accounts",
                slug: "housing-starts-q3",
                title: "Housing Starts, Q3",
                pieces: 2,
              },
              {
                label: "supplementary estimates",
                slug: "transfer-payments-2025",
                title: "Transfer Payments 2025",
                pieces: 3,
              },
            ],
          };
        }
        // Facts extracted from the research run's banked sources.
        if (/FROM nodes/i.test(sql) && /neutral_fact/i.test(sql)) {
          return { results: [{ n: 273 }] };
        }
        // Typed-graph node counts, per piece.
        if (/FROM nodes/i.test(sql) && /GROUP BY piece_id/i.test(sql)) {
          return {
            results: [...EXTRACTION].map(([slug, e]) => ({ piece_id: slug, n: e.nodes })),
          };
        }
        return { results: [] };
      },
      async run() {
        return { results: [], meta: { changes: 0 } };
      },
    };
    return stmt as unknown as D1PreparedStatement;
  };
  return {
    prepare: (sql: string) => mk(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

// A known secret so look.mts can sign an operator session and actually SEE
// the operator-only surfaces. /library is where uploading happens and where
// the ingestion receipt renders; without this the screenshot tool could only
// ever photograph the signed-out page, which is the same blind spot that let
// the research-document rendering bug reach the operator instead of me.
export const SESSION_SECRET = "look-fixture-secret";

const env = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  ANTHROPIC_API_KEY: "test",
  OPENPARLIAMENT_USER_AGENT: "test",
  LOG_LEVEL: "error",
  SESSION_SECRET,
  DB: makeDb(),
};

/** Slugs the audit needs to hit detail pages without hard-coding them twice. */
export const FIXTURE = {
  essaySlug: ESSAYS[0]?.[0] as string,
  researchSlug: RESEARCH[0]?.[0] as string,
};

export { env, ESSAYS, RESEARCH, ALL };
