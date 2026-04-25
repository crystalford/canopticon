# CANOPTICON Build Handoff Package v1.0

**Purpose.** This is the document Claude Code executes from. It assembles the Sprint 1 scope into a single buildable plan: repo structure, environment setup, the exact subset of schema/skills/workflows/API to implement, the order to build them in, the acceptance criteria for "Sprint 1 done."

**Audience.** Claude Code (or any developer agent) starting from zero. Assumes access to the eight reference documents (master synthesis v1.5.1, methodology canon, UI spec, public site spec, glossary, changelog, schema v1.0, skills v1.0, workflows v1.0, entity resolution v1.0, API v1.0).

**Sprint 1 verb.** *Hansard ingests → Critic gates → operator approves via Sources screen → claims write → Verifier grounds → Interrogator generates questions → cascade produces a Live feed item.* If that end-to-end flow works on a real Hansard publication, Sprint 1 is done.

**Out of scope for this doc.** Sprint 2+ work (entity resolution, claim deduplication, articles, predictions, contradictions, public site cache, the public site itself, all roles other than the three Sprint 1 minimums). Those have their own designs already; they ship in subsequent sprints.

---

## 0. PRINCIPLES FOR THE BUILD

**Vertical first.** Build the full ingestion → cascade → Live feed slice end-to-end before adding breadth. Resist the temptation to build all the schema tables before any UI. A working slice with three tables beats a half-built schema with no UI.

**Real data, real source.** Use a real Hansard publication (openparliament.ca has a public API) as the Sprint 1 demo source. Synthetic test data hides integration issues. Real Hansard is structured, A-grade, and free.

**No silent spending.** The cost gate is wired before any paid API call. There are no "we'll add the gate later" code paths. The very first time the system calls Anthropic, it goes through `approvePaidOperation()`.

**RLS from row one.** Every table ships with Row-Level Security policies enabled. Don't write any test code that bypasses RLS by using the service-role key for routine operations.

**Idempotency from row one.** Workflow steps log to `workflow_runs.steps_completed` before AND after work. Re-running a cascade hits the cache.

**Operator-first UI.** The mobile-first v9.2 prototype is the design contract. The frontend implements those screens against real endpoints. No placeholder UI; if it can't be built against real data, the design needs adjusting first.

**Skills as files, not strings.** The three Sprint 1 role prompts live in `/skills/{role}/SKILL.md` as actual files in the repo. The orchestrator reads them at startup. This way prompt iteration doesn't require redeploys.

---

## 1. STACK

```
Frontend (operator app)
  Next.js 15 (App Router)
  TypeScript strict
  React 19
  Tailwind CSS (utility-only, no Tailwind UI components)
  Custom CSS for design tokens (matches v9.2 prototype)
  Supabase JS client (for auth + realtime)
  Hosted on Vercel

Backend
  Cloudflare Workers (TypeScript)
  Hono router
  Durable Objects for orchestrator state
  Cloudflare Queues for async webhook processing
  Cloudflare R2 for source-body storage
  Cloudflare Cron Triggers for scheduled cascades + cron pulls

Database / Auth
  Supabase (Postgres 15, GoTrue auth, Realtime)
  Schema migrations via Supabase CLI

External
  Anthropic API (claude-opus-4-7) — primary model
  openparliament.ca API — Hansard source (Sprint 1 only)
  AssemblyAI — Path B transcription (not used in Sprint 1)
  GPT-5 / Gemini — cross-model verification (deferred)

Tooling
  pnpm workspaces (monorepo)
  TypeScript 5.5+
  Biome for lint/format (not ESLint/Prettier — single tool, faster)
  Vitest for unit tests
  Playwright for end-to-end on the cascade flow
```

---

## 2. REPO STRUCTURE

A pnpm monorepo with three packages: `web` (frontend), `api` (Cloudflare Worker), `shared` (types + skills).

