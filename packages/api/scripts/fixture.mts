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

// The sectioned brief (migration 0062): every search has run, the outline is
// written, and two of its five sections have landed — one with a killed
// quote, so the red count is in the screenshot. This is the state a Claude
// run spends most of its presses in.
const RESEARCH_OUTLINE = [
  "Where attribution vendors actually compete",
  "What retail media networks measure, and what they cannot",
  "The post-cookie identity layer",
  "Incrementality: the method, and the gap in the tooling",
  "Standards bodies and who follows them",
].map((heading, i) => ({
  heading,
  brief_of_section: `What section ${i + 1} must establish.`,
  source_ids: i % 2 === 0 ? ["s1", "s2", "s3"] : ["s4", "s5", "s6"],
}));

const RESEARCH_SECTIONS_DONE = [
  {
    heading: RESEARCH_OUTLINE[0]?.heading,
    body_md: "Section one, as written.",
    quotes_ok: 3,
    quotes_killed: 0,
  },
  {
    heading: RESEARCH_OUTLINE[1]?.heading,
    body_md: "Section two, as written.",
    quotes_ok: 2,
    quotes_killed: 1,
  },
];

const RESEARCH_RUN = {
  id: "run-1",
  label: RESEARCH_LABEL,
  angle: null,
  status: "section_pending",
  mode: "sectioned",
  outline: JSON.stringify(RESEARCH_OUTLINE),
  sections_done: JSON.stringify(RESEARCH_SECTIONS_DONE),
  pass1_source_ids: JSON.stringify(["s1", "s2", "s3", "s4", "s5"]),
  pass2_source_ids: JSON.stringify(["s6"]),
  followup_queries: JSON.stringify(RESEARCH_PLAN),
  followups_done: JSON.stringify(RESEARCH_PLAN),
  writer: "anthropic",
  final_piece_id: null,
  error: null,
  created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
};

// A FINISHED sectioned run (the review panel): three sections written, one
// of them with a killed quote, assembled into a working-material brief that
// grew from a document already in the fixture. This is the state in which
// the loop closes — document → lead → research → brief → publish — and it
// is the state that could not be photographed until this run existed.
const REVIEW_LABEL =
  "Does reprofiling explain the gap between the estimates and the starts series?";
const REVIEW_SECTIONS_DONE = [
  {
    heading: "What the estimates call reprofiling",
    body_md:
      "The Main Estimates use *reprofiling* for money moved between fiscal years without a change in the authority to spend it. The two documents disagree on how much of the housing line this covers.\n\nOne reads it as a timing artefact; the other as a cut by another name.",
    quotes_ok: 3,
    quotes_killed: 0,
  },
  {
    heading: "How the starts series is counted",
    body_md:
      "The starts series counts a start when the footing is poured, not when a unit is funded, so a reprofiled dollar shows up in it one to three quarters later — if it shows up at all.\n\nA figure the writer proposed for the lag was not found verbatim in any source and was dropped.",
    quotes_ok: 1,
    quotes_killed: 1,
  },
  {
    heading: "Where the two series can be reconciled",
    body_md:
      "Only at the programme level. Neither document publishes a crosswalk, and the one that comes closest stops at the departmental total.",
    quotes_ok: 2,
    quotes_killed: 0,
  },
];
const REVIEW_BRIEF_ID = "brief-reprofiling";
const REVIEW_BRIEF = {
  id: REVIEW_BRIEF_ID,
  slug: "reprofiling-and-the-starts-gap",
  title: "Reprofiling and the gap in the starts series",
  body_md: [
    "Reprofiling explains part of the gap, and the part it explains is the part that arrives late. The two documents measure different moments — the funded dollar and the poured footing — and neither publishes the crosswalk that would let a reader net one against the other.",
    ...REVIEW_SECTIONS_DONE.map((x) => `## ${x.heading}\n\n${x.body_md}`),
    "## What this brief could not establish\n\n- The size of the lag between a reprofiled dollar and a counted start.\n- Whether the estimates' housing line and the starts series use the same programme boundary.",
  ].join("\n\n"),
  publication_status: "working-material",
  kind: "research-report",
  byline: "Canopticon research agent",
  parent_piece_id: "budget-2026-estimates",
  origin: REVIEW_LABEL,
  metadata: JSON.stringify({
    ingested_from: "deep-research",
    label: REVIEW_LABEL,
    mode: "sectioned",
    sections: REVIEW_SECTIONS_DONE.length,
    quotes_ok: 6,
    quotes_killed: 1,
    source_id: "src-brief",
  }),
};
const REVIEW_RUN = {
  ...RESEARCH_RUN,
  id: "run-2",
  label: REVIEW_LABEL,
  status: "done",
  outline: JSON.stringify(
    REVIEW_SECTIONS_DONE.map((x) => ({ heading: x.heading, brief_of_section: "", source_ids: [] })),
  ),
  sections_done: JSON.stringify(REVIEW_SECTIONS_DONE),
  followup_queries: "[]",
  followups_done: "[]",
  final_piece_id: REVIEW_BRIEF_ID,
  created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
};

