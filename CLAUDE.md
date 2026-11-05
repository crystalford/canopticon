# Canopticon

> **If you are an AI reading this to understand the project: this file is the
> source of truth. The primary product is THE PUBLICATION — canopticon.com,
> `packages/api`. You upload research documents and essays; it publishes them
> as citable, machine-readable artifacts. Everything else in this monorepo is
> a separate, compartmentalized system that is maintained but not grown.**
>
> **This changed on 2026-09-14.** This file previously said the primary
> product was CANOPTICON STUDIO, a generative film engine. It isn't, and
> hasn't been used. Studio is parked (see COMPARTMENTALIZED below) and the
> operator is continuing that work separately. Do not design against
> `docs/studio/`, however confident it sounds.

- **The Record** (primary): canopticon.com · **Studio** (parked): studio.canopticon.com
- **Twitter**: @canoptics · **GitHub**: crystalford/canopticon

---

# THE BLACK BOX SITE — the public record since 2026-10-11

> **`docs/blackbox/README.md` is the design spec and its prototypes are the
> tie-breaker.** Everything public is now rendered by `packages/api/src/site/`;
> `src/public/` is the old public site, still mounted behind it for the few
> routes not yet rebuilt (and Admin's workbench), and is residue to delete (build
> order step 9). Where this section and older text below disagree, this
> section wins.

- **The content store.** `packages/api/content/` holds the record as files:
  `research/` (public documents), `research-held/` (private — stored, never
  served), `articles/` (the essay contract: `<q doc section>` = verbatim),
  `papers/`, `pages/` (hand-built pages ported as-is: About, three concepts,
  one open problem), and the derived JSON lists. `scripts/build-content.mjs`
  compiles it into `src/site/content/store.gen.json` (gitignored) and FAILS
  the build if any `<q>` is not a literal substring of its document. Wrangler
  runs it via `[build]`; `typecheck` and `test` run it first. Read the store
  only through `src/site/content/store.ts` — the accessors are where "held"
  and "projects are private" are enforced. `tests/site.test.ts` pins both.
- **Routes.** `src/site/routes.ts` is mounted in front of `src/public/routes.ts`
  and calls `next()` for what it does not own. `/library` is the public
  Library; the operator console is at **`/admin`** (it was `/library`).
  Documents uploaded after the handoff live only in D1 and render through the
  same document page (guarded by `OWN_UPLOADS_SQL`).
- **Design.** `src/site/styles.ts` (served at `/site.css`) and `src/site/layout.ts`.
  Paper palette, Geist, cobalt = interaction, brick = the author's marks,
  green = verified. No box-shadows. Reading column 720px. `/site.js` is
  enhancement only (`/` focuses search, progress bar, TOC, cite copy,
  passage finding, hovercards); every page is whole without it.
- **Adding an article** means adding `content/articles/<slug>.md` and a row in
  `content/library.json`, then deploying. The verbatim check runs at build.
- **To look at it:** `pnpm tsx scripts/look-site.mts <outDir> <width> <path…>`;
  to check every receipt lands: `scripts/check-receipts.mts`.
- **Email** waits on a mailing address (CASL): `lib/email.ts` sends nothing
  without both `RESEND_API_KEY` and `MAILING_ADDRESS`.
- **Admin** is `/admin` (`site/pages/admin.ts`, actions in
  `operator/routes/admin.ts` under `/op/admin/*`): Add something, Waiting for
  you, Decided this week. The old operator console — processing, leads,
  research, the export — is `/admin/workbench`. Published Admin uploads join
  every public list through `site/uploads.ts` → `setUploadedRows()`.
- **The workspace** is `/admin/write` (`src/write/`, `site/pages/write.ts`,
  actions in `operator/routes/write.ts`): a chat with Claude beside the real
  article page, the way Claude Design works. Claude (Opus 5.5, through
  Cloudflare's AI Gateway Anthropic pass-through when `AI_GATEWAY_ID` +
  `CF_AIG_TOKEN` are set — Unified Billing, no Anthropic key — else the
  Anthropic API with `ANTHROPIC_API_KEY`; `env.AI.run()` cannot carry tools
  or caching, so the workspace never uses it; `claudeRoute()`) reads the
  record through tools (list, search, read), writes with `write_draft` and
  revises one passage with `edit_draft`; every write is checked word for
  word in code (`write/check.ts`, the build's rule) and failures go back to
  Claude and show red in the preview. Clicking a paragraph flags it into the
  chat. Its instructions are `docs/blackbox/ESSAY-CONTRACT.md`, whole,
  compiled into the store — change the contract, change the drafter. Drafts
  and their conversations are D1 rows (migration 0065), append-only. It may
  quote public research and the operator's own published or waiting uploads,
  never a held or private document. It also **reads Chris's own articles and
  papers** (`ownWriting` / `ownWritingText` / `searchOwnWriting` in
  `write/sources.ts`), listed and labelled apart, never quotable —
  `sourceText` does not return them, so a `<q>` from one fails the check.
  The instructions open with **THE RECORD** (what the record holds; Claude
  can read it and change nothing; it reports what looks wrong without
  saying where to fix it). Thinking is `display: "updates"` (beta
  `thinking-display-updates-2026-08-18`): non-empty thinking blocks stream
  as `update` events and show in the chat as italic progress lines. Needs `ANTHROPIC_API_KEY` (a GitHub
  secret the deploy pushes to the Worker). **Publish** runs the build's gates
  (every quote word for word, every quoted or named document already public,
  a real topic) and copies the draft into a new `published_versions` row
  (migration 0066) — nothing overwritten; the site shows the latest version.
  Edits stay private until "Update the live article"; "Take down" keeps the
  address and every version. Live articles join the store as an overlay
  (`setPublishedArticles`, loaded with the uploads in `site/uploads.ts`), so
  the article page, Library, topics, feeds, llms.txt, sitemap and cited-by
  all read them; `storeVersion()` rebuilds the derived lookups when the
  overlay changes. A draft also downloads as `content/articles/<slug>.md`.
  **Reports go straight into the chat** ("Add files" or drop): each is stored
  and held in Admin exactly like an Admin upload, and named to Claude in the
  next message. **Claude proposes** concepts, open problems and key figures
  (`propose_entry`, `write/entries.ts`), each grounded in a passage checked
  word for word; you add one as written or rewritten (a person writes the
  paragraph, contract §1b–1c) or dismiss it. Added entries live in
  `record_entries` (migration 0067) and join the store's concepts, problems,
  figures and Library (`setRecordEntries`). **Each draft's system prompt and
  tools are frozen at its first turn** (`drafts.frame`) and resent byte for
  byte: Claude's reasoning is bound to the exact conversation, and a changed
  prompt or tool list mid-conversation fails the request on newer accounts.
  `thinking.block_binding: drop_block` is the safety net. Never edit a
  draft's stored messages. **Never read a conversation or a draft's kept
  pages in one query**: a research draft stores every page read (in its
  messages and in `research_sources`), and one query over all of it exceeded
  D1's CPU limit. Sizes come from covering indexes (migration 0072,
  `draft_messages.chars`) and the text is read ~2 MB and ≤90 rows a query
  (`batches` in `write/drafts.ts`); the drafts list never selects
  `body_md` or `frame`.
