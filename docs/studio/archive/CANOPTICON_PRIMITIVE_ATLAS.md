# CANOPTICON — Procedural Audiovisual Primitive Atlas
## The Palette Layer

**Status:** Third of three documents. Sits *between* the Creative Constitution (intent) and the Master Spec (compiler). Reading order:

```
CREATIVE CONSTITUTION      what the director expresses
        ↓
PRIMITIVE ATLAS            what the machine can paint with   ← this document
        ↓
MASTER SPEC                how it compiles and caches
```

---

# MISSION

> The purpose of Canopticon's procedural audiovisual subsystem is to **maximize the expressive range of deterministic code-generated media** before relying on photographic footage, generative video, or external motion-design assets.
>
> The system treats code as a visual medium, not merely as an assembly mechanism.
>
> Primitives must be deterministic, seedable, parameterized, composable, independently cacheable, and usable as inputs to other primitives.

**Internal umbrella term:** *Procedural Audiovisual Composition.* The underlying disciplines are creative coding and procedural motion graphics.

---

# PART 1 — THE STRUCTURAL INSIGHT

## 1.1 Blocks are recipes, not vocabulary

The Master Spec's four block types (`KINETIC_TEXT`, `ESSAY_DOC`, `SIMPLE_CHART`, `ABSTRACT_BG`) are **recipes** — pre-composed chains of primitives. They are not the machine's toolbox.

```
KINETIC_TEXT  (recipe)
  └── text layout → glyph geometry → word segmentation
      → stagger → mask → motion → composite

ABSTRACT_BG   (recipe)
  └── noise field → particle emitter → flow field
      → trail renderer → composite → shader
```

Recipes are convenient defaults. The composition engine must be able to reach *past* them to the primitives underneath, or the film will always look like four things in rotation.

## 1.2 Three generation modes

| Mode | Produces | Example |
|---|---|---|
| **Code → Artifact** | A visual object | SVG timeline, generated newspaper page, typographic composition, procedural map |
| **Code → Animation** | Time-varying behaviour | Particle system, morph, camera move, flow field, physics |
| **Artifact → Artifact** | A transformation chain | Sentence → glyph geometry → points → particles → flow field → abstract image |

The third is where Canopticon becomes distinctive. Most tools do the first two.

A shot is therefore:

```
ARTIFACTS + ANIMATION + COMPOSITING → SHOT
```

## 1.3 Typed I/O is what makes chaining possible

Every primitive declares typed inputs and outputs. This is the single most important structural decision in this document.

**Output types:**

| Type | Meaning | Can feed |
|---|---|---|
| `FIELD` | A 2D vector or scalar field | particle motion, displacement, geometry deformation, camera |
| `GEOMETRY` | Points, paths, polygons | stroke animation, particle targets, mask, 3D extrusion |
| `IMAGE` | A raster buffer | pixel effects, ASCII, displacement source, texture |
| `MASK` | An alpha channel | compositing, clipping, reveal |
| `DATA` | Structured values | charts, timelines, networks, sonification, particle counts |
| `AUDIO` | A sound buffer | mixing, audio-reactive parameters |
| `ANIMATION` | A parameter-over-time curve | driving any other primitive's parameters |
| `ARTIFACT` | A composed static visual | camera moves, further transformation |

Because glyph geometry outputs `GEOMETRY`, and a particle system accepts `GEOMETRY` as targets, *text can become particles* without either primitive knowing about the other. That's the whole game.

## 1.4 The taxonomy is closed; the palette is not

There is no finite "complete palette." Creative coding is combinatorial and open-ended. What *can* be defined completely is the **taxonomy** — the families, their I/O types, and their composition rules. New primitives slot into existing families without architectural change.

Do not let Claude Code treat the Phase 0 list as exhaustive. Treat the *interface* as the contract.

---

# PART 2 — PRIMITIVE INTERFACE

Every primitive conforms to:

