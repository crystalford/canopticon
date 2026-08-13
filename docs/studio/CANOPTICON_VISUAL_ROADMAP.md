# The visual system — where it is, and what comes next

> Written into the repository rather than left in a conversation, so the
> next session continues the program instead of reconstructing it.
>
> **The governing question is not "did we add a capability" but "can the
> system now express something it genuinely could not express before".**

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

**The semantic scene reaches the plan and not the picture.** The
arrangement is computed correctly and the frames still read as one form,
because the FIELD and SECONDARY elements composite too faintly to be
seen. This is the single highest-leverage next fix and it is a
compositing-weight problem inside a working structure, not a new layer.

Also outstanding, in order of leverage:

1. **Make the arrangement visible.** `serialiseScene`'s `layer_over`
   opacity/sink per role is burying everything that is not PRIMARY. Until
   this is fixed no semantic work can be judged from the gallery.
2. **`APERTURE` is a plane, not an opening.** The structural column is a
   rectangle. `wireframe(form:1)` is the wrong source for "you see
   through it"; this probably wants a real aperture — two nested paths
   with the interior removed.
3. **`CONNECT` reads as scattered points.** `force_layout` does not
   cluster. Diagrammatic needs grouping and edges that are drawn.
4. **Temporal grammar.** The scene graph is the right substrate: elements
   ENTER, ACCUMULATE, TRANSFORM, and the camera observes across time. The
   compositional-strategy work (`experiments/strategy.ts`) is still
   outside the pipeline and this is where it rejoins.
5. **Film-level motif.** Same aperture across scenes, developing.

## Rules that have earned their place

- **No noun-specific generators.** The centipede and the smoke detector
  were feasibility proofs that became the ontology. Never again: ask what
  general operation is missing, not what object to code.
- **A renderer must render the payload.** Three operations have now been
  caught declaring a type and destroying what they received —
  `particle_trail` on type, `extrude` on geometry, `boolean_ops` on every
  form it touched. Check the picture, not the contract.
- **A constant tuned against one situation will break when the situation
  becomes directorial.** `formPoints`' 0.14 luminance floor assumed a
  near-black ground and broke the moment colour became a choice.
- **The gallery is the laboratory.** `scratchpad/gal.mjs` regenerates the
  whole matrix in one command. Two columns that look alike means the
  abstraction is too shallow; two different sentences producing the same
  scene means semantic information is being discarded.