```
canopticon/
├── README.md                          # this doc, condensed
├── package.json                       # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── .env.example                       # env var template
├── .gitignore
│
├── docs/                              # the eight reference docs live here
│   ├── master-synthesis-v1.5.1.md
│   ├── methodology-canon.md
│   ├── ui-spec-v1.0.md
│   ├── public-site-spec-v1.0.md
│   ├── glossary.md
│   ├── changelog.md
│   ├── schema-v1.0.md
│   ├── skills-v1.0.md
│   ├── workflows-v1.0.md
│   ├── entity-resolution-v1.0.md
│   ├── api-v1.0.md
│   └── build-handoff-v1.0.md          # this doc
│
├── packages/
│   ├── shared/                        # types + skills, consumed by web & api
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── database.ts        # generated from Supabase schema
│   │   │   │   ├── api.ts             # generated from openapi.yaml
│   │   │   │   └── events.ts          # orchestrator event types
│   │   │   └── constants/
│   │   │       └── enums.ts           # mirrors Postgres enums
│   │   └── skills/
│   │       ├── ingestion-critic/
│   │       │   ├── SKILL.md
│   │       │   ├── schema.json
│   │       │   └── examples/
│   │       ├── verifier/
│   │       │   ├── SKILL.md
│   │       │   └── (no schema — uses Citations API)
│   │       └── interrogator/
│   │           ├── SKILL.md
│   │           └── schema.json
│   │
│   ├── api/                           # Cloudflare Worker
│   │   ├── package.json
│   │   ├── wrangler.toml              # CF Worker config
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts               # Worker entry point + Hono routes
│   │   │   ├── auth/
│   │   │   │   └── jwt.ts             # Supabase JWT validation
│   │   │   ├── routes/
│   │   │   │   ├── sources.ts
│   │   │   │   ├── claims.ts
│   │   │   │   ├── entities.ts
│   │   │   │   ├── theses.ts
│   │   │   │   ├── cascade.ts
│   │   │   │   ├── orchestrator.ts    # SSE stream + cost approval
│   │   │   │   ├── search.ts
│   │   │   │   └── webhooks/
│   │   │   │       └── youtube.ts     # Sprint 1: stub only; Hansard cron is below
│   │   │   ├── orchestrator/
│   │   │   │   ├── cost_gate.ts       # approvePaidOperation()
│   │   │   │   ├── cascade.ts         # the morning cascade workflow
│   │   │   │   ├── ingestion.ts       # ingestion-only workflow
│   │   │   │   ├── role_runner.ts     # invokes a role with substrate snapshot
│   │   │   │   └── events.ts          # event-emitter
│   │   │   ├── cron/
│   │   │   │   └── hansard.ts         # 6h pull from openparliament.ca
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts        # service-role client for backend ops
│   │   │   │   ├── anthropic.ts       # Anthropic API wrapper
│   │   │   │   ├── r2.ts              # R2 storage helpers
│   │   │   │   └── errors.ts          # standard error builder
│   │   │   └── durable_objects/
│   │   │       └── cascade_run.ts     # orchestrator state per cascade
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   └── README.md
│   │
│   └── web/                           # Next.js operator app
│       ├── package.json
│       ├── next.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.ts
│       ├── public/
│       │   ├── favicon.ico
│       │   └── grain.svg              # the texture overlay
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── globals.css        # design tokens from v9.2
│       │   │   ├── (auth)/
│       │   │   │   ├── sign-in/page.tsx
│       │   │   │   └── auth-callback/route.ts
│       │   │   ├── (operator)/
│       │   │   │   ├── layout.tsx     # shell with bottom nav
│       │   │   │   ├── live/page.tsx
│       │   │   │   ├── graph/page.tsx
│       │   │   │   ├── studio/page.tsx
│       │   │   │   ├── library/page.tsx
│       │   │   │   ├── sources/page.tsx
│       │   │   │   └── system/page.tsx
│       │   │   └── api/
│       │   │       └── auth/[...slug]/route.ts
│       │   ├── components/
│       │   │   ├── nav/
│       │   │   ├── feed/
│       │   │   ├── source/
│       │   │   ├── claim/
│       │   │   ├── thesis/
│       │   │   ├── modals/
│       │   │   │   ├── cost-approval.tsx
│       │   │   │   └── confirm.tsx
│       │   │   └── primitives/        # buttons, badges, chips
│       │   ├── lib/
│       │   │   ├── api-client.ts      # generated from openapi.yaml
│       │   │   ├── supabase.ts        # browser client
│       │   │   ├── realtime.ts        # subscription helpers
│       │   │   └── utils.ts
│       │   └── styles/
│       │       └── tokens.css         # color, type, spacing tokens
│       └── tests/
│
├── supabase/                          # Supabase project config & migrations
│   ├── config.toml
│   ├── migrations/
│   │   ├── 0001_extensions.sql
│   │   ├── 0002_enums.sql
│   │   ├── 0003_users.sql
│   │   ├── 0004_cost_ledger.sql
│   │   ├── 0005_sources.sql
│   │   ├── 0006_entities.sql
│   │   ├── 0007_claims.sql
│   │   ├── 0008_theses.sql
│   │   ├── 0009_role_runtime.sql      # role_definitions, role_invocations, orchestrator_events, cascade_runs
│   │   ├── 0010_rls_policies.sql
│   │   ├── 0011_triggers.sql
│   │   ├── 0012_seed_role_definitions.sql
│   │   └── 0013_workflow_runs.sql
│   └── seed/
│       └── dev_seed.sql               # optional dev seed: a sample Hansard source, a sample thesis
│
└── scripts/
    ├── generate-types.ts              # supabase gen types -> shared/types/database.ts
    ├── generate-api-types.ts          # openapi-typescript -> shared/types/api.ts
    └── deploy.sh                      # push web to Vercel + worker via wrangler
```

