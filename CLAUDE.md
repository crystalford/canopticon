# Canopticon

> **If you are an AI reading this to understand the project: this file is the
> source of truth for what Canopticon *currently is*. Everything in
> `docs/archive/` describes SUPERSEDED systems — do not design against it. The
> current vision spec is `docs/canonical-spec-v2.6.md`; the version lineage is
> `docs/LINEAGE.md`; the current built architecture is below.**

## What it is

A **forensic intelligence publication system**. One operator feeds it research
documents. The system reads them into a typed graph of facts, grows a citable
public wiki from that graph, drafts signed interpretive readings on top of the
facts, and the operator approves. **The operator approves; the operator never
authors.**

- **Domain**: canopticon.com · **Twitter**: @canoptics
- **GitHub**: crystalford/canopticon

## The fabric (the core mental model)

One body of content, four grains. Everything below the pages is plumbing;
everything at the pages is product.

```
DOCUMENTS  (research reports, essays, primary sources — the operator drops these; IN)
   ↓ extract (cheap model · idempotent · verbatim spans only)
FACTS — the typed graph
   • 7 node kinds: entity · attribute · event · neutral_fact · assertion · source · theme
   • 6 edge families: aboutness · relationship · temporal · causal · evidential · attribution
   • the FIREWALL lives here: an assertion is never silently a fact; contested is stored as contested
   ↓ compose (automatic, on corpus settle)
SUBJECTS & THEMES → PAGES
   • every subject (entity | event | theme) is ONE page in TWO modes:
       neutral  = the wiki (facts + receipts, contested shown gray, timeline, connections)
       signed   = the operator's reading (thesis + the SAME facts re-sequenced + mandatory complicating box)
   • a theme = a "received account the corpus engages with" — surfaced when 3+ docs converge on contradicting it
   ↓ reshape (selection, not regeneration — partly built)
TRANSFORMS  (thread · video script · card · chapter — Studio)
```

The investigation is **not** a separate object — it is the same page with a
thesis pulling the facts into order.

## Stack (CURRENT — not the old Next.js/Vercel/Postgres stack)

- **Runtime**: Cloudflare Workers + **Hono**. One Worker serves `/` (public),
  `/op/*` (operator console), `/v1/*` (API + admin).
- **Rendering**: server-rendered HTML via **string concatenation**. No JSX, no
  React, no client framework. No JS required to read any public page.
- **Storage**: **D1** (SQLite) relational · **R2** (raw docs + extracted-text
  overflow) · **Vectorize** (embeddings). Content-hash dedup on upload.
- **AI**: **Workers AI** via a per-role router (`packages/api/src/llm/router.ts`)
  — roles not model names. Anthropic is an optional near-launch top tier.
- **Migrations**: `supabase/migrations/NNNN_*.sql`, applied on deploy via
  `wrangler d1 migrations apply`. (Supabase = migration tooling only; the live
  DB is D1, not Postgres.)
- **Host**: Cloudflare, **auto-deploys on push/merge to `main`** (the
  "Deploy to Cloudflare" GitHub Action). CI is `.github/workflows/ci.yml`.

## Dev environment — IMPORTANT

- The operator works in Claude Code on the web, NOT a local IDE.
- **All testing/deployment is LIVE on Cloudflare.** No local dev server, no
  local D1. Merge to `main` → deploys automatically.
- To inspect or drive the LIVE system, use the **admin probe**: trigger
  `.github/workflows/canopticon-admin-probe.yml` (workflow_dispatch with a
  `path`); it calls canopticon.com through Cloudflare Access and commits the
  response to `ops/probe/response.json`. Useful endpoints: `/v1/admin/runtime`,
  `/v1/admin/health`, `/v1/admin/debug-model`, `/v1/admin/reextract?confirm=1`,
  `/v1/admin/reset-graph?confirm=1`.
- Do NOT suggest `npm run dev`. Verify with `pnpm --filter @canopticon/api
  exec tsc --noEmit`, `pnpm exec biome check packages/api/src`, and
  `pnpm --filter @canopticon/api exec vitest run`. **CI runs `biome check`
  WITHOUT `--write`** — fix lint before pushing (e.g. no-template-literal on
  non-interpolated strings).
- Branch convention: `claude/<name>`. Never push to `main` directly; PR + CI +
  squash-merge.

## Surfaces

### Operator console (`/op/*`) — no destination list anymore
"One site, permission layers" (spec v2.5 Part 9): operating Canopticon means
logging in and browsing the *public* site — the same pages grow affordances
(sign/edit/discard on a subject page, Extract buttons in Library, a
work-status badge and a `citations`/`how this works` link spliced into the
nav) rather than visiting a separate dashboard. `operator/layout.ts`'s
`OP_NAV` rail is deliberately empty; there is no IN/OUT/Studio list to click
through anymore — the redirects that used to send those clicks back to the
public site are gone because the rail that pointed at them is gone.

