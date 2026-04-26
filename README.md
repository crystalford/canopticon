# CANOPTICON

Forensic intelligence platform for Canadian political and economic
structure. Operator declares theses, AI agents research and verify
supporting claims, the substrate tracks predictions and contradictions
over time. Public site exposes published theses, the prediction
ledger with rolling Brier, contradictions, and findings rated by
novelty + pattern type.

The architecture spec lives in [`docs/`](docs/). Start with
[`docs/canopticon-build-handoff-v1.0.md`](docs/canopticon-build-handoff-v1.0.md)
— its §17 indexes which reference doc answers which question.

- **Web** — Next.js 15 App Router on Cloudflare Pages
  (`packages/web` — operator UI + public site under route groups)
- **API** — Hono router on Cloudflare Workers (`packages/api` —
  19 route groups, cascade orchestrator, cost gate, SSE feed)
- **Database** — Supabase Postgres with RLS on every table
  (18 migrations, 37+ tables)
- **AI** — Anthropic Claude Opus 4.7 (13 analytical roles)

## Architecture

```
                       ┌──────────────────┐
                       │  Cloudflare Pages │  packages/web
                       │  - operator UI    │  Next.js 15, edge runtime
                       │  - public site    │
                       └──────────┬────────┘
                                  │ NEXT_PUBLIC_API_BASE_URL
                                  ▼
              ┌──────────────────────────────────┐
              │       Cloudflare Workers          │  packages/api
              │       Hono router                 │  19 route groups
              │       cascade orchestrator        │  cost gate
              │       SSE event feed              │
              └────┬──────────────┬──────────────┘
                   │              │
                   ▼              ▼
       ┌────────────────┐   ┌──────────────────┐
       │   Supabase     │   │   Anthropic API   │
       │   Postgres     │   │   13 roles        │
       │   RLS / Auth   │   │   Citations API   │
       └────────────────┘   └──────────────────┘
```

## Prerequisites

- Node 22+
- pnpm 10.33.0+
- Supabase CLI (for `supabase db push`)
- Wrangler 3+ (Cloudflare CLI)
- Accounts: Supabase, Anthropic, Cloudflare

## Bring-up

The order matters. Doing it in any other order causes preventable
mistakes (env vars referencing services that don't exist yet, the
sync-skills step failing before role_definitions are seeded, etc).

### 1. Clone + install

```sh
git clone https://github.com/crystalford/canopticon
cd canopticon
pnpm install
pnpm typecheck     # verifies all three packages compile
pnpm test          # 92 tests across api + shared
```

### 2. Supabase

Create a new Supabase project. Copy down four values from
**Settings → API**:

- `SUPABASE_URL`              (Project URL)
- `SUPABASE_ANON_KEY`          (Project API keys → anon public)
- `SUPABASE_SERVICE_ROLE_KEY`  (Project API keys → service_role)
- `SUPABASE_JWT_SECRET`        (Settings → API → JWT Settings)

Apply the 18 migrations:

```sh
supabase link --project-ref <your-project-ref>
supabase db push
```

After this you should see 37+ tables in the `public` schema.

### 3. Anthropic

Get an API key from <https://console.anthropic.com/>. Save it as
`ANTHROPIC_API_KEY`.

### 4. API on Cloudflare Workers

Set Worker secrets and deploy:

```sh
cd packages/api
wrangler login

wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_JWT_SECRET
wrangler secret put ANTHROPIC_API_KEY

wrangler deploy
```

Note the deployed Worker URL (e.g.
`https://canopticon-api.your-subdomain.workers.dev`). You'll set this
as `NEXT_PUBLIC_API_BASE_URL` for the web package.

### 5. Push skill prompts into role_definitions

The migration seeds `role_definitions` rows with `prompt_template =
'<see SKILL.md>'` as a placeholder. **Until you run sync-skills,
every Claude call will go out with that placeholder.**

```sh
SUPABASE_URL=<your-url> \
SUPABASE_SERVICE_ROLE_KEY=<your-service-key> \
pnpm sync-skills
```

Expect "✓ <role_name> → 1 row(s) updated" for each of the 13 roles.
Re-run any time you edit a SKILL.md prompt.

### 6. Web on Cloudflare Pages

In the Cloudflare dashboard:

1. **Pages → Create project → Connect to Git**, pick this repo.
2. **Build settings**:
   - Framework preset: None
   - Build command:
     `cd packages/web && pnpm install --frozen-lockfile && pnpm pages:build`
   - Build output directory: `packages/web/.vercel/output/static`
   - Root directory: leave blank
3. **Environment variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_BASE_URL`
4. **Settings → Functions → Compatibility flags**: add
   `nodejs_compat` for both Production and Preview.

Trigger a deploy. Or from the terminal:

```sh
cd packages/web
pnpm pages:build
pnpm pages:deploy
```

### 7. First sign-in

Visit your Pages URL → you'll be redirected to `/sign-in`. Enter
your email, click the magic link in your inbox. You'll land on
`/home`.

The signup trigger in migration `0012` automatically creates a
`public.users` row and seeds your `role_definitions` (which
sync-skills then updates on the next run).

### 8. Smoke test

Verify the bring-up worked:

```sh
SUPABASE_URL=<your-url> \
SUPABASE_SERVICE_ROLE_KEY=<your-service-key> \
pnpm smoke
```

Walks the substrate (tables exist, role_definitions populated with
real prompts not placeholders, RLS policies declared, enums match)
without spending Anthropic credits. Any failure is something to fix
before you start using the system.

## Local development

```sh
# API (Wrangler dev server on :8787)
pnpm dev:api

