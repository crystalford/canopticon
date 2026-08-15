# Are constructions and operators fundamental? — an audit and one experiment

> Run to answer a specific question: has the Visual Language layer removed
> the funnel, or moved it up a level? Everything below is measured. No
> production code was changed to produce it; the Language Lab is the
> control and is untouched.

---

## The verdict, first

**Constructions and operators are (C) accidental historical architecture.**
They are already not on the path — six of the seven languages never touch
them. That question turned out to be settled before it was asked.

**The language grammars are (B) convenience abstractions — recipes.** The
audit confirms the suspicion exactly.

**And neither is the bottleneck.** The bottleneck is one level below both,
and it is the reason every attempt to open the palette has half-failed:

> ### 42 of 129 primitives declare a payload type and emit nothing but pixels.
>
> The type system is a **naming convention, not a contract**. A chain can
> type-check completely and the downstream node receives nothing.

---

## 1. The audit

### Do the languages depend on constructions/operators?

No. `language.ts` imports three *types* from `construct.ts` and no values.
`CONSTRUCTIONS`, `OPERATORS` and `constructPrograms` are referenced zero
times. Only `ILLUSTRATIVE` delegates to the old constructor, deliberately,
so the object-world branch can keep improving on its own track.

So the dependency chain is already:

```
language grammar  →  primitives
```

not

```
language → construction → operator → primitive
```

### Are the grammars recipes?

Yes. Measured across five very different sentences:

| Language | Primitives always present | Distinct primitive sets / 5 sentences |
|---|---|---|
| TYPOGRAPHIC | `glyph_geometry` `text_layout` `variable_axis` | **3** |
| DIAGRAMMATIC | `data_series` `force_layout` `graph_reveal` | **4** |
| COMPUTATIONAL | `wireframe` `camera_3d` `ui_surface` `pixelate` | **4** |

A fixed core with one or two slots that the prose can move. That is a
recipe with holes, and it is what a recipe looks like when it is written
carefully.

### How much of the registry can the language layer reach?

Across **all six** languages and thirteen varied sentences:

```
42 of 129 primitives   (33%)
12 of 20  families
```

Per language, **5 to 9 primitives**. Eight families — VECTOR in part,
TIMELINE, MAPS, CUT GRAMMAR, MOTION CRAFT, AUDIO and most of COMPOSITING —
are unreachable by any language.

For comparison the old construction/operator pipeline reached 26–29 on a
real essay. So the language layer roughly *doubled* reach and kept the
same shape of limit. The funnel moved up exactly one level.

---

## 2. The experiment

`packages/studio/experiments/synth.ts`. Built beside the compiler, wired
into nothing.

```
SEMANTIC MODEL  +  VISUAL LANGUAGE  +  PRIMITIVE REGISTRY
                        ↓
                GRAPH SYNTHESIS        ← no construction is selected
                        ↓              ← no operator stack is selected
                   TYPE CHECK
                        ↓
                     RENDER
```

A language here **cannot name a primitive**. It can only declare per-family
appetites, families it refuses outright, a raster budget and a target size.
The synthesizer grows type-valid graphs out of the registry under those
constraints and binds parameters from what the sentence offers — words to
`text` params, figures to `series` params (and refuses the graph entirely
when the prose printed no numbers), printed counts to anything meaning
"how many".

### Coverage: it works

Twenty programs per language, one sentence:

| | Language layer | Direct synthesis |
|---|---|---|
| Primitives reached (union) | **42 / 129 (33%)** | **86 / 129 (67%)** |
| Families | 12 / 20 | **17 / 20** |
| Per language | 5–9 | **30–40** |
| Distinct programs per sentence | 1 | **20** |

The recipe bottleneck is real and removing it doubles reach. That part of
the hypothesis is confirmed.

### But the programs are not good, and the reason is the finding

Rendering twelve of them: some are genuinely strong and unlike anything a
recipe produced. Others are **flat grey frames carrying the runtime error
`geometry_draw: no upstream GEOMETRY`** — chains that type-check and then
have nothing to work on. Others show `90 DAYS` or `SHOT B`: a downstream
primitive falling back to its own synthetic default because the payload it
was promised never arrived.

Language identity also collapses — TYPOGRAPHIC produces circles,
DIAGRAMMATIC produces a rosette — because raw type-legality is a far weaker
constraint than a chain.