---

## 3. ENVIRONMENT VARIABLES

`.env.example`:

```bash
# Supabase (both frontend and backend use these)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...                 # backend only, never exposed to frontend

# Anthropic (backend only)
ANTHROPIC_API_KEY=sk-ant-...

# Cloudflare (deploy time)
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...

# Frontend
NEXT_PUBLIC_API_BASE_URL=https://api.canopticon.com
NEXT_PUBLIC_SITE_URL=https://app.canopticon.com  # operator app domain

# Backend
API_BASE_URL=https://api.canopticon.com
R2_BUCKET_NAME=canopticon-sources
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...

# openparliament.ca (Sprint 1 source)
OPENPARLIAMENT_API_KEY=...                       # if needed; their API is largely open

# Misc
NODE_ENV=development
LOG_LEVEL=info
```

Worker secrets are set via `wrangler secret put <name>`. Frontend secrets go in Vercel project settings. Local development uses `.env.local`.

---

## 4. SPRINT 1 SCHEMA — THE 18 TABLES

The minimum table set that supports the Sprint 1 verb.

**Migration order** (from schema-v1.0.md Section 18, abbreviated):

```
0001_extensions.sql
  - uuid-ossp, pgcrypto, pg_trgm, btree_gin
  - (defer pgvector to Sprint 3)

0002_enums.sql
  - admiralty_grade, verification_status, ipcc_likelihood
  - entity_type, claim_layer, thesis_status
  - source_type, ingestion_mode, ingestion_state
  - role_name, cost_operation_type
  - watch_pin_type, question_status
  (the enums needed by Sprint 1 tables; defer the rest)

0003_users.sql
  - public.users (mirrors auth.users)

0004_cost_ledger.sql
  - public.cost_ledger
  - public.cost_whitelists

0005_sources.sql
  - public.sources
  - public.ingestion_critic_reports
  - public.ingestion_actions

0006_entities.sql
  - public.entities
  - public.entity_mentions      (entity_id NULLABLE; resolution deferred)

0007_claims.sql
  - public.claims
  - public.claim_versions
  - public.claim_entities
  - public.claim_sources
  (defer claim_relations, entity_relations to Sprint 2)

0008_theses.sql
  - public.theses
  - public.thesis_versions
  - public.thesis_claims
  - public.thesis_watch_sets
  - public.thesis_concept_spine
  - public.thesis_inbox

0009_role_runtime.sql
  - public.role_definitions
  - public.role_invocations
  - public.orchestrator_events
  - public.cascade_runs

0010_rls_policies.sql
  - RLS enabled on every public.* table
  - Per-table policies: owner_all + (where applicable) public_read for is_public rows

0011_triggers.sql
  - set_updated_at trigger on every table with updated_at
  - enforce_single_current_claim_version on claim_versions
  - enforce_single_current_thesis_version on thesis_versions
  - emit_orchestrator_event on insert/update of substrate tables

0012_seed_role_definitions.sql
  - INSERT default rows for the 3 Sprint 1 roles (ingestion_critic, verifier, interrogator)
  - prompt_template = '<see SKILL.md>' placeholder; the runtime reads from the file

0013_workflow_runs.sql
  - public.workflow_runs (from workflows-v1.0.md Section 0.3)
```

**Sprint 1 tables (18 total):**
1. users
2. cost_ledger
3. cost_whitelists
4. sources
5. ingestion_critic_reports
6. ingestion_actions
7. entities
8. entity_mentions
9. claims
10. claim_versions
11. claim_entities
12. claim_sources
13. theses
14. thesis_versions
15. thesis_claims
16. thesis_watch_sets
17. thesis_concept_spine
18. thesis_inbox

Plus runtime tables: role_definitions, role_invocations, orchestrator_events, cascade_runs, workflow_runs.

That's 23 tables total when including runtime. The 18 in the spec count substrate only.

---

## 5. SPRINT 1 ROLES — THE THREE SKILLS

Three SKILL.md files in `packages/shared/skills/`. Full prompt content from skills-v1.0.md sections 1, 2, 3.

```
packages/shared/skills/
├── ingestion-critic/
│   ├── SKILL.md           # frontmatter + full prompt from Section 1 of skills doc
│   ├── schema.json        # IngestionCriticReport JSON Schema
│   └── examples/          # (empty for Sprint 1; populated as runs accumulate)
├── verifier/
│   ├── SKILL.md           # full prompt from Section 2
│   └── schema.json        # post-citations extraction schema
└── interrogator/
    ├── SKILL.md           # full prompt from Section 3
    └── schema.json        # InterrogatorOutput schema
```

**SKILL.md frontmatter format:**

