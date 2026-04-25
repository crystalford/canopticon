# CANOPTICON — Handoff Bundle

This is the complete architectural and design package for CANOPTICON, ready for build.

## What this is

CANOPTICON is a forensic intelligence platform for Canadian political and economic structure. The operator app is a mobile-first cockpit; the public site is the published paper. Both read from the same Postgres substrate.

## Where to start

**Read [`docs/canopticon-build-handoff-v1.0.md`](docs/canopticon-build-handoff-v1.0.md) first.** It is the index. Section 17 of that document tells you which other doc answers which question.

The handoff doc specifies Sprint 1 scope, repo structure, environment setup, build order, and acceptance criteria. Once Sprint 1 ships end-to-end on a real Hansard publication (the 12 acceptance criteria in Section 12), Sprint 2 begins.

## What's in this bundle

### Reference documents (12 markdown files)

| File | What it covers |
|---|---|
| `canopticon-master-synthesis-v1.5.1.md` | The architecture. Six constitutional principles, eleven roles, six data structures, methodology-first design. Read second. |
| `canopticon-methodology-canon.md` | The 65+ frameworks (Admiralty, Toulmin, Van Evera, IPCC, Brier, Cynefin, etc.) with deep dives on the top 12. |
| `canopticon-ui-spec-v1.0.md` | Functional spec of every operator screen. |
| `canopticon-public-site-spec-v1.0.md` | The public site: 14 surfaces, AI-search architecture, editorial standards. |
| `canopticon-glossary.md` | Every non-obvious term defined. The vocabulary reference. |
| `canopticon-changelog.md` | How the architecture got to v1.5.1. Decision provenance. |
| `canopticon-schema-v1.0.md` | Postgres schema. Every table, column, RLS policy, trigger. |
| `canopticon-skills-v1.0.md` | The 11 roles as Claude Skills with full prompt templates and output schemas. |
| `canopticon-workflows-v1.0.md` | The 8 workflows. Morning cascade is the centerpiece. |
| `canopticon-entity-resolution-v1.0.md` | Entity resolution + claim deduplication design. |
| `canopticon-api-v1.0.md` | API surface. ~80 endpoints; Sprint 1 needs ~30. |
| `canopticon-build-handoff-v1.0.md` | **Start here.** The Sprint 1 execution plan. |

### Prototypes (2 HTML files)

| File | What it is |
|---|---|
| `canopticon-prototype-v92.html` | The operator app design contract. Mobile-first, six screens. The frontend implements this against real endpoints. |
| `canopticon-public-prototype-v1.html` | The public site design contract. Three surfaces (homepage, article, thesis) demonstrating the editorial register. |

## Sprint 1 scope (one paragraph)

Hansard ingests via cron from openparliament.ca → Ingestion Critic produces a report → operator approves via Sources screen → claim extraction skill writes claims to substrate → Verifier grounds claims using Citations API → Interrogator generates questions → cascade produces a Live feed item → operator sees it on the Live screen. Cost discipline enforced at every paid call. RLS isolation enforced at the database. 18 substrate tables, 3 roles + claim-extraction utility, 3 workflows, ~30 API endpoints, 6 UI screens. Stack: Next.js + Vercel for the operator app, Cloudflare Workers + Durable Objects for the backend, Supabase Postgres + R2 for storage, Anthropic API for roles.

## What's NOT in this bundle (deferred)

- Graph visualization research — Phase E, post-Sprint-1
- Public site auto-generated pages (entity, source, claim, prediction ledger, contradiction tracker) — Sprint 2+
- Tip / contribute surface — when you want it
- The 7 non-Sprint-1 roles (Red Team, Steelman, Premortem, Gap Surfacer, Calibration, Tier Projector, Assumption Auditor, Indicator Validator) — designed in skills-v1.0.md, ship in Sprints 2-3
- Entity resolution and claim deduplication — designed in entity-resolution-v1.0.md, ship in Sprint 2

## Discipline reminders

- **Methodology pluralism, not monism.** No single framework dominates.
- **Provenance over assertion.** Every claim has a visible source and grade.
- **Calibrated language over rhetorical certainty.** IPCC qualifiers.
- **Contradictions preserved over contradictions resolved.** Machloket is legitimate.
- **Operator voice as default.** The system serves a person.
- **No silent spending.** Every paid op prompts unless whitelisted.
- **No editorializing in published content.** Conclusions emerge from facts.
- **Vertical first.** Build the slice end-to-end before adding breadth.

---

Bundle assembled April 25, 2026. Architecture is design-complete. Next step is execution.