Genuinely reachable under `/op/*` today: `/op/design` (an unlinked, throwaway
prototype), `/op/studio/:id` (a per-project Studio workspace, reached from a
signed subject page's "Produce" button, not from a list), `/op/out/:id/edit`
and `/op/outputs/:id/edit` (edit forms, reached contextually), and the
POST-only action endpoints (`/op/records/:slug/expand`, `/op/library/extract`,
`/op/out/:id/sign`, `/op/outputs/:id/build`, etc.) that the public-side
operator affordances submit to. `⌘K` opens a command palette with the small
set of destinations that still do something distinct: Library,
Investigations, Citations, re-surface synthesis, the public site.

### Public site
- **Home** (`/`): live fabric activity feed — hero (the open file) → depth
  stats → active files (what grew) → latest evidence → a short "browse the
  record" teaser. Operator overlays (briefing, drafts awaiting signature,
  findings, threads) weave into the same page when logged in.
- **Subject pages** (`/s/:slug`, with `/p/:slug` fallthrough): the unified
  renderer. `?mode=signed` reveals the reading. Neutral mode emits schema.org
  JSON-LD + stable block anchors.
- **Investigations** (`/investigations`): signed readings only, intent
  badges + `?intent=` filters. (The older `briefs` publishing pipeline that
  used to also list here is sunset — see `graph/lib/settle-pipeline.ts`;
  already-published briefs still resolve individually at `/briefs/:slug`.)
- **Topics** (`/topics`): the canonical full browsable index (Themes /
  People / Companies & other / Events) — the stable, grouped counterpart to
  Home's short recency teaser.
- **Library** (`/library`, `/library/:slug`): source documents, public by
  default; each shows "what it fed the fabric". Reachable from the footer
  and every receipt, not top nav — sources are evidence, not a nav pillar.
- `/record` → 301 `/`, `/patterns` → 301 `/investigations`, `/sources` → 301
  `/library`.

## Key files
- `packages/api/src/index.ts` — Worker entry, cron.
- `packages/api/src/llm/router.ts` — model router (roles → models).
- `packages/api/src/graph/lib/digestion.ts` + `digestion-typed.ts` — extraction
  into the typed graph (resumable, batched, verbatim-checked quotes).
- `packages/api/src/graph/lib/digest-jobs.ts` — durable job queue + the
  **corpus-settle gate** (entity/event dedup → surfacing L1 → themes →
  autoseed pages → draft readings — see `settle-pipeline.ts`).
- `packages/api/src/graph/lib/theme-surfacer.ts` · `surfacing.ts` ·
  `draft-reading.ts` · `autoseed-pages.ts`.
- `packages/api/src/public/render/subject-page.ts` — unified subject page.
- `packages/api/src/operator/screens/out-stream.ts` — the sign/edit/discard
  logic behind a drafted reading; its own GET screen is redirect-shadowed
  (see Surfaces above), the actions it backs are live via
  `operator/routes.ts`.
- `supabase/migrations/` — typed graph (0026), piece_id index (0027), output
  layers (0029), themes+pages (0030).

## The rules that survived every rebuild
- **The operator approves, never authors.**
- **Upload is authorization.** No confirmation gauntlets.
- **Verification is mechanical, not vouched.** Every published claim's quote is
  a literal substring of a real stored source, independently judged; failures
  are killed, visibly.
- **The firewall.** An attributed assertion is never silently a neutral fact.
  A signed reading must show the facts that complicate it.
- **Repetition is not significance.** Surfacing runs on structure and stance.
- **Simplicity above all.** Prior iterations failed from over-engineering.

## Env / bindings
```
Bindings: DB (D1) · FILES (R2) · EMBEDDINGS (Vectorize) · AI (Workers AI)
Secrets:  ANTHROPIC_API_KEY (optional) · CRON_SECRET
          CF_ACCESS_CLIENT_ID · CF_ACCESS_CLIENT_SECRET (admin probe)
          SESSION_SECRET (operator session cookie — set this when the
                          one-site permission model lands)
```

## Operator setup post-merge — do these once after the one-site PR deploys

1. **Set the session secret.** Any long random string; the Worker uses it
   to sign the operator's session cookie.
   ```
   wrangler secret put SESSION_SECRET
   ```
2. **Configure Cloudflare Access on `/auth/*`.** Add `/auth/*` to the
   same Access application that already gates `/op/*`. The Worker reads
   the JWT Access adds to the request to mint the session cookie.
3. **Visit `https://canopticon.com/auth/login` once.** Access challenges,
   the Worker drops the `canopticon_op` cookie, every public URL
   recognises you from then on. Logout: `/auth/logout`.

Until those land, the public site continues to serve anonymous viewers
correctly (no regression); the operator just sees the public view of
every page.