---

## 3. The actual bottleneck

Every primitive was run standalone and its returned payload compared to
its declared output type:

```
129 primitives
 87  declared payload type actually emitted
 42  declared a payload and emit NOTHING but pixels
```

The 42 include the load-bearing ones:

```
text_layout        declares GEOMETRY   emits pixels only
glyph_to_points    declares GEOMETRY   emits pixels only
parametric_curve   declares GEOMETRY   emits pixels only
voronoi            declares GEOMETRY   emits pixels only
force_layout       declares GEOMETRY   emits pixels only
sankey_flow        declares GEOMETRY   emits pixels only
wireframe          declares GEOMETRY   emits pixels only
point_cloud        declares GEOMETRY   emits pixels only
document_surface   declares ARTIFACT   emits pixels only
ui_surface         declares ARTIFACT   emits pixels only
creature_chain     declares ENTITY     emits pixels only
data_to_field      declares FIELD      emits pixels only
text_repeat        declares GEOMETRY   emits pixels only   ← mine, same fault
```

**This explains everything that has been going wrong, in one line.**

- Why recipes worked and synthesis does not: recipes were hand-verified
  against *runtime behaviour*. They avoid the dead links by luck and
  iteration, not by type.
- Why `tile` returned "90 DAYS": it was never receiving an upstream at all.
- Why the raster bridge seemed necessary: payloads do not flow, so the
  chain only ever really passes a **canvas**.
- Why 80% of the palette looked unreachable: a third of it *cannot be
  composed with* whatever the compiler asks for.
- Why every film became a raster treatment: pixels are the only thing that
  reliably travels between two primitives.

The palette is not a typed vocabulary. It is **129 independent
picture-makers with type labels attached**, joined by a canvas.

---

## 4. What this means for the roadmap

**Do not refactor constructions and operators.** They are not the problem
and removing them changes nothing measurable.

**Do not build more languages or more vocabulary.** Adding grammar on top
of a nominal type system produces more recipes.

**The next work is making the type system real**, and it is tractable
because it is mechanical:

1. For each of the 42, decide whether it *should* emit its declared
   payload. Many should — `parametric_curve`, `voronoi`, `force_layout`,
   `point_cloud`, `wireframe` all compute real geometry internally and
   simply do not return it.
2. Where a primitive genuinely only makes pixels, **change the declaration**
   rather than the code. A source that emits IMAGE and says so is honest;
   one that claims GEOMETRY is a trap for anything that composes.
3. Add the emitted-payload check to the registry generator, so the
   declaration can never drift from behaviour again. It is the same
   discipline `consumesUpstream` already applies to the input side —
   detected mechanically, not declared by hand.

Only after that is direct graph synthesis worth pursuing, and at that
point it becomes far more powerful than it looks here, because the branch
structure — a compositor's second input as a whole subgraph — starts
carrying real typed payloads instead of canvases.

## 5. Two classifications, as asked

**`text_repeat` is a capability, not a special case.** It exists because
`tile` declares IMAGE → IMAGE and draws a synthetic plate, ignoring its
upstream — which is a *compositional semantics* failure, not a missing
feature. The distinction it demonstrates is worth keeping:

> "the primitive exists" ≠ "the primitive exposes the right compositional
> semantics"

It is also, honestly, in the list of 42 above. It should emit the point
field it draws.

**The raster-bridge discovery was not about `particle_trail` looking bad.**
It was the first symptom of this same finding: incompatible representations
were being forced through a converter because the architecture assumed a
linear chain of canvases. A visual program is a graph, and a graph needs
payloads that actually travel along its edges.


---

# ADDENDUM — the payload contract pass, and the rerun

> Phase 1–6 of the mandate. The compiler, the Language Lab, the seven
> languages and the synthesizer were all frozen; only the substrate moved.

## The invariant now holds

```
129 primitives
129 declared payload types actually emitted
  0 false payload contracts
```

`scripts/gen-primitive-registry.mjs` will now **refuse to write a
registry** that contains a declaration the runtime does not honour. No
warning, no fallback. Verified by deliberately making `voronoi` claim
FIELD: the generator exits non-zero and the registry is not written.

