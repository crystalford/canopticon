# v2 — the graph era (archived 2026-09-14)

These documents describe the version of Canopticon that tried to build a
self-growing typed knowledge graph: seven node kinds, six edge families,
autonomous expansion sweeps, a settle pipeline, signed readings drafted by a
model and approved by an operator, and thirteen "arrangement" page types
projected out of the graph.

**They bind nothing.** Read them for the reasoning and the failures they
record, not for direction. Designing against them will rebuild a system that
was deliberately stopped.

## What actually happened

The graph was built and, by the project's own assessment in
`docs/canopticon-renovation.md`, "has never eaten a real corpus." The
autonomous machinery was retired in stages — the expand sweep first (it
published unreviewed research reports with a fabricated confidence badge),
then reading auto-drafting, then the cron itself. What survived because it
earns its keep:

- **Quote receipts** (`/q/<id>`) — verbatim verification with byte offsets.
  The strongest idea in the whole era, and the reason this publication is
  more citable than a blog.
- **Timelines** (`arrangements/timeline.ts`) — dated events per subject,
  pure SQL, no model at render time.
- **Search** — Vectorize embeddings over the corpus.

Everything else is scaffolding. See `CLAUDE.md` for what the project is now.

## Contents

| File | What it is |
|---|---|
| `canonical-spec-v2.4.md` | The full v2.4 specification. |
| `canonical-spec-v2.6.md` | Its successor; already self-marked SUPERSEDED. |
| `audit-2026-06-11.md` | A gap audit against the v2 spec. |
| `renovation-brief.md` | Steering doc for a crystallization pass. |