// TWO MORE FINISHED RUNS, so the review panel's other two states are in the
// catalogue. The warning: more quotes died than survived, the red line the
// panel shows above Publish — a draft the operator must read, not a gate.
// The published state: the brief is already in the record, so the panel
// offers "Read it in the record" instead of Publish.
const REVIEW_WARN_LABEL = "How much of the housing transfer was new money?";
const REVIEW_WARN_SECTIONS_DONE = [
  {
    heading: "What the transfer moved",
    body_md:
      "The transfer consolidated an existing programme into the departmental envelope. The writer proposed four figures for its size; three were not found verbatim in any source.",
    quotes_ok: 1,
    quotes_killed: 3,
  },
  {
    heading: "What the estimates call incremental",
    body_md:
      "The estimates say the increase does not represent incremental appropriation. Nothing else in the sources sets a figure against that sentence.",
    quotes_ok: 0,
    quotes_killed: 1,
  },
];
const REVIEW_WARN_BRIEF_ID = "brief-transfer-new-money";
const REVIEW_WARN_BRIEF = {
  ...REVIEW_BRIEF,
  id: REVIEW_WARN_BRIEF_ID,
  slug: "how-much-of-the-transfer-was-new-money",
  title: "How much of the housing transfer was new money",
  body_md: [
    "Very little, on the record as held — but the record holds less than the writer wanted to say, and most of what it proposed did not survive verification.",
    ...REVIEW_WARN_SECTIONS_DONE.map((x) => `## ${x.heading}\n\n${x.body_md}`),
    "## What this brief could not establish\n\n- The size of the consolidated programme in the prior year.\n- Whether any part of the increase is appropriation the estimates do not label.",
  ].join("\n\n"),
  origin: REVIEW_WARN_LABEL,
  metadata: JSON.stringify({
    ingested_from: "deep-research",
    label: REVIEW_WARN_LABEL,
    mode: "sectioned",
    sections: REVIEW_WARN_SECTIONS_DONE.length,
    quotes_ok: 1,
    quotes_killed: 4,
    source_id: "src-brief-2",
  }),
};
const REVIEW_WARN_RUN = {
  ...REVIEW_RUN,
  id: "run-3",
  label: REVIEW_WARN_LABEL,
  outline: JSON.stringify(
    REVIEW_WARN_SECTIONS_DONE.map((x) => ({
      heading: x.heading,
      brief_of_section: "",
      source_ids: [],
    })),
  ),
  sections_done: JSON.stringify(REVIEW_WARN_SECTIONS_DONE),
  final_piece_id: REVIEW_WARN_BRIEF_ID,
  created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
};

const REVIEW_PUBLISHED_LABEL = "Which vote did the housing transfer come out of?";
const REVIEW_PUBLISHED_BRIEF_ID = "brief-originating-vote";
const REVIEW_PUBLISHED_BRIEF = {
  ...REVIEW_BRIEF,
  id: REVIEW_PUBLISHED_BRIEF_ID,
  slug: "the-originating-vote",
  title: "The originating vote",
  publication_status: "published",
  origin: REVIEW_PUBLISHED_LABEL,
  metadata: JSON.stringify({
    ingested_from: "deep-research",
    label: REVIEW_PUBLISHED_LABEL,
    mode: "sectioned",
    sections: REVIEW_SECTIONS_DONE.length,
    quotes_ok: 6,
    quotes_killed: 1,
    source_id: "src-brief-3",
  }),
};
const REVIEW_PUBLISHED_RUN = {
  ...REVIEW_RUN,
  id: "run-4",
  label: REVIEW_PUBLISHED_LABEL,
  final_piece_id: REVIEW_PUBLISHED_BRIEF_ID,
  created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
};

/** Every finished brief, by id — what `FROM pieces WHERE id = ?` answers with
 *  before falling back to the published corpus. */
const BRIEFS = new Map([
  [REVIEW_BRIEF_ID, REVIEW_BRIEF],
  [REVIEW_WARN_BRIEF_ID, REVIEW_WARN_BRIEF],
  [REVIEW_PUBLISHED_BRIEF_ID, REVIEW_PUBLISHED_BRIEF],
]);