```yaml
---
name: ingestion-critic
version: 1.0
model: claude-opus-4-7
features:
  citations_api: false
  structured_output: true
  cross_model: false
---
```

The orchestrator reads SKILL.md at runtime, computes a SHA-256 hash of the prompt body, compares to `role_definitions.skill_md_hash`, updates if changed, then invokes.

---

## 6. SPRINT 1 WORKFLOWS — THE THREE

From workflows-v1.0.md:

1. **morning_cascade** — full cascade with steps 1, 2, 3, 4, 5 (without 5c/5d entity-and-claim-resolution; those come in Sprint 2), 6, 7, 8, 13, 14, 15. Skip steps 9 (Gap Surfacer), 10 (Calibration — no predictions yet), 11 (Tier Projector — no public theses yet), 12 (Assumption Auditor — weekly only, won't fire in first week of operation).

2. **ingestion_only** — webhook/cron arrival creates a `sources` row with `ingestion_state = 'pending_critic'` and emits `source.created`. Defers further work to next cascade.

3. **watch_set_update** — operator pins/unpins entities; backfill runs.

The publish-prep, contradiction-resolution, and prediction-resolution workflows ship in Sprint 2+ when their corresponding substrate features come online.

---

## 7. SPRINT 1 API ENDPOINTS — THE ~30

From api-v1.0.md Section 21:

```
Auth
  GET  /v1/auth/me
  PATCH /v1/auth/me

Sources
  GET  /v1/sources
  GET  /v1/sources/:id
  POST /v1/sources                    # operator URL or text upload
  POST /v1/sources/upload              # multipart file upload to R2
  GET  /v1/sources/:id/critic-report
  POST /v1/sources/:id/approve
  POST /v1/sources/:id/defer
  POST /v1/sources/:id/reject

Claims
  GET  /v1/claims
  GET  /v1/claims/:id
  POST /v1/claims/:id/verify

Entities
  GET  /v1/entities
  GET  /v1/entities/:id
  POST /v1/entities                    # operator-authored entity (rare in Sprint 1)

Theses
  GET  /v1/theses
  GET  /v1/theses/:id
  POST /v1/theses                      # declare new thesis
  POST /v1/theses/:id/versions         # update with new version
  GET  /v1/theses/:id/claims
  POST /v1/theses/:id/claims           # integrate claim into layer
  GET  /v1/theses/:id/inbox
  POST /v1/theses/:id/inbox/:inbox_id/act

Cascade
  POST /v1/cascade/run
  GET  /v1/cascade/runs
  GET  /v1/cascade/runs/:id

Orchestrator (SSE + cost approval)
  GET  /v1/orchestrator/events         # SSE stream
  POST /v1/orchestrator/approve-cost   # operator approves a pending cost gate

Cost
  GET  /v1/costs/summary

Search
  GET  /v1/search                      # pg_trgm-based; wires up the Library screen

Webhooks (inbound from cron worker; not external in Sprint 1)
  POST /v1/internal/cron/hansard
```

That's ~30 endpoints. Full request/response shapes per api-v1.0.md.

---

## 8. SPRINT 1 UI — THE SIX SCREENS

The mobile-first v9.2 prototype is the design contract. Every screen is implemented as a Next.js App Router page under `(operator)/`:

1. **Live (`/live`)** — feed assembled from cascade outputs. Reads from `GET /v1/orchestrator/events` (SSE), `GET /v1/sources?ingestion_state=...`, `GET /v1/claims?since=...`, `GET /v1/cascade/runs/latest`. Run Cascade button posts to `/v1/cascade/run`.

2. **Graph (`/graph`)** — for Sprint 1, this shows a simple force-directed graph of entities and their claim-relations. Uses Cytoscape.js or a similar library. The sophisticated graph UX comes in Phase E (post-Sprint-1 graph research). For now: 11-50 nodes is fine; nothing fancy.

3. **Studio (`/studio`)** — Sprint 1 shows the thesis-in-progress view (BLUF, layers, claims). Production tab for video/article workflows is stubbed. Rec-mode is stubbed.

4. **Library (`/library`)** — search and browse across substrate. Wires up `/v1/search`. Read-only in Sprint 1.

5. **Sources (`/sources`)** — the queue. Pending approvals, recently-ingested, source detail with Critic report. The most-used screen during Sprint 1.

6. **System (`/system`)** — health, costs, role activity, recent cascade runs. Reads from `/v1/costs/summary`, `/v1/cascade/runs`, etc.

**Implementation notes:**

- Server components by default; client components only where interactivity demands them (forms, modals, the SSE event listener, the bottom nav highlight)
- Mobile-first responsive — design works at 375px width minimum, scales up
- Color tokens in `globals.css` from v9.2 (the cream/amber/red/sage/blue/tan palette, dark backgrounds)
- EB Garamond for serifs, JetBrains Mono for mono — both via `next/font` with display: swap

---

## 9. SPRINT 1 ORCHESTRATOR — THE WIRING

The orchestrator is plain TypeScript on Cloudflare Workers, not an agent framework. Two pieces:

**Stateless Worker** (`packages/api/src/orchestrator/`):
- `cost_gate.ts` — exports `approvePaidOperation(user, op_type, estimate_cents)` returning `{approved: boolean, reason: string, approval_id?: uuid}`. Reads `cost_ledger` and `cost_whitelists`. Inserts a pending row in a `cost_approvals` table (or uses Durable Object state) when operator decision is required.
- `role_runner.ts` — exports `invokeRole(role_name, snapshot, options)`. Reads SKILL.md, builds prompt, calls Anthropic, validates structured output, persists `role_invocations` row, charges `cost_ledger`.
- `events.ts` — emits to `orchestrator_events` table. Subscribers (the SSE endpoint) tail this table.
- `ingestion.ts` — implements the ingestion-only workflow.

**Durable Object** (`packages/api/src/durable_objects/cascade_run.ts`):
- One DO per cascade run. State: `cascade_runs.id`, `steps_completed`, `current_step`, `error_state`.
- Methods: `start()`, `step(name, fn)`, `cancel()`, `resume(from_step)`.
- Persists state to `cascade_runs` table at each step boundary.

**Trigger paths:**

- Cron at 11:00 UTC daily → fetches openparliament.ca latest Hansard → ingestion workflow → emits `source.created`. (Sprint 1: only Hansard source; YouTube and others come in Sprint 2.)
- Operator `POST /v1/cascade/run` → instantiates a CascadeRun DO → runs through steps → returns `cascade_run_id`.
- The CascadeRun DO writes substrate, emits events, and returns when done.

---

## 10. SPRINT 1 BUILD ORDER

The order to actually do the work. Each step is checkable; nothing later depends on later items.

### 10.1 Foundation (Day 0)

```
[ ] pnpm workspace initialized
[ ] Three packages scaffolded (shared, api, web)
[ ] Biome configured, TypeScript strict, basic CI
[ ] Supabase project created (dev environment)
[ ] Anthropic API key in vault
[ ] Cloudflare Workers project initialized via wrangler
[ ] Environment variables wired
[ ] Repo pushed to GitHub
```

### 10.2 Database (Day 1)

```
[ ] Migration 0001 — extensions
[ ] Migration 0002 — enums (Sprint 1 subset)
[ ] Migration 0003 — users (mirroring auth.users)
[ ] Migration 0004 — cost_ledger, cost_whitelists
[ ] Migration 0005 — sources, ingestion_critic_reports, ingestion_actions
[ ] Migration 0006 — entities, entity_mentions
[ ] Migration 0007 — claims, claim_versions, claim_entities, claim_sources
[ ] Migration 0008 — theses, thesis_versions, thesis_claims, thesis_watch_sets, thesis_concept_spine, thesis_inbox
[ ] Migration 0009 — role_definitions, role_invocations, orchestrator_events, cascade_runs
[ ] Migration 0010 — RLS policies on every table
[ ] Migration 0011 — triggers
[ ] Migration 0012 — seed role_definitions
[ ] Migration 0013 — workflow_runs
[ ] supabase gen types typescript → packages/shared/src/types/database.ts
[ ] Smoke test: insert a user (via auth signup), confirm cascade-allowed RLS
```

### 10.3 Skills (Day 1.5)

```
[ ] packages/shared/skills/ingestion-critic/SKILL.md (full prompt + frontmatter)
[ ] packages/shared/skills/ingestion-critic/schema.json (IngestionCriticReport)
[ ] packages/shared/skills/verifier/SKILL.md (full prompt + frontmatter)
[ ] packages/shared/skills/verifier/schema.json (post-citations extraction)
[ ] packages/shared/skills/interrogator/SKILL.md (full prompt + frontmatter)
[ ] packages/shared/skills/interrogator/schema.json (InterrogatorOutput)
[ ] Loader function: read SKILL.md, parse frontmatter, hash body, return PreparedSkill
```

### 10.4 Backend (Days 2-4)

```
Foundation
[ ] Hono router setup with auth middleware
[ ] Supabase service-role client
[ ] Anthropic API wrapper with cost-gate hook
[ ] Standard error builder, JSON envelope

Auth
[ ] GET /v1/auth/me, PATCH /v1/auth/me

Sources endpoints
[ ] GET /v1/sources (with filters, pagination)
[ ] GET /v1/sources/:id
[ ] POST /v1/sources (URL or text upload; writes to R2 if large)
[ ] POST /v1/sources/upload (multipart)
[ ] GET /v1/sources/:id/critic-report
[ ] POST /v1/sources/:id/approve
[ ] POST /v1/sources/:id/defer
[ ] POST /v1/sources/:id/reject

Claims endpoints
[ ] GET /v1/claims, GET /v1/claims/:id
[ ] POST /v1/claims/:id/verify (cost-gated, invokes Verifier)

Entities endpoints
[ ] GET /v1/entities, GET /v1/entities/:id
[ ] POST /v1/entities (manual)

Theses endpoints
[ ] GET /v1/theses, GET /v1/theses/:id
[ ] POST /v1/theses (declare)
[ ] POST /v1/theses/:id/versions (update)
[ ] GET /v1/theses/:id/claims
[ ] POST /v1/theses/:id/claims (integrate)
[ ] GET /v1/theses/:id/inbox
[ ] POST /v1/theses/:id/inbox/:inbox_id/act

Cost & search
[ ] GET /v1/costs/summary
[ ] GET /v1/search (pg_trgm)

Orchestrator
[ ] GET /v1/orchestrator/events (SSE — tails orchestrator_events table)
[ ] POST /v1/orchestrator/approve-cost

Cascade
[ ] CascadeRun Durable Object
[ ] POST /v1/cascade/run
[ ] GET /v1/cascade/runs, /:id

Cron
[ ] Hansard cron handler (POST /v1/internal/cron/hansard)
[ ] Wired to scheduled trigger every 6h

Orchestrator workflow code
[ ] cost_gate.ts (the chokepoint)
[ ] role_runner.ts (invokes a skill against a snapshot)
[ ] cascade.ts (the morning cascade workflow)
[ ] ingestion.ts (the ingestion-only workflow)
[ ] events.ts (emit + subscribe)

End-to-end tests (integration)
[ ] Test: ingest a real Hansard fragment → Critic runs → operator approves → claims write
[ ] Test: cascade run end-to-end produces Live feed items
```

### 10.5 Frontend (Days 4-6)

```
Foundation
[ ] Next.js project initialized in packages/web
[ ] Supabase client (browser) configured
[ ] Auth flow: sign-in, sign-up, callback
[ ] App Router shell with bottom nav
[ ] Design tokens in globals.css (matches v9.2)
[ ] Font loading (EB Garamond, JetBrains Mono)
[ ] Realtime subscription helpers

Generated types
[ ] openapi-typescript on api-v1.0.md → shared/types/api.ts
[ ] Wrap fetch with typed client in lib/api-client.ts

Screens
[ ] /live — feed with SSE subscription, Run Cascade button
[ ] /sources — pending queue, source detail, Critic report viewer, approve/defer/reject buttons
[ ] /system — health, cost summary, recent cascade runs
[ ] /library — search across substrate
[ ] /studio — thesis detail view
[ ] /graph — simple force-directed (Cytoscape)

Modals & primitives
[ ] CostApprovalModal — opens on cost.operation_proposed event, posts to approve-cost
[ ] ConfirmModal — generic confirm
[ ] FeedItem, SourceCard, ClaimCard, ThesisCard primitives
[ ] All buttons, badges, chips matching v9.2 styling

End-to-end tests
[ ] Playwright: sign in → trigger cascade → see new claim appear in Live feed
```

### 10.6 Demo (Day 7)

```
[ ] Real Hansard publication ingested via cron OR manual operator paste
[ ] Critic runs, produces report
[ ] Operator approves via Sources screen
[ ] Claim extraction skill runs (note: claim_extraction is a Sprint 1 utility skill — see §11 below)
[ ] Verifier grounds extracted claims
[ ] Interrogator generates questions
[ ] Live feed shows: source ingested, claims written, questions generated
[ ] Cost ledger reflects all operations
[ ] System screen shows cascade run summary

If this works end-to-end on a real Hansard publication: Sprint 1 done.
```

---

## 11. THE CLAIM EXTRACTION GAP

The cascade workflow's STEP 5 calls a `claim_extraction` skill that isn't in the original 11-role skills package. It's a utility skill — reads source body, returns structured claim candidates with Toulmin fields populated. Specified here for Sprint 1 implementation:

**Trigger:** Cascade STEP 5, after a source is approved.

**Reads:** Source body, source metadata (publication, author, date), thesis concept spines (for relevance hint).

**Writes:** Returns structured array; the orchestrator then writes `claims`, `claim_versions`, `claim_entities`, `claim_sources` rows.

**Model:** claude-opus-4-7.

**API features:** Structured Outputs.

**Prompt template:**

```xml
<task>
You are the Claim Extractor. Given a source document, identify discrete factual claims
worth recording in the substrate. Each claim should be:
- Atomic (one factual proposition, not a compound)
- Stated declaratively
- Tied to specific entities mentioned in the source
- Quotable from or directly inferable from the source text

Do NOT extract:
- Opinions, framing, editorial commentary (those are not claims)
- Speculation about future events (those are predictions, separate flow)
- Context-only facts that don't relate to active theses

Extract 0-10 claims per source. More than 10 means you're being too granular.
</task>

<input>
<source>
  <type>{{source.source_type}}</type>
  <title>{{source.title}}</title>
  <publication>{{source.publication}}</publication>
  <published_at>{{source.published_at}}</published_at>
  <body>{{source.raw_text}}</body>
</source>

<active_thesis_concepts>
{{concepts from active thesis concept_spines, for relevance hint}}
</active_thesis_concepts>
</input>

<extraction_steps>
For each candidate claim:

1. State the data: what observable fact does this claim rest on, with a quotable
   source passage?

2. State the claim text: what is being asserted?

3. Identify the warrant: what inference rule connects data to claim? (Often left
   implicit in source; surface it.)

4. Identify the qualifier: any IPCC-style likelihood or temporal scope?

5. Identify the entities involved with their surface mentions (we'll resolve them
   later).

6. Propose the layer: factual / framing / architectural / distributive.

7. Propose an Admiralty grade (default to source's grade unless a specific claim
   has special standing).
</extraction_steps>

<output_format>
Emit JSON conforming to the ClaimExtractionOutput schema.
</output_format>

<constraints>
- Be quotable. The source passage you cite must be findable in the source text.
- Be conservative on warrants. If the source doesn't make the warrant explicit and
  it's not obviously inferable, leave warrant=null.
- Most Hansard claims are factual layer. Architectural claims are rare and
  high-value.
</constraints>
```

**Output schema:**

```json
{
  "type": "object",
  "required": ["claims"],
  "properties": {
    "claims": {
      "type": "array",
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": ["data", "claim_text", "layer", "admiralty_grade", "entities"],
        "properties": {
          "data": { "type": "string" },
          "claim_text": { "type": "string" },
          "warrant": { "type": "string" },
          "qualifier": { "type": "string" },
          "rebuttal": { "type": "string" },
          "layer": { "type": "string", "enum": ["factual", "framing", "architectural", "distributive"] },
          "admiralty_grade": { "type": "string", "enum": ["A", "B", "C", "D", "E", "F"] },
          "source_passage": { "type": "string" },
          "entities": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["surface_text", "entity_type_hint"],
              "properties": {
                "surface_text": { "type": "string" },
                "entity_type_hint": { "type": "string", "enum": ["person", "organization", "institution", "corporation", "department", "office", "legislation", "event", "concept", "location"] },
                "context_excerpt": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
}
```

**Add to skills package:**

```
packages/shared/skills/claim-extraction/
├── SKILL.md
└── schema.json
```

This is the fourth skill needed for Sprint 1, plus role_definitions seed gets a fourth row.

---

## 12. ACCEPTANCE CRITERIA

Sprint 1 is "done" when all of the following work end-to-end against a real Hansard publication:

1. **Authentication.** Operator signs in via email/password (or magic link), gets a Supabase JWT, calls authenticated API endpoints successfully.

2. **Hansard ingestion.** Cron runs every 6h, pulls latest Hansard from openparliament.ca, creates a `sources` row with `ingestion_state='pending_critic'`. The source body is stored in R2 (or inline if small).

3. **Critic review.** The Ingestion Critic runs against the Hansard source, produces an `ingestion_critic_reports` row with proposed grade A, no contradictions, and a recommendation. The cost is logged in `cost_ledger`.

4. **Operator approval.** The operator opens the Sources screen, sees the pending Hansard source with the Critic's report, taps approve. The action is logged in `ingestion_actions`; source state becomes `approved`.

5. **Claim extraction.** The cascade STEP 5 runs, claim_extraction skill produces 3-7 atomic claims, each written to `claims`, `claim_versions`, `claim_entities` (with unresolved entity_id NULL), and `claim_sources` referencing the Hansard source.

6. **Verification.** The Verifier runs on each grade-A claim using Citations API. Each claim's `verification_status` updates to `grounded` or `partial`. Citations are logged.

7. **Question generation.** The Interrogator runs against any active thesis with new claim integrations, produces 3-7 questions in the `questions` table.

8. **Live feed.** The operator's Live screen shows: source ingested, claims written (with grades, verification status), questions generated, cascade run completed.

9. **Cost discipline.** Every paid Anthropic API call passed through `approvePaidOperation()`. The cost ledger reflects accurate cents charged. The System screen shows total spent this month, ceiling, and remaining budget.

10. **Cascade replay.** Operator hits "Run Cascade" again with no new sources; cascade runs idempotently and produces no duplicate claims, questions, or events.

11. **RLS isolation.** A second test user account cannot see the first user's substrate. Confirmed via attempted reads with the second user's JWT.

12. **Realtime.** While the cascade is running, the Live screen updates in realtime (SSE) showing each role invocation completing.

If all 12 criteria pass on a real Hansard publication, Sprint 1 is done. The substrate is alive, the operator has a working interface, the cost discipline is enforced, and the foundation for Sprints 2+ is solid.

---

## 13. WHAT SHIPS IN SPRINT 2

(Not part of this handoff — for context only.)

- Entity resolution pipeline (uses entity-resolution-v1.0.md)
- Claim deduplication
- The remaining substrate tables (claim_relations, entity_relations, predictions, contradictions, articles, assumptions, indicators, books)
- Red Team, Steelman, Premortem, Gap Surfacer, Calibration, Tier Projector, Assumption Auditor, Indicator Validator roles
- Publish-prep, contradiction-resolution, prediction-resolution, watch-set-update workflows (the last is a candidate for Sprint 1 if time permits)
- More source adapters (YouTube webhook, X stream, news RSS)
- Public site cache materializations
- The public site itself (separate Next.js app)

Sprint 2 doesn't start until Sprint 1 acceptance criteria pass.

---

## 14. KNOWN RISKS

**Anthropic API rate limits.** A morning cascade with 10 sources can fire 30+ API calls in a few minutes. Default tier rate limits may bottleneck. Mitigation: queue role invocations with backoff; budget for tier upgrade.

**Cost gate UX.** Every paid op prompts the operator unless whitelisted. In Sprint 1 testing, this could mean approving every Anthropic call. Mitigation: ship with sensible whitelist defaults — Critic, Verifier, Interrogator on small-cost runs auto-approve via per-op cap; cross-model and large-context calls always prompt.

**SSE connection stability on mobile.** SSE connections drop on mobile network changes. Mitigation: client reconnects with `Last-Event-ID` and replays missed events.

**RLS performance with large substrates.** RLS adds query overhead. For Sprint 1's data volumes (hundreds of rows per user), this is fine. Future: materialized views for hot read paths.

**Hansard parser fragility.** openparliament.ca's API may change format. Mitigation: a thin adapter layer; fall back to operator manual upload if API is unreachable.

**Idempotency in face of partial failures.** A cascade that fails mid-step must resume cleanly. Mitigation: every step writes its `steps_completed` checkpoint before AND after; resume reads checkpoint and skips completed steps.

---

## 15. DEPLOYMENT

**Frontend (web):**
- Vercel project linked to GitHub
- Auto-deploy on push to main
- Preview deploys on every PR
- Custom domain: app.canopticon.com

**Backend (api):**
- Cloudflare Workers via wrangler
- `wrangler deploy` from CI on push to main
- Custom domain: api.canopticon.com
- Cron triggers configured in wrangler.toml

**Database (supabase):**
- Production project for prod
- Dev project for development
- Migrations applied via Supabase CLI in CI
- Backups daily via Supabase's automated backup

**Storage (R2):**
- Bucket: canopticon-sources
- Lifecycle: keep indefinitely (sources are append-only; deletion is rare)

**Monitoring:**
- Sentry for both frontend and backend
- Cloudflare Workers built-in analytics
- Supabase logs for database queries
- A simple `/health` endpoint on the API for uptime monitoring

---

## 16. THE STARTING COMMAND

When Claude Code begins, the first commands:

```bash
# Clone the repo template (or initialize from scratch)
gh repo create canopticon --private --clone
cd canopticon

# Copy the eight reference docs into ./docs/
# (Manual step — operator drops them in)

# Initialize the workspace
pnpm init -y
echo "packages:\n  - 'packages/*'" > pnpm-workspace.yaml

# Set up base TypeScript and Biome
# ... etc, per Section 2 above

# Then proceed through Section 10's build order, day by day, item by item
```

---

## 17. NOTES TO THE BUILDER

The eight reference documents are the spec. This handoff document is the index. When in doubt about a design decision, the corresponding reference doc has the answer:

- *What does this table do?* → schema-v1.0.md
- *How does this role behave?* → skills-v1.0.md
- *What's the workflow sequence?* → workflows-v1.0.md
- *How do I resolve entities?* → entity-resolution-v1.0.md
- *What's this endpoint return?* → api-v1.0.md
- *What does this term mean?* → glossary.md
- *Why was this decided?* → changelog.md
- *What does the UI look like?* → ui-spec-v1.0.md and the v9.2 prototype HTML
- *What's the public face?* → public-site-spec-v1.0.md

Anything ambiguous after reading the relevant doc gets surfaced to the operator before guessing. The discipline of not-guessing is the discipline of building correctly.

Don't add features not in this doc. Don't refactor preemptively. Sprint 1 is the foundation; everything later builds on it. Get the foundation right.

When Sprint 1's acceptance criteria pass on a real Hansard publication, take a breath, demo it, and only then move to Sprint 2.