- **Engines: Claude or Workers AI** (`write/engines.ts`, 2026-11-04). Every
  conversation runs on one engine, chosen beside New article / New research
  (remembered as the default in `users.preferences.engine`) and frozen in the
  frame at the first turn (`frame.engine`; absent = Claude; a conversation
  with messages but no frame stays Claude). Workers AI engines:
  `@cf/deepseek-ai/deepseek-v4.1-flash-1017` (default, $0.30/$1.20 per M) and
  `@cf/zai-org/glm-5.3` ($1.40/$4.40) — both tool-calling-tested live through
  `/v1/admin/models?try=`. Same loop, instructions, tools and checks: the
  stored conversation stays Anthropic-shaped; `workersStep` converts it to the
  OpenAI chat format (`toChat`/`toFunctions`) and the reply back (`fromChat`).
  The web is our own tools there: `web_search` through Cloudflare's Web
  Search (`env.AI.websearch`, beta, billed on the Cloudflare account) via the
  gateway named in `SEARCH_GATEWAY_ID` (wrangler.toml, "canopticon-search";
  created once in the dashboard), falling back to Brave
  (`BRAVE_SEARCH_API_KEY`, set live). Never `AI_GATEWAY_ID` for this: that
  also moves the processing pipeline onto Claude (`preferredProvider`);
  `web_fetch` through `fetch` + `env.AI.toMarkdown`, 40,000 characters at a
  time with an offset, every page kept in `research_sources`. Measured spend
  before this (`/v1/admin/spend`, 2026-11-04): $72 recorded over 14
  conversations, research $68.62, more than half of it Claude cache writes —
  hence also `max_content_tokens` 60k → 30k on Claude's web_fetch.
  **A third Anthropic engine**, `claude-sonnet-advised`: Sonnet 5.5 runs the
  conversation ($2/$10) and consults Opus 5.5 through the advisor tool
  (`advisorTool`, beta `advisor-tool-2026-03-01`, 2,048-token cap, advisor
  caching on) — frozen into the frame's tools like the rest. Cost is counted
  by `claudeUsage`: the engine's rates, advisor iterations at Opus's, and $10
  per thousand web searches; **usage is saved after every step** (the
  operator's bill was ~$100 against $72 recorded: turns cut off by errors
  were never counted). Context editing clears rarely and in bulk (trigger
  500k, `clear_at_least` 200k): every clear rewrites the cached conversation.
  "Test the connection" also tries Sonnet with the advisor. **Claude's cache
  is one hour** (`ttl: "1h"` on the system block, the request and the
  advisor; writes priced at 2× input): the operator reads for longer than
  five minutes between messages, and each reply after that re-bought the
  whole conversation. **The previous request's end is marked as a cache
  breakpoint** (`markPreviousEnd`, in what is sent only): automatic caching
  looks back ~20 blocks, and one research step adds more (two per search or
  page read), so the previous entry was missed and the whole conversation
  re-written — the likely source of the 8.2M tokens of cache writes.
  **Loop hygiene (2026-11-05 audit):** a page is read once (`byUrl`, served
  from what was kept, no allowance spent); kept pages load once per turn
  (`ctx.kept`); read-only tools asked for together run in parallel; Claude's
  web allowance is counted per message and a spent allowance is said in the
  next tool result; on Workers AI `toChat` sheds old page reads in batches of
  eight past 800k characters, a `finish_reason: "length"` reply is
  `max_tokens`, `_unreadable` arguments get a plain message. Straight
  quotation marks open/close only at word edges (`reportQuotations`), and a
  failed quotation comes back with the page's nearest words
  (`nearestPassage`). `edit_draft` takes several passages (`also`, all or
  none) — live conversations had made up to 24 single-passage edits, each a
  full model call. Claude's search is `web_search_20260318` with
  `response_inclusion: "excluded"` (results its filtering used are not
  carried: 0.3–1.6M characters per conversation). `/v1/admin/turns` reports
  how conversations behaved (counts only).
  **Research writes from notes, section by section** (`write/notes.ts`,
  migration 0073 `research_notes`, new research conversations): the model
  lays the report out with `write_outline` (Details sections with target
  lengths), notes each passage it will use with `note_evidence` (checked word
  for word against the kept page when made — refused with the page's nearest
  words otherwise — and numbered in code), reads them back with
  `list_notes`, and writes each part with `write_section` (a section number,
  "summary", "closing"); the Sources list is rebuilt from the notes on every
  write, so citation numbers never drift. `write_report` is gone from new
  research frames. With notes kept, pages leave the model's view sooner:
  Claude clears at 250k (≥120k, keep 6), Workers AI past 300k characters.
  `reportProblems` lists parts still to write.
