# CANOPTICON Build Reference

**What this doc is.** A reference index for the codebase. It points at where things live, what depends on what, and the invariants the system maintains. It does not prescribe a build order — every developer (human or agent) reading the bundle picks the path that fits the work they're doing.

**Audience.** Claude Code, future contributors, future-you in six months trying to remember why something is the way it is.

---

## 1. STACK

```
Frontend (operator app)
  Next.js 15 (App Router)
  TypeScript strict
  React 19
  Tailwind CSS (utility-only, no Tailwind UI components)
  Custom CSS for design tokens
  Supabase JS client (auth + realtime)
  Hosted on Vercel

Backend
  Cloudflare Workers (TypeScript)
  Hono router
  Durable Objects for any orchestrator state that outlives a single request
  Cloudflare Queues for async webhook processing
  Cloudflare R2 for source-body storage
  Cloudflare Cron Triggers for any scheduled work (off by default — see §6)

Database / Auth
  Supabase (Postgres 15, GoTrue auth, Realtime)
  Schema migrations via Supabase CLI

External
  Anthropic API (claude-opus-4-7) — primary model and the one that drives
    the AI research loop. Tool use (web_search, web_fetch) is the primary
    ingestion path; see §6.
  AssemblyAI / gpt-4o-mini-transcribe — Path B transcription for YouTube
    audio when no captions are available.
  GPT-5 / Gemini — secondary verification for publication-bound claims.
    Infrastructure is wired; invocation gated on `is_public = TRUE` theses.
  Optional source feeds (Hansard, RSS, etc.) — disabled by default.

Tooling
  pnpm workspaces (monorepo)
  TypeScript 5.5+
  Biome for lint/format (single tool, fast)
  Vitest for unit tests
  Playwright for end-to-end flows
```

---

## 2. REPO LAYOUT

A pnpm monorepo with three packages — `web`, `api`, `shared` — plus the
Supabase project at the root.

```
canopticon/
├── README.md                           # entry point for new readers
├── package.json                        # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── .env.example                        # env var template
│
├── docs/                               # the reference bundle (this folder)
│   ├── canopticon-master-synthesis-v1.5.1.md
│   ├── canopticon-methodology-canon.md
│   ├── canopticon-ui-spec-v1.0.md
│   ├── canopticon-public-site-spec-v1.0.md
│   ├── canopticon-glossary.md
│   ├── canopticon-changelog.md
│   ├── canopticon-schema-v1.0.md
│   ├── canopticon-skills-v1.0.md
│   ├── canopticon-workflows-v1.0.md
│   ├── canopticon-entity-resolution-v1.0.md
│   ├── canopticon-api-v1.0.md
│   └── canopticon-build-handoff-v1.0.md   # this doc
│
├── packages/
│   ├── shared/                         # types + constants + Skill loader + SKILL.md files
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── database.ts         # generated from Supabase schema
│   │   │   │   ├── api.ts              # generated from openapi.yaml
│   │   │   │   └── events.ts           # orchestrator event-type unions
│   │   │   ├── constants/
│   │   │   │   └── enums.ts            # mirrors Postgres enums
│   │   │   └── skills/loader/          # SKILL.md parser + hasher
│   │   └── skills/
│   │       ├── ingestion-critic/{SKILL.md, schema.json, examples/}
│   │       ├── verifier/{SKILL.md, schema.json}
│   │       ├── interrogator/{SKILL.md, schema.json}
│   │       └── claim-extraction/{SKILL.md, schema.json}
│   │
│   ├── api/                            # Cloudflare Worker
│   │   ├── package.json
│   │   ├── wrangler.toml
│   │   ├── src/
│   │   │   ├── index.ts                # Worker entry + Hono routes
│   │   │   ├── auth/{jwt.ts, middleware.ts}
│   │   │   ├── routes/
│   │   │   │   ├── sources.ts
│   │   │   │   ├── cascade.ts
│   │   │   │   ├── research.ts         # AI research loop (primary path)
│   │   │   │   ├── orchestrator.ts     # SSE + cost approval
│   │   │   │   ├── webhooks/youtube.ts # YouTube channel webhooks
│   │   │   │   └── ...
│   │   │   ├── orchestrator/
│   │   │   │   ├── cost_gate.ts
│   │   │   │   ├── role_runner.ts      # the only Anthropic call site
│   │   │   │   ├── cascade.ts          # role-step orchestration
│   │   │   │   ├── research.ts         # research-agent loop
│   │   │   │   └── events.ts
│   │   │   ├── cron/                   # off by default
│   │   │   │   └── hansard.ts
│   │   │   ├── lib/
│   │   │   │   ├── anthropic.ts        # the only Anthropic client
│   │   │   │   ├── supabase.ts         # service-role + user-scoped clients
│   │   │   │   ├── openparliament.ts
│   │   │   │   └── errors.ts
│   │   │   └── durable_objects/
│   │   │       └── ...                 # state for long-running cascades / research
│   │   └── tests/
│   │
│   └── web/                            # Next.js operator app
│       ├── package.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── src/
│       │   ├── app/                    # App Router screens
│       │   ├── components/             # primitives + composed components
│       │   ├── lib/{api-client,supabase,realtime,utils}.ts
│       │   └── styles/tokens.css
│       └── tests/
│
├── supabase/
│   ├── config.toml
│   ├── migrations/                     # 0001-0014; numbered in apply order
│   ├── seed/dev_seed.sql
│   └── tests/rls/                      # alice/bob/anon RLS test matrix
│
└── scripts/
    ├── sync-skills.ts                  # SKILL.md → role_definitions
    ├── generate-types.ts               # Supabase types
    ├── generate-api-types.ts           # openapi-typescript
    └── deploy.sh
```

