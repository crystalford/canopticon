# Canopticon

> **If you are an AI reading this to understand the project: this file is the
> source of truth. The primary product is CANOPTICON STUDIO — a deterministic
> editorial compiler for documentary and video-essay film. Everything else in
> this monorepo is a separate, compartmentalized system that is maintained but
> not grown. Do not design Studio against the older systems' docs; Studio's
> authority is `docs/studio/`, in the order given below.**

- **Domain**: canopticon.com · **Twitter**: @canoptics
- **GitHub**: crystalford/canopticon

---

# THE PRIMARY PRODUCT — Canopticon Studio

**Essay in, film out.** A film is the *compiled artifact* of a versioned,
reproducible source representation — not a one-off render. The video is built
from code: 111 procedural primitives across 18 families, chained by a
composition engine that reads the director's intent.

```
ESSAY / SCRIPT
     ↓
NARRATIVE IR            acts → scenes, bound to the prose by character offset
     ↓
CREATIVE STATE          the film's evolving personality, as curves
     ↓
COMPOSITION ENGINE      intent → primitive chains
     ↓
PROCEDURAL PALETTE      111 primitives, typed inputs and outputs
     ↓
CONSTRAINT SOLVER       narration anchors → time windows
     ↓
RENDER DAG              content-hashed, cache-aware
     ↓
FILM
```

**It is not** an AI video generator, a prompt-to-video wrapper, or a template
engine. If a design decision would make it resemble any of those, it is the
wrong decision.

## Authority order (highest first)

| # | Document | Answers |
|---|---|---|
| 1 | `docs/studio/CANOPTICON_CREATIVE_CONSTITUTION.md` | What does the director express? |
| 2 | `docs/studio/CANOPTICON_PRIMITIVE_ATLAS.md` | What can the machine paint with? |
| 3 | `docs/studio/CANOPTICON_PHASE0_MASTER_SPEC.md` | How does it compile, cache, store? |

`docs/studio/CANOPTICON_00_HANDOFF_BRIEF.md` is the entry point and build
sequence. **Where the Master Spec contradicts the Constitution, the
Constitution wins** — three parts of the Master Spec are already superseded
and the code implements the amended version:

1. Flat per-act `vocabularyMix` → **Creative State control points**. Vocabulary
   mix is a derived, overridable output, never the authoring model.
2. Four fixed block types → **recipes over typed primitives**. Blocks remain as
   defaults the engine can reach past.
3. Per-block cache hashing → **per-primitive cache hashing**.

## Standing rules — non-negotiable

1. **AI output is an input artifact, never a function.** TTS audio, alignment
   JSON, and segmentation proposals are generated once, frozen, hashed, and
   committed. The compiler never calls an AI service at render time.
2. **Timing is anchor-based, never frame-based.** No frame ranges in the IR.
3. **The operator is always in control.** The system proposes; the human
   ratifies. No auto-mutation of the IR.
4. **No `Math.random()`.** Everything stochastic takes a seed.
5. **Every primitive declares typed inputs and outputs.** A primitive that
   consumes nothing and produces only final pixels is a recipe, not a primitive.
6. **Overrides survive restyling.** A pin is never silently discarded by a
   recompile; tension is *reported*, not resolved unilaterally.
7. **Determinism is claimed honestly.** L1 (semantic) always. L2 (pixel) within
   a pinned environment. L2-GPU for shader/3D. L3 is never claimed.
8. **Degrade, flag, continue.** A failure in one scene never blocks the rest of
   the film from compiling.

## The test for every decision

> **Does this let the director express intention, or does it make them specify
> implementation?**

If the latter, it belongs in an Advanced panel or nowhere.

## What's built (Stage 1 — the skeleton)

`packages/studio` — its own Worker, own D1 (`canopticon-studio`), own R2, own
migration numbering in `supabase/migrations-studio/`.

- `src/ir/schema.ts` — the Editorial IR + validation. Creative State control
  points, motifs with development ladders, first-class overrides.
- `src/compile/creative-state.ts` — control-point interpolation, invariant
  floors/ceilings that **report** when they bite.
- `src/compile/compose.ts` — the composition engine. Abstraction ladder
  (GROUNDED → ANNOTATED → DECOMPOSED → DISSOLVED), the Constitution's
  8-level precedence order, motif development, restraint ceiling.
- `src/compile/solver.ts` — anchor-based timing, overflow auto-split at
  sentence boundaries, underflow J-cut/underrun, elastic-vs-rigid cascade.
- `src/compile/hash.ts` · `cache.ts` — per-primitive SHA-256 node hashing over
  canonical JSON; cache diff with a stated reason per recomputation.
- `src/primitives/registry.ts` — **generated**, 111 primitives / 18 families.
  Regenerate with `node scripts/gen-primitive-registry.mjs packages/studio/lab`.
- `lab/` — the Lab. Where primitives actually paint (canvas, seeded, in the
  browser) and where one earns its place in the palette before being wired
  into the pipeline.

