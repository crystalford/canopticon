# Canopticon — a briefing for the redesign

> Written 2026-09-24 for whoever takes on the design and front-end of
> canopticon.com next. It describes what the product is, what has been
> discussed, what is built and live, and how the pieces fit. It does not say
> what to design. The repo is `crystalford/canopticon`; the site is
> `packages/api` (Cloudflare Worker, Hono, D1, R2, Vectorize). `CLAUDE.md`
> is the engineering source of truth, `docs/the-record.md` the product
> definition, `docs/HANDOFF.md` the build state. This file is the bridge.

## 1. What the product is

**A research record that compounds — a mind you can cite.** One person (the
operator) uploads their research documents and essays. Each is published
the moment it is uploaded, at a permanent URL, as a citable, machine-readable
artifact. Then the system reads it and says what it noticed: figures with no
source, two documents that contradict each other, a subject shared by two
documents filed under different sections, questions the corpus raises but
cannot answer. Each of those is a button that starts research. The research
produces a brief, which is a child of the document that raised it. The
operator reads, notes passages, and publishes. The record grows as a tree.

The operator's name for the wider idea is **NEO — Neural Engine
Optimization**, or a **neuronal extension**: the site as an extension of the
operator's own mind, one that learns with them and that people and answer
engines can cite. The model case is a synthesis the operator found genuinely
novel (McLuhan's "the medium becomes ground" read against neuroscience's
allostasis), which no single source contained and which the record surfaced
because two documents in different sections shared a subject. That is what a
**bridge** is, and why bridges are treated as the most valuable thing the
machine finds.

Two things get published:

- **Research** — a primary document, kept whole. Indexed at `/research` and
  under one of eight closed sections at `/research/<section>`.
- **Essays** — arguments written to a Markdown convention (a title, a
  one-line dek, a standalone summary paragraph, `##` headings that are
  questions, a `## Sources` list). The file's shape *is* the page's shape.
  Indexed at `/essays`. A **tetrad** (McLuhan's four questions: enhances,
  obsolesces, retrieves, reverses into) is a second essay shape.

## 2. The principles that were settled, and why

These came out of the conversation and are in `CLAUDE.md` as standing
rules. They constrain any design.

1. **Verification is mechanical.** Every published quote is checked by code
   as a literal substring of a stored source. Quotes that fail are dropped
   and the number that failed is shown in red. `/q/<id>` is the public
   receipt for any quote. Nothing is vouched for by a person.
2. **Upload is authorization.** No draft-then-publish rail for documents, no
   confirmation gauntlets. The operator approves by uploading.
3. **Nothing is written twice.** The page, its `.md` twin, its JSON-LD, the
   sitemap, `llms.txt`, the feed — all generated from one query. There is no
   CMS layer and no second renderer.
4. **Nothing runs unattended.** No cron. Every model-heavy job is a state
   machine advanced one step per request by a poller that runs only while
   the operator's tab is open. "The browser is the scheduler." An idle site
   costs nothing.
5. **AI output is an input artifact, never a function.** No model is called
   when a page renders. If a model wrote something, it was frozen into a row
   first, and the page says which model.
6. **Say what is true.** Unknown dates say so. Partial extraction says
   "read the first 70,400 of 145,300 characters". An honest gap beats a
   confident guess.
7. **No JavaScript required to read.** Every public page server-renders
   complete. Scripts only enhance (the operator's poller, the selection
   popover).

Also settled: **the operator chose "model-drafted essays, clearly
labelled"** over "no model writes prose". A model may draft an essay or a
tetrad from the operator's material; the draft is a downloaded file whose
first lines say which model wrote it from what; nothing is stored; the
operator rewrites and uploads it under their own name.

Also settled, from experience: **questions and figures get no public pages
of their own.** Both were built as index pages and removed, because they
competed with the documents for retrieval and were incoherent across a
corpus that spans media theory, public health, housing and carbon finance.
What survives publicly lives on the document's own page.

## 3. What is live now (merged to `main` 2026-09-24)

### Public surfaces

