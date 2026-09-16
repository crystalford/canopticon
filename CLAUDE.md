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

# THE PRIMARY PRODUCT — the publication

**Document in, published page out.** Drop a `.md`, `.txt`, `.pdf` or `.zip`
on `/library` and it is live at `/p/<slug>` — upload *is* publication, with
no draft step and no approval gauntlet. Two kinds of thing get published and
nothing else:

- **Research** — a primary document, kept whole and published as itself
  rather than summarised away. Indexed at `/research`.
- **Essays** — arguments written to the convention below. Indexed at `/essays`.

```
UPLOAD  ──▶  extract  ──▶  pieces row (published)  ──▶  /p/<slug>
                                   │
                                   ├──▶  /p/<slug>.md      the plain-text twin
                                   ├──▶  JSON-LD            Article / DigitalDocument / FAQPage
                                   ├──▶  /sitemap.xml · /llms.txt · /feed.json
                                   └──▶  /q/<id>            verified quote receipts
```

**The goal is citability.** Not traffic for its own sake — being quotable,
by people and by answer engines, with the provenance intact. That is the one
thing this publication can do that a Substack cannot, and every design
decision should be read against it.

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
2. **Upload is authorization.** The operator approves by uploading; there are
   no confirmation gauntlets and no draft→publish rail for documents.
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
(the shell: head, OG/canonical, nav, footer, mailing-list form) ·
`public/machine.ts` (JSON-LD, the `.md` twin, APA/BibTeX, llms.txt, feed) ·
`public/data.ts` (all piece queries) · `public/styles.ts` (one stylesheet,
served at `/styles.css`) · `public/render/` (`indexes.ts`, `about.ts`,
`piece-template.ts`, `quote-receipt.ts`, `search.ts`, `arrangements/timeline.ts`).

**Ingest** — `operator/routes.ts`'s `createAndExtract()` is the spine:
SHA-256 dedup → R2 → `uploaded_files` → `extract.ts` → a published `pieces`
row. `graph/lib/digestion-typed.ts` pulls verified quotes and typed nodes out
of the text.

**Design** — dark ground, one red accent (`#e0433c`), Archivo + JetBrains
Mono, Newsreader for reading columns. Component vocabulary lives in
`styles.ts` under "v3 — THE PUBLICATION".

**Looking at it** — `packages/api/scripts/look.mts` serves the real app
against a seeded in-memory D1 and screenshots six pages. There is no local
dev server; this is the fastest way to see a change without deploying.

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
- **Extraction reads at most ~72KB of any document** (`MAX_CHUNKS = 3` in
  `digestion-typed.ts`). Fine for timelines and quotes; don't imply the graph
  has read a whole book.
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
  over 116 pieces. `docs/canopticon-renovation.md` says it "has never eaten a
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
| `record-expand` | 0 | third-party pages a retired crawler banked | **never** — purged |

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

1. Upload real documents and write real essays. Everything else is downstream
   of whether that is pleasant.
2. **Arrangement routes: deliberately deferred, with the reason measured.**
   The plan was to retire the ~11 unlinked ones and shrink `subject-page.ts`
   (2,400 lines). Two findings say not yet, and not urgently:
   - **They are not unlinked any more.** 8 of the 13 now have inbound links
     from `subject-page.ts`, which fixed the "see standalone" embeds. The
     stated precondition — once nothing links to them — is not met.
   - **The crawl exposure is nil.** The worry was that `/s/:slug` subject
     pages are in the sitemap (the query allows 5,000) and link out to every
     arrangement, putting thin auto-generated pages in front of crawlers.
     Measured 2026-09-16: the sitemap is **56 URLs — 50 documents, 5 static
     pages, and exactly one subject page**. One. Nothing else is announced,
     so the scaled-content risk this was meant to avert does not exist.
   What is left is code hygiene on a file nothing points at. Worth doing when
   the graph is next touched; not worth a large deletion to tick a box.
3. Then measure: `/citations` already logs GPTBot, ClaudeBot and
   PerplexityBot hits, so whether any of this worked is answerable.

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
- **AI**: **Workers AI** only, and only at authoring time (extraction, TTS),
  never at render time. (`packages/video` calls MiniMax directly for voice
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
