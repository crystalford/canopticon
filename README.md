# CANOPTICON

A **citable public record**. Research documents and essays are uploaded and
published as themselves — kept whole, given a permanent address, and made as
legible to search and answer engines as to people.

> **Orientation:** the current architecture is in [`CLAUDE.md`](CLAUDE.md) —
> read that first, and treat it as the source of truth. The version history is
> traced in [`docs/LINEAGE.md`](docs/LINEAGE.md). Everything under
> [`docs/archive/`](docs/archive/) is superseded and binds nothing.

## The shape

```
UPLOAD  ──▶  extract  ──▶  published page at /p/<slug>
                               │
                               ├──▶  /p/<slug>.md    a plain-text twin
                               ├──▶  JSON-LD          Article · DigitalDocument · FAQPage
                               ├──▶  /sitemap.xml · /llms.txt · /feed.json
                               └──▶  /q/<id>          verified quote receipts
```

Upload *is* publication — there is no draft step. Two kinds of thing get
published: **research** (a primary document, published as itself) and
**essays** (arguments written to a Markdown convention where each section
answers the question it asks). The convention is documented in `CLAUDE.md`
and on the site's own `/about` page.

Every quote drawn from a stored source is verified as a literal substring of
that source, with its byte offset recorded, by code rather than by assertion.
Each one gets its own citable URL. That is the part a blog cannot copy.

## Stack

- **Runtime** — Cloudflare Workers + Hono. One Worker serves the public site
  (`/`), the operator console (`/op/*`), and the API + admin (`/v1/*`).
- **Rendering** — server-rendered HTML strings. No React, no client framework,
  no JS required to read.
- **Storage** — D1 (SQLite) · R2 (documents) · Vectorize (embeddings).
- **AI** — Workers AI, at authoring time only. Nothing calls a model to render
  a page.
- **Host** — Cloudflare; auto-deploys on merge to `main`. No cron: an idle
  site costs nothing.

## Repo layout

- `packages/api/` — **the publication.** The primary product.
- `packages/studio/` — a generative film engine. Parked, maintained, not grown.
- `packages/video/`, `packages/blindspot/` — separate compartmentalized tools.
- `supabase/migrations/` — D1 schema migrations (applied on deploy).
- `docs/` — lineage and reference; `docs/archive/` is history.
- `.github/workflows/` — CI, deploy, and the admin probe.

## Develop

All testing and deployment is **live on Cloudflare** — there is no local dev
server. Verify before pushing:

```
pnpm -r typecheck
pnpm exec biome check .        # CI runs this WITHOUT --write
pnpm -r test
```

To *see* a change without deploying, `packages/api/scripts/look.mts` renders
the real app against a seeded in-memory database and screenshots it.

Work on `claude/<name>` branches; PR → CI → squash-merge to `main` deploys.