# Web (Next dev server on :3000), pointed at your local API
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787 pnpm dev:web
```

Local secrets go in `packages/api/.dev.vars` (git-ignored):

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
ANTHROPIC_API_KEY=...
```

## The operator loop

1. **Research** (`/research`) — type a research topic. The research
   agent runs Claude with web search + fetch + substrate-write tools
   and registers candidate sources.
2. **Sources** (`/sources`) — review the Critic's report on each
   source; promote `critic_completed` → `approved`.
3. **Cascade** runs automatically (cron, every 6h) or manually via
   `/v1/cascade/run`. Walks: critic → claim_extraction →
   entity_resolver → verifier → interrogator → gap_surfacer →
   assumption_audit.
4. **Studio** (`/studio`) — declare a thesis. Use the integrate
   panel to attach claims at one of four layers (factual, framing,
   architectural, distributive).
5. **Surface gaps / surface findings** from `/studio/[id]`. Findings
   land as drafts; questions land in the Questions panel.
6. **Predictions** — declare with a probability. Premortem fires
   automatically before commit; failure-mode linchpins land in the
   assumptions ledger.
7. **Publish** the thesis. Tier Projector regenerates BLUF / 80 /
   800 / Full + IPCC qualifier, Red Team writes contradictions,
   Steelman writes load-bearing assumptions. Thesis appears at
   `/p/theses/<slug>`.
8. **Confirm + publish findings** at `/findings/[id]`. Public
   findings appear at `/p/findings`.
9. **Resolve** predictions as they come due. Calibration auto-fires
   after each resolution and updates the rolling Brier on `/home`
   and `/p/predictions`.

## Cost control

Every Anthropic call passes through the cost gate
(`packages/api/src/orchestrator/cost_gate.ts`). Operations costing
more than the per-operation threshold pause and surface a
`cost_approvals` row to the operator via the `CostApprovalModal`.
Approve in the modal; the cascade resumes with the issued
proposal_id.

## Skill iteration

When you edit a SKILL.md prompt, the runtime change is one command:

```sh
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm sync-skills
```

Pass `ROLE=novelty_surfacer` to scope to a single role. `DRY_RUN=1`
shows what would change without writing.

## Project layout

```
packages/
  api/          Cloudflare Worker (Hono)
    src/
      routes/         19 route groups
      orchestrator/   cascade, cost_gate, role_runner, 13 role orchestrators
      lib/            anthropic, supabase, brier, errors
      auth/           jwt verify, requireAuth middleware
    tests/            73 unit tests
  shared/
    src/
      constants/      enums (mirrors Postgres types)
      skills/loader/  SKILL.md loader + 19 unit tests
    skills/           13 role definitions (SKILL.md + schema.json)
  web/          Next.js 15 App Router on Cloudflare Pages
    src/
      app/(operator)/   25 routes — dashboard, studio, claims, findings, …
      app/(public)/p/   6 routes — public theses, predictions, findings, …
      components/       primitives (Badge, Button, Card, …)
      lib/              api-client, supabase ssr, public-api

supabase/
  migrations/   0001 … 0018 (run via supabase db push)

scripts/
  sync-skills.ts   pushes SKILL.md prompts → role_definitions
  smoke.ts         verifies bring-up against a live Supabase project

.github/workflows/
  ci.yml         lint + typecheck + test + wrangler dry-run +
                 next build + next-on-pages adapter
```

## Roles

Active by default (Sprint 1):
- **ingestion_critic** — gates incoming sources before substrate writes
- **claim_extraction** — Toulmin-format claims from approved sources
- **verifier** — grounds each claim against its source via Citations API
- **interrogator** — generates 3–7 questions per cascade

Activate lazily on first invocation:
- **gap_surfacer** — seven-stage sweep for missing actors / time / geo /
  evidence / source / counter-cases / lineage
- **assumption_auditor** — re-audits linchpin assumptions (status:
  holding / shaken / broken / retired)
- **indicator_validator** — checks operator-declared indicators for
  operationalization, source, cadence, threshold, thesis-link
- **premortem** — imagines a prediction is wrong and surfaces failure
  modes; fires before every prediction commit
- **calibration** — rolling Brier narrative + per-band /
  per-domain breakdown; fires after every prediction resolution

Activate on first thesis publication:
- **tier_projector** — regenerates BLUF / 80 / 800 / Full + IPCC qualifier
- **red_team** — adversarial objections rated minor / notable / major
- **steelman** — strongest opposing position + load-bearing
  assumptions with linchpin flags
- **novelty_surfacer** — patterns in the claim graph as candidate
  findings, graded incremental / notable / breakthrough, tagged by
  pattern_type (recurring_actor, transaction_chain, mechanism_overlap,
  structural_homology, negative_space, conflict_of_interest,
  temporal_correlation, jurisdictional_arbitrage)

## Discipline

- **Vertical first.** End-to-end slice on a real publication beats a
  half-built schema with no UI.
- **No silent spending.** Every paid op flows through
  `approvePaidOperation()` before the API call.
- **RLS from row one.** Every table ships with policies enabled. The
  service-role client bypasses RLS only for orchestrator bookkeeping
  (cost_ledger, role_invocations); user-facing reads always go through
  the user-scoped client.
- **Skills as files.** SKILL.md prompts live in
  `packages/shared/skills/<name>/`, hashed at load and versioned in
  `role_definitions.skill_md_hash`.
- **Calibrated language over rhetorical certainty.** IPCC qualifiers
  in published BLUFs.
- **Provenance over assertion.** Every claim has a source and an
  Admiralty grade.
- **Findings are graded honestly.** Breakthrough requires linchpin
  claims + operator confirmation; most patterns are incremental or
  notable.

## License

Private. All rights reserved.
