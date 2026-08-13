# The procedural cinematic palette, mapped

> Written after the parameter-plumbing investigation, and deliberately
> pointed at a different question. That investigation proved two things:
> direction can change what gets built and how it moves, and roughly a
> third of the operators had been running on their defaults for months.
> Both are now fixed and tested. **This document does not continue that
> thread.** It answers the question underneath the six-track brief's first
> item: *what can this machine actually make*, checked against the real
> registry rather than remembered or imagined.
>
> Method: every claim below was read out of `src/primitives/registry.ts`
> (128 primitives, 20 families, generated from the Lab's own source) and
> `lab/prims-*.js` (what each primitive's `frame()` actually draws), not
> out of the family names or docstrings alone. Three findings changed the
> shape of this document from what a design conversation would have
> produced: the palette has no WebGL anywhere — "3D" is projected
> point/wireframe math on a 2D canvas, a real technique with a real
> ceiling, not a placeholder for something bigger; `canChain` is a type
> system on eight shared types (FIELD, GEOMETRY, IMAGE, DATA, ANIMATION,
> MASK, ARTIFACT, ENTITY), so cross-family composition mostly already
> works without anyone designing it to; and `sonify` is confirmed, by
> reading its `frame()` function, to contain no Web Audio call at all — it
> draws dots that highlight in sequence and calls that "PITCH MAPPING". Its
> own comment says so: *"Phase 1 — but the interface is defined now so the
> hook exists."*

---

## The headline

**Almost everything on the six-track brief's palette list already exists,
composed from parts that were built for something else.** Of roughly fifty
named visual phenomena in that list, the overwhelming majority are already
producible — most on the first try, a handful by chaining two or three
existing primitives in an order nobody has written down yet. The real gaps
cluster into six specific, nameable things, and none of them are "more
primitives."

This means the brief's own instruction — *"do not expand the primitive
list indiscriminately, first map the space"* — lands somewhere more
specific than it could have known: the space is already wide. **What is
missing is not paint. It is the construction layer that knows how to
reach for the paint that already exists**, and the director-facing surface
that lets a human ask for it without naming a primitive.

---

## The stack, stated plainly

- Cloudflare Workers + Hono, D1, R2, Workers AI at authoring time only —
  standing rule 1, unchanged, not up for revisiting here.
- Rendering is **100% `CanvasRenderingContext2D`**. Grepped across every
  `lab/prims-*.js`: zero WebGL contexts, zero `three.js`, zero shader
  programs in the GPU sense. `K · SHADER` is the name of a family, not a
  claim about the API — its four primitives (`chromatic_split`,
  `displacement`, `feedback`, `shader_surface`) are 2D canvas pixel
  manipulation, CPU-side.
- **"3D" is real, and it is 2D.** `L · 3D`'s five primitives
  (`point_cloud`, `wireframe`, `extrude`, `exploded_view`, `layer_peel`)
  project 3D-looking math onto a 2D canvas with a `spin` parameter —
  confirmed by reading `wireframe`'s and `point_cloud`'s registrations in
  `prims-d.js`. This is a legitimate, decades-old technique (isometric and
  orthographic projection have always worked this way) and it has a real
  ceiling: no depth buffer, no real occlusion beyond draw order, no
  lighting model to fake with.
- **No image ingestion exists anywhere in the palette.** Every primitive
  that takes an `IMAGE` input takes one produced by an earlier stage in
  the same chain — a canvas another primitive already painted. Nothing
  accepts an uploaded photograph or a video frame. This is not an
  oversight; `CANOPTICON_STUDIO_OVERHAUL.md` §23 explicitly defers it
  ("architect the material system so a future image CAN enter... do not
  make generative imagery part of the first core dependency chain") and
  the code matches that decision exactly.
- **Chaining is a real type system, not a curated list.** `canChain(a, b)`
  returns true when `b`'s declared inputs intersect `a`'s declared
  outputs, or when `b` is a two-input compositor (which accepts anything
  as its first input, because every primitive paints a canvas). This is
  why the palette is more composable than its family boundaries suggest —
  `GEOMETRY` flows from typography into vector ops into particle systems
  into 3D projection without anyone having designed that path on purpose.

---

## The palette against the brief's list

Every item from the six-track brief's §1, checked. **EXISTS** — a named
primitive does this today. **COMPOSABLE** — no single primitive does it,
but the type system already permits a chain that would. **GAP** — nothing
produces it and nothing chains to it; naming it is new work. **DEFERRED**
— excluded by a standing product decision, not a technical one.

| Phenomenon | State | Evidence |
|---|---|---|
| Procedural illustration | **EXISTS** | `S·ENTITY` + `C·GENERATIVE` — `creature_chain`, `mounted_fixture`, `l_system`, `fractal`, `voronoi`, `recursive_geometry` |
| Creatures / entities | **EXISTS** | `S·ENTITY` — parameterised body plans, not assets |
| Pixel art | **EXISTS** | `J·RASTER` (`pixelate`, `pixel_sort`, `dither`) + `T·MATERIAL` (`pixel_quantise`) |
| Vector illustration | **EXISTS** | `B·VECTOR` — 8 primitives |
| Typography / kinetic typography | **EXISTS** | `A·TYPOGRAPHIC` — 11 primitives, the richest single family |
| Glyph manipulation | **EXISTS** | `glyph_geometry`, `glyph_to_path`, `glyph_to_points` |
| Diagrams | **EXISTS** | `F·DATA` + `G·NETWORK` |
| Maps | **EXISTS** | `R·MAPS` — 6 primitives (`choropleth`, `flow_arc`, `map_camera`, `map_projection`, `pin_drop`, `route_draw`) |
| Graphs / networks | **EXISTS** | `G·NETWORK` (`force_layout`, `hierarchy_layout`) |
| Timelines | **EXISTS** | `H·TIMELINE` — 3 primitives |
| Charts | **EXISTS** | `F·DATA` — `chart_cartesian`, `chart_radial`, `chart_flow` |
| Particle systems | **EXISTS** | `D·PARTICLE` — 6 primitives |
| Fields | **EXISTS** | `C·GENERATIVE` (`flow_field`, `noise_field`) + `E·PHYSICS` (`gravity_field`) |
| Fluids | **GAP, named honestly** | No pressure/velocity grid anywhere. `particle_flow` + `noise_field` *approximate* fluid motion; nothing solves for it. Worth building only if a scene genuinely needs liquid-specific behaviour a field can't fake |
| Cellular automata | **EXISTS** | `C·GENERATIVE` — `cellular` |
| Reaction–diffusion | **EXISTS** | `C·GENERATIVE` — `reaction_diffusion`. Genuinely uncommon to have this already; worth knowing it's there |
| Noise / terrain | **PARTIAL** | `noise_field` exists; nothing turns it into a heightmapped landscape. `plate_scene` is a fixed authored plate (its own comment: *"stands in for a generated plate"*), not a generator |
| Geometric systems | **EXISTS** | `B·VECTOR` + `C·GENERATIVE` |
| Generative architecture | **COMPOSABLE, unbuilt** | `l_system` + `recursive_geometry` + `extrude` (`L·3D`) chain by type today. No **construction** reads "a building/office/institution" from prose the way `fixture` reads a noun — this is a `construct.ts` gap, not a palette gap |
| Simulated physics | **EXISTS** | `E·PHYSICS` — `gravity_field`, `spring`, `orbital`, `collision` |
| Procedural environments | **PARTIAL, same shape as architecture** | `plate_scene` is the only "environment" primitive and it is authored, not parametric. A real procedural room/city/landscape construction is unbuilt, not impossible |
| Camera systems | **PARTIAL** | `camera_move` (`I·DOCUMENTS`) and `map_camera` (`R·MAPS`) are narrow and contextual. No general orthogonal camera operator (push / track / orbit / macro / top-down, per the overhaul brief §9) exists across the whole palette |
| 2.5D scenes / depth / parallax | **EXISTS** | `M·COMPOSITING` (`parallax_layers`) + `T·MATERIAL` (`drift_parallax`) |
| Lighting | **GAP** | No primitive touches light. Not approximated, not composable from parts — nothing in any family models a light source |
| Shadows | **GAP** | Same as lighting — no shadow anywhere |
| Silhouettes | **GAP, weakly composable** | `threshold` (`J·RASTER`) or `mask_apply` could produce a silhouette-*like* result as a side effect, but nothing is built or named for it |
| Morphing / transformation (as an operation) | **EXISTS** | `shape_morph`, `geometry_morph`, `text_morph`, `chart_morph` — four different families each have their own morph |
| Image decomposition | **EXISTS** | `image_to_points` (`S·ENTITY`, IMAGE→GEOMETRY), `ascii_render`, all of `J·RASTER` |
| Image reconstruction | **GAP** | Decomposing (image → points) is real; nothing reassembles points back into a recognisable image. A genuinely new primitive, not a missing chain |
| Image → particles / geometry / pixels | **EXISTS** | `image_to_points`, `ascii_render`, `J·RASTER` trivially |
| Image → contours | **GAP** | No edge-detection primitive anywhere |
| Image → masks (from an arbitrary image) | **PARTIAL** | `text_mask`, `layer_mask`, `mask_apply` exist; nothing generates a mask FROM an arbitrary painted image (luminance/threshold-based) the way `text_mask` does from type |
| Image → depth | **GAP, likely out of reach here** | Depth estimation from a flat image is a model problem, not a canvas-math problem — flagged, not scoped |
| Typography → geometry | **EXISTS** | `glyph_geometry`, `glyph_to_path` |
| Text → objects | **VERIFIED COMPOSABLE** | Checked directly: `canChain("glyph_geometry", "boolean_ops")` and `canChain("glyph_to_path", "extrude")` both return true. Type-legal today, not merely plausible |
| Objects → particles | **EXISTS** | `entity_render` → `image_to_points` |
| Objects → diagrams | **GAP as a construction** | `F·DATA` could represent an entity's state as a chart; nothing wires that path today |
| Diagrams → animation | **EXISTS** | `graph_reveal`, `chart_morph`, most of `H·TIMELINE` |
| **One visual form becoming another, as a deliberate device** | **THE BIGGEST GAP** | See below — this is not a primitive question at all |
| Procedural characters / crowds / swarms / organisms | **EXISTS** | `creature_chain` generalises beyond insects; `count` covers crowd/swarm; `D·PARTICLE`'s `flocking` is a second, independent path to the same idea |
| Mechanical systems | **EXISTS** | `E·PHYSICS` + `mounted_fixture`'s `spin`/`pitch`/`push` |
| Abstract visual metaphors | **A CONSTRUCTOR QUESTION** | Already partially real — see `dislocation` in `construct.ts`, which lets a construction be reached for against the grain of its noun |
| Sonification | **PRESENT AND DISHONEST** | `sonify` declares `DATA → AUDIO`. Its `frame()` function, read directly, contains **zero Web Audio calls** — it draws dots on a canvas and labels them "PITCH MAPPING." Its own comment: *"Phase 1... the hook exists"* |
| Audiovisual synchronisation | **HALF-BUILT** | `audio_analyze` (`AUDIO→ANIMATION`) exists and is the right shape, but nothing in `compose.ts` drives a visual construction from it — `lab/score.js` goes the other direction, film state shapes the score, not the reverse. Checked whether the palette would even let it: `canChain("audio_analyze", "text_morph")` returns true, but `text_morph` declares `consumesUpstream: false` in the registry — mechanically detected already, per `gen-primitive-registry.mjs`, from its `frame()` function's arity, confirmed by reading it directly (no upstream parameter at all). The registry already knows this chain would type-check and do nothing; nothing has asked it |
| Image material pipeline (photo/video as input) | **DEFERRED BY DESIGN** | Per overhaul brief §23. Correctly unbuilt, not missing |
| Generative video as a source | **DEFERRED BY DESIGN** | Per overhaul brief §24. Same |

---

## The real gaps, named once each

Six things, and only six, survive the table above as genuine absences
rather than unbuilt compositions:

1. **Lighting, shadow, silhouette.** No primitive in any family touches
   light. This is the one category where nothing composable exists —
   every other "GAP" row above has at least a partial answer already in
   the palette.
2. **A fluid solver.** Approximated by fields, never modelled. Low
   priority — build it only when a specific scene's liquid behaviour
   genuinely can't be faked by `noise_field` + `particle_flow`.
3. **Procedural environments and generative architecture as
   CONSTRUCTIONS**, not as primitives. The primitives (`l_system`,
   `extrude`, `wireframe`, `recursive_geometry`) already exist. What's
   missing is the `construct.ts` entry that reads "an office", "a city",
   "a warehouse district" the way `fixture` reads "detector" — a parsing
   and assembly problem, already solved once for objects and creatures,
   not yet generalised to spaces and structures.
4. **A general camera operator.** `camera_move` and `map_camera` are
   narrow. The overhaul brief's camera dimension (push / track / orbit /
   macro / impossible / top-down) wants one orthogonal primitive family
   that any construction can be shot with, not two context-bound ones.
5. **Image decomposition without reconstruction.** The palette can take
   things apart into points; nothing puts them back together into
   something recognisable. Relevant mainly for the "form becomes form"
   transformation work below, where an object needs to dissolve *and
   re-cohere*.
6. **`sonify` is a stub wearing a real signature.** This is not a gap in
   the palette's coverage — it's a lie in the registry, the same class of
   defect the parameter-plumbing investigation just spent two commits
   fixing elsewhere. It should be fixed before anything is built on top of
   it, or every future sonification claim inherits the same dishonesty.

Two items from the brief's list — image-to-depth and true image
ingestion — are correctly out of scope for this stack rather than gaps to
close; flagged above, not itemised here.

---

## Transformation: the one genuinely unexplored territory

*"Not: Scene A ends, Scene B begins. But: A becomes B."* This is worth
its own section because it is qualitatively different from everything
else in this document. Every other row above is a question about the
**palette** — does a primitive or a short chain of primitives produce this
phenomenon. Transformation-as-device is a question about the
**constructor and the composer** — does the system know how to sequence
several DIFFERENT constructions across one continuous visual thread.

It does not, today, anywhere in the code:

- `construct.ts` builds **one program per beat**. `constructPrograms`
  returns alternatives, but they are alternatives the director chooses
  BETWEEN — never a sequence the film plays THROUGH.
- `compose.ts` carries one scene of memory (`carried`, in `sceneSubjects`)
  so a pronoun continues the last-named subject. It has no concept of a
  visual identity persisting and *changing form* across scenes — that is
  the world-state gap the earlier `CANOPTICON_STUDIO_MAP.md` already
  names as P1, and transformation is a second reason to want it, not a
  duplicate of the first.
- Morph primitives (`shape_morph`, `text_morph`, `geometry_morph`,
  `chart_morph`) each interpolate WITHIN one representation — geometry to
  different geometry, text to different text. None of them, and nothing
  in the compositing family, crosses a REPRESENTATION boundary — body to
  network, network to space, space to type. `image_to_points` is the
  closest thing to a cross-representation bridge that exists (`ENTITY` →
  `IMAGE` → `GEOMETRY`), and it was built for a different reason.

What this actually needs is not a primitive. It's a fourth kind of
program, alongside the construction, the operator stack and the ground:
a **sequence** — an ordered list of constructions with declared crossfade
points, planned once per beat or per motif rather than per scene, that
`compose.ts` can hand to the shot planner instead of a single chain. The
individual transitions (`entity → data_series`, `data_series →
particle_flow`, `particle_flow → text_layout`) are almost all
type-legal today per `canChain`; the missing piece is the thing that
decides to ask for that sequence and hands it the right beats to land on.

This is exactly the shape of gap the brief's own method predicts:
**not a missing primitive, a missing construction.**

---

## What this means for the other five tracks

Kept short — each of these already has real documentation
(`CANOPTICON_STUDIO_MAP.md`, `CANOPTICON_STUDIO_OVERHAUL.md`,
`compile/intent.ts`, `compile/relation.ts`, `compile/grammar.ts`) and this
document's job was only to settle track 1 before anything gets designed
on top of it.

- **Semantic cinematography** — real and tested (`intent.ts`,
  `relation.ts`). Next test, per the last session, is metaphor and
  narrative function — neither needs new palette, both need new reading
  layers over the same constructions.
- **The Director** — `verbs.ts` and the intent panel are the seed. The
  six-track brief's natural-language directing wants a free-text path
  into `readIntent`'s register lexicon, which is additive, not a rewrite.
- **Visual grammar** — `grammar.ts` exists and captures operator appetite
  + representation rung. It has no opinion about camera or composition
  because, per this document, no general camera primitive exists yet to
  have an opinion about.
- **The UX** — six engineer-facing views, as `CANOPTICON_STUDIO_MAP.md`
  already states plainly. This document doesn't change that finding; it
  changes what the Director view would have to expose IF built now — the
  palette underneath it is wider than the six-view UX currently shows any
  sign of.
- **The hybrid future** (image/generative-video as materials) — correctly
  untouched, confirmed above by absence in the code rather than assumed
  from the brief's own deferral.

---

## What I would build first, given this map

In order, and each one chosen because it is the highest-leverage item
that does NOT require expanding the primitive count:

1. **Fix `sonify`.** It is actively dishonest in the registry right now,
   the same defect class as the parameter bug, and it should not still be
   true the next time someone reads this file.
2. **A `space`-family construction for procedural environments and
   architecture.** The primitives exist; nothing reads prose into them.
   Directly answers "generative architecture" and "procedural
   environments" from the brief's list in one piece of work.
3. **The transformation sequence** — the fourth program type. This is the
   single most requested capability in the six-track brief that the
   palette can already almost fully support, and building it is a
   `compose.ts`/`construct.ts` change, not a rendering change.
4. **A general camera family.** Cheap relative to its leverage — every
   future construction benefits from it once it exists, and nothing else
   on this list depends on it existing first.
5. **Lighting/shadow**, only after the above, because it is the one item
   with zero existing composability to build from — the most expensive
   gap to close and the one every other gap can be worked around without.

Deliberately not on this list: any new visual family. Twenty families and
128 primitives, chained by a real type system, cover the brief's palette
almost completely. The work is reaching what's already there.