The check probes each primitive with a well-formed upstream payload of
every type, because a *consumer* like `geometry_morph` honestly returns an
empty set when handed nothing, and judging it on that would punish the one
kind of primitive behaving correctly.

## The three classifications, as asked

**A — should emit the declared payload (35).** Fixed at the single place
every primitive is registered, not in thirty-four drawing loops. `reg()`
wraps any primitive declaring GEOMETRY: if its `frame()` already returns a
point set it is left completely alone; otherwise the form it just drew is
sampled back into `[{x, y, x0, y0}]` — the same contract `glyph_to_points`
established, carrying each point's origin so a morph can interpolate.

Sampling the drawn form is not manufacturing geometry to satisfy a type.
It is reading back the thing the primitive actually made, which is exactly
what `image_to_points` already does deliberately. Sampled through a
200px offscreen rather than the full canvas, so the contract stays
affordable at render resolution.

**B — genuinely an image generator (6).** `ARTIFACT` and `ENTITY` turned
out to be **entirely fictional types**. Every consumer of either —
`artifact_render`, `camera_move`, `entity_render` — reads
`upstream.canvas`. They were names for "a picture from the documents
family" and "a picture from the entity family". Both collapsed to IMAGE,
which is what they always emitted. The type vocabulary lost two members
and gained nothing false.

**C — needs a contract this palette does not have (1, recorded not
faked).** `creature_chain` and `mounted_fixture` genuinely contain
structured information — segments, joints, gait, position. A real ENTITY
payload would let a renderer draw *from* the body rather than grade a
picture of it, and would make "people become insects" a transformation
rather than a cut. That requires rewriting `entity_render` to draw from a
payload, which is a renderer rewrite and explicitly out of scope. Declared
IMAGE for now, which is truthful, and the required contract is written
down here rather than invented.

`data_to_field` was the last holdout and a clean category A: it computes a
per-cell angle to draw its hatch and never collected it. Now returns the
same `{kind:"vector", cols, rows, cell, ang}` shape `flow_field` emits, so
the two are interchangeable upstream of anything reading a vector field.
It also read a module-global array while declaring a DATA input; it now
reads the numbers it was handed.

## One real behaviour change, and why it was kept

Removing ENTITY removed a *type bridge* — and that bridge was carrying a
genuine editorial rule. `entity_render` was inserted to cross a type
boundary and, while it was there, applied the under-exposure that says
*this sentence reports a claim, not a fact*.

With the fiction gone the grade would have silently disappeared: a real
rule vanishing because an unrelated fiction was removed. So it is now
stated in `treatment.ts` as a treatment decision, applied to the subject
before the language's tail, and it applies whatever the subject was built
from rather than only to things that happened to be entities.

Five tests asserted the fiction and now assert the truth. 280 pass.

## The rerun — same synthesizer, same languages, same sentence

| | BEFORE | AFTER |
|---|---|---|
| Primitives reached | 86 / 129 | 85 / 129 |
| Families | 17 / 20 | 17 / 20 |
| Programs that **crashed the renderer** | 1 | **0** |
| Frames carrying a runtime **dataflow error** | 2 | **0** |
| Mean frame contrast | 0.042 | **0.068** |

**Coverage did not move, and it was never what the payload fix addressed.**
The synthesizer explores by type legality, and type legality was already
permissive — that was the problem. What changed is whether the programs it
finds can actually run.

The clearest single piece of evidence is one chain:

```
glyph_to_path → extrude → geometry_morph
```

Before, that produced a flat grey frame reading `geometry_draw: no
upstream GEOMETRY`. Now it produces the word WITHOUT, extruded, its points
morphing — because the glyph geometry genuinely travels the graph. That is
a transformation between representations, discovered by a synthesizer that
was never told about typography, extrusion or morphing.

## What this does and does not prove

**Proved:** the type system is now a contract rather than a naming
convention, and a type-valid graph is a graph that can run.

**Not proved:** that direct synthesis produces *good* films. It does not
yet. Language identity still collapses under pure type-legality —
TYPOGRAPHIC reaches for cellular automata, DIAGRAMMATIC for wireframes —
because family appetite is a far weaker constraint than a chain, and
motion-craft tails still dominate because ANIMATION → ANIMATION accepts
anything once a chain emits it.

Those are the next questions, and they are now askable on a substrate that
tells the truth.
