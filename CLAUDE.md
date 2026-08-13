# Canopticon

> **If you are an AI reading this to understand the project: this file is the
> source of truth. The primary product is CANOPTICON STUDIO — a deterministic
> editorial compiler for documentary and video-essay film. Everything else in
> this monorepo is a separate, compartmentalized system that is maintained but
> not grown. Do not design Studio against the older systems' docs; Studio's
> authority is `docs/studio/`, in the order given below.**

- **Studio** (primary): studio.canopticon.com · **Record**: canopticon.com
- **Twitter**: @canoptics · **GitHub**: crystalford/canopticon

> **One-time setup after the Studio Worker first deploys:** add
> `studio.canopticon.com` in the Cloudflare dashboard under Workers & Pages →
> `canopticon-studio` → Settings → Domains & Routes. The deploy token lacks
> Workers Routes Edit on the zone, so this can't be automated and the Worker
> stays on its workers.dev subdomain until it's done.

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
COMPOSITION ENGINE      intent → a CONSTRUCTED program
     ↓
CONSTRUCTIONS           build a thing, parameterised from the prose
OPERATORS               orthogonal — applied to anything constructed
     ↓
PROCEDURAL PALETTE      128 primitives — the instruction set, not the menu
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

## What's built

`packages/studio` — its own Worker, own D1 (`canopticon-studio`), own R2, own
migration numbering in `supabase/migrations-studio/`.

**The pipeline, end to end.** An essay goes in as prose and comes out as a
compiled plan. Verified on a real 88-scene institutional investigation:

```
POST /project/ingest       essay text → a compilable IR
POST /project/:id/read     propose readings — a model call, bounded
POST /project/:id/ratify   the human act: approve or reject
POST /project/:id/narrate  speak it once, hash it, freeze it, measure it
POST /project/:id/compile  the plan, cached per primitive
```

- `src/compile/segment.ts` — the intake. **Deterministic, no model, by
  design.** Acts from the essay's own headings; scenes bound by character
  offset, scanning forward so a repeated line binds to its own occurrence;
  bullets kept whole; a figure-bearing scene held rigid. It deliberately
  does **not** decide what a sentence is about.
- `src/compile/figures.ts` — quantities lifted by regex and checked as
  literal substrings, plus routes the prose drew explicitly. **No model
  ever touches a figure.** An approximation of `$282,345.84` is a different
  finding.
- `src/compile/extract-reading.ts` — the one model call, at authoring time,
  frozen and ratified. Declines rather than guesses. The hedge floor
  overrules the model, and reads the register — institutional framing
  ("presented as", "framed as") and quoted spans count; bare "claims" does
  not, because an essay about asylum *claimants* is not hedging.
- `src/compile/subject.ts` — **what the sentence names**, from a lexicon
  matched as whole words, each hit carrying its verbatim text and offset.
  The same distinction figures use: whether a sentence NAMES a depictable
  thing is checkable against the prose, so it needs no model and no
  ratification. It is what makes the object families reachable at all.
- `src/compile/phrase.ts` — **the words on screen, chosen not truncated.**
  Candidates from the sentence — the verbatim figure, a proper-noun run,
  the noun it names, its first strong clause — trimmed so a phrase can
  never begin or end on a function word, deduped against the last six
  scenes.
- `src/compile/construct.ts` — **the layer above the palette.**
  CONSTRUCTIONS build a thing with its numbers read off the prose ("nine
  numbered rooms" is a nine-segment chain; a detector vents and blinks
  where a camera domes and does not). OPERATORS are orthogonal and apply
  to anything constructed. CANDIDATES are several genuinely different
  programs per beat, carried on the report. A visual language moves each
  operator's appetite rather than naming a tail; abstraction is a
  PERMISSION that opens and closes which operations may run at all.
- `src/compile/treatment.ts` — the ratified-reading path. A human-approved
  interpretation still outranks everything the constructor infers.
- `src/compile/compose.ts` — the composition engine. Abstraction ladder
  (GROUNDED → ANNOTATED → DECOMPOSED → DISSOLVED), the Constitution's
  8-level precedence order, motif development, restraint ceiling.
- `src/compile/solver.ts` — anchor-based timing, overflow auto-split at
  sentence boundaries, underflow J-cut/underrun, elastic-vs-rigid cascade,
  and the cut into shots.
- `src/compile/shot-plan.ts` — what varies across a cut. Deterministic, and
  it escalates. A contested line is held flatter.
- `src/compile/ground.ts` — **the second input.** A chain is a line and says
  only "then"; a ground says "and". Decides — from the abstraction rung,
  motion energy, density and restraint — whether a scene is composited over
  its own small chain, and refuses on three stated grounds: a pinned scene,
  a restrained film, and a contested line (which is never dramatised).
- `src/narrate/` — narration as a frozen input artifact. `tts.ts` speaks it,
  `align.ts` measures it, `index.ts` hashes both into R2 and names them on
  the IR. Both calls are LADDERS that report the shape they could not use,
  because the last serious bug here was an unverified assumption about a
  Workers AI response shape.
- `src/compile/hash.ts` · `cache.ts` — per-primitive SHA-256 node hashing
  over canonical JSON; cache diff with a stated reason per recomputation.
  The node's ground is in the payload — swapping the layer behind a
  sentence has to move the hash or the film keeps rendering the old one.
- `src/primitives/registry.ts` — **generated**, 128 primitives / 20 families.
  Regenerate with `node scripts/gen-primitive-registry.mjs packages/studio/lab`.
