# CANOPTICON — Changelog

This document is the paper trail of major architectural decisions. It exists so that anyone reading the system later — including future-self — can reconstruct *why* it is shaped this way, not just *how* it currently is. Decisions are listed in reverse chronological order (newest first).

The changelog is conservative about what counts as a "decision worth recording." Cosmetic changes, individual prompt iterations, schema column additions, and routine bug fixes are not here. What's recorded: architectural pivots, substrate redesigns, role-set changes, methodology integrations, discipline commitments, scope changes.

---

## v2.2 — Comprehensive prototype bundle (April 2026)

The visual specification expanded from 2 single-file prototypes (legacy v9.2 operator + public) to a comprehensive bundle covering every surface mentioned in the documentation. Added `prototypes/` directory with:

- **19 public-site prototypes** covering homepage, articles, theses, prediction ledger, contradiction tracker, methodology, about, glossary, subscribe, search, corrections, plus the auto-generated entity / source / claim page templates, plus the three output-framework surfaces (argument map, solution inventory, frame genealogy), plus the article and thesis page templates.
- **16 operator-app prototypes** covering all six bottom-nav surfaces (Live, Graph, Studio, Library, Sources, System), all six Studio tab variants (Ready, Recording, Producing, Publish, Perf, Archive), the full-screen recording overlay, and four modal/queue UIs (cost approval, publish-prep checks, entity resolution queue, claim deduplication queue).
- **One `prototypes/index.html`** linking and describing every surface.

All prototypes are single-file HTML with inlined CSS — no build step, no shared assets, no dependencies. Each renders standalone in any browser. Real Canadian-political examples (Carney, Brookfield, PBO, Bank Act, OSFI) used throughout for content reference and visual coherence across surfaces.

The intent: when Claude Code or any other implementation environment builds the actual application, it has a complete visual contract to work against rather than having to interpret design from prose specs.

---

## v2.1 — Output framework integration (April 2026)

The intellectual output framework — previously a standalone addendum doc — was integrated as a first-class part of the system. Added `canopticon-output.md` covering:

- Root-striking discipline and the three intervention levels (symptom / mechanism / structural)
- Five Whys protocol with substrate enforcement (`five_whys_chains` table)
- Three intellectual output modes (intelligence theses, policy briefs, books) with formats and disciplines
- Solution inventory primitive (`solution_inventories`, `solution_entries` tables)
- Six-layer argument tree (`argument_maps` table) — distinct from and complementary to the four-layer topic template
- Frame genealogy / argument propagation analysis (`frame_genealogies` table)
- Undismissability architecture (seven publish-prep requirements)
- Coined vocabulary discipline (theses ship with a phrase that compresses the structural insight)
- Document type taxonomy via `article_type` enum

Three new roles added to the catalog: `solution_inventory_builder`, `argument_mapper`, `genealogy_tracer`. Total role count now 17.

The publish-prep workflow extended to enforce the seven undismissability checks before allowing `is_public = TRUE` on a thesis publishing as `intelligence_thesis`.

The methodology canon section in `canopticon-thinking.md` expanded with proper integration of zhengming, Bacon's idols, Lakoff's conceptual metaphor, and Walton's argumentation schemes. Added the meta-principle that the canon is anti-monistic — methodology pluralism, not monism — with explicit second-tier (situational) and third-tier (rare) framework awareness.

A sixth operator discipline added: root-striking. The five become six: calibration, falsifiability, layer, provenance, contradiction, root-striking.

The closing principle ("the system maps; you decide") added as a new section to `canopticon-thinking.md`.

---

## v2.0 — Documentation consolidation (April 2026)

The 12+ separate documents accumulated across many sessions were consolidated into 5 coherent reference docs written end-to-end with a single voice:

- `canopticon-thinking.md` — philosophy, methodology canon, constitutional principles, operator disciplines
- `canopticon-system.md` — substrate, roles, workflows, entity resolution, production engine, architectural commitments
- `canopticon-interfaces.md` — operator UI, public site, API surface
- `canopticon-glossary.md` — vocabulary
- `canopticon-changelog.md` — this document

Plus two prototype HTMLs as visual reference (operator app v9.2, public site v1).

The consolidation removed prescriptive build framing (sprint phases, day-by-day timelines, acceptance criteria, demo flows, "minimum viable" prescriptions) that had crept into the prior documentation set and was inappropriate for a reference architecture. The docs describe what the system is, not how to build it on a calendar.

