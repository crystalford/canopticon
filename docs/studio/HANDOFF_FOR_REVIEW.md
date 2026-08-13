# Canopticon Studio — session handoff

> Written to be handed to someone with no access to the repo. Self-contained.
> Everything stated as measured is measured; everything unproven says so.
> Branch `claude/upload-new-version-docs-6fa92`, latest commit `4dc1767`.

---

## 0. What the system is

**Essay in, film out.** A film is the compiled artifact of a versioned,
reproducible source representation — not a one-off render. Prose is
segmented into acts and scenes, read semantically, composed into a scene
graph, and executed as a chain of procedural primitives on canvas.

Hard rules that constrain every decision below:

- AI output is a **frozen input artifact**, never called at render time.
- Timing is **anchor-based** (measured off narration), never frame-based.
- **No `Math.random()`** — everything stochastic takes a seed.
- The operator ratifies; the system proposes.
- Determinism is claimed honestly: L1 always, L2 in a pinned environment,
  never L3.
- Degrade, flag, continue.

The palette is **129 primitives across 20 families** (typographic, vector,
generative, particle, physics, data, network, timeline, documents, raster,
shader, 3D, compositing, audio, motion craft, interface, cut grammar,
maps, entity, material).

---

## 1. The arc of this session, in order

Each step was driven by an actual measurement, and several of them
overturned the step before.

### 1.1 `plane.weight` and `plane.depth` reach pixels

The scene planner computed a weight and depth per semantic plane and
**nothing downstream read either**. Closing that loop immediately exposed
a live bug: the sentence *"At first nobody noticed"* was rendering its
anomaly at **0.85 of the frame** — the largest thing on screen — while the
narration said nobody saw it. Forced to 0.30; the scene is now visibly
smaller than the two around it.

Recorded as a hard rule: **one authoritative translation point per
semantic quantity.** The semantic layer says *this plane has visual
importance 0.30*; it never says *make it smaller*. Exactly one function
turns that number into parameters.

### 1.2 N-plane composition

A scene could hold a SETTING *or* a COUNTERPOINT, never both — the
one-winner failure moved down a layer. Now every plane behind the subject
becomes a real construction and they nest, far to near, on compositors'
second inputs.

Four consumers had to learn that a ground can carry a ground, and **every
one of them would have failed silently**: the cache hash flattened one
level (change the deepest layer, every hash identical, cache serves old
frames), the film-plan conversion amputated everything below the first
layer, the palette-usage measure reported deep layers as unused, and cost
counted one level.

### 1.3 The director model — world population and attention

Two dimensions, both biases, both neutral at 0.5 so no existing film
moved. Measured on one sentence:

```
population 0.1 / 0.5 / 0.9   world 17 / 41 / 67 cars   subject 0.427 FLAT
attention  0.1 → 0.9         world 48 → 35 cars        subject 0.378 → 0.475

across a 3×3 grid:  1 distinct role set,  9 distinct pictures
```

The subject is deliberately immune to population: *"dozens of them"* is a
number the essay printed, and a world dial that multiplied it would be the
director editing the prose. Same firewall the figures keep.

Meaning-invariance is **structural, not asserted**: attention applies after
the roles are fixed, and the proposition is built from roles, so it cannot
move when only weights have moved.

Both reachable in prose. *"Make the city feel huge and indifferent"* reads
as `population +0.75, attention −0.70`. Neither word names a parameter.

### 1.4 The scene graph — `ground` retired

A scene became a typed tree rather than a chain plus a privileged slot.
One rule: *a node's children are composed within it, far to near, and the
node's own program is the deepest thing inside it.* The type decides how
two nodes interact — an IMAGE node layers, a FIELD node inverts onto a
field compositor because it must be read as numbers.

### 1.5 The first real film

**"The City That Learned To Watch"** — 1m48s, 38 scenes, 5 acts, 2597
frames at 1280×720, rendered by exact frame index from the real compiler.
Silent (no audio encoder available in the environment; narration needs the
deployed Worker).

