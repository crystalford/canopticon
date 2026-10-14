# Changelog

What changed, when, and why — at the level of decisions, not commits.
`git log --first-parent main` has the rest. Earlier eras (the v1 dossier
product, the "Fabric" graph era, the film engine) are in `docs/archive/LINEAGE.md`
and `docs/archive/canopticon-changelog.md`; this file starts where the
product became the publication.

## 2026-10-14, last — What a read feeds

- **"Show on the page"**: one approval per read puts what you kept on the
  document's public page — the key figures with who gives them and when (in
  place of the figures the page used to pick by pattern), a line saying how
  many passages are the document's own words and who chose them, and after
  the body: what it finds, the questions it answers, what it leaves open.
  Every item links to its passage. "Take it off" undoes it; nothing is lost.
- Never on the page: possible articles, advice to the author, the author's
  own decisions, anything about the author, and the document's own Key
  Findings and Caveats (they are in the body already).
- **"Write this"** on a possible article starts an article in the workspace
  with the thesis and the passages that carry it as the first message.
- **Admin** cards say what each read found: when, how many kept, how many
  dropped, and whether it is on the page; "Its read" opens it.

## 2026-10-14, later — Read it

- **"Read it"** on every readable upload in Admin and on a document's page
  when signed in. Claude reads that one document, whole, once, and lays out
  what is in it as cards: key figures, findings with their role, questions it
  answers and raises, its thesis, predictions, caveats, coined names, open
  problems, and up to three possible articles. It runs only when pressed.
- **Every card rests on the document's own words**, found in code. A span
  that is not there is dropped and counted on the receipt, in red, always.
- **The document's structure comes first, free**: its Key Findings, Caveats
  and question headings are cards before Claude starts.
- **Advice is never evidence**: each passage carries its role, and only
  findings and reasoning count toward a possible article. A possible article
  the document already states is refused (that is a summary); one no
  verified finding carries is never shown; under eight is marked thin.
- **Keep or dismiss**; dismissed never comes back on a re-read. Each read
  leaves a receipt: characters read of characters held, passages found,
  passages dropped, cost. Nothing is public yet; "Show on the page", "Write
  this" and the Admin badges are next. Migration 0070; `docs/read-it.md`.

## 2026-10-14, late — Research in the workspace

- **"New research"** in `/admin/write`: ask a question, say why and what is
  already decided; Claude checks the record, searches the web, reads the
  sources in full (Anthropic's own search and fetch tools, the ones Claude's
  Research uses), and writes the report on the right, as the document page
  it will become.
- **Every page it reads is kept, and every quotation in the report is checked
  against those pages**, in code, on every write. A report reaches Admin
  only with a title, a real topic, a Sources list with links and no failed
  quotation. In Admin it publishes like any upload.
- Billed to the Anthropic key or Cloudflare credits, not Claude's apps:
  searches are $10 per 1,000, reading pages costs only tokens.
- The old research engine stays until the new one has made real reports,
  then it is retired.

## 2026-10-14, night — The workspace, made safe for first real use

A review of everything built today, before Claude is connected, found what
would have broken the first time it ran:

- **One turn at a time per draft** (a lock, migration 0068). Two tabs, or a
  reload mid-turn, could interleave messages and break a draft for good.
- **A refusal no longer breaks a draft**: an empty or half-written reply is
  never saved. After a mid-answer fallback, the declined model's unfinished
  calls are dropped, as Anthropic specifies.
- **A first turn that fails no longer freezes broken instructions**; they are
  frozen after the first reply.
- **The Cloudflare route sends no Anthropic key**, so Unified Billing is what
  pays; errors say what the gateway or Anthropic actually answered.
- **A keep-alive** keeps the stream open while Claude thinks; the page asks
  you to keep the tab open (the server stops about 30 seconds after it closes).
- **Personal uploads are never offered to Claude**, and a concept, problem or
  figure can only be added once its source document is public.
- **Receipts from your published uploads** now show on public article pages,
  as they did in the preview.
- **No 404 after Publish**: the link reads the database at once.
- Long messages are stored across several rows; Claude is offered only the
  topics an article can publish under; two Publish presses at once no longer
  collide; a stale card cannot dismiss an entry already added.
- The whey article's comparison table carried a stray row from another table
  (it came with the handoff); removed.

## 2026-10-14, later — Reports into the chat; Claude proposes for the record

- **Add files** in the workspace (or drop them on the chat): research
  reports are stored and held in Admin exactly as an Admin upload is, and
  Claude is told their ids so it can read them at once. An article that
  quotes one can publish once the report itself is published.
- **Claude proposes concepts, open problems and key figures** while it reads,
  each grounded in a passage checked word for word. They arrive as cards in
  the chat: rewrite the paragraph if you like, then Add to the record or
  Dismiss. Added ones appear on their own pages, in Ideas, the Library and
  the key figures list. Concepts are patterns that happen, never names for
  things to build (contract §1b).
