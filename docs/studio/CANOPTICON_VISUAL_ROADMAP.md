# The visual system — where it is, and what comes next

> Written into the repository rather than left in a conversation, so the
> next session continues the program instead of reconstructing it.
>
> **The governing question is not "did we add a capability" but "can the
> system now express something it genuinely could not express before".**

---

## SCOPE — read this before picking anything up

Three states, and they are not the same thing. A roadmap item is not
permission; a tabled item is not a backlog.

| | |
|---|---|
| **ACTIVE** | The spatial/semantic visual grammar. `representation → semantic scene → composition → geometry → camera`. This is the only thing to build. |
| **ROADMAP** | Sequenced below. Work through it as a program, not one item at a time. |
| **TABLED** | Discussed, deliberately not being built. **Do not touch without explicit reactivation.** |

### ROADMAP — build, but not yet

- **Continuous / one-shot as a FILM MODE.** Visual state persists across
  every semantic event so an essay morphs, accumulates and travels
  without cuts. The mechanism already exists as a single constraint —
  `allowCut: false` in `film-state.ts` — because a cut is a grammatical
  operation rather than the absence of one. It is **one flag on the
  continuity vocabulary, not a second engine**, and that is the whole
  design: the modes are constraints over one grammar.

  | Mode | Continuity |
  |---|---|
  | Shot / film | state may reset at a CUT |
  | One shot | state must persist; CUT forbidden |
  | Montage | state deliberately fractures |
  | Hybrid | continuous passages punctuated by cuts |

  **Integrated after the spatial grammar is expressive**, not before —
  a continuous sequence of weak frames is still weak. No further work on
  it in the meantime.

### TABLED — do not build

- **React / any frontend framework.** The Lab is plain canvas and vanilla
  JS with no build step, by design.
- **TTS, voice and narration work.** A separate sidebar. The narration
  pipeline that exists is frozen.

The temporal work already committed (`scene-graph.ts` choreography,
`film-state.ts` continuity) stays in the tree and keeps passing its
tests. It is not the active line of work.

---

## The architecture, as it stands

```
PROSE
   ↓
SEMANTIC MODEL          subjects · figures · relation · scene kind
   ↓
SEMANTIC SCENE          entities + relations + negation      semantic-scene.ts
   ↓
REPRESENTATION          six visual ideas, weighted            represent.ts
   ↓
SCENE GRAPH             elements · roles · places · depth     scene-graph.ts
   ↓  observe(camera)
VISUAL GRAMMAR          ten shared verbs                      grammar-visual.ts
   ↓
PRIMITIVES              132, payload contract 132/132
   ↓
FRAME
```

Every layer is inspectable and each has exactly one translation point.

---

## What is real and verified

- **Representation** — six ideas, weighted off checkable facts. Use vs
  mention: "claiming to be a window" scores literal 0.05 and structural
  0.82. Verified.
- **Visual grammar** — ten verbs (`FRAME ENCLOSURE LAYER APERTURE REPEAT
  CONNECT WORD MARK CONTOUR SOLID PLACE`), shared across modes, typed by
  role (SOURCE / TRANSFORM / RENDER).
- **Vector geometry** — `paths` on the GEOMETRY payload; sampling is now
  the fallback, not the representation.
- **Scene graph** — multiple elements, roles, depth, serialised to nested
  `layer_over` with no renderer change.
- **Camera** — `observe(scene, cam)` transforms places before
  serialisation; parallax by depth. Scene ≠ frame.
- **Semantic scene** — entities and relations with direction. Verified:
  `"The city watched its residents"` → `city OBSERVES residents · 5
  elements`; `"The residents watched the city"` → `residents OBSERVES
  city · 4 elements`. **The reversal is real at the scene level.**

## What is NOT yet true, stated plainly

~~The semantic scene reaches the plan and not the picture.~~ **DONE.** It
was not a compositing WEIGHT problem — raising the weights made the
gallery paler. `layer_over` composites two IMAGES and every primitive
paints its own opaque `bg()`, so each layer's background covered the one
beneath and opacity merely faded the top plate toward the ground colour.
`knockout()` now treats pixels near the film's ground as transparent —
the same "a form is what differs from the ground" insight `formPoints`
needed. Layers genuinely stack; multiple elements are visible; the
OBSERVES arrangement reads on the frame.

Outstanding, in order of leverage:

~~`APERTURE` is a plane, not an opening.~~ **DONE, and built as a
RELATION rather than a graphic.** An aperture creates inside/outside,
visible/hidden, foreground/background and reveal/conceal; a window, a
doorway, a screen, a hole and a redaction are consequences of it rather
than definitions. It paints a surface and cuts an opening filled with the
ground colour, so the compositor's knockout lets whatever is behind it in
the scene graph show through — two elements, one relation, no masks and
no new compositing path. `REVEALS` and `CONCEALS` joined the relation
vocabulary with it.

Outstanding, in order of leverage:

~~`CONNECT` reads as scattered points.~~ **DONE.** `graph_field` gathers
nodes into clusters, joins each to its own centre, and rings the clusters
together — so a diagram is groups and connections rather than a scatter.
Serves a network, an organisation, a distribution or a crowd without
knowing what any of them are. Emits real paths.

Outstanding, in order of leverage:
3. **Temporal grammar.** The scene graph is the right substrate: elements
   ENTER, ACCUMULATE, TRANSFORM, and the camera observes across time. The
   compositional-strategy work (`experiments/strategy.ts`) is still
   outside the pipeline and this is where it rejoins.
4. **Film-level motif.** Same aperture across scenes, developing.

## Rules that have earned their place

- **No noun-specific generators.** The centipede and the smoke detector
  were feasibility proofs that became the ontology. Never again: ask what
  general operation is missing, not what object to code.
- **A renderer must render the payload.** Four operations have now been
  caught declaring a type and destroying what they received —
  `particle_trail` on type, `extrude` on geometry, `boolean_ops` on every
  form it touched, and `layer_over` covering its own under-plate. Check
  the picture, not the contract.
- **Guessing twice is the signal to read the code.** The compositing
  fix was guessed wrong twice from the symptom before anyone opened
  `layer_over` and found it drawing two opaque plates.
- **A constant tuned against one situation will break when the situation
  becomes directorial.** `formPoints`' 0.14 luminance floor assumed a
  near-black ground and broke the moment colour became a choice.
- **Prefixes do not take a trailing word boundary.** `\baccumulat\b`
  cannot match "accumulated". Five relation kinds were unreachable
  because of it and their sentences fell through to CONNECTS. Found by
  the continuity suite asking why an accumulation did not accumulate.
- **The paired suite is the regression net, and it finds things.**
  `tests/semantic-scene.test.ts` holds minimal pairs where only the
  relationship changes. It caught `APPROACHES`/`DEPARTS` missing on its
  first run — "the camera approached the door" and "the camera moved away
  from the door" were producing one scene. Assert on the SCENE GRAPH, not
  on pixels: a regression in meaning should fail before anyone looks at a
  frame.
- **The gallery is the laboratory.** `scratchpad/gal.mjs` regenerates the
  whole matrix in one command. Two columns that look alike means the
  abstraction is too shallow; two different sentences producing the same
  scene means semantic information is being discarded.
