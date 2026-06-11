# Canopticon

> **If you are an AI reading this to understand the project: this file is the
> source of truth for what Canopticon *currently is*. Everything in
> `docs/archive/` describes SUPERSEDED systems — do not design against it. The
> current vision spec is `docs/canonical-spec-v2.4.md`; the version lineage is
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
TRANSFORMS  (thread · video script · meme · chapter — Studio)
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

### Operator console (`/op/*`) — three destinations
- **IN** (`/op/library`): drop documents + the archive + per-row Extract. `/op`
  redirects to OUT.
- **OUT** (`/op/out`, the home): the single editorial stream — morning brief →
  *awaiting your signature* (drafted readings: sign/edit/discard) → *the wiki
  grew* → *worth your attention* (≤4 findings, substance gate) → *still chasing*
  (inquiry threads) → silence line. `/op/out/refresh` re-runs the settle
  pipeline (cheap steps inline, LLM steps in `waitUntil`).
- **Studio** (`/op/studio`): rich-media transforms (Stage 1 scripts).
- *Synthesis + Outputs routes still exist for deep oversight but are OFF the
  rail — folded into OUT.*

### Public site
- **Home** (`/`): live fabric activity feed.
- **Subject pages** (`/s/:slug`, with `/p/:slug` fallthrough): the unified
  renderer. `?mode=signed` reveals the reading. Neutral mode emits schema.org
  JSON-LD + stable block anchors.
- **Investigations** (`/investigations`): signed readings + outputs, intent
  badges + `?intent=` filters.
- **Topics** (`/topics`): the browsable doorway (Themes / Entities / Events).
- **Library** (`/library`, `/library/:slug`): source documents, public by
  default; each shows "what it fed the fabric".
- `/record` → 301 `/topics`, `/patterns` → 301 `/investigations`.

## Key files
- `packages/api/src/index.ts` — Worker entry, cron.
- `packages/api/src/llm/router.ts` — model router (roles → models).
- `packages/api/src/graph/lib/digestion.ts` + `digestion-typed.ts` — extraction
  into the typed graph (resumable, batched, verbatim-checked quotes).
- `packages/api/src/graph/lib/digest-jobs.ts` — durable job queue + the
  **corpus-settle gate** (surfacing L1 → themes → autoseed pages → proposer →
  draft readings).
- `packages/api/src/graph/lib/theme-surfacer.ts` · `surfacing.ts` ·
  `draft-reading.ts` · `autoseed-pages.ts`.
- `packages/api/src/public/render/subject-page.ts` — unified subject page.
- `packages/api/src/operator/screens/out-stream.ts` — the OUT stream.
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