```json
{
  "primitiveId": "flow_field",
  "family": "generative",
  "inputs":  [{ "name": "seedField", "type": "FIELD", "optional": true }],
  "outputs": [{ "name": "field", "type": "FIELD" }],
  "parameters": {
    "resolution": { "type": "int", "default": 64, "range": [16, 512] },
    "turbulence": { "type": "float", "default": 0.5, "range": [0, 1] },
    "octaves":    { "type": "int", "default": 3, "range": [1, 8] }
  },
  "temporalParameters": ["turbulence", "octaves"],
  "seed": "required",
  "compositingModes": ["source", "displace", "mask"],
  "renderer": "canvas",
  "rendererVersion": "1.0.0",
  "estimatedCostMsPerFrame": 8,
  "determinismGuarantee": "L2"
}
```

Notes on fields that matter:

- **`temporalParameters`** — which parameters may be animated over the shot's duration. Not all can be; changing `resolution` mid-shot would pop.
- **`seed: "required"`** — anything stochastic must accept a seed. `Math.random()` is banned by lint rule, as in the Master Spec.
- **`estimatedCostMsPerFrame`** — the composition engine uses this to refuse combinations that would blow the frame budget, and the Compile View surfaces it.
- **`determinismGuarantee`** — `L1` (semantic), `L2` (pixel-identical in pinned env), or `L2-GPU` (pixel-identical on the *same* GPU only). Shader and 3D primitives are honestly `L2-GPU`; do not claim otherwise.

---

# PART 3 — THE FAMILIES

Fourteen families. Each lists its primitives, I/O, engine, and Phase 0 status.

## A. TYPOGRAPHIC

The largest expressive territory and the one most under-served by treating "kinetic type" as a single renderer.

**Text decomposes:** `text → words → lines → characters → glyphs → vector paths → points → particles`

| Primitive | Out | Notes |
|---|---|---|
| `text_layout` | `GEOMETRY` | centered, justified, asymmetric, editorial, poster, grid, circular, radial, scattered, stacked, oversized, edge-aligned |
| `glyph_to_path` | `GEOMETRY` | glyph outlines as path commands |
| `glyph_to_points` | `GEOMETRY` | glyph outlines sampled to point clouds — the gateway to text-as-particles |
| `text_stagger` | `ANIMATION` | word / character / line stagger curves |
| `text_scramble` | `ANIMATION` | character randomization resolving to target, seeded |
| `variable_axis` | `ANIMATION` | weight, width, slant, optical size, custom axes |
| `text_morph` | `ANIMATION` | path-level morph between two typographic states |
| `text_mask` | `MASK` | type as a compositing mask |
| `text_displace` | `GEOMETRY` | deform glyph geometry by a `FIELD` input |

**Engines:** SVG/DOM + GSAP SplitText for layout and stagger; font-to-path libraries for glyph geometry; CSS `font-variation-settings` for variable axes.

**Phase 0:** YES — layout, stagger, scramble, variable axis, mask. `glyph_to_points` is the highest-value single primitive in the whole atlas because it unlocks the typography→particle chain.

## B. VECTOR / GEOMETRIC

| Primitive | Out | Notes |
|---|---|---|
| `path_draw` | `ANIMATION` | stroke-dasharray reveal |
| `path_traverse` | `ANIMATION` | move an object along a path |
| `shape_morph` | `GEOMETRY` | arbitrary SVG shape → shape, auto point remapping |
| `parametric_curve` | `GEOMETRY` | spirals, rose curves, Lissajous, polar plots |
| `recursive_geometry` | `GEOMETRY` | subdivision, branching, nesting |
| `boolean_ops` | `GEOMETRY` | union, subtract, intersect |

**Engines:** SVG + GSAP (MorphSVG for `shape_morph`), Paper.js for geometry ops.

**Phase 0:** YES — draw, traverse, morph, parametric.

## C. GENERATIVE SYSTEMS

| Primitive | Out | Notes |
|---|---|---|
| `noise_field` | `FIELD` | Perlin/simplex, octaves, seeded |
| `flow_field` | `FIELD` | directional field, optionally derived from noise |
| `voronoi` | `GEOMETRY` | cell decomposition |
| `fractal` | `GEOMETRY` | self-similar recursion |
| `l_system` | `GEOMETRY` | grammar-driven growth |
| `reaction_diffusion` | `IMAGE` | Gray-Scott; expensive, precompute |
| `cellular` | `IMAGE`/`FIELD` | automata |
| `attractor` | `GEOMETRY` | strange attractors as point clouds |