**Stage 1 milestone is met and tested** (`packages/studio/tests/compile.test.ts`,
31 tests): a hand-authored IR resolves to correct windows; an unchanged
recompile is 100% cache hit; editing one sentence recomputes only what depends
on it; dragging the abstraction curve spends zero TTS and leaves early scenes
untouched; a pin survives a restyle with the tension reported; the same IR
always produces the same hashes.

## What's next

Stage 2 — the primitives that prove code is a medium, in this order:
`noise_field` + `flow_field` → `glyph_to_points` → `particle_flow` +
`particle_seek` → **motion craft layer** → compositing. Milestone: the
text-dissolution chain runs end to end and a word assembles from scattered
particles, holds, and dissolves into drift.

Then Stage 3 (documentary workhorses), Stage 4 (Director's Control Surface,
visual memory, override types), Stage 5 (remainder — cut from the bottom).

Build the **five views** alongside stages 1–4, not after: Narrative,
Editorial, Preview, Compile, Lab. **Lab first** — it is how you find out
whether a primitive reads on screen before it goes near the pipeline.

---

# COMPARTMENTALIZED — maintained, not grown

These are separate systems that predate the Studio pivot. They are kept and
they keep working. **Do not grow them, do not couple them to Studio, and do
not treat their docs as design authority for anything.** Each has its own
Worker, its own database, and its own deploy.

### `packages/api` — **the Record** (canopticon.com)

A forensic intelligence publication: a typed graph (7 node kinds, 6 edge
families) grown from uploaded research documents, rendered as a citable public
wiki with signed interpretive readings on top. Real, working, and full of real
content — 50+ research documents, subject pages, investigations, a library.

Its own D1, migrations in `supabase/migrations/`, deployed by
`deploy-api.yml`. Treat it as a **record-keeping / CMS system**: fix bugs,
keep it live, don't extend the model.

Its own internal rules, still true of it: the operator approves and never
authors; upload is authorization; verification is mechanical (every published
quote is a literal substring of a real stored source, verified by an
independent different-family judge); an attributed assertion is never silently
a neutral fact.

Historical docs for the Record live in `docs/` (`canonical-spec-v2.6.md`,
`canopticon-renovation.md`, `LINEAGE.md`, `docs/archive/`). **They describe
the Record only.** They are not Studio design input.

### `packages/video` — render surface + reaction tool (video.canopticon.com)

Two unrelated things sharing a Worker. `routes/from-reading.ts` drafts an
already-signed Record analysis into a video script through a human-approval
rail. `src/react/*` is a standalone personal reaction-video tool (record on
camera against an external clip). Neither is Studio; Studio does not build on
either.

### `packages/blindspot` — Instruments (blindspot.canopticon.com)

A standing home for standalone software side-projects, each judged on its own
merits. The Blind Spot (an inequality-measurement instrument) is the first.

---

# Stack

Shared across every Worker in the monorepo; nothing else is shared.

- **Runtime**: Cloudflare Workers + **Hono**, TypeScript.
- **Storage**: **D1** (SQLite) · **R2** · **Vectorize** (Record only).
- **AI**: **Workers AI**. The Record routes by role
  (`packages/api/src/llm/router.ts`). Studio uses it only at authoring time
  (segmentation, TTS) and freezes the output.
- **Rendering**: server-rendered HTML by string concatenation. No JSX, no
  React, no client framework, no frontend build step. Studio's Lab is plain
  canvas + vanilla JS for the same reason.
- **Migrations**: plain numbered SQL, applied on deploy via
  `wrangler d1 migrations apply`. Each Worker has its own directory —
  `supabase/migrations/` (Record), `migrations-video/`, `migrations-studio/`.
- **Host**: Cloudflare, auto-deploy on merge to `main` per-package.

# Dev environment — IMPORTANT

- The operator works in Claude Code on the web, NOT a local IDE.
- **All testing/deployment is LIVE on Cloudflare.** No local dev server, no
  local D1. Merge to `main` → deploys automatically.
- Do NOT suggest `npm run dev`. Verify with:
  ```
  pnpm -r typecheck
  pnpm exec biome check .        # CI runs this WITHOUT --write
  pnpm -r test
  ```
- The **Lab runs locally as a static page** — open
  `packages/studio/lab/Canopticon.html` in a browser. It needs no server, and
  it is the fastest way to see whether a primitive actually looks good.
- To inspect the live Record, trigger `.github/workflows/canopticon-admin-probe.yml`
  (workflow_dispatch with a `path`); it calls canopticon.com through Cloudflare
  Access and commits the response to `ops/probe/response.json`. It is hardcoded
  to canopticon.com and cannot reach the other Workers.
- Branch convention: `claude/<name>`. Never push to `main` directly; PR + CI +
  squash-merge.

# Env / bindings

```
Studio:  DB (D1 canopticon-studio) · FILES (R2) · AI
Record:  DB (D1 canopticon) · FILES (R2) · EMBEDDINGS (Vectorize) · AI
Secrets: ANTHROPIC_API_KEY (optional) · CRON_SECRET
         CF_ACCESS_CLIENT_ID · CF_ACCESS_CLIENT_SECRET (admin probe)
         SESSION_SECRET (Record operator session cookie)
```
