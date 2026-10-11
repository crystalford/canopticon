# Changelog

What changed, when, and why — at the level of decisions, not commits.
`git log --first-parent main` has the rest. Earlier eras (the v1 dossier
product, the "Fabric" graph era, the film engine) are in `docs/archive/LINEAGE.md`
and `docs/archive/canopticon-changelog.md`; this file starts where the
product became the publication.

## 2026-10-11 — Black Box: the redesigned public record

The redesign handoff (`docs/blackbox/`) rebuilt inside the Worker, page by
page from its prototypes.

- **A content store.** The handoff delivered the record as files:
  123 public research documents (51 already live, 72 new), 6 held private,
  29 articles, 7 papers, and the derived lists (library, questions, key
  figures, concepts, open problems, topic timeline). They live in
  `packages/api/content/`; `scripts/build-content.mjs` compiles them into one
  JSON module and **refuses to build if any article quote is not verbatim**
  (1,244 checked). It runs before every deploy, typecheck and test.
- **Every public page, new design**: front, Library (filters as links),
  topic pages, documents, articles, papers, concepts, open problems, Ideas,
  Investigations, Search (AND-match, quoted phrases, passages from the full
  text), About and Follow. Geist, the paper palette, one shell.
- **Passage links**: every receipt goes to `/p/<id>#q=<passage>`, found and
  marked in the rendered text in any browser. All 1,250 receipt links were
  followed in a real browser; none missed (`scripts/check-receipts.mts`).
- **The machine face** from the same store: RSS and JSON Feed with full
  content and WebSub hubs, per-topic feeds, `?t=` combined feeds, llms.txt,
  llms-full.txt, sitemap, `.md` and `.json` twins.
- **Follow** stores a CASL consent record per subscriber (migration 0064).
  Nothing is emailed until a key *and* a mailing address exist.
- **The operator console moved from `/library` to `/desk`.** `/library` is
  the public Library now. The desk itself is not yet redesigned (step 8).
- Old URLs redirect per `docs/blackbox/ROUTES.md`.

## 2026-09-24, later — The seam, the audit, the tidy (PR #183)

- **One nav for the operator** (three stacked headers → one bar).
- **A data seam**: typed page models for the document, the library and
  search, served as JSON beside the HTML (`/p/<slug>.json`,
  `/library.json`, `/search.json`). HTML unchanged, diffed to prove it.
  Built so a new front end can be made against real data.
- **Security audit**: stored XSS on the research review screen fixed; two
  redirect guards; one ownership filter; a CORS allow-list; a cross-site
  POST guard; `workers_dev = false`. Report in `docs/`.
- **Modules**: operator routes and the library renderer split by concern,
  pure moves.
- **The screenshot catalogue** (24 states) and `docs/SCREENSHOTS.md`.
- **Docs**: this changelog, `docs/README.md`, `docs/DESIGN-BRIEF.md` (the
  briefing for the redesign), superseded docs archived.

## 2026-09-24 — The Record, built (PR #181)

Three swings in one day, one branch, merged as one. Details in
`docs/HANDOFF.md`; the design briefing that came out of it is
`docs/DESIGN-BRIEF.md`.

- **One pipeline** (migration 0060): every document walks
  `title → digest → findings → passage → section → og → index → done`, one
  step per request, pressed by the library's poller while the tab is open.
  Replaced five separate extraction passes of which only the first tick of
  the first ever ran on its own. One status per row; Re-process; Retry;
  auto-title with "Put it back"; the lead passage auto-approved.
- **Claude through Cloudflare AI Gateway (Unified Billing)** as the preferred
  model for every judgement step and the research writer, Workers AI
  otherwise; the library says which. Billed through Cloudflare by design.
- **The loop closes** (migration 0061): bridges (a subject shared across two
  sections), readings (the operator's verbatim-anchored notes; "Read by the
  operator"; labelled model-drafted essay from one), lineage (Grew from /
  into; every brief a child of the document that raised it), the
  corpus-wide worklist, related by subject, Ask the record (passages with
  receipts first on `/search`).