- `lab/` — the Lab. Where primitives actually paint (canvas, seeded, in the
  browser) and where one earns its place before being wired in.

**Timing comes off the audio, not off character counts.** `POST
/project/:id/narrate` speaks each scene once, hashes the bytes into R2,
records an Asset with its provenance, measures word timings, and freezes the
measurement as a second Asset. The anchors the segmenter authored
(`{sceneId}_start` / `{sceneId}_end`) then resolve, `missing_alignment`
clears, and the window is the measured one. Alignment is called what it is —
`asr-proportional`, sentence boundaries landing on real word boundaries at
real measured times — not dressed up as forced.

**Two inputs, not two stacked frames.** Five compositors in `M · COMPOSITING`
take a second input: `layer_over`, `layer_blend`, `layer_mask`,
`field_displace`, `field_erode`. A compositor's first input is the previous
stage's canvas — every primitive paints one — and its second is a GROUND, a
chain of its own run on the same clock. Two of them are typed on that second
input for real: `field_displace` and `field_erode` read a field's NUMBERS, so
a branch that only paints a picture of a field is refused rather than
silently doing nothing. This is what lets a gravity field move a sentence
instead of being painted over by it.

**A figure is not an interpretation.** This is the distinction that makes the
whole thing work on real material. A *reading* — what a sentence is about — is
proposed by a model and ratified by a human, and a scene without one falls back
to the film's own curve. A *figure* is checkable by anyone, so it needs neither.
Which means an institutional essay reaches the chart family from prose alone,
before a model has seen a single sentence.

**The instrument.** `studio.canopticon.com` serves the Lab: six views over ONE
compiler. FILMS lists what is stored and takes a pasted essay; NARRATIVE shows
the prose with every scene bound to its own span; EDITORIAL is the creative
state, and dragging it writes a new IR version and reports what the edit cost;
PREVIEW runs the real chain, plays the frozen narration on the Web Audio
clock, and RENDER writes a `.webm` frame by exact index with the voice on its
own track; COMPILE is the audit;
LAB is where a primitive earns its place. Keyboard throughout, and `/` finds a
scene by what it says.

**There is no second engine.** The Lab used to reimplement the ladder, the
resolver and the cost table in the browser. It reads the Worker's composition
now — two implementations of one rule is how they disagreed about 57 of 88
scenes without anyone noticing.

**The engine proposes; the director ratifies — applied to depiction.**
`POST /project/:id/direct` pins one of the constructed alternatives to a
scene, which is precedence 1 and was always meant to be reachable. The
Preview's right column opens with the VISUAL IDEA — what the shot IS, in a
sentence — above the chain rather than instead of it.

**Tested** (212 tests): a hand-authored IR resolves to correct windows; an
unchanged recompile is 100% cache hit; editing one sentence recomputes only
what depends on it; moving the last control point leaves the film's opening
untouched and spends zero TTS; a pin survives a restyle with the tension
reported; the same IR always produces the same hashes; the real essay segments,
validates, compiles and re-compiles clean; and the flagship chain is asserted
to consume its own upstream at every stage. Narration: a frozen alignment
clears `missing_alignment` AND moves the window to the measured time, audio
survives a failed alignment, and one scene's failure degrades that scene
only. Grounds: the ground reaches the hash, costs what it costs, and a field
compositor refuses a ground that is not a field. Construction: the same
sentence in documentary, pixel and surreal produces three chains differing
in their OPERATIONS rather than a swapped tail; none of the chains a real
essay compiles to is a ladder rung; and the paragraph the architecture is
judged on ("they walked around the city like insects... then there were
dozens of them, moving in strange synchronized waves") builds bodies,
carries them across a sentence made of pronouns, and escalates — more of
them, with the wander taken out.

**Known gaps, stated plainly.**

- **No server-side renderer.** Chains execute in the browser, so a compile
  produces a plan and the export records the canvas in real time. That is L2
  honestly — frames are captured on the browser's clock — not L3.
- **Some of the palette's consumers still ignore their declared input.**
  The compiler measures this (`usage.linkHonesty`, `usage.decorativeLinks`,
  `usage.grounds`) and the Compile view prints it, so pruning happens on
  evidence. The whole raster family was fixed the moment it became
  load-bearing: every one of them declared IMAGE → IMAGE and rastered a
  synthetic "1997" plate, so an operator applied to a constructed object
  replaced it rather than transforming it. That is the difference between
  an operator and a slide, and it is the check to run on any primitive
  before treating it as one.
- **The Studio's information architecture is still the compiler's, not a
  director's.** The VISUAL IDEA card and its alternatives are the first
  piece of the creative loop; a shot-level inspector, a contact sheet, a
  visual-rhythm view, and fork/compare are not built.
- **`POST /project/:id/narrate` has not run against the live AI binding.**
  Both ladders were exercised against fakes covering every response shape
  Workers AI has been known to return, and `POST /v1/tts/probe` exists to ask
  production what it actually returns before trusting any of it. Until that
  probe has run, the model names in `TTS_CANDIDATES` are candidates.

## What's next

Stage 2 is done. `noise_field` + `flow_field` → `glyph_to_points` →
`particle_flow` + `particle_seek` → motion craft → compositing, and the
milestone with it: the text-dissolution chain runs end to end, and with a
ground under it a sentence now comes apart in the shape of the field acting
on it rather than under a random mask.

The immediate next thing is not a feature, it is a probe. Run
`POST /v1/tts/probe` against production and find out what the TTS binding
actually returns before a single scene is narrated for real — the last
serious bug in this system was exactly this assumption left unchecked.

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
