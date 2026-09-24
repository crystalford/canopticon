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
`docs/the-record.md` §10 are built; what remains is use, configuration, and
the "after PR 5" list below.

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

All of the above is in the tree and tested (674 tests). Known small
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

## More the operator can configure (all optional, all inert until set)

- `INDEXNOW_KEY` (Worker secret, `openssl rand -hex 16`); then
  `https://canopticon.com/<key>.txt` serves it.
- `CLOUDFLARE_ACCOUNT_ID` in `[vars]` + `CLOUDFLARE_API_TOKEN` secret with
  Browser Rendering Edit — share cards (≈$0.005 each). Re-process to draw
  cards for documents already processed.
- `CF_WEB_ANALYTICS_TOKEN` in `[vars]` from Analytics & Logs → Web Analytics.

## What is next

- **Use it** (`CLAUDE.md` "What's next"): process the corpus; note passages;
  follow a bridge with "Has anyone said this?"; publish a brief; open a
  model-drafted essay from a reading and rewrite it.
- **Then, only if use asks for it:** "Resurface" (a passage not seen in N
  weeks, with Note this / Research this); the tetrad as a Markdown shape;
  readings placed in the margin beside their passage; a post-upload
  consolidation banner; a Lighthouse pass in `look.mts`; the sectioned
  research writer after real runs have been judged.
- **Housekeeping:** the graph-era renderers are unmounted but still in the
  tree (`public/render/arrangements`, `subject-page.ts`, `record.ts`,
  `brief.ts`, `faces`, the operator `screens/outputs|studio`) — delete once
  nothing imports them. Old PRs #165, #128, #117 are stale and can be
  closed.

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