const RESEARCH_RUNS = [RESEARCH_RUN, REVIEW_RUN, REVIEW_WARN_RUN, REVIEW_PUBLISHED_RUN];

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
  // A page the fetcher refused: the crawler writes sources only, and a
  // bot-challenge page is not a source. Shown so the workspace's rejected
  // state is in a screenshot.
  {
    event_type: "record.expand.source_rejected",
    payload: JSON.stringify({
      subject: RESEARCH_LABEL,
      url: "https://example.com/blocked",
      title: "Just a moment...",
      reason: "bot challenge",
    }),
    created_at: new Date(Date.now() - 30 * 1000).toISOString(),
  },
  {
    event_type: "record.expand.completed",
    payload: JSON.stringify({
      subject: RESEARCH_LABEL,
      banked_source_ids: ["s1", "s2", "s3", "s4", "s5"],
      rejected: 1,
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
  // Which model wrote it, so the tag beside the heading photographs.
  model: "claude-opus-5",
  error: null,
};

// ASK THE RECORD — a question the operator has already asked, frozen in a
// lead_answers row under kind "question" (answer-question.ts). /search?q=
// for this exact question renders "From the record" above the passages, for
// every reader. The key is questionKey() computed at load, as the lead answer
// above is, so it cannot drift from what storedAnswerForQuestion binds.
const SEARCH_QUESTION = "Did housing funding rise in 2026?";
const { questionKey } = await import("../src/graph/lib/answer-question.ts");
const SEARCH_ANSWER_KEY = await questionKey(SEARCH_QUESTION);
const SEARCH_ANSWER = {
  lead_key: SEARCH_ANSWER_KEY,
  status: "answered",
  answer_md:
    "The departmental housing line rose 32.3%, but the estimates attribute the " +
    "whole increase to consolidating an existing programme into the envelope. " +
    "No document on file records new appropriation for housing in 2026.",
  quotes: JSON.stringify([
    {
      text: "The housing figure is the one worth pausing on",
      piece_id: "budget-2026-estimates",
      slug: "budget-2026-estimates",
      title: "Budget 2026: Main Estimates",
      quote_id: "q-housing",
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
  model: "claude-opus-5",
  created_at: "2026-09-23T16:20:00.000Z",
};

// What the vector index "returns" for any query: three verified passages,
// each verbatim in its document (so its receipt resolves), and two document
// hits. The fixture has no Vectorize; the stub below answers every query the
// same way so the search page can be photographed with results on it.
const SEARCH_PASSAGES = [
  {
    id: "q-housing",
    verbatim_text: "The housing figure is the one worth pausing on",
    slug: "budget-2026-estimates",
    title: "Budget 2026: Main Estimates",
  },
  {
    id: "q-variance",
    verbatim_text: "Percentages are computed from the unrounded source values",
    slug: "budget-2026-estimates",
    title: "Budget 2026: Main Estimates",
  },
  {
    id: "q-rd-1",
    verbatim_text:
      "Checking takes time; the signal is instant. A live audience cannot pause to verify a syllogism, so the performance is judged on affect.",
    slug: "the-logic-costume",
    title: "The Logic Costume",
  },
];
const SEARCH_DOCUMENT_IDS = ["budget-2026-estimates", "housing-starts-q3"];

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

// THE PIPELINE, one row per document in piece_processing, so every state the
// library's status column can show is in the screenshot: processed, mid-read
// with a chunk count, queued, failed with a reason — and one document with no
// row at all, which is what a corpus looks like before "Process everything"
// has ever been pressed. If a state cannot appear in a screenshot, it is not
// checked.
const PROCESSING = [
  {
    piece_id: "budget-2026-estimates",
    status: "done",
    step: "done",
    chunks_done: 7,
    chunk_count: 7,
    error: null,
    model: "anthropic/claude-sonnet-4-5",
    attempts: 0,
  },
  {
    piece_id: "housing-starts-q3",
    status: "running",
    step: "digest",
    chunks_done: 3,
    chunk_count: 7,
    error: null,
    model: "anthropic/claude-sonnet-4-5",
    attempts: 0,
  },
  {
    piece_id: "transfer-payments-2025",
    status: "queued",
    step: "title",
    chunks_done: 0,
    chunk_count: 0,
    error: null,
    model: null,
    attempts: 0,
  },
  {
    piece_id: "wealth-estimates-review",
    status: "failed",
    step: "findings",
    chunks_done: 2,
    chunk_count: 2,
    error: "model returned no JSON after 3 attempts",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    attempts: 3,
  },
  // lobbying-registry-extract and pass-7-mini-hardening-dossier deliberately
  // absent: "Not processed", and the count on "Process everything".
].map((r) => ({
  ...r,
  user_id: "u1",
  heartbeat_at: r.status === "running" ? new Date().toISOString() : null,
  started_at: "2026-09-24T09:00:00.000Z",
  finished_at: r.status === "done" ? "2026-09-24T09:04:00.000Z" : null,
  updated_at: "2026-09-24T09:04:00.000Z",
}));

// A title the pipeline replaced from the document's own words, with the
// original kept — the row must offer "Put it back".
const AUTO_TITLED = new Map<string, string>([["housing-starts-q3", "housing_q3_final_v2 (1).md"]]);

const EXTRACTION = new Map<string, { quotes: number; nodes: number; body_chars: number }>([
  ["budget-2026-estimates", { quotes: 47, nodes: 112, body_chars: 145300 }],
  ["housing-starts-q3", { quotes: 12, nodes: 31, body_chars: 8400 }],
  ["transfer-payments-2025", { quotes: 9, nodes: 22, body_chars: 15200 }],
]);

const LINEAGE = new Map<string, { parent: string; origin: string }>([
  [
    "wealth-estimates-review",
    {
      parent: "budget-2026-estimates",
      origin: "Housing rose 32.3% year over year — which document is right?",
    },
  ],
]);

// A BRIDGE (docs/the-record.md §5b): one subject label, two documents filed
// under different sections. "Reprofiling accounts" is in Money & markets
// (the estimates) and Housing & cities (the starts series). The newer
// document is piece_id, so a run started from it is parented there.
const BRIDGES = [
  {
    label: "Reprofiling accounts",
    piece_id: "housing-starts-q3",
    piece_slug: "housing-starts-q3",
    piece_title: "Housing Starts, Q3",
    piece_topic: "Housing & cities",
    other_id: "budget-2026-estimates",
    other_slug: "budget-2026-estimates",
    other_title: "Budget 2026: Main Estimates",
    other_topic: "Money & markets",
    created_at: "2026-05-14T00:00:00.000Z",
  },
];

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
  // Migration 0063: when the operator last opened the document. Null is a
  // real state ("never since the column existed") and resurface must handle it.
  last_opened_at: i % 2 === 0 ? "2026-09-20T00:00:00.000Z" : null,
  body_chars: EXTRACTION.get(slug)?.body_chars ?? (kind === "essay" ? BODY : RESEARCH_BODY).length,
  topic: TOPIC_BY_SLUG.get(slug) ?? null,
  original_title: AUTO_TITLED.get(slug) ?? null,
  title_auto_at: AUTO_TITLED.has(slug) ? "2026-09-24T09:00:30.000Z" : null,
  title_approved_at: null,
  // LINEAGE (docs/the-record.md §5). One document grew from another, so the
  // row can photograph "Grew from" and the parent "1 branch".
  parent_piece_id: LINEAGE.get(slug)?.parent ?? null,
  origin: LINEAGE.get(slug)?.origin ?? null,
});

// READINGS (docs/the-record.md §5c): the operator's notes on passages. Two
// states must both photograph. The first two passages are verbatim in their
// documents (one hard-wrapped, in a list item), so they render in the margin
// beside the block; the third is NOT in the current text — the document was
// replaced after the note — so the page must say so rather than pin the note
// to the wrong paragraph.
const READINGS = [
  {
    id: "rd-1",
    piece_id: "the-logic-costume",
    quote_id: "q-rd-1",
    verbatim_text:
      "Checking takes time; the signal is instant. A live audience cannot pause to verify a syllogism, so the performance is judged on affect.",
    note_md:
      "This is the whole mechanism in two sentences. Worth checking whether the **attention** literature has a name for it — the gap between signal and verification.",
    created_at: "2026-09-22T10:00:00.000Z",
  },
  {
    id: "rd-2",
    piece_id: "the-logic-costume",
    quote_id: "q-rd-2",
    verbatim_text:
      "The costume is a claim about method that the method itself would reject on inspection, and the audience never inspects.",
    note_md: "Cut from the second draft, but the note still stands: who *does* inspect, and when?",
    created_at: "2026-09-18T09:00:00.000Z",
  },
  {
    id: "rd-3",
    piece_id: "budget-2026-estimates",
    quote_id: "q-rd-3",
    verbatim_text:
      "Percentages are computed from the unrounded source values, so they will not always reproduce exactly from the rounded columns shown above.",
    note_md: "Ask for the unrounded table. The rounded one cannot be re-derived.",
    created_at: "2026-09-23T14:00:00.000Z",
  },
];

const ALL = [
  ...ESSAYS.map(([s, t, d], i) => row(s as string, t as string, d as string, "essay", i)),
  ...RESEARCH.map(([s, t, d], i) =>
    row(s as string, t as string, d as string, "research-report", i + 3),
  ),
];

// THE WORKSPACE (/admin/write): one draft mid-conversation, with one quote
// that is word for word and one that is not, so both states are on screen.
const WHEY = "instant-dissolving-whey-for-hot-coffee-where-the-science-and-manufactu";
const DRAFT_ROW = {
  id: "draft-1",
  meta: JSON.stringify({
    title: "Why whey curdles in hot coffee",
    dek: "Coffee's acidity sits almost exactly where whey is least stable, and it is served above the temperature that unfolds the protein.",
    topic: "Health & self-care",
    thesis:
      "Whey fails in hot coffee for two unrelated reasons, and the fix sold for one is marketed as if it fixed both.",
    based_on: [WHEY],
  }),
  body_md: `Collagen vanishes into hot black coffee. Whey turns it into pale lumps.

## Coffee is close to the worst liquid for it

Coffee is mildly acidic, and whey proteins are least stable at almost exactly that acidity, where <q doc="${WHEY}" section="Key findings">maximum turbidity and aggregate sizes occurred at the isoelectric point (pI 5.2) of whey proteins</q>. The dominant protein <q doc="${WHEY}" section="Details">unfolds for good above roughly 65 degrees</q>, below the temperature coffee is served at.`,
  usage: JSON.stringify({
    input: 41000,
    output: 5200,
    cacheRead: 180000,
    cacheWrite: 52000,
    cents: 49.2,
  }),
  status: "draft",
  created_at: "2026-10-12T20:00:00Z",
  updated_at: "2026-10-12T20:14:00Z",
};
const DRAFT_MESSAGES = [
  {
    role: "user",
    content: [
      {
        type: "text",
        text: "Write something short from the whey-in-coffee report: why it curdles.",
      },
    ],
  },
  {
    role: "assistant",
    content: [{ type: "tool_use", id: "t1", name: "read_document", input: { id: WHEY } }],
  },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "…" }] },
  {
    role: "assistant",
    content: [
      {
        type: "text",
        text: 'I read the report in full and wrote a first draft. One quotation is not word for word yet — I\'ll fix it. I also need your reason for asking, in your words, for "Why I asked".',
      },
      { type: "tool_use", id: "t2", name: "write_draft", input: {} },
    ],
  },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "t2", content: "Saved." }] },
  {
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: "t3",
        name: "propose_entry",
        input: { kind: "open_problem", title: "Whey that dissolves in hot black coffee" },
      },
    ],
  },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "t3", content: "Proposed." }] },
].map((m) => ({ message: JSON.stringify(m) }));
// A research draft: a question asked, the web searched, two pages read, and
// a report with one quotation found in them and one not.
const RESEARCH_ROW = {
  id: "draft-2",
  kind: "research",
  meta: JSON.stringify({
    title: "Did short-term rental bans lower rents in Canadian cities?",
    topic: "Housing",
  }),
  body_md: `## TL;DR
The bans removed listings, but rents kept rising: the cities' own data show long-term supply grew by a fraction of the units delisted, and the effect on rent is too small to see beside interest rates and immigration [1][2].

## Key Findings
- Toronto's registry shows that "the number of short-term rental listings fell by roughly half within a year of enforcement" [1].
- One study found that "every one percent increase in listings raised rents by about 0.018 percent across the city" [2].

## Details
### 1. What the bans removed
The registry counts listings, not homes returned to the long-term market [1].

## Open questions
Nobody has measured where the delisted units went.

## Sources
1. [Short-term rental registry, annual report](https://example.ca/registry-2025) — City of Toronto, 2025
2. [The effect of home-sharing on house prices and rents](https://example.org/paper) — journal article, 2021
`,
  usage: JSON.stringify({
    input: 220000,
    output: 14000,
    cacheRead: 900000,
    cacheWrite: 180000,
    cents: 199.3,
  }),
  status: "draft",
  slug: null,
  created_at: "2026-10-14T01:00:00Z",
  updated_at: "2026-10-14T01:20:00Z",
};
const RESEARCH_MESSAGES = [
  {
    role: "user",
    content: [
      {
        type: "text",
        text: "Did the short-term rental bans actually lower rents? I'm asking because I want to write about housing supply; we already agree the bans were popular.",
      },
    ],
  },
  {
    role: "assistant",
    content: [
      {
        type: "server_tool_use",
        id: "s1",
        name: "web_search",
        input: { query: "Toronto short-term rental registry annual report listings" },
      },
      {
        type: "server_tool_use",
        id: "f1",
        name: "web_fetch",
        input: { url: "https://example.ca/registry-2025" },
      },
      {
        type: "server_tool_use",
        id: "f2",
        name: "web_fetch",
        input: { url: "https://example.org/paper" },
      },
      {
        type: "text",
        text: "I read the registry report and the main study in full and wrote the report. One quotation is not in the pages I read; I'll fix it.",
      },
    ],
  },
].map((m) => ({ message: JSON.stringify(m) }));
const RESEARCH_PAGES = [
  {
    url: "https://example.ca/registry-2025",
    title: "Registry",
    retrieved_at: "2026-10-14",
    kind: "text",
    text: "Annual report. In 2025 the number of short-term rental listings fell by roughly half within a year of enforcement. Other text.",
  },
  {
    url: "https://example.org/paper",
    title: "Paper",
    retrieved_at: "2026-10-14",
    kind: "text",
    text: "A 1% increase in Airbnb listings leads to a 0.018% increase in rents.",
  },
];