The arc reached the picture: Act I compiled mostly GROUNDED, Act II
ANNOTATED, Act III DECOMPOSED, Act V returned to GROUNDED — close to Act I
and deliberately not identical.

**And it looked like every previous film.** Murky raster strata,
procedural marks, restrained palette. Different meaning, same kind of
image. That result drove everything after it.

### 1.6 The Visual Language layer

The cause was mechanical and it was **not a shortage of primitives**:

> The compiler reached the palette through 8 constructions and 12
> operators — and **nine of those twelve operators are raster or shader**.
> So whatever got built, the last three stages of every chain were
> pixelate, dither, halftone, scanline, threshold or chromatic split.

Meanwhile 80% of the palette had never been touched. Contact sheets of the
unused families showed a clean wireframe cube, a boolean circle pair, a
Bauhaus rosette, a voronoi cell map. **Unreachable, not missing.**

So a layer above constructions: a language is a set of **answers to a fixed
set of visual questions** — what is a THING here, a QUANTITY, a RELATION,
the WORLD, the WORDS, the SURFACE. Questions identical across languages;
answers different.

Seven languages: TYPOGRAPHIC, GEOMETRIC (*no raster at all* — its defining
refusal), DIAGRAMMATIC, COMPUTATIONAL, MATERIAL (halftone as reproduction,
not glitch), SIGNAL (**the existing glitch grammar, kept and promoted from
universal default to deliberate choice**), ILLUSTRATIVE (delegates to the
old constructor so the object-world branch improves on its own track).

Plus `words.ts`: every word ranked by what it *is* — figure, turn, concept,
subject — into headline / sub / repeat / hinge. **A caption tells you what
the narration says; typography makes an argument out of the sentence's own
words.**

**Result: six visually distinct films from one paragraph.** One frame prints
DECISIONS ~100 times with THOUSANDS over it, because the sentence said
"thousands of ordinary decisions".

### 1.7 The audit — did the funnel move, or vanish?

It moved. Measured:

```
TYPOGRAPHIC   always  glyph_geometry + text_layout + variable_axis
DIAGRAMMATIC  always  data_series + force_layout + graph_reveal
COMPUTATIONAL always  wireframe + camera_3d + ui_surface + pixelate

3–4 distinct primitive sets across 5 very different sentences
42/129 primitives across ALL six languages · 12/20 families · 5–9 each
```

A fixed core with one or two slots. **Richer recipes, same shape of limit.**

Also settled: constructions and operators are **already not on the path** —
the language file imports three *types* from the constructor and no values.
They are accidental historical architecture, and removing them would
change nothing measurable.

### 1.8 The experiment — direct graph synthesis

Built beside the compiler, wired into nothing. Semantic model + visual
language + primitive registry → typed graph, with **no construction and no
operator stack selected**. A language there cannot name a primitive — only
per-family appetites, outright refusals, a raster budget, a target size.

```
                        language layer   direct synthesis
primitives reached      42/129 (33%)     86/129 (67%)
families                12/20            17/20
per language            5–9              30–40
programs per sentence   1                20
```

**The recipe bottleneck is real and removing it doubles reach.**

**And the programs were not good** — which turned out to be the finding.

### 1.9 The actual bottleneck

Running every primitive standalone and comparing its returned payload to
its declared output type:

```
129 primitives
 87  declared payload type actually emitted
 42  declared a payload and emit NOTHING but pixels
```

`text_layout`, `parametric_curve`, `voronoi`, `force_layout`, `wireframe`,
`point_cloud`, `document_surface`, `creature_chain`, `data_to_field` — all
declared GEOMETRY / ARTIFACT / ENTITY / FIELD, all returned pixels.

> **The type system was a naming convention, not a contract.** A chain
> could type-check completely and the downstream node receive nothing.