The consolidation also integrated the production engine as a first-class part of the system, rather than a separately-extracted piece, with full substrate (`productions`, `scripts`, `beats`, `production_publishes`, `production_perf`), state machine (Ready / Recording / Producing / Publish / Perf / Archive), and pipeline (Script → Coherence → Record → Edit → Publish).

The role count became 14 with the explicit naming of three previously-implicit utility skills: `claim_extraction`, `entity_resolver`, `claim_deduplicator`. Previously these existed in workflow descriptions but were not first-class named roles in the skills catalog.

The `users.ingestion_apis_enabled` toggle was added as the master switch for all automated external ingestion (webhooks, cron, AI-driven queries), default FALSE. This codified the discipline that operator-driven ingestion is the default and automated ingestion is opt-in.

The `question_dependencies` table was added to make the Question Graph an actual graph rather than a tree.

A CI-required RLS test matrix was specified to prevent single-policy misconfigurations from leaking private substrate data through the public anon key.

Cross-model verification was clarified as operator-toggled and gated by the cost discipline; default off.

---

## v1.5.1 — Workflow orchestration consolidation (April 2026)

Pivoted definitively from autonomous multi-agent framings to workflow-orchestration-over-rich-substrate. The pivot was grounded in:

- Cognition's June 2025 essay documenting limits of multi-agent systems
- Anthropic's multi-agent research showing ~15× token cost vs single-agent equivalents
- The MAST taxonomy from ICLR/NeurIPS 2025 cataloguing 14 named failure modes across 1,600+ multi-agent traces

The orchestrator became plain TypeScript code on Cloudflare Workers — a state machine reacting to substrate events via an event bus. Roles became named prompt templates packaged as Claude Skills. The shared state lives in Postgres substrate, not in inter-agent message passing.

This pivot consolidated several scattered architectural intuitions into an explicit commitment. It also closed the door on framework adoption (LangGraph, AutoGPT, CrewAI patterns) as architectural foundations.

---

## v1.5 — Methodology canon expansion (March 2026)

The methodology canon expanded from a handful of frameworks (Toulmin, Admiralty, IPCC) to the broader integrated set documented in `canopticon-thinking.md`:

- Cynefin for thesis-level domain tagging
- Lakatos progressive/degenerating diagnosis for thesis health
- Peirce abduction as the canonical inference type for role-based reasoning
- Meadows leverage points for the architectural and distributive layers
- McLuhan as foundational influence on the framing layer and platform self-conception
- Popper falsifiability as the Premortem role's central question
- de Bono Six Hats as Red Team vantages
- catuṣkoṭi and machloket as non-binary contradiction postures
- Van Evera tests for evidence weighting

The methodology canon stopped being a separate "reference document" and became integrated description: each framework lives at specific points in the substrate or in specific roles' prompts.

---

## v1.4 — Production engine integration (March 2026)

The production engine — previously sketched as a possible future addition — became a first-class part of the system. The Studio screen was added to the operator app with six tabs (Ready / Recording / Producing / Publish / Perf / Archive). The substrate gained `productions`, `scripts`, `beats`, `production_publishes`, `production_perf` tables. The chunked-recording pattern (beats as 10-30 second discrete recording units with full resumability) was specified.

This integration recognized that CANOPTICON's output formats include not just articles but video essays, documentary cuts, audio essays, shorts, threads — and that a content pipeline shaped around the operator's voice as the through-line was a core part of the system, not a peripheral concern.

The pipeline indicator (Script → Coherence → Record → Edit → Publish) was specified as a visual constant across all six Studio tabs. The Coherence step was named distinctly from "Verify" because it covers both source-grounding (for factual content) and structural coherence (for argumentative content).

---

## v1.3 — Entity resolution and claim deduplication design (March 2026)

The four-stage pipeline (Capture → Block → Match → Decide) was specified for both entity resolution and claim deduplication. The decision matrix codified when to auto-merge, when to surface to operator, and when to create new entities/claims.

Schema additions: `entity_resolution_log`, `entity_merge_history`, `entity_resolution_queue`, plus equivalent claim-side queue patterns. pgvector embeddings on `entities` and `claims` for semantic blocking. Adjacency-list patterns confirmed for entity_relations and claim_relations (no Neo4j).

The provenance guarantees were explicitly stated: every merge is reversible, every match has reasoning, operator decisions trump LLM decisions when they disagree.