---

## 3. ENVIRONMENT

`.env.example` documents every variable. Worker secrets are set with
`wrangler secret put`; frontend secrets go in the Vercel project settings;
local dev uses `.env.local`.

The variables that matter:

```bash
# Supabase (frontend + backend)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=                # backend only, never exposed
SUPABASE_JWT_SECRET=                      # backend only, for JWT verification

# Anthropic (backend only)
ANTHROPIC_API_KEY=

# Cloudflare (deploy time)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# Frontend
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_SITE_URL=

# Backend
R2_BUCKET_NAME=canopticon-sources
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=

# Optional source feeds — only needed if you enable them
OPENPARLIAMENT_USER_AGENT=
OPERATOR_USER_ID=
```

---

## 4. THE INVARIANTS

These are the system's load-bearing rules. Code that violates any of them
is broken even if its tests pass.

**No silent spending.** Every paid operation flows through
`approvePaidOperation()` before the API call is made.
`packages/api/src/orchestrator/cost_gate.ts` is the single chokepoint;
`packages/api/src/lib/anthropic.ts` is the single Anthropic client; the
role runner is the single composer. There is no other path to a paid
external API call.

**RLS is the access boundary.** Every `public.*` table has Row-Level
Security enabled with explicit policies. The user-scoped Supabase client
in `lib/supabase.ts` attaches the user's JWT so policies see
`auth.uid()` correctly. The service-role client bypasses RLS and is used
only for backend bookkeeping (cost ledger writes, role invocation
audit, scheduled work that has no user JWT). The matrix in
`supabase/tests/rls/` proves alice/bob/anon isolation in CI; that gate
is non-negotiable before any deploy that touches policies.

**Provenance over assertion.** Every claim has at least one source.
Every source has an Admiralty grade. Every role invocation logs its
inputs and outputs to `role_invocations`. The audit trail is enough to
reconstruct any piece of substrate from primary documents.

**Skills as files.** Role prompts live in
`packages/shared/skills/<name>/SKILL.md`. The
`scripts/sync-skills.ts` script reads each file, hashes the prompt body,
and updates `role_definitions.prompt_template` and
`role_definitions.skill_md_hash`. Iterating on a prompt is editing a
file and re-running sync — no migration, no redeploy.

**Calibrated language over rhetorical certainty.** IPCC qualifiers in
every published BLUF (`virtually_certain`, `extremely_likely`, ... ,
`exceptionally_unlikely`). Default to the weaker option when uncertain.

**Contradictions preserved over contradictions resolved.** Cross-claim
contradictions live in their own registry (added when the contradiction
substrate comes online) and are surfaced to the operator. Forced consensus
is not a goal.

**Idempotency at every workflow step.** Workflow runs write
`workflow_runs.steps_completed` before *and* after each step. Replays
read the checkpoint and skip done steps.

---

## 5. INGESTION POSTURE

CANOPTICON ingests in three modes. They share the same substrate and
flow through the same Critic → claim_extraction → Verifier → Interrogator
analytical roles. They differ only in how sources arrive.

**Operator-driven AI research (primary).** The operator says "research
X" and the system runs Claude with web search, URL fetch, and substrate-
write tools. The agent finds sources, registers them (each one through
the Critic), extracts claims, and routes them to active theses. The
operator watches via SSE and can interrupt or redirect.
`POST /v1/research` is the entry point. This is the path operators
spend most of their time on.

**Curated webhooks (secondary).** Specific YouTube channels the
operator follows (declared via the Channel Watchlist surface) emit
webhooks on new uploads. The handler pulls the transcript via Path A
(free `youtube-transcript-api`) or Path B (paid AssemblyAI /
gpt-4o-mini-transcribe), creates a `sources` row, and runs the cascade.
Other webhook providers (e.g., specific Substacks the operator follows)
plug into the same shape.

