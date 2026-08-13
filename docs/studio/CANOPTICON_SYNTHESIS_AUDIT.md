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