**Phase 0:** YES for `noise_field`, `flow_field`, `voronoi`. Defer reaction-diffusion and cellular (cost).

`noise_field` and `flow_field` are foundational — they feed particles, displacement, geometry deformation, and camera motion. Build these first.

## D. PARTICLE / AGENT

| Primitive | In | Out | Notes |
|---|---|---|---|
| `particle_emitter` | — | `GEOMETRY` | spawn, decay, count |
| `particle_flow` | `FIELD` | `GEOMETRY` | particles advected through a field |
| `particle_seek` | `GEOMETRY` | `GEOMETRY` | particles seeking target positions — **this is how text forms from chaos** |
| `particle_trail` | `GEOMETRY` | `IMAGE` | motion trails |
| `flocking` | — | `GEOMETRY` | boids: separation, alignment, cohesion |
| `particle_connect` | `GEOMETRY` | `GEOMETRY` | neighbour links — proto-network |

**Phase 0:** YES — emitter, flow, seek, trail. Flocking optional.

The chain `glyph_to_points → particle_seek → particle_flow` gives you: word assembles from scattered particles, holds, then dissolves into a flow field. That single chain is worth more expressive range than three new block types.

## E. PHYSICS

| Primitive | Out | Notes |
|---|---|---|
| `spring` | `ANIMATION` | already in Remotion |
| `gravity_field` | `FIELD` | |
| `collision` | `ANIMATION` | |
| `orbital` | `ANIMATION` | |

**Phase 0:** `spring` only (free via Remotion). Rest deferred — determinism of iterative physics needs care (fixed timestep, no frame-rate coupling).

## F. DATA

`SIMPLE_CHART` is far too narrow. Data is a **material**, not a chart type.

| Primitive | In | Out | Notes |
|---|---|---|---|
| `chart_cartesian` | `DATA` | `GEOMETRY` | bar, line, area, scatter, histogram |
| `chart_radial` | `DATA` | `GEOMETRY` | radial bar, arc, rose |
| `chart_flow` | `DATA` | `GEOMETRY` | stream, sankey-like, bump |
| `counter` | `DATA` | `ANIMATION` | animated number |
| `small_multiples` | `DATA` | `GEOMETRY` | grid of repeated charts |
| `heatmap` | `DATA` | `IMAGE` | matrix, calendar |
| `data_to_particles` | `DATA` | `GEOMETRY` | **1,000,000 people → 1,000,000 particles** |
| `data_to_field` | `DATA` | `FIELD` | data as a displacement source |
| `data_to_type` | `DATA` | `GEOMETRY` | figures rendered as typographic composition |

**Engine:** D3 (shape, scale, hierarchy) rendering to SVG or Canvas. Pin the version; D3 6.0+ force simulation is seedable via `randomSource`.

**Phase 0:** YES — `chart_cartesian`, `counter`, `data_to_particles`. The last one is the differentiator.

## G. NETWORK & RELATIONAL

| Primitive | Out | Notes |
|---|---|---|
| `force_layout` | `GEOMETRY` | seeded d3-force; run headless, export per-frame positions |
| `hierarchy_layout` | `GEOMETRY` | tree, treemap, pack, partition |
| `graph_reveal` | `ANIMATION` | staged node/edge appearance |
| `topology_shift` | `ANIMATION` | network reorganizes — dramatically useful |

**Determinism note:** d3-force is fully deterministic since v6.0 *if* `randomSource` is seeded. Precompute the simulation headless, serialize positions per frame, then render. Never tick the simulation inside the render loop.

**Phase 0:** Deferred, but `particle_connect` (family D) gives a cheap proto-version.

## H. TIMELINE SYSTEMS

Not a renderer — a **recurring visual metaphor** and a family in its own right.

| Axis | Options |
|---|---|
| Orientation | horizontal, vertical, radial, layered, nested, parallel, branching |
| Event marks | points, bars, bands, documents, images, quotes, figures, people, places |
| Behaviour | grow, zoom, scrub, compare, fragment |

**Phase 0:** YES — horizontal and vertical, point/bar/band marks, grow behaviour. This is likely your primary motif carrier (see Creative Constitution Part 6).

