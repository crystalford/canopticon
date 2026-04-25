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
- **Anthropic API key** — for the four Sprint-1 skills (Ingestion Critic, Verifier, Interrogator, claim_extraction). Goes into the Worker as a secret via `wrangler secret put ANTHROPIC_API_KEY`.
- **Cloudflare account** — for the Worker, R2 source storage, and Durable Objects. `wrangler login` then `wrangler deploy` from `packages/api/`.

The local-dev path that exercises everything without external deploys: `supabase start` (runs Postgres locally on port 54322), `pnpm --filter @canopticon/api dev` (Wrangler dev server), `pnpm --filter @canopticon/web dev` (Next.js on :3000).

## What ships in Sprint 1

The minimum slice that makes the system real: Hansard ingestion → Critic gate → operator approval → claim_extraction → claim writes → Verifier grounding → Interrogator question generation → Live feed item. Acceptance criteria are in `docs/canopticon-build-handoff-v1.0.md` §12.

## Discipline

- **Vertical first.** End-to-end slice on a real Hansard publication beats a half-built schema with no UI.
- **No silent spending.** Every paid op flows through `approvePaidOperation()` before the API call.
- **RLS from row one.** Every table ships with policies enabled. The `supabase/tests/rls/` matrix proves alice/bob/anon isolation in CI.
- **Skills as files.** SKILL.md prompts live in `packages/shared/skills/<name>/`, hashed at load and versioned in `role_definitions.skill_md_hash`.
- **Calibrated language over rhetorical certainty.** IPCC qualifiers in published BLUFs.
- **Provenance over assertion.** Every claim has a source and an Admiralty grade.