This explained everything that had been half-failing:

- **Recipes worked** because they were hand-verified against *runtime
  behaviour* — they dodge the dead links by iteration, not by type.
- A tiling primitive returned a stock string from a different essay
  because it was never receiving an upstream at all.
- The raster bridges seemed necessary because payloads don't flow — the
  chain only ever really passed a **canvas**.
- **Every film became a raster treatment** because pixels are the only
  thing that reliably travelled between two primitives.

The palette was **129 independent picture-makers with type labels
attached, joined by a canvas.**

### 1.10 The payload contract pass

```
129 primitives · 129 declared payload types actually emitted · 0 lies
```

The registry generator now **refuses to write** a registry containing a
declaration the runtime doesn't honour — no warning, no fallback, exit
non-zero. Verified by deliberately making a primitive lie.

Three classifications, as required:

- **A — should emit it (35).** Fixed at the one place every primitive
  registers, not in 34 drawing loops. A primitive already returning its own
  point set is left completely alone; otherwise the form it just drew is
  sampled back into `[{x, y, x0, y0}]`, carrying each point's origin so a
  morph can interpolate. That is reading back what the primitive actually
  made, not manufacturing geometry to satisfy a type.
- **B — genuinely image generators (6).** `ARTIFACT` and `ENTITY` were
  **entirely fictional** — every consumer of either read `upstream.canvas`.
  Both collapsed to IMAGE. The vocabulary lost two members and gained
  nothing false.
- **C — needs a contract that doesn't exist (recorded, not faked).**
  `creature_chain` genuinely carries segments, joints, gait. A real ENTITY
  payload would let a renderer draw *from* the body rather than grade a
  picture of it — and would make "people become insects" a transformation
  rather than a cut. That needs the renderer rewritten, so it is declared
  IMAGE (truthful) and the required contract is written down.

**One behaviour change kept deliberately.** Removing ENTITY removed a type
bridge that was carrying a real editorial rule — a contested claim graded
colder, meaning *this reports a claim, not a fact*. It would have silently
vanished. It is now stated as a treatment decision and applies whatever the
subject was built from.

### 1.11 The rerun — same experiment, truthful substrate

| | BEFORE | AFTER |
|---|---|---|
| Primitives reached | 86/129 | 85/129 |
| Families | 17/20 | 17/20 |
| Programs that crashed | 1 | **0** |
| Frames with dataflow errors | 2 | **0** |
| Mean frame contrast | 0.042 | **0.068** |

**Coverage didn't move, and it was never what this addressed.** The
synthesizer explores by type legality, and type legality was already
permissive — that *was* the problem. What changed is whether the programs
it finds can run.

The clearest single piece of evidence is one chain:

```
glyph_to_path → extrude → geometry_morph
```

Before: a flat grey frame reading `geometry_draw: no upstream GEOMETRY`.
After: the word WITHOUT, extruded, its points morphing — because the glyph
geometry genuinely travels the graph now. **A transformation between
representations, found by a synthesizer that was never told about
typography, extrusion or morphing.**

---

## 2. Current state

### Built and working

- Semantic reading: figures (regex, verified as literal substrings, no
  model), subjects (curated lexicon, whole-word), relations (agent /
  patient / action, read from grammar), stance, causality, one scene of
  narrative memory for both subject and setting.
- Scene graph: typed tree, nested compositing, budget-aware, recursion
  honoured by cache / cost / determinism / usage / serialisation.
- Director model: 11 creative-state dials, prose direction via a
  10-register lexicon, world population and attention.
- Seven visual languages + a synthesis rule that crosses between two.
- **Language Lab**: a self-contained HTML file — no server, no build step.
  Press 1–7, watch one paragraph become a different kind of film. Shows
  what each language is, what it's saying, why, and the live chain.
- Offline renderer: drives the Lab's own functions by exact frame index in
  headless Chromium, pipes frames to ffmpeg. Nothing in the path reads a
  clock.