**Optional feed pulls (off by default).** Hansard via openparliament.ca,
RSS, etc. The code lives in `packages/api/src/cron/` but the cron
triggers in `wrangler.toml` are commented out. Operators who want a
continuous low-priority feed can enable them; the default install is
research-and-webhooks-only.

All three modes converge at the Ingestion Critic gate. No source bypasses
grading. No claim writes to the substrate without provenance and an
Admiralty grade.

---

## 6. WHERE TO LOOK FOR WHAT

When in doubt about a design decision, the corresponding reference doc
has the answer:

| Question | Doc |
|---|---|
| What does this table do? Which constraint guards it? | `canopticon-schema-v1.0.md` |
| How does this role behave? What's its prompt? Schema? | `canopticon-skills-v1.0.md` |
| What's the workflow sequence? When does the cascade fire? | `canopticon-workflows-v1.0.md` |
| How are mentions resolved to canonical entities? | `canopticon-entity-resolution-v1.0.md` |
| What does this endpoint return? | `canopticon-api-v1.0.md` |
| What does this term mean? | `canopticon-glossary.md` |
| Why was this decided? | `canopticon-changelog.md` |
| How does the operator UI work? | `canopticon-ui-spec-v1.0.md` and the v9.2 prototype HTML |
| What's the public face? | `canopticon-public-site-spec-v1.0.md` and the v1 public prototype |
| What's the architectural posture? Constitutional principles? | `canopticon-master-synthesis-v1.5.1.md` |
| Which methodology lives where in the system? | `canopticon-methodology-canon.md` ("How the canon is integrated") |

---

## 7. KNOWN RISKS

**Anthropic rate limits.** A long research-agent run can fire many API
calls in a short window. Default tier may bottleneck. Mitigations: the
cost gate is the natural throttle (it pauses when the per-op cap is hit
and prompts the operator); the role runner queues with backoff; budget
for tier upgrade.

**Cost-gate UX.** Every paid op prompts unless whitelisted. Without
sensible whitelist defaults, the operator approves every Anthropic call
during heavy research. Ship with a default whitelist that auto-approves
small operations (Critic, claim_extraction, Verifier on grade-A sources)
under a per-op cap; cross-model and large-context calls always prompt.

**SSE on mobile.** SSE connections drop on mobile network changes. The
client reconnects with `Last-Event-ID` and replays missed events.

**RLS overhead at scale.** RLS adds query overhead. Fine at current
volumes; future optimization is materialized views for hot read paths
(see `canopticon-schema-v1.0.md` §16).

**Public-site RLS misconfiguration.** The public API is PostgREST
against the anon key. A single misconfigured policy leaks private theses.
The deny-by-default test matrix in `supabase/tests/rls/` is the gate;
it must be green before any deploy that touches RLS, and CI fails
otherwise.

**Idempotency under partial failure.** A cascade or research run that
fails mid-step must resume cleanly. Every step writes its
`steps_completed` checkpoint before and after; resume reads the
checkpoint and skips completed steps.

**Webhook signature verification.** Inbound webhooks (YouTube, future
RSS) must verify HMAC signatures or token claims before any side effect.
Unsigned webhook payloads are rejected.

---

## 8. DEPLOYMENT

**Frontend (web):**
- Vercel project linked to GitHub
- Auto-deploy on push to main
- Preview deploys on every PR
- Custom domain: `app.canopticon.com`

**Backend (api):**
- Cloudflare Workers via wrangler
- `wrangler deploy` from CI on push to main
- Custom domain: `api.canopticon.com`
- Cron triggers in `wrangler.toml` (off by default)

**Database (supabase):**
- Production project for prod, dev project for development
- Migrations applied via Supabase CLI in CI
- Backups daily via Supabase's automated backup

**Storage (R2):**
- Bucket: `canopticon-sources`
- Lifecycle: keep indefinitely (sources are append-only; deletion is rare)

**Monitoring:**
- Sentry for both frontend and backend
- Cloudflare Workers built-in analytics
- Supabase logs for database queries
- A `/health` endpoint on the API for uptime monitoring

---

## 9. NOTES TO THE BUILDER

The other reference docs are the spec; this one is the index. When in
doubt about a design decision, the answer is in the corresponding
reference doc — see §6.

Ambiguities surface to the operator before guessing. The discipline of
not-guessing is the discipline of building correctly.

The substrate doesn't care which source comes first. The operator picks.
The architecture supports any starting point. Don't manufacture demos
that lock the system into one.
