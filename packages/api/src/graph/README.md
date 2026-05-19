# Graph compartment

This directory is the **Graph compartment** from the system spec.
Everything AI-driven, substrate-related, or analytical lives here:
extraction, claims, entities, sources, theses, contradictions,
predictions, cascade orchestration, role runners, monitors.

## Seam rules

- **Code under `cms/` MUST NOT import from `graph/`.** The CMS works
  standalone — drafts, publish, public render — with zero graph
  dependency. If `env.GRAPH_ENABLED === "false"`, this entire directory
  becomes inert (no tools surfaced, no graph hook on publish).

- **Code under `graph/` MAY read from CMS** (the `posts` table, for
  example) but should not write to it directly. The one allowed
  cross-compartment touchpoint is `sources.post_id`, which points
  CMS-ward but lives on the graph side.

- **The chat layer at `src/chat/` is shared.** Its `tool-loader.ts`
  assembles the model's tool list from both compartments at request
  time, gating graph tools on `env.GRAPH_ENABLED`.

## Layout

```
graph/
├── lib/                # core graph runtime
│   ├── cascade.ts      # automatic ingest_critic → claim_extraction cascade
│   ├── extract.ts      # PDF/image/URL extraction → sources
│   ├── role-runner.ts  # executes one role_definitions row against a payload
│   ├── watcher.ts      # autonomous Kimi/Llama loop for monitors
│   ├── seed-examples.ts
│   └── embeddings.ts
├── tools/              # chat tools surfaced when GRAPH_ENABLED=true
│   └── index.ts        # TOOLS registry (search_substrate, fetch_url, etc.)
├── routes/             # (future) graph-specific HTTP routes
├── roles/              # (Phase 6) extractor, synthesist, critic, citer, etc.
├── workflows/          # (Phase 6) IngestWorkflow (WorkflowEntrypoint)
├── schemas/            # (Phase 6) JSON schemas for extractor + critic + thesis proposer
└── prompts/            # (Phase 6) role prompts
```

The `roles/`, `workflows/`, `schemas/`, and `prompts/` subdirectories are
present as empty placeholders today and get populated in Phase 6 when
the spec's 8 new graph roles replace the existing 18 forensic roles.

## What's still elsewhere

These should arguably live under `graph/` and will get moved in later
phases as cleanup permits:

- `src/routes/sources.ts`, `claims.ts`, `entities.ts`, `theses.ts`,
  `predictions.ts`, `contradictions.ts`, `cascade.ts`, `monitors.ts`,
  `orchestrator.ts`, `library.ts`, `live.ts`, `embeddings.ts` — all
  graph routes
- `src/lib/seed.ts` — operator-seeding (the 18 role_definitions live
  here, but those get reworked in Phase 6)

Moving them now would inflate this PR. The seam at runtime — which is
what actually matters for "graph is disable-able" — is already enforced
by the tool-loader and the `GRAPH_ENABLED` flag.

## What's intentionally NOT here

`src/llm/index.ts`, `src/llm/workers_ai.ts`, `src/llm/anthropic.ts`,
`src/llm/types.ts` — these are **shared LLM infrastructure** used by
both CMS (for any future LLM-driven post helpers) and Graph (for every
role run). They stay outside the seam.