Realistic accuracy expectations were grounded in 2025 ER benchmarks: ~90% precision / ~70% recall with semantic blocking. The operator review queue is the safety mechanism for the remaining 30% recall gap, not a flaw.

---

## v1.2 — Role expansion and gap surfacer specification (February 2026)

The role set expanded to its current eleven named roles (plus the three utility skills added in v2.0). The Gap Surfacer's seven-stage sweep was specified with concrete signals per stage:

1. Missing entities
2. Missing relations
3. Missing counter-evidence
4. Missing time periods
5. Missing stakeholder perspectives
6. Missing comparison cases
7. Missing disconfirming indicators

Plus structural-hole detection (Burt's structural-hole concept applied to the claim graph — narrow bridges between large clusters indicate analytical thinness).

The Premortem role's required output was tightened to demand at least one falsifying observation, or an explicit `is_falsifiable = FALSE` flag. Theses without falsifying observations cannot publish without operator override.

---

## v1.1 — Cost discipline as constitutional commitment (February 2026)

The no-silent-spending discipline was promoted from "best practice" to constitutional commitment, wired through schema (`cost_ledger`, `cost_whitelists`), API (every paid endpoint passes through the cost gate), orchestrator (no fallback paths that bypass), and operator UI (cost approval modal as canonical primitive).

The single chokepoint pattern (`approvePaidOperation()`) was specified to prevent the gate from being bypassed by clever workflow design.

The two-path transcription discipline (Path A free / Path B paid, no Path C) was codified. LLM-as-transcriber was explicitly forbidden after several incidents of model hallucination of transcripts from URL metadata.

---

## v1.0 — Initial substrate design (January 2026)

The first cohesive substrate design. Six core registries plus their version histories: claims, theses, sources, assumptions, indicators, contradictions. Plus predictions, articles, books, entities. Postgres-only architecture (no Neo4j, no separate graph database) with pg_trgm for fuzzy text and the planned addition of pgvector for semantic similarity.

Append-only versioning for claims, theses, articles. Single-current-version enforcement via trigger. RLS at every table from day one.

The four-layer template (Factual / Framing / Architectural / Distributive) was wired into the schema as the `claim_layer` enum. Cross-layer contradictions preserved rather than flattened.

Admiralty grading on every source and every claim. IPCC qualifier on theses and predictions. Toulmin structure on `claim_versions`. The integration of intelligence-tradition rigor (Admiralty), philosophy-of-science rigor (Popper, Lakatos, Toulmin, Van Evera), and forecasting rigor (Brier, IPCC) into a single substrate was the intent of v1.0.

---

## Pre-v1.0 — Conceptual gestation

Before the substrate had its current shape, CANOPTICON went through several conceptual iterations:

- Originally framed as an AI-augmented investigative journalism platform; reframed as forensic intelligence platform when the journalism framing kept pulling toward narrative shaping inappropriate for the work
- Originally planned around multi-agent autonomy; pivoted to workflow orchestration as the autonomous-agent literature accumulated (see v1.5.1)
- Originally conceived with Neo4j for graph operations; collapsed to Postgres-only after analysis of typical query patterns showed adjacency lists were sufficient and operational simplicity outweighed marginal performance
- Originally conceived without a public site; the public site became core when the trust model crystallized — every claim sourced, every prediction banked, every contradiction visible — as a credibility offering that requires actual public surfaces

The conceptual gestation accumulated several frameworks (McLuhan, machloket, Lakatos, Cynefin, the four-layer template, the IPCC adoption) that became foundational. The system's commitments are downstream of the operator's reading.

---

## Notes on what doesn't appear in this changelog

**Daily prompt iteration.** Role prompts evolve continuously; SKILL.md hash changes propagate without ceremony. The current prompts are in the deployed SKILL.md files, not here.

**Schema column additions.** Routine schema evolution (new columns, new indexes, new triggers) happens via migration files. The current schema is in `canopticon-system.md` §2.

**Bug fixes and infrastructure tuning.** Operational maintenance — rate limit adjustments, retry policy tuning, Cloudflare Worker memory tweaks — does not enter the changelog.

**Individual published articles, theses, productions.** These are content, not architecture. They live on the public site, not here.

**UI iteration within the established register.** The aesthetic tokens (colors, typography, geometry) are stable. The specific arrangement of controls on a screen evolves; that evolution is not changelog material.

What enters the changelog is what would surprise a reader who knows the current state of the system but doesn't know how it got there. The goal of this document is to make those surprises legible.