- **Is Claude connected?** `/admin/claude` (`site/pages/claude.ts`,
  `write/connection.ts`): which settings are present (never their values) and
  "Test the connection" (`POST /op/admin/claude-test`) — one small call with
  the workspace's own model, betas and declared web tools. **An Anthropic key
  can be pasted there** (`write/stored-key.ts`, `operator_secrets`, migration
  0071): stored AES-GCM-encrypted with a key derived from `SESSION_SECRET`,
  tested at once (a 401/403 key is not kept), never shown again beyond its
  last four characters, loaded into a one-minute per-isolate cache on every
  `/op` request and signed-in page. Route order: AI Gateway, then the pasted
  key, then the `ANTHROPIC_API_KEY` secret (`claudeRoute`, `anthropicKey`).
- **Research** is the same workspace with a research draft ("New research";
  `write/research.ts`): Claude (Opus 5.5) checks the record, then searches the
  web and reads whole pages with Anthropic's server tools (`web_search`,
  `web_fetch` — fetch is `allowed_callers: ["direct"]` so every page comes back
  to us), and writes a report in the record's shape (TL;DR, Key Findings,
  Details, Open questions, numbered Sources with links). **Every page read is
  kept** in `research_sources` (migration 0069; PDFs through
  `env.AI.toMarkdown`) and **every quotation in the report is checked against
  those pages** on every write (whitespace collapsed, nothing else forgiven).
  **Depth, not brevity**: the instructions ask for a document of record at
  the record's own depth (median ~4,500 words, thorough ones 7,000+, no cap,
  never padded, usually ten or more sources read in full); research gets 60
  model calls per message (`RESEARCH_STEPS`; articles 24, reads 80) and every
  call may output 128,000 tokens, the model's maximum. Web allowance: 80
  searches and 80 page reads (`SEARCH_LIMIT` / `READ_LIMIT`, `max_uses`, per
  request); a `max_uses_exceeded` result is said once in the chat ("reply
  keep going"), and each research turn ends with what it spent ("This
  message: N web searches · M pages read"). Frozen with the frame, so only
  new research drafts get a changed allowance.
  "Save to Admin" sends the finished report through `createAndExtract` as a
  waiting upload (`origin: workspace-research`); it publishes there on
  Publish. Saved again under the same title it is **"Update in Admin"**:
  the new copy replaces the one still waiting (a published one is kept and
  the new copy is a new document); a new title in the same conversation is
  a new document (`meta.savedAs` / `savedTitle`). Once saved, **"Write an
  article from this"** starts an article draft seeded to read the saved
  report first (`reportBrief`, `meta.articleDraft`). A research conversation
  cannot write articles, and its instructions say to send Chris to that
  button rather than paste one into the chat. Fetched pages are sources, never content: nothing in
  `research_sources` is published. Context editing clears old tool results
  past 300k tokens; the kept pages remain. **This replaces the old research
  engine (`graph/lib/deep-research.ts`, `/op/research`), which is retired
  once the new one has produced real reports.**
- **Read it** (`docs/read-it.md`; `write/read.ts`, `site/pages/read.ts`,
  `operator/routes/read.ts`): a button on Admin's upload cards and on the
  signed-in document page. It opens a read draft (kind `read`) whose first
  message the page sends once; Claude (Opus 5.5) reads the document whole and
  notes cards with `note` and `pitch`. Every span is located in the document
  in code (`locateSpan`: exact, then whitespace, then emphasis — nothing else)
  and the document's text is what is stored; a miss is dropped and counted on
  the receipt. Key Findings, Caveats and question headings are taken first
  with no model (`shapeOf`). Roles: only findings and reasoning are evidence.
  A pitch the document already states is refused (contract §3 rule 11); proof
  is counted in code, 0 never shown, under 8 thin. Cards are kept or
  dismissed in the workspace's right pane; a dismissal is remembered in
  `read_ignores` forever. `reads` is the receipt (migration 0070). One read
  per document; pressing again opens it. Nothing a read finds is public until
  **"Show on the page"** (`reads.status = 'shown'`; "Take it off" undoes it):
  then the kept figures replace the page's picked key figures, and "What it
  finds", "Questions it answers" and "What it leaves open" follow the body
  (`site/pages/evidence.ts`, overlay `setShownReads` → `shownRead()`, loaded
  with the uploads; never for a held document). Never public: possible
  articles, advice and premises, the about-the-author flag, and the
  document's own Key Findings / Caveats bullets (already in the body).
  **"Write this"** on a possible article starts an article draft seeded with
  the thesis and its passages (`pitchBrief`, `drafts.meta.seed`, sent once on
  arrival). Admin cards show each read: date, kept, dropped, on its page. A
  kept **coined name or open problem** joins Ideas from the board with the
  paragraph the author writes there (`/op/read/card/:id/idea` → `addEntry`,
  the workspace proposal's gates). A shown read's kept **figures and open
  questions** also join the Library, search and topic lists
  (`keyFigures()` / `questions()`), each linking to its passage.
- **The record linking itself** (`site/links.ts`, no model anywhere): a
  document's text links, in place, the subjects it shares with other
  documents — the typed graph's subjects as a vocabulary
  (`graph/lib/crosslinks.ts subjectVocabulary` filtered by
  `isLinkableSubject`: at least two words and 8 characters; never a person,
  organisation, institution or place; no dates, no "The X", no news outlet or
  journal — rules set against the live vocabulary), two documents sharing one
  when **both texts carry the phrase** word for word (or its plain plural), on
  ≥2 and ≤ a tenth of documents (`linkIndex` in `content/store.ts`: a
  word-and-pair index, built once per isolate, ~0.3 s; live: 189 phrases, 87
  of 123 documents). Not the graph's own document links:
  entity resolution keeps one node per subject on the first document that
  named it, so only 2 of 6,175 subjects were "on" two documents (measured
  live 2026-10-14). One link per phrase and per destination, at most 12; the
  concepts it names (`conceptsNamedIn`; the concept page lists them back as
  "Where it appears"). After the body, **Elsewhere in the record**: a
  question it leaves open that another document answers, and a figure
  another gives for the same measure (`answeredElsewhere`,
  `measuredElsewhere` — matched by shared terms, which are shown; figures
  need shown reads). Loaded with the uploads overlay, so a page view runs no
  query; destinations are checked at render (never held). Live check:
  `/v1/admin/links` through the probe (vocabulary, phrases shared, documents
  linking out, links to held documents — always 0 — and build time).
- **Shares sources with** (document rail): other public documents citing the
  same pages — `sharedSources()` in `content/store.ts`, a query over the URLs
  each cites (store research + published uploads via `setUploadedSources`),
  newest first, never ranked by count. Two documents "agreeing" may be one
  upstream page echoing; this makes that visible.

---

# THE PRIMARY PRODUCT — the record

> **`docs/the-record.md` is the product definition; `docs/HANDOFF.md` is where
> the build stands; `docs/DESIGN-BRIEF.md` is the briefing for the redesign;
> `CHANGELOG.md` says what changed when; `docs/README.md` says which
> documents are current and which are history.** This file is the engineering source of truth and is
> being brought into line with them (2026-09-24).

**A research record that compounds — a mind you can cite.** Drop a `.md`,
`.txt`, `.pdf`, `.docx` or `.zip` on `/library` and it is live at `/p/<slug>`
at once — upload *is* publication. Then the pipeline reads it, one step per
request while the library tab is open, and the record says what it noticed:
contradictions, unsourced figures, open questions, **bridges** (a subject
shared by documents filed under different sections), and the operator's own
**readings**. Each is a button that starts research; the brief it produces is
a child of the document that raised it. Two kinds of thing get published:

- **Research** — a primary document, kept whole. Indexed at `/research` and
  under its section hub `/research/<section>`.
- **Essays** — arguments written to the convention below. Indexed at `/essays`.
  A model may *draft* one from a reading; the draft is a labelled file the
  operator rewrites and uploads under their own name.

```
UPLOAD ──▶ pieces row (published) ──▶ /p/<slug>
             │
             ├─ pipeline: title → digest → findings → passage → section → og → index → done
             │            (graph/lib/processing.ts, one step per POST /op/process/advance)
             ├─ /p/<slug>.md · JSON-LD · /sitemap.xml · /llms.txt · /llms-full.txt · /feed.json
             ├─ /q/<id>      verified quote receipts (readings are quotes too)
             └─ /search      "Ask the record": passages with receipts, then documents
```

**The goal is citability** — by people and by answer engines, with the
provenance intact. `docs/the-record.md` §1b names this NEO.

## The essay convention

An essay is a Markdown file. Its shape *is* the page's shape — the table of
contents, the section anchors, the Q&A structured data and the source links
are all derived from it, and **nothing calls a model at any point.**

```
# Title
A one-line dek.

A summary paragraph that stands alone.

## A question ending in a question mark?
The answer, in the first sentence or two.
Supporting paragraphs after that, citing sources as [1].

## Sources
1. Author. Title. Publisher, 2026.
```

An upload is classified as an essay when a majority of its `##` headings are
questions — that contract is exactly what the essay template and the FAQ
markup need. `packages/api/src/lib/essay.ts` is the parser, the classifier
and an advisory lint (opening paragraphs over 70 words, uncited sources).
**The lint never blocks a publish.** Notes are stored in the piece's metadata
and shown in `/library`.

## Questions are a worklist, not a page type

Tried and cut back. Questions ARE extracted from documents and they do merge
across them — but they get **no public URL**. They live in `/library` as the
operator's research queue: a question the documents provoked, with what is
missing attached, which is a far better research prompt than a topic.

Why the public pages went, having been built:

- **The evidence graded them moderate.** The commissioned research put
  *statistics with a named source and date* top (GEO, 3 of 9 tactics) and
  *question + sourced answer* only moderate. The spine was built on the weaker
  finding.
- **They compete with the documents.** Retrieval is passage-level, and a
  site's own pages displace each other rather than compounding. 50 dense
  documents are already bags of citable passages; a 2-4 sentence answer page
  is thin beside a 45KB dossier and takes queries from it.

**Find patterns across the corpus; never let repeatability be the mechanism
that decides what matters.** Cross-document detection is most of why extraction
exists. But frequency is a tally standing in for a quality judgement, and a
question worth chasing is worth chasing the first time it is asked. It is a
especially bad proxy here: the documents are the operator's own research
output, not independent sources, so three of them "agreeing" may be one
upstream page echoing three times. The queue is therefore ordered recent-first
— a list order, not a ranking.

The signals that ARE about quality are not counts: sources contradicting each
other, a figure carrying a named source and a date, and the corpus raising
something it cannot answer.

What survives publicly is on the document's own page and creates no new URL:
the **lead passage** (selected verbatim, never composed) and the **findings**
block.

`/numbers` was built and removed for the same reason `/answers` was. An index
of every verified figure is the strongest-evidenced primitive *on paper*, and
it did not survive contact with this corpus: the documents span media theory,
public health, housing, polling method and carbon finance, so one global list
stacks an overdose statistic beside a mortgage rate and asks a reader to make
sense of it. It was also a second copy of findings that already render beside
the thing they are about. **Two derived indexes built, two removed — the
pattern to notice is that a page the evidence supports in the abstract can
still be incoherent for the reader this corpus actually has.**

## Standing rules — non-negotiable## Standing rules — non-negotiable

1. **Verification is mechanical, never vouched for.** Every published quote
   is checked as a literal substring of a stored source, with its byte offset
   recorded, by code — not by an operator's say-so. Quotes that fail are
   dropped. `/q/<id>` is the public receipt.
2. **Nothing publishes without Publish** (since 2026-10-11, the Black Box
   Admin page; this replaces "upload is authorization"). A file dropped on `/admin`
   is read, sorted by its shape (`lib/sort-upload.ts`: research, paper,
   article, or personal — held private) and waits as working-material. One
   button publishes it; the pipeline and IndexNow run then, not on the drop.
   Every decision has an Undo except Remove.
3. **Nothing is written twice.** A page, its `.md` twin, its JSON-LD, the
   sitemap, `llms.txt` and the feed are all generated from one query over one
   table. They cannot drift apart because there is only one of them. New
   surfaces go in `public/machine.ts`, not into a second renderer.
4. **Nothing runs unattended.** The cron is disabled (`packages/api/wrangler.toml`).
   Work happens when a person does something. If you need a queue drained,
   add a button, not a schedule — an idle site should cost nothing.
5. **AI output is an input artifact, never a function.** Nothing calls a model
   at render time. If a model wrote something, it was frozen into a row first.
6. **Say what is true.** If a date is unknown, the page says so. If extraction
   only read part of a document, don't imply full coverage. An honest gap
   beats a confident guess — this is a record.
7. **No JavaScript required to read.** Every public page server-renders
   complete. A crawler that runs no JS must see everything a reader sees.

## The prioritisation function

> **Would I publish something here today, and would it be a pleasant ten
> minutes?**

Then: is it findable, is it quotable, does the provenance survive? A green
test suite answers none of those.

## What's built

`packages/api` — its own Worker, own D1 (`canopticon`), own R2, own Vectorize.

**Public** — `public/routes.ts` (every public route) · `public/layout.ts`
(the shell: head, OG/canonical, nav, footer with the trust line, mailing-list
form) · `public/machine.ts` (JSON-LD, the `.md` twin, APA/BibTeX, llms.txt,
feed) · `public/data.ts` (all piece queries) · `public/styles.ts` (one
stylesheet, served at `/styles.css`) · `public/render/` (`indexes.ts`,
`front.ts`, `about.ts`, `piece-template.ts`, `markdown.ts`, `receipts.ts`,
`quote-receipt.ts`, `search.ts`, `investigations.ts` — which is `/library`).

**Retired rooms redirect, never render.** A sweep on 2026-09-23 found six
routes still resolving as full pages, none linked, each describing a part of
the product that no longer exists — and `/how-it-works` printing six stat
tiles that read `undefined`. Now: `/how-it-works` → `/method`,
`/investigations` and `/patterns` → `/research`, `/watchlist` → `/library`,
`/videos` → `/`, and the `/op/design` prototype is unmounted. Their renderers
stay in the tree, unwired. On 2026-09-24 the rest of the graph era followed —
subject pages, the thirteen arrangement prefixes, records, briefs, topics,
activity, instruments, studio-produce, and every operator screen for signed
readings, proposals, faces, synthesis and outputs — each 301ing to the live
surface that does its job (`docs/the-record.md` §9 is the list and the plan
this is part of). `/method` was rewritten
to describe what is actually in the record; it had described a second-judge
model and "signed analyses" that were never built.

**A document page is assembled, not copied.** `lib/document-structure.ts`
promotes the document's own summary table and its "gaps" section to the top
and cuts them from the body (nothing is written twice). `receipts.ts`
splices verified quotes into the prose as links to their `/q/` receipts, and
`graph/lib/crosslinks.ts` splices phrases that link to the OTHER documents
sharing that subject — a query over the typed graph, no model, so it is free,
deterministic and always current. Both are placed in ONE pass and a receipt
wins any contested span: proof before navigation. `lib/title.ts` flags a
working title and `lib/title-candidates.ts` offers replacements selected
verbatim from the document, never composed. `graph/lib/topics.ts` files each
document into one of a CLOSED list of eight sections (free naming produced
forty near-duplicate buckets); "Everything else" is a real answer.

**Ingest** — `operator/routes.ts`'s `createAndExtract()` is the spine:
SHA-256 dedup → R2 → `uploaded_files` → `extract.ts` → a published `pieces`
row — then **the pipeline** (`graph/lib/processing.ts`, migration 0060,
2026-09-24): `title → digest(i/n) → findings → passage → section → done`, one
state machine per document, one step per `POST /op/process/advance`, pressed
by `/library`'s poller while the tab is open (`public/render/process-live.ts`).
The browser is the scheduler; nothing runs unattended. It replaced five
separate passes with five triggers, of which only the first tick of the first
ever ran by itself. `docs/the-record.md` §4 is the definition. `graph/lib/digestion-typed.ts` pulls verified quotes and typed nodes out
of the text; `graph/lib/aeo-extract.ts` pulls findings (a figure with its
source and date) and answered questions. `graph/lib/ingestion-receipt.ts`
reports, per document, what was read (`EXTRACTION_CHAR_CEILING` = 70,400 —
not 72,000, chunks overlap) and what survived verification. It returns null
when nothing ran, so "not extracted" never renders as confident zeros.

**Leads** — `graph/lib/leads.ts`: where the corpus is strange. Two documents
that contradict each other; a figure with no source named anywhere. Each is a
QUERY over the graph — no model, no count, ordered by recency and never by
frequency (the documents are the operator's own output, so three agreeing may
be one upstream page echoing). `graph/lib/answer-lead.ts` settles a
contradiction from the two documents already held: three sentences, up to
four quotes each located verbatim by `locateVerbatim`, and the number of
proposed quotes that FAILED that check shown in red. Small enough to check in
half a minute instead of having to be trusted. An answer with no surviving
quote becomes "not settled" — a finding, not an error. Stored in
`lead_answers`, keyed on a hash of the lead, so it vanishes when the lead does.

**Research on demand** — `graph/lib/deep-research.ts` is a state machine, one
model-heavy step per Worker execution: bank sources → write → one follow-up
search at a time → final brief. It was two passes that each ran an expand AND
a synthesis in one execution, and both stalled past Cloudflare's ceiling
("Sources banked, but no brief written"). `followup_queries` is the PLAN and
is never consumed; `followups_done` records what ran. Nothing drains it on a
schedule (rule 4) — `POST /op/research/advance` does one step, and the
workspace's poller presses it while the tab is open. **The browser is the
scheduler**: attended by construction, nothing when idle. The writer is
`@cf/openai/gpt-oss-120b` unless `RESEARCH_LLM_PROVIDER=anthropic` +
`ANTHROPIC_API_KEY` + a `cost_whitelists` row for `anthropic.research_writer`,
in which case it is Opus 5. **Since 2026-09-24 the preferred writer — and the
model for every judgement step in the pipeline — is Claude through
Cloudflare AI Gateway Unified Billing (`llm/claude-gateway.ts`) whenever
`AI_GATEWAY_ID` is set; Workers AI otherwise, and `/library` names which.**
Its budget is the honest limit: 5,000 chars per source, 12 sources, 4,000
output tokens. Deeper than that means more calls, not a bigger one. A run
records the document that started it (`research_runs.parent_piece_id`); the
brief is that document's child.

**The operator surface** — `/library` is the working page: upload first, the
documents, each with its receipt and its leads, the answered-questions index
below. `/op/research?q=` is the research workspace: the plan, the sources as
they land, two numbers, the one next action — rendered COMPLETE on the
server, the poller only keeps it current. Sign-in is `/op/login`, inside the
prefix Cloudflare Access protects (`/auth/login` sits outside it and could
never mint a session). `operator/operator-styles.ts` has its own token NAMES
for its thousand lines of console CSS, but every VALUE now resolves to the
publication's palette and the public names are aliased — one product.

**Design** — dark ground, one red accent (`#e0433c`), Archivo + JetBrains
Mono, Newsreader for reading columns. ONE shell width (`--shell`, `--gutter`)
for nav, content and footer; ONE panel treatment; a dashed border only on
`.chip.draft` and `.killed`. `tests/stylesheet-invariants.test.ts` pins all
of it, plus no backtick in the template literal (four separate build breaks,
always inside a CSS comment) and balanced braces. Six superseded design
systems were deleted from `styles.ts` in September 2026 — 500 rules that no
markup referenced; the current system is what remains.

**Looking at it** — `packages/api/scripts/look.mts` serves the real app
against a seeded in-memory D1 (`scripts/fixture.mts`) and screenshots
thirteen pages, including `/library` and the research workspace signed in.
There is no local dev server; this is the fastest way to see a change without
deploying, and it has caught more than the tests have. **If a state cannot
appear in a screenshot, it is not checked** — seed the fixture.

**The archive** — `/op/export` (linked from `/library` as "Download as .zip")
lists the reports as several downloads, and `GET /op/export/research.zip?part=N`
returns one of them: markdown, one `.md` per document plus an `INDEX.md`, each
body untouched under a small front-matter block. **At most 15 documents per
zip, dealt out evenly** (52 reports come out as four zips of 13), because
Claude Design reads about twenty files from a zip and silently drops the rest —
a single 53-file archive arrived as roughly its first twenty with nothing to
say the others were cut. Own uploads only (`OWN_UPLOADS_SQL`), read-only,
behind Access. The reports exist only in the live D1, so this is the one way
to get them out without a request per document. Built by
`lib/research-archive.ts`, which is pure and tested by unzipping its real
output. Parts are stable only while the corpus is: upload something between
two downloads and later parts shift by one, so re-download from the top. Mounted
at `/export/...` and not `/library/export.zip`: the `/library/:slug` redirect is
registered first and would swallow it. A missing or impossible `part` redirects
to the list rather than erroring.

**Probes** — `/v1/admin/runtime`, `/v1/admin/corpus-split`,
`/v1/admin/research-runs` (where every research run stopped, and how many are
waiting for the button). Read-only. Reach them through the admin-probe
workflow; the sandbox cannot.

## Known gaps, stated plainly

- **AI crawlers get through — checked by the operator 2026-09-15.** Cloudflare
  blocks them by default on zones created after July 2025, and a `robots.txt`
  that invites them cannot overrule the edge: with *Block AI Bots* on, they get
  a 403 before the Worker runs and the whole AEO effort is decorative. It is
  off for the canopticon.com zone, so the premise holds. Worth re-checking
  after any zone-settings change, since nothing in the repo would show it
  breaking: `curl -A GPTBot https://canopticon.com/`. **Only the operator can
  run this** — an agent sandbox's egress policy denies canopticon.com, and a
  403 from that proxy looks nothing like a 403 from Cloudflare.
- **Extraction reads at most ~72KB of any document** — `MAX_CHUNKS = 3` in
  **`graph/lib/aeo-extract.ts`**, against `chunkText`'s 24KB default. (This
  file used to credit `digestion-typed.ts`; that module exports a `MAX_CHUNKS`
  too, but nothing imports it, and the real chunker is `digestion.ts` at 3,000
  chars × 32.) Fine for timelines and quotes; don't imply the graph has read a
  whole book.
- **`quotes.byte_offset` is not a document position and must never be used as
  one.** It is measured against whatever string the writer happened to hold:
  a ~3,000-char chunk in `digestion-typed.ts` (the bulk of the corpus, and the
  chunk index is never stored), one of three 24KB chunks in `aeo-extract.ts`,
  and only in `lede.ts` a true prefix of `body_md`. `chunkText` also re-joins
  blocks with `"\n\n"` and carries an 800-char overlap, so a chunk is not even
  a contiguous slice — the offset can be wrong in principle, not merely
  shifted. They are character indices, not bytes. **To find a quote inside a
  document, call `locateVerbatim(body_md, verbatim_text)` at render time**, as
  `public/render/receipts.ts` does. `/q/<id>` used to tell readers the offset
  was "the exact position in the document", and that was false.
- **Email is built but unconfigured.** `lib/email.ts` sends via Resend over
  HTTP (a Worker cannot do SMTP). Signup now sends a confirmation, `/confirm`
  spends the token, and `/v1/admin/announce?slug=…` mails one published piece
  to CONFIRMED subscribers only — dry run unless `&execute=1`, because unlike
  every other endpoint the effect is in other people's inboxes and there is no
  undo. **Nothing sends until `RESEND_API_KEY` is set and the sending domain is
  verified with the provider**; without the key every call returns a stated
  reason and writes nothing, so an unconfigured deploy is inert rather than
  half-working.
- **The graph is real, not scaffolding.** Measured live 2026-09-14:
  **13,075 nodes · 18,774 edges · 6,137 verified quotes · 1,902 assertions**
  over 116 pieces. `docs/archive/canopticon-renovation.md` says it "has never eaten a
  real corpus" and an earlier version of this file repeated that — both are
  out of date. The legacy flat tables (`entities`, `topics`, `claims`) are at
  zero; the typed graph is what carries content.

## The corpus has more than one population — never treat them as one

`pieces` holds several things the schema cannot tell apart. Measured live
2026-09-15, after the purge below:

| `ingested_from` | n | what | publish it? |
|---|---|---|---|
| `feed-upload` | 50 | the operator's own uploaded documents | yes — all published |
| `deep-research` | 6 | the dormant research pipeline's own output — all `working-material` | **no** — unpublished 2026-09-16 |
| `record-expand` | 0 | third-party pages the crawler banked before 2026-09-24 | **never** — purged |

**Since 2026-09-24 the crawler writes `sources` only** (`graph/lib/record-builder.ts`),
rejects bot-challenge and sub-400-character pages at fetch time, and research
runs bank source ids (`research_runs.pass1_source_ids`, migration 0059). It
had not been retired: "Dig here" and the research workspace still reached it,
and every page it fetched became a `pieces` row in `/library`. Any row it left
behind matches `WEB_FETCHED_SQL` and is purged the same way as before.

The `record-expand` group was source material to quote from, never content.
Publishing it would have put Wikipedia articles and copyrighted news text on
canopticon.com as Canopticon's own work under the CC BY 4.0 `/about` asserts
over everything, and bulk duplicated third-party text is what search engines
penalise a whole domain for. **All 60 were deleted on 2026-09-15** (0 nodes
and 0 quotes attached — they had never been digested, so no provenance was
lost). The guard stays: the crawler is retired but unwired, not deleted.

⚠ **`deep-research` is a third population and needs its own guard.** Neither
the operator's uploads nor banked third-party pages, so `OWN_UPLOADS_SQL`
excludes it and `WEB_FETCHED_SQL` does not match it — which is why the purge
and the reslug both correctly stepped around it. Use `DEEP_RESEARCH_SQL`.

Four of the six were published until 2026-09-16 and are now all
`working-material`. They were ~2KB pass-1 summaries of third-party web pages
with no quotes and no receipts, published under a CC BY byline: the weakest
pages on a site whose whole argument is provenance. Two reasons they were thin,
both worth remembering — their sources were Wikipedia and government bio pages,
and pass 2 (the follow-up searches and re-synthesis) only ever ran from the
cron, so with the cron off they were frozen mid-process and published anyway.
Unpublished, not deleted; the rows are intact.

Every query that acts on one population is guarded twice — on `ingested_from`
and on the `web-fetched` tag — via `OWN_UPLOADS_SQL` / `WEB_FETCHED_SQL` in
`admin/runtime.ts`, asserted by `tests/corpus-guards.test.ts`. **Do not write
a new query over `pieces` that publishes or deletes without using them.**

Admin endpoints (probe-reachable, `?confirm=1`):
`/v1/admin/corpus-split` (read-only) · `/v1/admin/publish-uploads` ·
`/v1/admin/purge-web-fetched` (dry run unless `&execute=1`).

⚠ A purge deletes through `nodes`, never `pieces` alone: `nodes.piece_id` has
no foreign key (migration 0027), so deleting a piece does **not** cascade and
would leave its quotes alive but unmoored — a `/q/<id>` receipt with no
document behind it. `purgeTypedGraphForPiece()` is the correct primitive.

## What's next

`docs/HANDOFF.md` is current. In short: merge what is open; press *Process
everything* in `/library` with the tab open; create the AI Gateway with
Unified Billing and set `AI_GATEWAY_ID` / `CLAUDE_MODEL`; then use it —
upload, note passages, follow a bridge, publish a brief — before building
more. "Resurface", the tetrad as a Markdown shape, "New version", narrow
answers for unsourced figures and the sectioned research writer (Claude
only: outline → one section per step → assemble, every quote located
verbatim in a source's full text, the killed count in red) are built; what
is left is use, and the configuration only the operator can do.

---

# COMPARTMENTALIZED — maintained, not grown

Separate systems, each with its own Worker, database and deploy. **Do not
grow them, do not couple them to the publication, and do not treat their
docs as design authority for anything.**

### `packages/studio` — the film engine (studio.canopticon.com)

An editorial film generator: essay in, film out. Real, deployed, and the
largest thing in the repo by recent churn. **Parked, not dead** — the
operator is continuing this work separately, and it costs nothing idle (no
cron, no containers). Its own design authority is
`docs/studio/CANOPTICON_FILM_ENGINE.md`; `docs/studio/archive/` describes a
DELETED engine and binds nothing.

It was the primary product in this file until 2026-09-14. It isn't now. The
honest summary of why: it is a genuinely good engine that was never finished
to the point of being used, and pursuing it kept the publication from
shipping.

### `packages/video` — render surface + reaction tool (video.canopticon.com)

`routes/from-reading.ts` drafts a Record analysis into a video script;
`src/react/*` is a standalone reaction-video tool. Carries a Cloudflare
Container (`standard-4`) for rendering — **on-demand only, nothing schedules
it.** If costs ever spike, check Containers/Durable Objects usage here first.

### `packages/blindspot` — Instruments (blindspot.canopticon.com)

Standalone software side-projects, each judged on its own merits. The Blind
Spot (an inequality-measurement instrument) is the first. Push-button, no
cron, near-zero maintenance.

### Dormant inside `packages/api`

The autonomous-growth machinery — `autonomous-expand.ts`, `deep-research.ts`,
`settle-pipeline.ts`, `watcher.ts`, `profile-generator.ts`, and the
enrichment passes — is unwired and unreachable now the cron is off. It is
kept for reference. **This is the "make the thing build itself" impulse that
stalled the project twice.** Leave it alone.

---

# Stack

- **Runtime**: Cloudflare Workers + **Hono**, TypeScript.
- **Storage**: **D1** (SQLite) · **R2** · **Vectorize** (search).
- **AI**: **Claude via Cloudflare AI Gateway (Unified Billing)** when
  configured, **Workers AI** otherwise — and only at authoring time
  (the pipeline, research), never at render time. (`packages/video` calls MiniMax directly for voice
  cloning with its own key — compartmentalized, not a precedent.)
- **Rendering**: server-rendered HTML by string concatenation. No JSX, no
  React, no client framework, no frontend build step.
- **Migrations**: plain numbered SQL, applied on deploy via
  `wrangler d1 migrations apply`. `supabase/migrations/` (Record),
  `migrations-video/`, `migrations-studio/`. **Legacy tables are never
  dropped** — they are unread, which costs nothing, and dropping them risks
  live data.
- **Host**: Cloudflare, auto-deploy on merge to `main` per-package.

# Dev environment — IMPORTANT

- The operator works in Claude Code on the web, NOT a local IDE.
- **All testing/deployment is LIVE on Cloudflare.** No local dev server, no
  local D1. Merge to `main` → deploys automatically.
- Do NOT suggest `npm run dev`. Verify with:
  ```
  pnpm -r typecheck
  pnpm exec biome check .        # CI runs this WITHOUT --write
  pnpm -r test
  ```
- To SEE a change: `packages/api/scripts/look.mts` (needs
  `pnpm add -D -w playwright` and `CHROMIUM_PATH` pointing at the Chromium
  already on the machine — do not run `playwright install`).
- To inspect the live Record, trigger `.github/workflows/canopticon-admin-probe.yml`
  (workflow_dispatch with a `path`); it calls canopticon.com through Cloudflare
  Access and commits the response to `ops/probe/response.json`.
- Branch convention: `claude/<name>`. Never push to `main` directly; PR + CI +
  squash-merge. Branches are reused across PRs, so a designated branch may
  carry a stale tip with no merge base — archive it before force-pushing.

# Env / bindings

```
Record:  DB (D1 canopticon) · FILES (R2) · EMBEDDINGS (Vectorize) · AI
Studio:  DB (D1 canopticon-studio) · FILES (R2) · AI
Secrets: ANTHROPIC_API_KEY (optional) · RESEND_API_KEY (optional) · CRON_SECRET
         CF_ACCESS_CLIENT_ID · CF_ACCESS_CLIENT_SECRET (admin probe)
         SESSION_SECRET (operator session cookie)
```