## I. PROCEDURAL DOCUMENTS & ARTIFACTS

Critical for documentary and almost entirely overlooked in the Master Spec.

Code can *construct* rather than photograph: newspapers, letters, transcripts, forms, screens, receipts, tickets, index cards, folders, labels, stamps, memos, spreadsheets, terminal output, chat threads, browser windows, generated maps.

```
CODE → newspaper page → camera push → article highlight
     → text extraction → words become particles
```

No footage required. And unlike a scanned document, a generated one can be *animated at the structural level* — a table can reorganize, a form can fill itself, a redaction can slide across.

| Primitive | Out | Notes |
|---|---|---|
| `document_surface` | `ARTIFACT` | paper, aged, screen, terminal, ledger |
| `document_layout` | `ARTIFACT` | columns, headers, tables, marginalia |
| `annotation` | `GEOMETRY` | hand-drawn circles, underlines, boxes, arrows (seeded roughness) |
| `redaction` | `ANIMATION` | blackout bars |
| `camera_move` | `ANIMATION` | push, crop-reveal, pan across an `ARTIFACT` |

**Phase 0:** YES — surface, layout, annotation, redaction, camera. This is `ESSAY_DOC` properly decomposed.

## J. RASTER / PIXEL

| Primitive | In | Out | Notes |
|---|---|---|---|
| `pixelate` | `IMAGE` | `IMAGE` | mosaic, quantization |
| `dither` | `IMAGE` | `IMAGE` | ordered, error-diffusion |
| `halftone` | `IMAGE` | `IMAGE` | |
| `threshold` | `IMAGE` | `IMAGE`/`MASK` | posterize, isolate |
| `pixel_sort` | `IMAGE` | `IMAGE` | |
| `scanline` | `IMAGE` | `IMAGE` | CRT-style |
| `ascii_render` | `IMAGE` | `GEOMETRY` | **luminance → character field; output is typography** |

`ascii_render` deserves emphasis: it converts *any* image output back into the typographic family. `noise_field → IMAGE → ascii_render → GEOMETRY` closes a loop between abstraction and text that is very much the Canopticon sensibility.

**Engine:** Canvas `ImageData` for direct pixel access.

**Phase 0:** YES — pixelate, dither, threshold, ascii_render.

## K. SHADER / GPU

| Primitive | Out | Notes |
|---|---|---|
| `shader_surface` | `IMAGE` | arbitrary GLSL fragment |
| `displacement` | `IMAGE` | distort by a `FIELD` |
| `chromatic_split` | `IMAGE` | |
| `feedback` | `IMAGE` | previous frame as input — **stateful, see warning** |

**Determinism warning:** GPU floating-point varies between hardware. Shader primitives are `L2-GPU` — pixel-identical only on the same GPU model. Flag them as such in the receipt. `feedback` is additionally stateful (frame N depends on N−1), which breaks per-frame independence and complicates chunked parallel rendering. Either precompute feedback chains serially to an `IMAGE` sequence, or exclude them.

**Phase 0:** LIMITED — `shader_surface` and `displacement` only, flagged `L2-GPU`. No feedback.

## L. 3D / SPATIAL

Excluding photographic footage does **not** mean excluding 3D. Point clouds, wireframes, procedural geometry, camera systems, depth, and lighting are all code-generated.

| Primitive | Out |
|---|---|
| `point_cloud` | `GEOMETRY` |
| `wireframe` | `GEOMETRY` |
| `extrude` | `GEOMETRY` (from 2D `GEOMETRY` — including glyph paths) |
| `camera_3d` | `ANIMATION` |

**Phase 0:** Small experimental subset — `extrude` + `camera_3d` only, to validate the renderer interface accepts a WebGL backend. Do not build a 3D pipeline yet.

## M. COMPOSITING

Composability is the actual superpower. Compositing is a first-class creative primitive, not plumbing.

| Primitive | Notes |
|---|---|
| `blend` | multiply, screen, difference, overlay, add |
| `mask_apply` | apply a `MASK` |
| `blur` | gaussian, directional, radial |
| `displace_composite` | distort layer A by field B |
| `color_transform` | grade, duotone, palette map |
| `tile` / `mirror` / `slice` | spatial repetition |
| `split_screen` | |
| `nest` | **a full composition as a layer inside another** |