- **Claude through Cloudflare:** the workspace can run on Cloudflare's AI
  Gateway with Unified Billing (Cloudflare credits, no Anthropic account),
  through the gateway's Anthropic pass-through, which carries tools and
  caching. It is used whenever the GitHub secrets `AI_GATEWAY_ID` and
  `CF_AIG_TOKEN` are set; the Anthropic key is the fallback. The page says
  which one is in use.
- **The publish deploy failed, and is fixed here:** its table was called
  `article_versions`, a name a legacy table from 0005 already had, so the
  migration did nothing and then broke. It is `published_versions` now, and
  a new test applies every migration in order to real SQLite, so a collision
  like that fails CI instead of the deploy.
- **Fixed before it could bite:** each conversation's instructions and tool
  list are now frozen at its first turn. Claude Opus 5.5 rejects a turn when
  they change mid-conversation (a new topic, a new tool), which would have
  broken every existing draft the first time either changed.

## 2026-10-14 — Publish from the workspace

- **Publish** in `/admin/write` puts the article live at `/articles/<slug>`,
  in the Library, its topic, the feeds, llms.txt and the sitemap, and in the
  "cited by" of every document it quotes. It refuses, with the reasons, a
  draft with a quote that is not word for word, a document that is not yet
  public, or no topic.
- Every publish is a new version; nothing is overwritten. Editing a live
  article changes nothing until "Update the live article". "Take down" keeps
  the address and the versions.
- Fixed on the way: lookups built from the Library (cited-by, a document's
  row) were built once per server and could miss anything published after
  it started.

## 2026-10-13 — The workspace: write with Claude beside the page

- **`/admin/write`**, step 1 of making Canopticon work the way Claude Design
  did: a chat with Claude on the left, the article on the right, drawn by the
  public renderer so it is exactly what will publish. Claude reads the record
  (public research and your own uploads, never held or private documents),
  writes the whole article or revises one passage, and every quotation is
  checked word for word on every write. A failing quote is red on the page
  and handed back to Claude to fix. Click a paragraph to flag it into the
  chat. "Why I asked" is never written by the model; Claude asks for it.
- Runs on Claude Opus 5.5 through the Anthropic API with a key
  (`ANTHROPIC_API_KEY`), with automatic fallback if a request is declined and
  prompt caching for the documents it has read. The page shows an estimated
  cost per draft.
- The essay contract is compiled into the store and is Claude's
  instructions, whole.
- Pull quotes are now checked word for word at build, like every `<q>`
  (all six already were).
- Not yet: publishing from the workspace (a draft downloads as a content
  file meanwhile), uploads straight into the chat, and research.

## 2026-10-11, night — Checked against the handoff's own pages

The Desk/Admin mix-up came from following the handoff's README where its
prototype page said otherwise. `scripts/check-against-handoff.mts` now
renders every prototype page beside ours and lists what a reader of the
prototype would see that ours lacks: headings, controls, links and short
labels. What it turned up, now fixed:

- Links on the front page, footer and concept pages that went somewhere other
  than the prototype's; the Admin pill's count on every page.
- Concept and open-problem pages: the "More" lists and the citation wording.
  Ideas rows, Follow's topics and wording, and its feed address.
- Essays: short contents labels (matched by position and corrected where two
  are plainly swapped), named sources, "one of a pair" notes, curated read-next
  picks. Emphasis the Markdown export dropped is back (about 20 places). Two
  essays had a pair of "named" cards flattened into one line of text; they are
  a `names` figure now. The tasks essay has its "This thread is still open"
  block and its open-problem link.
- The withdrawn draft (*The change you stop seeing*) says so, is `noindex`,
  and is credited from nowhere.
- The seven papers are ported as-is from their prototype pages.
- The Aldershot and Ancaster project pages are at `/admin/projects/…`,
  signed in only. `privatePage()` is the only way to get them.
- The verbatim check now matches ESSAY-CONTRACT §4 exactly: it ignores
  emphasis and backticks, and nothing else.
- Library: a "Marked useful" sort for the author.

## 2026-10-11, evening — It is called Admin

- The operator's page is **Admin**, at `/admin` (it shipped for an hour as
  `/desk`, the handoff's route name; `/desk` and everything under it now
  301 to `/admin`). The workbench is `/admin/workbench`; the actions are
  `/op/admin/*`; the status key on an upload is `admin_status`.

## 2026-10-11, later — Admin: nothing publishes without Publish

- **`/admin`**, the operator's page from the handoff: drop, choose or paste a
  link; each file is read and sorted by its shape (research, paper, article,
  or personal and held private) and waits as a card with Publish, Keep
  private, Remove and Review. Failed reads ask for a text version. Held
  documents and names awaiting a scholarly check are listed.
- **Upload is no longer publication.** The pipeline and IndexNow run on
  Publish. Every decision can be undone this week, except Remove, which
  clears the typed graph before the row.
- Documents published from Admin join the public Library, topics,
  feeds, llms.txt and the sitemap with the content store.
- The old operator console is `/admin/workbench`.

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
- **The operator console moved from `/library` to `/admin`.** `/library` is
  the public Library now. Admin itself is not yet redesigned (step 8).
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
