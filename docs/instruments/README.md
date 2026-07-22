# CANOPTICON Instruments

The third product arm of canopticon. Standalone, code-built measurement tools. Each instrument makes something visible that the official measurement structurally cannot — and each ships with three layers: a method paper that proves it, a live instrument that shows it, and a content layer that spreads it.

## Anatomy of an instrument

Every CANOPTICON instrument has three deliverables, in dependency order:

1. **The method paper** proves it. Precise, falsifiable, reproducible, honest about uncertainty. Source of truth lives in the package (`packages/<name>/src/content/`) and is mirrored for the record at `docs/instruments/<name>/method-paper.md`; it renders at `<name>.canopticon.com/method`.
2. **The instrument** shows it. The live tool that runs the method. Server-rendered HTML, no JS unless a privacy-preserving client-side calculator genuinely requires it. Lives at `packages/<name>/`.
3. **The content layer** spreads it. The CANOPTICON pieces — in the publication or as video segments — that use the instrument to land specific stories.

Build in that dependency order even when releasing together. The paper keeps the other two honest.

## Architecture

- **Monorepo, one package per instrument.** No mono-instrument, no silent coupling.
- **One subdomain per instrument.** `<name>.canopticon.com`.
- **The publication is the trust anchor.** Instruments authenticate against `canopticon.com/auth/*`; a single session cookie scoped to `.canopticon.com` recognises the operator everywhere. The shared package `@canopticon/shared` holds only the cookie verifier — every instrument carries its own data model, its own ingest, its own UI.
- **Push-button, not cron.** Ingest runs when the operator clicks *Refresh sources* (`POST /refresh`, operator-gated). No scheduled pulls until a flow is settled.
- **Provenance is structural.** Every published number is traceable to a stored R2 snapshot of a real public statistic. Nothing vouched.

## Adding a new instrument

Mirror The Blind Spot:

1. New package: `packages/<name>/` (copy the `packages/blindspot/` shape — `env.ts`, `auth.ts`, `index.ts`, `pages/shell.ts`, `routes/*`).
2. New subdomain: `<name>.canopticon.com` (added once in the Cloudflare dashboard after first deploy).
3. New deploy workflow: `.github/workflows/deploy-<name>.yml` (mirror `deploy-blindspot.yml`).
4. New migration tree: `supabase/migrations-<name>/`.
5. New method paper: `docs/instruments/<name>/method-paper.md` + runtime content in `packages/<name>/src/content/`.
6. Add a card to `packages/api/src/public/render/instruments.ts`'s `INSTRUMENTS` array.
7. Add a `wrangler deploy --dry-run` step for the new Worker to `.github/workflows/ci.yml`.

## Current instruments

- **The Blind Spot** — Canada's three official methods of estimating top-tail wealth disagree most at the very top. The instrument quantifies the spread as the **Invisibility Index**. Lives at `blindspot.canopticon.com` (`packages/blindspot/`). Docs: [`blindspot/`](./blindspot/).