// A read (docs/read-it.md): the whey report, read once, with cards kept,
// proposed and one dropped span on the receipt.
const READ_ROW = {
  id: "draft-3",
  kind: "read",
  meta: JSON.stringify({
    title: "Read: Instant-Dissolving Whey for Hot Coffee",
    based_on: [WHEY],
    readId: "read-1",
  }),
  body_md: "",
  usage: JSON.stringify({
    input: 31000,
    output: 6200,
    cacheRead: 90000,
    cacheWrite: 33000,
    cents: 71.4,
  }),
  status: "draft",
  slug: null,
  created_at: "2026-10-14T02:00:00Z",
  updated_at: "2026-10-14T02:04:00Z",
};
const READ_MESSAGES = [
  {
    role: "user",
    content: [
      {
        type: "text",
        text: `Read "Instant-Dissolving Whey for Hot Coffee" (id: ${WHEY}) in full and lay out what is in it.`,
      },
    ],
  },
  {
    role: "assistant",
    content: [
      { type: "tool_use", id: "r1", name: "read_document", input: { id: WHEY } },
      { type: "tool_use", id: "n1", name: "note", input: { kind: "figure", figure: "65 °C" } },
      { type: "tool_use", id: "n2", name: "note", input: { kind: "finding" } },
      {
        type: "tool_use",
        id: "p1",
        name: "pitch",
        input: { thesis: "The protein coffee aisle is built on cold drinks sold as hot ones" },
      },
      {
        type: "text",
        text: "Read in full. Eleven cards: the two temperatures and the pH the argument rests on, the price rise that makes fermented BLG competitive, and one possible article. One span I proposed was not in the document word for word and was dropped.",
      },
    ],
  },
].map((m) => ({ message: JSON.stringify(m) }));
const READ_DB = {
  id: "read-1",
  doc_id: WHEY,
  draft_id: "draft-3",
  status: "read",
  model: "claude-opus-5-5",
  chars_held: 28010,
  chars_read: 28010,
  verified: 14,
  dropped: 1,
  cents: 71.4,
  started_at: "2026-10-14T02:00:00Z",
  finished_at: "2026-10-14T02:04:00Z",
  shown_at: null,
};
const deriv = (id: string, kind: string, span: string, extra: Record<string, unknown> = {}) => ({
  id,
  read_id: "read-1",
  doc_id: WHEY,
  kind,
  origin: (extra.origin as string) ?? "read",
  role: (extra.role as string) ?? null,
  span,
  section: (extra.section as string) ?? "Details",
  data: JSON.stringify(extra.data ?? {}),
  status: (extra.status as string) ?? "proposed",
  tool_use_id: null,
  created_at: "2026-10-14T02:01:00Z",
});
const DERIVS = [
  deriv(
    "c1",
    "finding",
    "Native whey (WPI, WPC, BLG) will denature above about 65 °C and aggregate fastest near pH 5.2.",
    { origin: "shape", role: "finding", section: "Verdict and Outlook", status: "kept" },
  ),
  deriv(
    "c2",
    "figure",
    "**BLG** unfolds irreversibly above about 65 °C at pH 6.7 (reported onsets are 67–72 °C at pH 6.5).",
    {
      data: {
        figure: "65 °C",
        measures: "the temperature above which BLG unfolds irreversibly",
        period: null,
        attributed_to: null,
        source_rating: null,
        rejected: false,
      },
    },
  ),
  deriv(
    "c3",
    "figure",
    "New Hope Network reports WPC costs up 108% and WPI up roughly 139% over two years",
    {
      section: "3. Precision-fermentation whey: status in September 2026",
      status: "kept",
      data: {
        figure: "139%",
        measures: "rise in the price of whey protein isolate",
        period: "two years to 2026",
        attributed_to: "New Hope Network",
        source_rating: null,
        rejected: false,
      },
    },
  ),
  deriv(
    "c4",
    "finding",
    "This is strong evidence that a major operator judged whey unsuitable for straight black coffee.",
    { role: "reasoning", section: '4. Commercial "protein coffee" products: an honest assessment' },
  ),
  deriv(
    "c5",
    "finding",
    "add unflavored instantized whey isolate after the coffee has cooled a little (roughly below 60 °C)",
    { role: "recommendation", section: "TL;DR" },
  ),
  deriv(
    "c6",
    "prediction",
    'A true "whey that disappears like collagen in hot coffee" is at best a 2027–2029 prospect.',
    {
      section: "TL;DR",
      data: {
        standing: "speculative",
        resolves_when: "a consumer whey powder is sold for hot black coffee",
      },
    },
  ),
  deriv("c7", "pitch", 'Javvy\'s own guidance is to mix "cold, and then heat it up after mixing"', {
    data: {
      thesis: "The protein coffee aisle is built on cold drinks sold as hot ones",
      proof: 3,
      thin: true,
      supports: [
        {
          span: 'Javvy\'s own guidance is to mix "cold, and then heat it up after mixing"',
          role: "finding",
        },
        { span: "Laird's 10-K says its product is designed to be consumed cold.", role: "finding" },
        {
          span: "This is strong evidence that a major operator judged whey unsuitable for straight black coffee.",
          role: "reasoning",
        },
      ],
      counter: "They work reasonably well at 10 g.",
    },
  }),
];

