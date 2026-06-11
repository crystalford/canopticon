# CANOPTICON

A **forensic intelligence publication system**. One operator drops research
documents in; the system reads them into a typed graph of facts, grows a
citable public wiki from that graph, drafts signed interpretive readings on top
of the facts, and the operator approves. **The operator approves; the operator
never authors.**

> **Orientation:** the current architecture is in [`CLAUDE.md`](CLAUDE.md). The
> vision spec is [`docs/canonical-spec-v2.4.md`](docs/canonical-spec-v2.4.md).
> The full version history — how the project evolved from a chat-first CMS to
> the current fabric — is traced in [`docs/LINEAGE.md`](docs/LINEAGE.md).
> Older specs live in [`docs/archive/`](docs/archive/) and are superseded.

## The fabric

```
DOCUMENTS  →  FACTS (typed graph)  →  PAGES (neutral wiki ⇄ signed reading)  →  TRANSFORMS
   IN           extract                 grow + draft (operator signs)            OUT
```

Every subject — an entity, an event, or a **theme** (a received account the
corpus engages with) — is **one page in two modes**: a neutral wiki view
(facts with receipts, contested claims shown as contested) and a signed
reading (the same facts, re-sequenced under a thesis). The firewall guarantees
an attributed assertion is never silently rendered as a neutral fact.

## Stack

- **Runtime** — Cloudflare Workers + Hono. One Worker serves the public site
  (`/`), the operator console (`/op/*`), and the API + admin (`/v1/*`).
- **Rendering** — server-rendered HTML strings. No React, no client framework,
  no JS required to read.
- **Storage** — D1 (SQLite) · R2 (documents) · Vectorize (embeddings).
- **AI** — Workers AI via a per-role model router; Anthropic optional near
  launch.
- **Host** — Cloudflare; auto-deploys on merge to `main`.

## Repo layout

- `packages/api/` — the Worker (extraction, the typed graph, surfacing,
  drafting, all surfaces). The whole app lives here.
- `supabase/migrations/` — D1 schema migrations (applied on deploy).
- `docs/` — the current spec + the lineage; `docs/archive/` is history.
- `.github/workflows/` — CI, deploy, and the admin probe used to drive the
  live system.

## Develop

All testing and deployment is **live on Cloudflare** — there is no local dev
server. Verify before pushing:

```
pnpm --filter @canopticon/api exec tsc --noEmit
pnpm exec biome check packages/api/src
pnpm --filter @canopticon/api exec vitest run
```

Work on `claude/<name>` branches; PR → CI → squash-merge to `main` deploys.
