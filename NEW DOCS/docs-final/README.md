# CANOPTICON

A forensic intelligence platform for Canadian political and economic structure.

This is the architectural reference for the system. It is not a build plan. It describes what the system *is* — its substrate, its roles, its workflows, its interfaces, the disciplines it enforces, the philosophy it rests on. How to build it on what timeline is the operator's call.

---

## Where to start

**Read [`docs/canopticon-thinking.md`](docs/canopticon-thinking.md) first.** It is the philosophical foundation. Without it, the technical decisions in the other documents look arbitrary; with it, they look inevitable.

Then proceed by need:

- Building the substrate, roles, workflows, or production engine? Read `canopticon-system.md`.
- Building the operator app, the public site, or anything that calls the API? Read `canopticon-interfaces.md`.
- Working on what the system *produces* — theses, policy briefs, argument maps, books, the disciplines around root-striking and undismissability? Read `canopticon-output.md`.
- Encountering a term that needs definition? Search `canopticon-glossary.md`.
- Wondering why some piece of the architecture is shaped the way it is? Check `canopticon-changelog.md`.

The two HTML prototypes (`canopticon-prototype-operator.html` and `canopticon-prototype-public.html`) are the legacy v9.2 single-file references. **For full visual coverage of every surface in the platform, see [`prototypes/index.html`](prototypes/index.html)** — the comprehensive prototype bundle covering 19 public surfaces and 16 operator screens. Open `prototypes/index.html` in a browser to navigate the complete visual specification.

---

## What's in this bundle

| File | What it covers |
|---|---|
| `docs/canopticon-thinking.md` | Philosophy, six constitutional principles, four-layer template, six operator disciplines, methodology canon, voice, trust model, what CANOPTICON is and is not |
| `docs/canopticon-system.md` | Substrate (Postgres schema, 35+ tables), 17 roles, 8 workflows, entity resolution and claim deduplication pipelines, the production engine, ingestion architecture, stack |
| `docs/canopticon-interfaces.md` | Operator app (6 screens, recording overlay, modals, realtime), public site (14 surfaces, AI-search architecture, editorial standards), API surface, accessibility |
| `docs/canopticon-output.md` | Root-striking discipline, Five Whys protocol, three intellectual output modes (theses, policy briefs, books), solution inventory primitive, six-layer argument tree, frame genealogy, undismissability architecture, coined vocabulary discipline |
| `docs/canopticon-glossary.md` | Vocabulary reference for epistemic, system-specific, operational, and Canadian regional terms |
| `docs/canopticon-changelog.md` | Paper trail of major architectural decisions and the reasoning behind them |
| `docs/canopticon-prototype-operator.html` | Visual reference for the operator app (mobile-first, dark cockpit, six screens with tabs and full Studio production engine) |
| `docs/canopticon-prototype-public.html` | Visual reference for the public site (paper-on-ink editorial register, three surfaces shown) |

Total: 6 markdown documents + 2 legacy HTML prototypes + comprehensive `prototypes/` bundle (36 single-file HTML prototypes covering every surface). Self-contained, no external references required to build from.

## The prototype bundle

The `prototypes/` directory contains a complete visual specification of every surface mentioned in the documentation. Each file is a single self-contained HTML — no build step, no dependencies — that can be opened directly in any browser.

```
prototypes/
├── index.html                      ← Navigate from here
├── public/                         ← 19 reader-facing surfaces (paper-on-ink editorial register)
│   ├── home.html
│   ├── article-revolving-door.html
│   ├── thesis-monetary.html
│   ├── predictions.html            ← Prediction Ledger
│   ├── contradictions.html         ← Contradiction Tracker
│   ├── argument-map-housing.html   ← Six-layer argument tree
│   ├── solution-inventory-housing.html
│   ├── frame-genealogy-housing-supply.html
│   ├── methodology.html
│   ├── glossary.html
│   ├── corrections.html
│   ├── claim-carney-brookfield.html ← Toulmin claim template
│   ├── entity-carney.html          ← Auto-generated entity page
│   ├── source-oic-2026-0143.html   ← Auto-generated source page
│   └── ... (search, subscribe, about, indexes)
└── operator/                       ← 16 cockpit surfaces (dark-mode mobile)
    ├── live.html                   ← Bottom nav 1
    ├── graph.html                  ← Bottom nav 2
    ├── studio.html                 ← Bottom nav 3 (six tab variants)
    ├── library.html                ← Bottom nav 4
    ├── sources.html                ← Bottom nav 5
    ├── system.html                 ← Bottom nav 6
    ├── recording.html              ← Full-screen beat reader
    ├── cost-approval-modal.html
    ├── publish-prep-modal.html
    ├── entity-resolution-queue.html
    └── claim-dedup-queue.html
```

All examples use real Canadian-political content (Carney, Brookfield, PBO, Bank Act, OSFI, BoC) for content reference and continuity across screens.

---

## Architectural commitments at a glance

These show up everywhere in the documents. They are non-negotiable design choices.

- **Workflow orchestration over autonomous agents.** Plain code reacting to substrate events. No agent framework. No autonomy loop.
- **Substrate-first.** Roles read from substrate and write to substrate. The substrate is the shared state.
- **Append-only versioning** for claims, theses, articles, predictions.
- **Provenance is mandatory.** Every claim has a source. Every registry entry has a role-invocation trail.
- **Tenant isolation via RLS.** Postgres Row-Level Security on every table. Application code does not filter by user_id.
- **Adjacency-list graphs in Postgres.** No Neo4j.
- **Cost discipline at a single chokepoint.** Every paid operation passes through one function. No fallback paths bypass it.
- **Ingestion APIs default off.** A master toggle (`users.ingestion_apis_enabled`) controls all automated external ingestion.
- **LLM-as-transcriber forbidden.** Path A (free YouTube captions) and Path B (paid AssemblyAI/openai) only. No Path C.

---

## Stack

Next.js + Vercel for frontends (operator app and public site). Cloudflare Workers + Durable Objects + Queues + R2 + Cron for backend. Supabase (Postgres 15 + GoTrue + Realtime) for substrate, auth, and database events. Anthropic API (`claude-opus-4-7`) for roles. AssemblyAI for paid transcription. GPT-5/Gemini for cross-model verification (operator-toggled).

Custom domains: `canopticon.com` (public site), `app.canopticon.com` (operator app), `api.canopticon.com` (API).

---

## What this bundle is not

- Not a project plan. There are no sprints, no phases, no day-by-day timelines, no acceptance criteria. The architecture is design-complete. How to translate it into code on what schedule is open.
- Not a complete codebase reference. The OpenAPI spec, the deployed SKILL.md files, and the migration files are the authoritative implementation artifacts. The documents here describe the contract; the code is the implementation.
- Not a finished product description. The system is built to be used; using it shapes its evolution. The current architecture is the starting state, not the end state.

---

The system is the methodology made executable. Without the substrate, this would be a way of thinking. With the substrate, it becomes infrastructure.