- **Findable**: section hubs, key figures above the body, the site's
  structured data (BreadcrumbList, Organization, WebSite + SearchAction,
  Person, `isBasedOn`), `/llms-full.txt`, IndexNow, share cards drawn by the
  pipeline, the analytics beacon. All inert and stated when unconfigured.
- **One design**: tokens on a scale in both stylesheets, pinned by the
  invariants test; the reading page at 68ch; one `.btn`; the workbench with
  a rail. `/about`, `/method` and `CLAUDE.md` rewritten from
  `docs/the-record.md`.
- **The document is the workbench**: leads as buttons on `/p/`, a free
  question box, "Research this" on a selected passage; **New version**
  (same slug, readings re-anchored); **Resurfaced today**; narrow answers
  for unsourced figures (three pages, who/where/when, quotes verified
  against the fetched page); **the tetrad** as a Markdown shape; the
  **sectioned research writer** (migration 0062: outline → one section per
  step → assemble, every quote located verbatim in a source's full text,
  killed count in red).
- **Ask the record answered from the corpus** (`POST /op/ask`; frozen once,
  shown to every reader; "the record does not settle this" is a finding);
  **readings in the margin**; the post-upload banner; the **brief reviewed
  and published on one screen**; **Draft a tetrad (labelled)**; an opened
  signal (migration 0063) for Resurface.
- **Deleted**: 52 graph-era files nothing imported (arrangements, subject
  pages, records, briefs, faces, studio-produce, the command palette,
  autonomous-expand, face-renderer, meme-draft, lighthouse), four admin
  handlers, `design-mock.ts`, the `.cmdk-*` CSS.
- **Found by review and fixed before merge**: a purge deleted the source
  node readings hang on (every note would have vanished on Re-process);
  share cards printed the raw kind; Resurface skipped canonical documents.
- **Fixed after the operator looked**: three stacked headers on every
  operator page collapsed to one nav (#183).
- **Removed on evidence**: nothing new this round; `/answers`, `/numbers`
  and `/figures` had already gone (below).

## 2026-09-23 — Retire the dead rooms (#179)

Six routes still rendered pages for parts of the product that no longer
existed (`/how-it-works` printed six `undefined` tiles). All 301 now.
`/method` rewritten to describe what is actually in the record.

## 2026-09-22 — One product (#177, #178)

Console CSS aliased to the publication's palette; the research pipeline
made to finish (a state machine, one model-heavy step per execution, after
two passes that each stalled past Cloudflare's ceiling); contradictions
settled from the two documents already held; the writer chosen per run.

## 2026-09-20 — Documents that read like documents (#173–#176)

The document stops being an endpoint: assembled from its own summary table
and gaps section, receipts and cross-links spliced in one pass, working
titles flagged and replaced from the document's own text, eight closed
sections. Wrangler 4. Sign-in moved inside the Access-protected prefix.

## 2026-09-15 to 09-16 — The publication, and the cuts

- The 50 uploaded documents given real URLs (`/p/<slug>`), the old ones
  redirecting.
- The corpus recognised as three populations (`feed-upload`,
  `deep-research`, `record-expand`); 60 crawler-banked third-party pages
  purged; the six pipeline briefs unpublished. Guards added and tested.
- `/answers`, `/numbers` and `/figures` built and removed: derived indexes
  that competed with the documents and were incoherent across this corpus.
  Questions became a worklist, not a page type. The lead passage selected
  verbatim, never written.
- Email built (Resend), inert without a key. CI stopped building a 3GB
  Docker image to check that a Worker compiles.

## 2026-09-14 — The turn

`CLAUDE.md` rewritten: the primary product is the publication, not the
film engine. Studio parked (`packages/studio`), not deleted. The
autonomous-growth machinery declared dormant. Everything before this is in
`docs/archive/LINEAGE.md`.