`nest` is what makes the palette recursive rather than flat.

**Phase 0:** YES — blend, mask, blur, color_transform, split_screen, nest.

## N. AUDIO

| Primitive | In | Out | Notes |
|---|---|---|---|
| `sonify` | `DATA` | `AUDIO` | pitch/rhythm/pan mapping |
| `synth_bed` | — | `AUDIO` | ambient tone |
| `audio_analyze` | `AUDIO` | `ANIMATION` | amplitude/frequency → parameter curves |

**Engine:** Tone.js `Offline()` rendering — deterministic, no real-time dependency.

**Note:** `audio_analyze` closes the loop the other way: narration audio drives visual parameters. Cheap and high-value.

**Phase 0:** Architecture and interface now; `audio_analyze` implemented (cheap, useful immediately); `sonify` in Phase 1.

---

# PART 4 — COMPOSITION CHAINS

Chains are the expressive unit. Some worth building as named, tested examples:

**Text dissolution**
```
text_layout → glyph_to_points → particle_seek → particle_flow(noise_field) → particle_trail
```
Word assembles from scatter, holds, dissolves into drift. The single most Canopticon-feeling chain.

**Evidence reveal**
```
document_surface → document_layout → camera_move(crop_reveal) → annotation → redaction
```

**Data as material**
```
DATA → data_to_particles → particle_flow(flow_field) → particle_connect
```
A population becomes a moving field becomes a network.