| Route | What it is |
|---|---|
| `/` | Front page |
| `/essays`, `/research`, `/research/<section>` | Indexes; eight section hubs |
| `/p/<slug>` | A document. The primary page of the site. |
| `/p/<slug>.md` | The document's plain-text twin |
| `/q/<id>` | A quote receipt: the verbatim text, its document, located by code |
| `/search?q=` | "Ask the record": a stored answer if one exists, then verified passages with receipts, then documents |
| `/about`, `/method` | What the site is; how verification works |
| `/citations` | Where the site has been cited (operator-facing data, public route) |
| `/llms.txt`, `/llms-full.txt`, `/feed.json`, `/sitemap.xml`, `/robots.txt` | Machine surfaces |
| `/og/<slug>.png` | A share card per document (drawn once by the pipeline) |
| `/confirm`, `/unsubscribe`, `POST /subscribe` | Mailing list (built, inert until an email key is set) |

A dozen retired routes (`/how-it-works`, `/investigations`, `/topics`,
`/record`, `/briefs`, `/watchlist`, `/videos`, …) exist only as 301s to the
live surface that does their job.

### The document page `/p/<slug>` — what it holds

Assembled from one row plus queries, in this order today:

- Breadcrumb · kind label · title · dek · byline with date, updated date,
  read time, and "Read by the operator" when a reading exists
- **Operator action bar** (signed in only): the page's own leads as buttons,
  a free question box, "Draft a tetrad (labelled)"
- **Lead passage** ("In one paragraph"): a verbatim passage selected by the
  pipeline, never composed
- **Key figures** table (findings with a figure, its source and date), when any
- Table of contents (essays)
- The body, with verified quotes spliced in as links to their `/q/` receipts
  and cross-links to other documents sharing a subject. Both are placed in
  one pass; a receipt wins any contested span.
- **Readings in the margin**: the operator's notes on a passage, each an
  aside beside the block that holds the passage, with its receipt and date.
  A note whose passage is no longer in the text falls back below the body
  and says so.
- Sources (essays) · Cite this (APA, BibTeX) · Where this came from
- **Lineage**: "Grew from" (the parent document and the question that
  started it) and "Grew into" (children)
- Related by subject
- Sidebar: kind, words, published, updated, licence (CC BY 4.0), "Read as
  markdown", "Download .md"
- For the operator: a floating "Note this / Research this" control on any
  selected passage (the only client script on the page)
- JSON-LD: Article, BreadcrumbList, Organization, WebSite + SearchAction,
  Person author, `isBasedOn` lineage, FAQPage for question-shaped essays,
  `about` + `hasPart` for a tetrad, Comment for each reading

### The operator's workbench `/library` (signed in)

One page. Today it holds, top to bottom:

- The model in use (Claude through Cloudflare AI Gateway when configured;
  Workers AI otherwise, stated in red)
- **Upload**: a drop zone (`.md .txt .pdf .docx .zip`), a video-URL import,
  and a folded "Maintenance" panel with **Process everything** and **Advance
  research**
- **Just uploaded** banner after an upload: the document's link, its
  processing step, and once done what it linked to
- **Resurfaced today**: one verified passage from the document opened least
  recently, the same all day, with Note this / Research this