const ENTRY_ROW = {
  id: "entry-1",
  kind: "open_problem",
  slug: null,
  data: JSON.stringify({
    title: "Whey that dissolves in hot black coffee",
    body: "You cannot buy a whey protein that goes into hot black coffee the way collagen does. The heat-stable versions exist, but they are bitter, because they work by cutting the protein up.",
    doc: WHEY,
    section: "Key findings",
    quote:
      "maximum turbidity and aggregate sizes occurred at the isoelectric point (pI 5.2) of whey proteins",
    topic: "Health & self-care",
  }),
  status: "proposed",
  draft_id: "draft-1",
  tool_use_id: "t3",
  created_at: "2026-10-12T20:15:00Z",
  decided_at: null,
};

function makeDb(): D1Database {
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) {
        bound = a;
        return stmt;
      },
      async first() {
        // getResearchStatus binds [userId, label]; the brief download binds
        // [userId, final_piece_id]. Anything else gets the run in flight.
        if (/FROM research_runs/i.test(sql)) {
          return (
            RESEARCH_RUNS.find((r) => r.label === bound[1] || r.final_piece_id === bound[1]) ??
            RESEARCH_RUN
          );
        }
        // The finished brief (loadResearchReview, the .md download) and the
        // parent document it grew from, both by id.
        if (/FROM pieces WHERE id = \?/i.test(sql)) {
          const brief = BRIEFS.get(String(bound[0]));
          if (brief) return brief;
          const piece = ALL.find((p) => p.id === bound[0]) ?? null;
          // The search page's document hit asks for a 220-char excerpt by alias.
          if (piece && /AS excerpt/i.test(sql)) {
            return { ...piece, excerpt: piece.body_md.slice(0, 220) };
          }
          return piece;
        }
        if (/FROM nodes/i.test(sql) && /neutral_fact/i.test(sql)) return { n: 273 };
        if (/FROM users/i.test(sql)) return { id: "u1" };
        if (/FROM drafts WHERE id = \?/i.test(sql))
          return bound[0] === DRAFT_ROW.id
            ? DRAFT_ROW
            : bound[0] === RESEARCH_ROW.id
              ? RESEARCH_ROW
              : bound[0] === READ_ROW.id
                ? READ_ROW
                : null;
        if (/FROM reads WHERE id = \?/i.test(sql)) return bound[0] === READ_DB.id ? READ_DB : null;
        if (/FROM reads WHERE doc_id/i.test(sql)) return bound[0] === WHEY ? READ_DB : null;
        // storedAnswerForQuestion binds [userId, lead_key, kind].
        if (/FROM lead_answers/i.test(sql)) {
          return bound[1] === SEARCH_ANSWER_KEY && bound[2] === "question" ? SEARCH_ANSWER : null;
        }
        if (/FROM pieces WHERE user_id = \? AND slug = \?/i.test(sql)) {
          return ALL.find((p) => p.slug === bound[1]) ?? null;
        }
        if (/MAX\(/i.test(sql)) return { d: "2026-09-10T00:00:00.000Z" };
        // The pipeline's totals (processingCounts): one SUM(CASE…) over
        // piece_processing, then a COUNT of published pieces with no row that
        // counts, which is what "Process everything (N)" shows.
        if (/FROM piece_processing/i.test(sql) && /SUM\(CASE/i.test(sql)) {
          const n = (st: string) => PROCESSING.filter((r) => r.status === st).length;
          return {
            queued: n("queued"),
            running: n("running"),
            failed: n("failed"),
            done: n("done"),
          };
        }
        if (/FROM piece_processing/i.test(sql) && /COUNT\(\*\)/i.test(sql)) {
          return {
            n: PROCESSING.filter((r) => r.status === "queued" || r.status === "running").length,
          };
        }
        if (/NOT EXISTS/i.test(sql) && /piece_processing/i.test(sql) && /COUNT\(\*\)/i.test(sql)) {
          const covered = new Set(
            PROCESSING.filter((r) => r.status !== "failed").map((r) => r.piece_id),
          );
          return { n: ALL.filter((p) => !covered.has(p.id)).length };
        }
        if (/FROM piece_processing/i.test(sql)) {
          return PROCESSING.find((r) => r.piece_id === bound[0] || r.piece_id === bound[1]) ?? null;
        }
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
        if (/FROM drafts WHERE user_id/i.test(sql))
          return { results: [READ_ROW, RESEARCH_ROW, DRAFT_ROW] };
        if (/FROM draft_messages/i.test(sql))
          return {
            results:
              bound[0] === RESEARCH_ROW.id
                ? RESEARCH_MESSAGES
                : bound[0] === READ_ROW.id
                  ? READ_MESSAGES
                  : DRAFT_MESSAGES,
          };
        if (/FROM derivations WHERE read_id/i.test(sql))
          return { results: bound[0] === READ_DB.id ? DERIVS : [] };
        if (/FROM research_sources/i.test(sql))
          return { results: bound[0] === RESEARCH_ROW.id ? RESEARCH_PAGES : [] };
        if (/FROM record_entries WHERE draft_id/i.test(sql)) return { results: [ENTRY_ROW] };
        // processingRows: every pipeline row for the operator.
        if (/FROM piece_processing/i.test(sql)) return { results: PROCESSING };
        // Readings: as leads for the worklist (readingsAsLeads selects the
        // piece's slug and title), or one document's (readingsForPiece binds
        // the piece id second).
        if (/FROM readings r/i.test(sql)) {
          if (/piece_slug/i.test(sql)) {
            return {
              results: READINGS.map((r) => ({
                ...r,
                piece_slug: r.piece_id,
                piece_title: ALL.find((p) => p.id === r.piece_id)?.title ?? null,
              })),
            };
          }
          return { results: READINGS.filter((r) => r.piece_id === bound[1]) };
        }
        // Bridge leads (leads.ts bridgeLeads): label x topic across sections.
        if (/pa\.topic <> pb\.topic/i.test(sql)) return { results: BRIDGES };
        // Consolidation's link pairs (consolidation.ts): every (source,
        // target) sharing a subject, in crosslinks order.
        if (/AS src_id/i.test(sql) && /AS dst_id/i.test(sql)) {
          return {
            results: [
              {
                label: "Reprofiling accounts",
                src_id: "budget-2026-estimates",
                dst_id: "housing-starts-q3",
                slug: "housing-starts-q3",
                title: "Housing Starts, Q3",
                pieces: 2,
              },
              {
                label: "supplementary estimates",
                src_id: "budget-2026-estimates",
                dst_id: "transfer-payments-2025",
                slug: "transfer-payments-2025",
                title: "Transfer Payments 2025",
                pieces: 3,
              },
              {
                label: "supplementary estimates",
                src_id: "transfer-payments-2025",
                dst_id: "budget-2026-estimates",
                slug: "budget-2026-estimates",
                title: "Budget 2026: Main Estimates",
                pieces: 3,
              },
            ],
          };
        }
        // A document's children (data.ts lineageForPiece): only the pieces
        // whose parent is the bound id — not the whole tree.
        if (/FROM pieces/i.test(sql) && /parent_piece_id = \?/i.test(sql)) {
          const parentId = bound[1];
          return {
            results: ALL.filter((p) => p.parent_piece_id === parentId).map((p) => ({
              slug: p.slug,
              title: p.title,
              origin: p.origin,
            })),
          };
        }
        // Lineage: the tree, keyed by piece id (consolidation.ts).
        if (/FROM pieces/i.test(sql) && /parent_piece_id/i.test(sql)) {
          return {
            results: ALL.map((p) => ({
              id: p.id,
              slug: p.slug,
              title: p.title,
              parent_piece_id: p.parent_piece_id,
              origin: p.origin,
            })),
          };
        }
        // The id-to-slug map consolidation uses to credit a lead's other side.
        // Admin (site/admin-data.ts): what is waiting, what was decided.
        if (/'\$\.desk'\)\) IS NOT NULL/.test(sql)) {
          const meta = (o: Record<string, unknown>) =>
            JSON.stringify({ ingested_from: "feed-upload", ...o });
          return {
            results: [
              {
                id: "admin-1",
                slug: "rents-after-the-ban",
                title: "Rents After the Ban: Toronto, Vancouver and Montreal, 2023–2026",
                publication_status: "working-material",
                chars: 31200,
                head: "## TL;DR\nRents fell for other reasons [1].",
                created_at: "2026-10-11T09:00:00Z",
                published_at: null,
                metadata: meta({
                  admin_status: "waiting",
                  sorted_as: "research",
                  sorted_why: "has a TL;DR or key findings and numbered sources",
                }),
              },
              {
                id: "admin-2",
                slug: "why-i-stopped-the-routine",
                title: "Why I stopped the routine that was working",
                publication_status: "working-material",
                chars: 8400,
                head: "My doctor changed my medication in March.",
                created_at: "2026-10-10T18:00:00Z",
                published_at: null,
                metadata: meta({
                  admin_status: "waiting",
                  sorted_as: "personal",
                  sorted_why: "names you or your health",
                }),
              },
              {
                id: "admin-3",
                slug: "the-quiet-part",
                title: "The Quiet Part",
                publication_status: "published",
                chars: 12000,
                head: "",
                created_at: "2026-10-09T12:00:00Z",
                published_at: new Date().toISOString(),
                metadata: meta({ admin_status: "published", sorted_as: "article" }),
              },
            ],
          };
        }
        if (/length\(trim\(body_md\)\) < 40/.test(sql)) {
          return {
            results: [
              {
                id: "admin-4",
                slug: "scan",
                title: "budget-2026-estimates",
                publication_status: "working-material",
                chars: 0,
                head: "",
                created_at: "2026-09-28T12:00:00Z",
                published_at: null,
                metadata: JSON.stringify({
                  ingested_from: "feed-upload",
                  admin_status: "waiting",
                  original_filename: "budget-2026-estimates.pdf",
                }),
              },
            ],
          };
        }
        if (/SELECT id, slug FROM pieces/i.test(sql)) {
          return { results: ALL.map((p) => ({ id: p.id, slug: p.slug })) };
        }
        // Questions answered, per document (consolidation.ts).
        if (/FROM aeo_question_evidence/i.test(sql) && /GROUP BY piece_id/i.test(sql)) {
          return { results: [{ piece_id: "budget-2026-estimates", n: 2 }] };
        }
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
        // The search page's passages (models/search.ts resolvePassages): the
        // verbatim text and the published document, for the quote ids the
        // vector stub returned.
        if (/FROM quotes q/i.test(sql) && /verbatim_text/i.test(sql) && /IN \(/i.test(sql)) {
          return {
            results: SEARCH_PASSAGES.filter((r) => bound.includes(r.id)),
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
          return { results: RESEARCH_RUNS };
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
        // Every write is a no-op — including the UPDATE of pieces.last_opened_at
        // that /p/<slug> fires for the operator after rendering (migration
        // 0063). The fixture has nothing to update, and a write must never
        // make a screenshot fail.
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
  // Workers AI and Vectorize, as far as the search page needs them: a fixed
  // embedding, a fixed answer set, and a rerank that keeps the order. Nothing
  // else at render time calls either (standing rule 5), so a page that starts
  // to would photograph the stub's shape rather than pass silently.
  AI: {
    run: async (model: string) =>
      /bge/i.test(model) ? { data: [[0.1, 0.2, 0.3]] } : { response: [] },
  },
  EMBEDDINGS: {
    query: async (_values: number[], opts: { filter?: { kind?: { $in?: string[] } } }) => {
      const kinds = opts.filter?.kind?.$in ?? [];
      const matches = kinds.includes("quote")
        ? SEARCH_PASSAGES.map((p, i) => ({
            id: `quote:${p.id}`,
            score: 0.91 - i * 0.07,
            metadata: { kind: "quote", id: p.id, user_id: "u1" },
          }))
        : SEARCH_DOCUMENT_IDS.map((id, i) => ({
            id: `piece:${id}`,
            score: 0.84 - i * 0.09,
            metadata: { kind: "piece", id, user_id: "u1" },
          }));
      return { matches };
    },
  },
};

/** Slugs the audit needs to hit detail pages without hard-coding them twice. */
export const FIXTURE = {
  essaySlug: ESSAYS[0]?.[0] as string,
  researchSlug: RESEARCH[0]?.[0] as string,
};

export {
  env,
  ESSAYS,
  RESEARCH,
  ALL,
  REVIEW_LABEL,
  REVIEW_WARN_LABEL,
  REVIEW_PUBLISHED_LABEL,
  SEARCH_QUESTION,
};