**Abstraction ladder** *(maps directly to the Creative Constitution's abstraction parameter)*
```
low  abstraction: document_surface + text_layout
mid  abstraction: glyph_to_points + particle_seek
high abstraction: noise_field + particle_flow + shader_surface
```
This is how a creative-state slider becomes concrete primitive selection.

**The loop back to type**
```
noise_field → shader_surface(IMAGE) → ascii_render(GEOMETRY) → text_stagger
```

---

# PART 5 — ENGINE STACK

```
                    COMPOSITION ENGINE
                           │
                   Primitive Graph (typed I/O)
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
     SVG / DOM          Canvas 2D          WebGL
        │                  │                  │
     GSAP, D3          pixel ops,         Three.js,
     typography        particles,         shaders
     vector geom       fields, ASCII      3D, GPU
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    Tone.js (offline audio)
                           │
                        REMOTION
                  orchestration + render
                           │
                         FILM
```

**Remotion stays the outer orchestration layer.** Everything else is a primitive backend it composites.

**Deliberately excluded from Phase 0:**
- **Manim** — specialist adapter later, not a core runtime. Python subprocess breaks the web-native Cloudflare model.
- **Motion Canvas** — conceptually interesting (code-defined scenes, signals, tweens) but bringing a second full animation framework into the core muddies the architecture.
- **p5.js as a runtime** — borrow its *ideas* (`textToPoints`, noise, fields) but implement against Canvas directly rather than importing another scene graph.

---

# PART 6 — PHASE 0 SCOPE

## 6.1 Recommendation

The feedback proposed ten families in Phase 0. That is real scope risk — Phase 0's job is still to prove the compile/cache/direct loop, not to ship a complete creative-coding library.

**Build the chains, not the catalogue.** Roughly 25 primitives, selected specifically because they compose into the four chains in Part 4:

| Family | Phase 0 primitives |
|---|---|
| A. Typographic | `text_layout`, `glyph_to_points`, `text_stagger`, `text_scramble`, `variable_axis`, `text_mask` |
| B. Vector | `path_draw`, `path_traverse`, `shape_morph`, `parametric_curve` |
| C. Generative | `noise_field`, `flow_field`, `voronoi` |
| D. Particle | `particle_emitter`, `particle_flow`, `particle_seek`, `particle_trail` |
| F. Data | `chart_cartesian`, `counter`, `data_to_particles` |
| H. Timeline | `timeline_linear` (h/v, point/bar/band marks) |
| I. Documents | `document_surface`, `document_layout`, `annotation`, `redaction`, `camera_move` |
| J. Raster | `pixelate`, `dither`, `threshold`, `ascii_render` |
| K. Shader | `shader_surface`, `displacement` *(flagged L2-GPU)* |
| M. Compositing | `blend`, `mask_apply`, `blur`, `color_transform`, `split_screen`, `nest` |
| N. Audio | `audio_analyze` |

**Deferred to Phase 1:** networks/force layout, physics beyond spring, reaction-diffusion, cellular, 3D beyond `extrude`, `sonify`, feedback shaders, Manim adapter.

## 6.2 Build order

1. **`noise_field` + `flow_field`** — everything downstream depends on fields
2. **`glyph_to_points`** — unlocks the typography→particle bridge
3. **`particle_flow` + `particle_seek`** — the text dissolution chain now works end to end
4. **Compositing family** — without `nest` and `blend`, chains can't layer
5. **Documents family** — the documentary workhorse
6. Everything else

If the build runs short, cut from the bottom. The first four items are the ones that prove code is a *medium* rather than an assembly mechanism.

## 6.3 The Procedural Visual Lab

Add a fifth view alongside Narrative / Editorial / Preview / Compile:

**LAB** — a primitive playground. Pick a primitive or chain, scrub parameters live, see it render in isolation, save a configuration as a named recipe. Not shipped to end users; it's how the operator (and Claude Code) discovers what the palette can actually do, and how recipes get authored rather than hardcoded.

This is also where `estimatedCostMsPerFrame` gets measured empirically rather than guessed.

---

# PART 7 — INTEGRATION WITH THE OTHER TWO DOCUMENTS

## 7.1 Amendments to the Master Spec

1. **Block types become recipes over primitives.** The `blocks[]` array in the IR gains an optional `chain[]` field expressing the primitive graph. A block with no explicit chain uses its recipe default.
2. **Cache granularity moves to the primitive.** `NodeHash` is computed per primitive node, not per block. A chain where only the final `color_transform` changed reuses the entire upstream particle simulation. This substantially improves the incremental-rebuild story.
3. **`determinismGuarantee` propagates.** A chain's guarantee is the weakest of its primitives. A chain containing `shader_surface` is `L2-GPU`, and the Compile View must say so.
4. **Cost budgeting.** The composition engine sums `estimatedCostMsPerFrame` across a chain and refuses or warns on combinations exceeding budget.

## 7.2 The directive that changes composition behaviour

From the Creative Constitution's framing — this is the operational form of it:

> **Do not ask: "What block type should this scene use?"**
>
> Ask: **"What visual materials, transformations, and behaviours could express this narrative moment within the film's creative state?"**

Worked example. Narration: *"The factory became a machine that consumed people."*

Wrong answer: `ABSTRACT_BG`.

Right answer — a chain:
```
parametric_curve(repeating units)     → mechanical rhythm
glyph_to_points("people")             → human forms from language
particle_flow(flow_field, velocity↑)  → conveyor motion, accelerating
text_layout(tracking↓)                → compression
displacement(noise_field)             → distortion rising
audio: synth_bed density ↑
```

The director specified *increasingly mechanical, dense, dehumanizing*. The engine selected primitives whose parameters express that. No renderer was named.

## 7.3 How creative state maps to primitive selection

| Creative parameter | Primitive-level expression |
|---|---|
| `abstraction` | position on the abstraction ladder (Part 4) |
| `visualDensity` | particle count, layer count, chart mark count, `nest` depth |
| `motionEnergy` | field turbulence, stagger speed, camera velocity |
| `typographicWeight` | family A prominence, `variable_axis` weight |
| `dataWeight` | family F prominence |
| `humanPresence` | `glyph_to_points` from human language, document annotation traces, `audio_analyze` from narration |
| `experimentalism` | willingness to use longer / more unusual chains |
| `restraint` | chain length ceiling, compositing layer ceiling |

`restraint` as a *chain-length ceiling* is an elegant mapping — a restrained film uses short, legible chains; an experimental one uses deep ones.

---

# THE TEST

For every primitive proposed:

> **Does it produce a typed output another primitive can consume?**

If it only produces final pixels and consumes nothing, it is a recipe, not a primitive — and it belongs in the recipe layer where the composition engine can still reach past it.

---

# PART 8 — AMENDMENTS (post Claude Design capability review)

Cross-checking the Atlas against a production programmatic-motion tool surfaced three genuine gaps and confirmed the rest of the taxonomy. Claude Design's stated limits — no photoreal footage, no character animation, no hand-illustrated art, and explicit avoidance of drawing complex imagery in SVG — independently confirm this document's central premise: code is strongest as a medium of *typography, geometry, data, systems, and abstraction*, and weakest when asked to imitate photography or illustration. Design accordingly.

## 8.1 NEW FAMILY — O. MOTION CRAFT

**The gap:** the Atlas specifies *what* moves but says nothing about *whether the movement feels crafted or tweened*. Two films using identical primitives can differ entirely in quality. Craft is not a primitive — it is a modifier applied across all animated primitives.

| Primitive | Applies to | Notes |
|---|---|---|
| `anticipation` | any `ANIMATION` | small counter-move before the main move |
| `overshoot` | any `ANIMATION` | pass the target, settle back |
| `follow_through` | any `ANIMATION` | secondary elements continue after the primary stops |
| `damping` | any `ANIMATION` | spring settle characteristics |
| `ease_profile` | any `ANIMATION` | named curves, not raw cubic-bezier soup |
| `seamless_loop` | any `ANIMATION` | first frame ≡ last frame — cheap, cacheable ambient beds |

**Why this matters architecturally:** craft parameters are a *layer* over the animation graph, applied at composition time. This means the Creative Constitution's `restraint` and `experimentalism` parameters can drive craft globally — a restrained film uses gentle damping and minimal overshoot; an energetic one uses pronounced anticipation and follow-through. One slider, coherent motion character across the entire film.

**Phase 0:** YES. `ease_profile`, `damping`, `overshoot`, `seamless_loop`. These are cheap and they are the difference between "generated" and "authored."

## 8.2 NEW FAMILY — P. INTERFACE EMULATION

**The gap:** entirely absent from the Atlas, and high-value for Canopticon's actual subject matter. Investigative work about platforms, portals, channels, and digital institutions constantly needs to *show the interface being discussed* — and screen-recording it is a rights, quality, and reproducibility problem. Constructing it from code is not.

| Primitive | Out | Notes |
|---|---|---|
| `device_frame` | `ARTIFACT` | phone, desktop, tablet chrome |
| `browser_chrome` | `ARTIFACT` | URL bar, tabs, scroll position |
| `ui_surface` | `ARTIFACT` | generated app/site layout from a structural description |
| `cursor` | `ANIMATION` | damped pointer that actually targets named elements |
| `interaction` | `ANIMATION` | tap ripple, keystroke entry, hover, scroll |
| `screen_transition` | `ANIMATION` | screen-to-screen, modal, notification arrival |
| `spotlight` | `MASK` | zoom + dim to isolate one element |

This is the sibling of family I (Procedural Documents). Documents cover paper artifacts; this covers screen artifacts. A generated interface can be *animated structurally* — a feed can reorder, a metric can tick, a paywall can slide up — in ways a screen recording never can.

**Phase 0:** YES for `device_frame`, `browser_chrome`, `ui_surface`, `spotlight`. Cursor and interaction primitives in Phase 1.

## 8.3 NEW FAMILY — Q. CUT GRAMMAR

**The gap:** the Atlas treats compositing *spatially* (layers, masks, blends) but has no *temporal* cut vocabulary. Editing is a creative primitive.

| Primitive | Notes |
|---|---|
| `hard_cut` | instantaneous |
| `match_cut` | shape/position continuity across a cut — requires both shots' geometry |
| `split_screen_temporal` | simultaneous parallel action |
| `montage` | rhythmic sequence under one narration line |
| `cut_rhythm` | cut frequency as a driven parameter |

`match_cut` is worth singling out: it needs geometry from *both* the outgoing and incoming shot, which means the composition engine must be able to reason across shot boundaries. That is a real architectural requirement, not a transition preset.

`cut_rhythm` maps directly to the Creative Constitution's `motionEnergy` and `visualDensity` — cut frequency becomes a directed parameter rather than an editorial afterthought.

**Phase 0:** `hard_cut`, `montage`, `cut_rhythm`. `match_cut` in Phase 1 (needs cross-shot geometry reasoning).

## 8.4 ADDITIONS TO EXISTING FAMILIES

| Family | Added primitive | Notes |
|---|---|---|
| F. Data | `chart_morph` | before→after transition *between chart types* — a bar chart becoming a line chart is an argument, not a transition |
| F. Data | `annotated_callout` | a label landing on a specific data point |
| G. Network | `treemap_repack`, `sankey_flow` | |
| H. Timeline | `roadmap_build` | left-to-right construction |
| I. Documents | `comparison_matrix` | grid filling in |
| L. 3D | `exploded_view`, `layer_peel` | spatial reveal of stacked systems |
| M. Compositing | `parallax_layers` | depth via differential layer motion |
| — Maps | promoted from deferred | see 8.5 |

## 8.5 MAPS — PROMOTED

The Atlas deferred maps. That was a mistake for documentary work specifically. Geography is a primary documentary primitive, not a specialist one, and it is fully code-generable from open vector data.

| Primitive | Out |
|---|---|
| `map_projection` | `GEOMETRY` — base geography from vector data |
| `map_camera` | `ANIMATION` — globe→region→street zoom |
| `route_draw` | `ANIMATION` — path tracing across geography |
| `choropleth` | `IMAGE` — region shading, animatable by year |
| `flow_arc` | `GEOMETRY` — migration, trade, movement |
| `pin_drop` | `ANIMATION` — located events with labels |

**Determinism note:** use vector data with a pinned version, projected in-process. Do not depend on a tile server at render time — that is an external service inside the render function, which violates the Master Spec's core principle.

**Phase 0:** `map_projection`, `map_camera`, `choropleth`. Route and flow in Phase 1.

## 8.6 METAPHOR RECIPES

Claude Design names things like *"a funnel, a scale tipping, a ladder."* These are neither primitives nor block types — they are **directorially-named recipes**, and that naming is itself the useful idea.

The recipe layer should carry a metaphor vocabulary the director can invoke by meaning rather than by mechanism:

```
funnel        → narrowing geometry + particle_flow with attrition
scale_tipping → physics pivot + weighted geometry
ladder        → sequential vertical reveal
erosion       → particle decay from a solid form
accumulation  → particle_seek building a mass over time
divergence    → two flows separating from one source
enclosure     → geometry progressively surrounding a subject
```

This is the layer where the Creative Constitution's motif system attaches. A motif *is* a metaphor recipe with persistent state and a development rule.

**Phase 0:** ship 4–6 metaphor recipes as named, authored examples in the Lab. They demonstrate that the recipe layer is directorial rather than technical.

## 8.7 PRACTICAL NOTE — CLAUDE DESIGN AS A PROTOTYPING SURFACE

Claude Design is a live tool that already implements much of this palette with a scrubbable timeline and video export. Before Claude Code builds a primitive, the chain can be prototyped there to find out whether it actually reads on screen. Two caveats:

- It is a *prototyping* surface, not the runtime. Canopticon's requirements — typed I/O, seeded determinism, per-primitive cache hashing, creative-state binding — are architectural and not something a general motion tool provides.
- Anything validated there still has to be reimplemented against the primitive interface in Part 2.

Use it to answer "does this chain look like anything?" before spending build time on it.

## 8.8 REVISED PHASE 0 COUNT

The additions raise the Phase 0 primitive count from ~25 to ~40. That is acceptable *only* because families O (motion craft) and Q (cut grammar) are cheap modifier layers rather than new rendering backends, and family P (interface emulation) reuses the document/compositing machinery already required.

**Revised build order** — amended from Part 6.2:

1. `noise_field` + `flow_field`
2. `glyph_to_points`
3. `particle_flow` + `particle_seek`
4. **Motion craft layer** *(moved up — it makes everything built before and after it look authored rather than tweened, at very low cost)*
5. Compositing family
6. Documents family
7. Cut grammar
8. Interface emulation
9. Maps
10. Everything else

Cut from the bottom if the build runs short. Items 1–4 remain the proof that code is a medium rather than an assembly mechanism.