- **All material**: one row per document — title, kind, one status
  ("Not processed" · "Queued 1/7 · titling" · "Processing 3/7 · reading (2/4)"
  · "Failed at findings: …" · "Processed"), date, then the receipt ("Read in
  full · 8,400 characters" / "Read the first N of M — the rest was never
  looked at"), the counts (verified spans, figures), an auto-renamed
  working title with "Put it back", the row's **leads** with their buttons
  and any stored answer, the consolidation line ("Linked to 2 documents ·
  linked from 1 · 1 contradiction · 1 unsourced figure · 1 bridge ·
  2 questions"), findings and questions folded, and actions: Re-process ·
  Retry · New version
- **What the record wants**: the corpus-wide worklist — contradictions,
  unsourced figures, bridges, the operator's own readings — ordered
  recent-first, never by frequency
- A left rail (Upload · Documents · Worklist · Research) that becomes tabs on
  a phone

### The research workspace `/op/research?q=`

One run, rendered complete on the server, kept current by a poller while the
tab is open. Shows the plan (the question and follow-up searches, ticked as
they run), the sources as they land (with rejected ones — bot challenges,
too-short pages — shown as rejected), two numbers (sources kept, rejected),
the writer in use, and **one next action** as a button. When the writer is
Claude, the brief is written in sections: the outline appears as a checklist,
each section shows "3 quotes verified · 1 killed" (killed in red). When the
run is done, a **review panel** shows the parent document, the question, the
sections and their counts, the body at a reading measure, the gaps, a red
warning when more quotes died than survived, and two buttons: **Publish to
the record** or **Download .md** (the labelled draft).

### Sign-in

`/op/login` inside a Cloudflare Access-protected prefix. The signed-in nav is
the reader's nav plus Library first, a small working indicator and Sign out
(PR #183, the last change; open at time of writing).

## 4. How the machinery works (so the design can expose it honestly)

**The pipeline.** Every document walks `title → digest(i/n) → findings →
passage → section → og → index → done`, one step per request. Steps:
auto-title from the document's own text; read the text in chunks and pull
verified quotes and typed nodes; extract findings (a figure with its named
source and date) and answered questions; select the lead passage; file into
one of eight sections; draw the share card; index the verified passages for
search. A document can fail at a step and say which; Retry resumes,
Re-process restarts.

**Leads** are queries over the graph, not model output: two documents whose
findings contradict; a figure whose sentence names no source anywhere in the
corpus; a subject shared across two sections (a bridge); the operator's own
reading. Each has a "Dig here" / "Settle this" / "Research" / "Has anyone said
this?" button. A **contradiction** is settled from the two documents already
held (three sentences, up to four quotes, each located verbatim, the failed
count in red, "not settled" when nothing survives). An **unsourced figure**
gets three pages fetched and a narrow answer: who published the number,
where, when. Everything else starts a research run.

**Research on demand.** A run banks web sources (into a `sources` table,
never into the library), writes, does one follow-up search at a time, and
writes the brief — or, on Claude, outlines then writes one section per step
then assembles. Every quote is located verbatim in a source's full text; the
model's attribution is not trusted. The brief is a working-material document
with the parent recorded; publishing it makes it a child of the document that
raised it.

**Readings.** The operator selects a passage on a page and writes a note.
The passage becomes a quote row (so `/q/` works for it), the note is the
operator's words. "Read by the operator" is the one trust signal the machine
cannot supply. From a reading, the operator can download a labelled
model-drafted essay to rewrite.

**Ask the record.** A question on `/search` is answered from the corpus's own
verified passages: retrieval, one writer call, every quote located verbatim,
the failed count in red, stored once and shown to every reader above the
passages. "The record does not settle this" is a finding, and "Research this
on the web" sits beside it for the operator.

**New version.** Replaces a document's source in place: same URL, graph
rebuilt, readings re-anchored to the new text, the count that could not be
found stated.

**Model.** Claude through Cloudflare AI Gateway with Unified Billing (billed
through Cloudflare, no separate Anthropic account) when `AI_GATEWAY_ID` is
set; Workers AI otherwise; the library says which. Only at authoring time.

## 5. The visual system as it stands

Dark ground, one red accent, three type families, one shell width. In
`packages/api/src/public/styles.ts` (one stylesheet, served at
`/styles.css`) and `operator/operator-styles.ts` (the console, aliased to the
same palette).

- Ground `--paper #0e1013`, panels `--paper-2/-3`, rules `--rule`
- Accent `#e0433c` (red), `--confirmed` green for verified, `--correction`
  red for failed/killed
- Type: Archivo (sans, UI), JetBrains Mono (labels, receipts, status),
  Newsreader (reading columns at `--measure: 68ch`)
- Scales: `--t-1..6` type, `--s-1..8` space, `--r`, `--r-lg`, `--r-pill`
  radii, pinned by `tests/stylesheet-invariants.test.ts`
- One shell (`--shell: 1180px`, `--gutter`) for nav, content and footer; one
  panel treatment; one `.btn`
- Server-rendered HTML by string concatenation. No JSX, no React, no build
  step. The mobile nav is a CSS checkbox toggle.

The operator's own verdict on the result: it reads as bolted together. The
pieces are individually reasoned (each has a comment saying why) but they
were added one at a time over months by different sessions, and it shows:
too many mono labels, too many small panels, a library row that is a stack
of eight different components, a header that was three tiers until today.
That is the thing a redesign is for.

## 6. Where it stands

- Everything in sections 3 and 4 is merged and deployed (PR #181, 2026-09-24;
  752 tests; screenshots reviewed at desktop and phone width via
  `packages/api/scripts/look.mts`, which serves the real app against a
  seeded in-memory database and takes 18 shots including signed-in views).
- The live corpus has not yet been processed by the new pipeline. The
  operator presses **Process everything** in `/library` with the tab open.
- The AI Gateway is not yet configured, so everything runs on Workers AI
  and the sectioned writer is off. Two values in `wrangler.toml`.
- Inert until keys are set: IndexNow, share cards (Browser Rendering), the
  analytics beacon, email, web search for research (`BRAVE_SEARCH_API_KEY`).
- Known limits, stated on the pages: extraction reads at most ~70KB of a
  document; a quote's stored offset is not a document position (quotes are
  re-located at render time); the margin note column is 148px at the shell
  width.

## 6b. Data for a new front end (added late 2026-09-24)

Every page now builds one typed model and renders from it, and the same
model is served as JSON beside the HTML. A new front end can be built
against real data without touching the plumbing; the JSON says everything
the page says and contains no HTML.

| Surface | Model | JSON |
|---|---|---|
| Document | `packages/api/src/public/models/document.ts` → `DocumentModel` | `GET /p/<slug>.json` (a reader gets the public model; the operator's copy adds `operator.leads` and `operator.actions` and is `no-store`) |
| Library | `public/models/library.ts` → `LibraryModel` | `GET /library.json` (operator only; 404 otherwise) |
| Search | `public/models/search.ts` → `SearchModel` | `GET /search.json?q=` |
| Research run | `graph/lib/deep-research.ts` → `getResearchStatus` (`ResearchStatus`, incl. `review`) | `GET /op/research-status?…` (what the poller reads) |

Each model file's interface is doc-commented field by field. The renderers
(`public/render/piece-template.ts` → `renderPieceFromModel`,
`public/render/library/*` → `renderLibraryFromModel`,
`public/render/search.ts` → `renderSearchModel`) are pure functions of the
model, so a replacement renderer is a function with the same signature.
Actions the operator can take are in the models as `{label, method, action,
fields}` — the form contract, not markup.

`docs/SCREENSHOTS.md` lists all 24 photographed states and the one command
that regenerates them against the seeded fixture; every state a design has
to handle is in that set. `docs/SECURITY-AUDIT-2026-09-24.md` says how the
operator surface is authenticated (Cloudflare Access at the edge; the
Worker itself trusts the hostname) — relevant to any new front end that
posts to `/op/*`: it must be same-origin, and it must carry no credentials
of its own.

## 7. Things worth knowing before redesigning

- **The document page is the product.** Everything else exists to get a
  reader or an answer engine to a passage on it, with provenance intact.
- **Every claim on a page has a receipt**, and the design has never made
  that legible at a glance. Receipts are spliced links in prose; the failed
  count is a red mono line. The proof is there; it does not read as proof.
- **The operator works in one tab, and the tab is the scheduler.** Status
  must be visible and honest while things run, and nothing runs when the tab
  closes. This is a constraint, not a bug.
- **Two audiences, one product.** The reader (and the crawler) sees a
  publication. The operator sees the same pages plus their tools. The
  console CSS was aliased to the public palette so they read as one thing;
  they do not yet feel like one thing.
- **The fixture is the design's test bed.** `scripts/fixture.mts` seeds every
  state (queued, processing, failed, processed; a bridge; a lineage pair; a
  run mid-write; a run at review; readings in and out of the text; an
  upload banner). If a state cannot appear in a screenshot, it is not
  checked. Any redesign can be seen against it without deploying.
- **What the operator asked for, in their words:** professional navigation,
  not bolted together; a full revision top to bottom; the workflow, the
  linking structure and the SEO/GEO/AEO surfaces all as one thing; billed
  through Cloudflare; and the site to feel like the thing discussed — a
  mind you can cite, that learns with its operator.