- Payload contract + a generator gate that enforces it.
- 592 tests across the monorepo (280 in Studio).

### Deliberately frozen (controls)

`language.ts`, the seven languages, the Language Lab, the direct
synthesizer, constructions/operators, existing compiler behaviour.

### Known gaps, stated plainly

- **The language layer is not wired into the main compile path.** Which
  language a film uses is a directorial decision that needs the interface
  before it needs a default — picking one silently is how this got stuck
  the first time.
- **No server-side renderer.** Chains execute in the browser; a compile
  produces a plan. That is L2 honestly, not L3.
- **No cinematography.** Nothing in any family reasons about light, lens,
  shadow, exposure or colour temperature. This is the largest gap between
  current output and anything photographic.
- **Transformation is detected, not rendered** at the compiler level. The
  relation "A became B" is read and reported; the compiler does not build
  the becoming. (The synthesizer stumbled into one by accident — see 1.11.)
- **Direct synthesis does not produce good films.** Language identity
  collapses under pure type-legality; motion-craft tails dominate because
  once a chain emits ANIMATION only ANIMATION → ANIMATION accepts it.
- **A real ENTITY payload doesn't exist** (classification C above).
- Narration has no pauses, no script-vs-spoken split, no
  regenerate-this-paragraph.

---

## 3. The architecture as it now stands

```
SEMANTIC MODEL        what the prose checkably says
      ↓
VISUAL LANGUAGE       constraints and appetites — never a chain
      ↓
GRAPH SYNTHESIS       a visual program is constructed, not selected
      ↓
PAYLOAD CONTRACT      declared type = payload actually emitted   ← now real
      ↓
RUNTIME GRAPH
      ↓
RENDER
```

With the vocabulary distinction that fell out of the experiment:

```
PRIMITIVE   = a capability
LANGUAGE    = constraints / preferences
GRAPH       = the actual visual program
PAYLOAD     = information travelling between nodes
```

---

## 4. Open questions worth an outside view

1. **Should the language layer be wired into the compile path now, or does
   the Director UI have to come first?** Picking a default language
   silently is how the previous funnel formed.

2. **Language identity under weak constraints.** Family appetite is far
   weaker than a chain, so synthesized programs drift between languages.
   Is the answer stronger constraint vocabulary (spatial, motion, temporal,
   material, colour, camera axes), or is it a scoring/search problem?

3. **Motion craft dominates every synthesized tail** because
   `ANIMATION → ANIMATION` accepts anything. Is ANIMATION a type at all, or
   is it — like ARTIFACT and ENTITY turned out to be — a name for something
   that isn't a payload?

4. **Cinematography has no home in the current model.** Camera, light,
   depth and colour aren't primitives, aren't languages, and aren't
   constraints. Where do they belong?

5. **Is the real ENTITY contract worth building** (a body a renderer draws
   *from*), given it's what makes physical transformation possible?

6. **Two tracks or one?** The typographic/geometric/editorial branch works
   now. The illustrative/object-world branch needs camera, light,
   population and transformation. Should they proceed independently?

---

## 5. What is proven and what is not

**Proven.**

- Semantic reading of prose reaches pixels: figures, relations, counts,
  place, subject, and the sentence's own significant words all
  parameterise what is built.
- A director dimension can change the cinematic argument **without
  changing the proposition** — one role set, nine pictures.
- The visual language layer produces **materially different visual results
  from the same semantic input** — six distinct films from one paragraph.
- The type system is now a **contract**: a type-valid graph is a graph
  that can run.
- The recipe bottleneck was real: removing it doubled registry reach.

**Not proven.**

- That the generation architecture is open-ended enough to produce *good*
  films without hand-authored recipes.
- That direct synthesis is the right production architecture — only that
  it is now testable on a substrate that tells the truth.
- Anything about cinematography, transformation-as-a-program, or a real
  entity model. None of those are built.
