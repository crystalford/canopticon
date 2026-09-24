# Handoff — where the record is, and what to do next

> For the next session (the operator is moving from a cloud session back to
> regular Claude Code). Read this, then `docs/the-record.md`, then `CLAUDE.md`.
> Last updated 2026-09-24. Every claim here was true at the commit that
> carries it; check `git log` for what landed after.

## The one-paragraph state

The product is defined in `docs/the-record.md`: **a research record that
compounds — a mind you can cite.** Upload → published + processed → what it
connected to and raised → research → publish, each brief a child of the
document that raised it. Five PRs were planned there (§10). **PR 1 and PR 2
are merged; PR 3, PR 4 and PR 5 are complete and ride the same open PR
(#181) as PR 2**, because the session's budget did not allow waiting for a
merge between them. Check whether #181 has merged. All five PRs of
`docs/the-record.md` §10 are built, and so is most of what was listed
"after PR 5" (the section below). What remains is use and configuration.

## What is merged and live

- **PR 1 (#180) — Clean the ground.** Graph-era routes unmounted (all 301);
  the crawler writes `sources` only and rejects bot-challenge pages; the
  library lists only the operator's material; PDF/DOCX via `toMarkdown`;
  **Claude through Cloudflare AI Gateway Unified Billing** as a transport
  (`llm/claude-gateway.ts`), preferred for every judgement role when
  `AI_GATEWAY_ID` is set, Workers AI otherwise — and the library header
  names which. The five leftover web-fetched rows were purged live.
- **PR 2 (#181) — One pipeline.** `graph/lib/processing.ts`: one state
  machine per document, `title → digest(i/n) → findings → passage → section
  → done`, one step per `POST /op/process/advance`, pressed by `/library`'s
  poller (`public/render/process-live.ts`) while the tab is open. One status
  per row; Re-process; Retry; auto-title with "Put it back"; the lead
  passage auto-approved. Migration 0060.

## What PR 3 contains (complete — on #181)

Migration 0061 (`pieces.parent_piece_id`, `pieces.origin`, `research_runs.
parent_piece_id/origin_kind`, table `readings`). Then, built in parallel:

- **Bridges** (§5b) — `graph/lib/leads.ts` `bridgeLeads`: a subject shared
  by two documents filed under different sections; buttons *Research* and
  *Has anyone said this?* (both `POST /op/leads/dig` with `kind=bridge`).
- **What the record wants** — the corpus-wide worklist on `/library`.
- **Consolidation summary** — `graph/lib/consolidation.ts`: per processed
  row, "Linked to N · N contradictions · N bridges · N questions".
- **Readings** (§5c) — `lib/readings.ts`; `POST /op/readings`; "Note this"
  on `/p/` for the operator (`/op/notes.js`); rendered on the page, signed;
  "Read by the operator" mark; JSON-LD `Comment`.
- **Lineage on the page** — Grew from / Grew into (`lineageForPiece`).
- **Related by subject** — replaces the recency list (`relatedBySubject`).
- **Model-drafted essay, clearly labelled** — `POST /op/readings/:id/draft-essay`
  returns a `.md` whose first lines say which model drafted it from which
  reading; nothing is stored; the operator edits and uploads. The operator
  chose this over "no model writes prose": the label is the rule.
- **Ask the record** — verified quotes are embedded (`kind: "quote"`) by a
  new pipeline step `index`; `/search` returns passages with receipts first.

All of the above is in the tree and tested (749 tests at the last run). Known small
leftovers for PR 3's follow-up: readings render as a block after the body
rather than in the margin beside the passage; "Note this" takes the
selection from rendered HTML, so a selection crossing a spliced link can fail
the verbatim check (the form shows the error); the consolidation summary is
not yet shown as a banner right after an upload, only on the row.

## What only the operator can do

1. **Cloudflare dashboard → AI → AI Gateway:** create a gateway, enable
   Unified Billing, load credits; set `AI_GATEWAY_ID` and `CLAUDE_MODEL`
   (the exact `anthropic/...` name the gateway lists) in
   `packages/api/wrangler.toml` `[vars]`. Until then everything runs on
   Workers AI and `/library` says so in red.
2. **Process the corpus:** `/library` → Maintenance → *Process everything*,
   tab open. 52 documents; each walks its steps. Re-process after the
   gateway is set if the first pass ran on Workers AI.
3. **Merge PRs.** CI + squash-merge. A failed deploy on "Run D1 migrations"
   with "D1 DB exceeded its CPU time limit" is a shared-budget hiccup:
   re-run the failed job.

## What PR 4 and PR 5 contain (complete — on #181)

- **PR 4 — Findable (NEO).** Section hubs `/research/<section>` (eight, in
  the sitemap and llms.txt when they hold a document); key figures above the
  body as a table; JSON-LD BreadcrumbList, Organization, WebSite +
  SearchAction, Person author, `isBasedOn` lineage; `/llms-full.txt`;
  IndexNow on publish (`lib/indexnow.ts`, inert without `INDEXNOW_KEY`); a
  share card per document drawn by the pipeline's `og` step through
  Cloudflare Browser Rendering into R2 (`/og/<slug>.png`; inert until
  `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` are set); the Cloudflare
  Web Analytics beacon when `CF_WEB_ANALYTICS_TOKEN` is set. Not done: a
  Lighthouse pass in `look.mts`.
- **PR 5 — One design, and say what is true.** Tokens on a scale in both
  stylesheets (`--t-1..6`, `--s-1..8`, `--r`, `--r-lg`, `--st-*`), pinned by
  `tests/stylesheet-invariants.test.ts`; the reading page at a 68ch measure;
  one `.btn`; the workbench with a left rail (Upload · Documents · Worklist ·
  Research) that becomes tabs on a phone. `/about`, `/method` and
  `CLAUDE.md`'s product sections rewritten from `docs/the-record.md`.

## What the second swing added (complete — on #181, 2026-09-24)

- **The document is the workbench.** On `/p/` the operator sees an action
  bar: the page's own leads as buttons, a free question box (`#op-ask`),
  and "Research this" beside "Note this" on any selected passage. Every one
  is `POST /op/leads/dig` with `piece_id`, so the brief is this document's
  child.
- **New version** — `POST /op/library/:id/replace` (a `New version` control
  on each library row). Same slug; body, kind and metadata replaced; the
  graph purged and the pipeline restarted; readings re-anchored by
  `locateVerbatim` against the new body and the count that could not be
  found reported in the redirect (`?replaced=1&readings_lost=N`). An
  identical file is refused before anything is written. Quote and reading
  ids change, so an old `/q/` for a reading's passage 404s — inherent.
- **Resurfaced today** — `lib/resurface.ts`: one verified passage (≥160
  chars) from a processed document with no reading in 14 days, chosen by a
  per-day hash so it is the same all day; rendered above the worklist with
  Note this / Research this. Nothing when there is nothing.
- **Narrow answers for unsourced figures** — `answerUnsourcedFigure` in
  `graph/lib/answer-lead.ts`: the dig route sends `kind=unsourced-figure`
  here. At most three pages fetched (through `expandRecord`, into `sources`
  only), three sentences on who published the figure, where and when, quotes
  verified against the fetched page, the page linked from the answer. Needs
  `BRAVE_SEARCH_API_KEY`; says so when unset. Stored in `lead_answers` like
  a settled contradiction; the source ids ride on the quotes.
- **The tetrad as a Markdown shape** — `looksLikeTetrad` / `parseTetrad` in
  `lib/essay.ts`: exactly the four `##` headings (enhances, obsolesces,
  retrieves, reverses / reverses into / flips into), any order, `## Sources`
  allowed. Classified at upload (`metadata.classification = "tetrad"`, kind
  essay), rendered as a 2×2 grid with anchored quadrants, JSON-LD `about` +
  `hasPart`, no FAQ markup. The grid styling is inline in
  `piece-template.ts`; move it to `styles.ts` if it grows.
- **The sectioned research writer** — migration 0062 (`research_runs.
  outline`, `sections_done`, `mode`). `decideResearchMode` picks `sectioned`
  when the writer is Claude, `single` (the old one-call brief) on Workers
  AI. Sectioned: `outline_pending` (one call over every banked source) →
  `section_pending` (one section per step, its own sources at 20,000 chars
  each, 2–5 quotes each located verbatim in a source's full text, the
  model's attribution not trusted, failures killed and counted) →
  `assemble_pending` (title, a summary that adds nothing, the gaps) → `done`.
  The workspace shows the outline as a checklist with the killed count in
  red; the poller's auto-press budget is 14 so a whole run walks while the
  tab is open. The brief's metadata carries `mode`, `sections`, `quotes_ok`,
  `quotes_killed`.
- **The graph era's code is gone** — 52 files nothing imported (arrangements,
  subject pages, records, briefs, faces, studio-produce, outputs/studio
  screens, the command palette, autonomous-expand, face-renderer, meme-draft,
  lighthouse and four admin handlers). `settle-pipeline.ts` and its subtree
  stay because `digest-jobs.ts` and the (disabled) scheduled handler import
  them; `operator/screens/design-mock.ts` has no importer and is a safe
  one-line deletion. Leftover `.cmdk-*` CSS in both stylesheets can go too.

## What the third swing added (complete — on #181, 2026-09-24)

- **Ask the record** — `graph/lib/answer-question.ts`: a question on
  `/search` answered from the corpus's own verified passages (top 8 by
  Vectorize, four documents read around the hits, one writer call, every
  quote located verbatim, the failed count in red). Stored in
  `lead_answers` with `kind="question"` and shown to every reader above the
  passages; `nothing_found` renders "The record does not settle this."
  `POST /op/ask` (field `q`, optional `writer=anthropic`) for the operator,
  beside "Research this on the web". No poller: `?asked=1` says "reload".
- **Readings in the margin** — `public/render/margin-readings.ts`: each
  reading is an `<aside class="reading">` after the block that holds its
  passage (grid column ≥1180px, inline below). Unfound passages fall back to
  the after-body block with a red line. JSON-LD Comments unchanged.
- **Post-upload banner** — upload redirects carry `?uploaded=<ids>` (≤5);
  `/library` opens on "Just uploaded": link, step, and once done the
  consolidation line and the row's leads. `process-live.ts` repaints every
  cell for a piece, not the first.
- **The brief reviewed on one screen** — a done run's workspace shows
  `review`: parent document, question, sections with verified/killed, body
  at a reading measure, gaps, a red warning when killed > verified, and
  "Publish to the record" (the existing `POST /op/library/research/:id/publish`)
  or `GET /op/library/research/:id/brief.md` (labelled download). The old
  `/op/library/research/:id/review` page is unlinked but still mounted.
- **Draft a tetrad (labelled)** — `graph/lib/draft-tetrad.ts`,
  `POST /op/pieces/:id/draft-tetrad`: one writer call over the lead passage
  and up to 12 verified passages; checked with `parseTetrad`; every
  quotation over 40 chars checked with `locateVerbatim` and marked ⚠ when
  not found; label lines are HTML comments so the file still parses.
- **Opened signal** — migration 0063 `pieces.last_opened_at`, written after
  the operator renders `/p/`; `resurfacePassage` orders by
  `COALESCE(last_opened_at, updated_at)`.
- `design-mock.ts` and the `.cmdk-*` CSS are gone. `look.mts` now takes 18
  shots including the signed-in document page, the upload banner and the
  review panel.

## More the operator can configure (all optional, all inert until set)

- `INDEXNOW_KEY` (Worker secret, `openssl rand -hex 16`); then
  `https://canopticon.com/<key>.txt` serves it.
- `CLOUDFLARE_ACCOUNT_ID` in `[vars]` + `CLOUDFLARE_API_TOKEN` secret with
  Browser Rendering Edit — share cards (≈$0.005 each). Re-process to draw
  cards for documents already processed.
- `CF_WEB_ANALYTICS_TOKEN` in `[vars]` from Analytics & Logs → Web Analytics.
- `BRAVE_SEARCH_API_KEY` (secret) — research runs and the narrow answer for
  an unsourced figure both search through it; without it both say so.

## What is next

- **Use it** (`CLAUDE.md` "What's next"): process the corpus; note passages;
  follow a bridge with "Has anyone said this?"; publish a brief; open a
  model-drafted essay from a reading and rewrite it.
- **Then, only if use asks for it:** a Lighthouse pass in `look.mts`
  (the sandbox has no Lighthouse; `look.mts` already fails on page errors
  and horizontal overflow); the margin column is 148px at the shell width,
  so long notes run tall — widen the shell or truncate with a receipt link
  if real notes are long; the review panel's warning and published states
  are unit-tested, not photographed; a seeded `lead_answers` row with
  `kind="question"` so the search answer is screenshotted.
- **Housekeeping:** old PRs #165, #128, #117 are superseded (the #117 fix is
  in `cost/approve.ts`) and can be closed.

## How to verify anything

```
pnpm -r typecheck
pnpm exec biome check .          # CI runs this WITHOUT --write
pnpm -r test
# to SEE it (do not run `playwright install`):
pnpm add -D -w playwright && cd packages/api && \
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  pnpm exec tsx scripts/look.mts /tmp/look && git checkout package.json pnpm-lock.yaml
```
Live state: trigger `.github/workflows/canopticon-admin-probe.yml` with a
path (`/v1/admin/corpus-split`, `/v1/admin/runtime`, `/p/<slug>.md`, …);
the response lands in `ops/probe/response.json` on `main`.

## Things worth knowing that are not written anywhere else

- The McLuhan–allostasis bridge is at `/p/research-pass-medium-becomes-ground-evidence-map-seven-theoretical`, §2. That document names six more novel syntheses. It is the worked example for bridges.
- `quotes.byte_offset` is not a document position (CLAUDE.md says why); always `locateVerbatim` at render time.
- The playwright install for `look.mts` must never be committed — `look.mts`'s header says why.
- The stop hook nags about uncommitted files; commit in coherent units, never an agent's half-finished file.
