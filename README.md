# CANOPTICON

Forensic intelligence platform for Canadian political and economic structure. Mobile-first operator console, public-facing publication site, both reading from the same Postgres substrate.

The architecture and design package lives in [`docs/`](docs/). Start with [`docs/canopticon-build-handoff-v1.0.md`](docs/canopticon-build-handoff-v1.0.md) — its §17 indexes which reference doc answers which question.

## Repo layout

```
canopticon/
├── README.md                          # this doc
├── package.json                       # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json                 # strict TS, shared by all packages
├── biome.json                         # lint + format
├── .env.example                       # env var template
│
├── docs/                              # the architecture bundle (14 files)
│
├── packages/
│   ├── shared/                        # types, constants, Skill loader, SKILL.md files
│   ├── api/                           # Cloudflare Worker (Hono router + Durable Objects)
│   └── web/                           # Next.js 15 operator console
│
└── supabase/                          # Postgres migrations + RLS test matrix
```

## Setup

Requires Node 22+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env.local            # then fill in keys you have
pnpm typecheck                        # verifies all three packages compile
pnpm test                             # runs vitest across packages
```

External services that need wiring before anything runs end-to-end:

- **Supabase project** — for Postgres, auth, realtime. `supabase link` against the project and `supabase db reset` to apply migrations.
- **Anthropic API key** — for the analytical skills (Ingestion Critic, Verifier, Interrogator, claim_extraction) and for the AI research loop's tool-use agent. Goes into the Worker as a secret via `wrangler secret put ANTHROPIC_API_KEY`.
- **Cloudflare account** — for the Worker, R2 source storage, and Durable Objects. `wrangler login` then `wrangler deploy` from `packages/api/`.

The local-dev path that exercises everything without external deploys: `supabase start` (runs Postgres locally on port 54322), `pnpm --filter @canopticon/api dev` (Wrangler dev server), `pnpm --filter @canopticon/web dev` (Next.js on :3000).

## How CANOPTICON ingests

Three modes, sharing the same substrate and analytical roles:

1. **AI research (primary).** Operator says "research X"; the system runs Claude with web search + fetch + substrate-write tools, and the graph fills in real time. Entry point: `POST /v1/research`.
2. **Curated webhooks (secondary).** YouTube channels the operator follows emit webhooks on new uploads; the handler pulls the transcript and runs the cascade. Other webhook sources plug into the same shape.
3. **Optional feed pulls (off by default).** Hansard via openparliament.ca, RSS, etc. Code lives in `packages/api/src/cron/` but cron triggers are commented out in `wrangler.toml`. Operators who want a continuous feed enable it explicitly.

All three converge at the Ingestion Critic gate. No source bypasses grading.

## Discipline

- **Vertical first.** End-to-end slice on a real Hansard publication beats a half-built schema with no UI.
- **No silent spending.** Every paid op flows through `approvePaidOperation()` before the API call.
- **RLS from row one.** Every table ships with policies enabled. The `supabase/tests/rls/` matrix proves alice/bob/anon isolation in CI.
- **Skills as files.** SKILL.md prompts live in `packages/shared/skills/<name>/`, hashed at load and versioned in `role_definitions.skill_md_hash`.
- **Calibrated language over rhetorical certainty.** IPCC qualifiers in published BLUFs.
- **Provenance over assertion.** Every claim has a source and an Admiralty grade.
