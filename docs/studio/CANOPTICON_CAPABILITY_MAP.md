# Canopticon — capability map

> A map of what the system can do, **not** a roadmap of what to build.
> Every box carries a state and, more usefully, an answer to the question
> that has caught nine silent failures so far:
>
> ### Does it reach pixels?
>
> `EXISTS` — built, tested, and a pixel differs because of it.
> `PLANNED` — computed and carried, and **nothing downstream reads it**.
> `PARTIAL` — reaches pixels through one path but not the ones it implies.
> `MISSING` — not built.
>
> `PLANNED` is the dangerous state and it is called out separately from
> `MISSING` on purpose: a missing thing announces itself, a planned thing
> looks finished from every angle except the screen.
>
> ### The six states, in full
>
> `PLANNED` is really one stop on a longer road, and every silent failure
> this project has found sat at a different one:
>
> ```
> DETECTED      the prose was read           subject.ts, figures.ts
>     ↓
> INTERPRETED   a meaning was assigned       relation.ts, intent.ts
>     ↓
> PLANNED       a decision was recorded      scene-plan.ts
>     ↓
> BOUND         a renderer was named         construction / ground slot
>     ↓
> COMPOSITED    it participates in the frame  layer_over, parallax depth
>     ↓
> RENDERED      a pixel differs               verified, not assumed
> ```
>
> The instructive part is that the failures were spread across all of
> them. `namesOnlyAbstractions` never left DETECTED. The `fit()` with no
> Style stalled at INTERPRETED. `plane.weight` sat at PLANNED. `text_morph`
> is BOUND and never COMPOSITED — it type-checks in a chain and ignores its
> upstream. Operator parameters were COMPOSITED and never RENDERED, because
> the names did not exist on the primitives.
>
> A capability claim should name which of the six it has actually reached.

---

## The tree

```
                          CANOPTICON
                               │
              ┌────────────────┴────────────────┐
              │                                 │
           MEANING                          DIRECTOR
              │                                 │
        semantic reading                  visual grammar
              │                            density
        proposition                        literalness
              │                            abstraction
        scene requirements                 transformation
              │                                 │
              └────────────────┬────────────────┘
                               │
                          SCENE PLAN
                               │
         ┌──────────┬──────────┼──────────┬──────────┐
      SETTING    SUBJECT   METAPHOR  COUNTERPOINT  EDITORIAL
         └──────────┴──────────┼──────────┴──────────┘
                               │
                         COMPOSITION
                               │
                        CONSTRUCTIONS
                               │
                          BEHAVIOURS
                               │
                           MATERIAL
                               │
                            CAMERA
                               │
                            PIXELS
```

---

## MEANING

| Box | State | Reaches pixels how |
|---|---|---|
| Figures (quantities, routes) | **EXISTS** | Chart series, sankey stages, `count` on a body |
| Subjects (what is named) | **EXISTS** | Selects the construction; `legPairs` from kind |
| Relations (who acts on whom) | **EXISTS** | `relationBias` → creative state → construction params |
| Stance (asserted/believed/apparent) | **EXISTS** | Belief raises abstraction + restraint, lowers energy |
| Causality (forward/backward) | **EXISTS** | Forward is denser and more restless; backward is held |
| Narrative memory (one scene) | **EXISTS** | Carries the subject into pronoun and unnoticed scenes |
| **Proposition** | **PLANNED** | Nothing reads it. It is a test artifact by design — but it currently cannot influence anything either |
| Narrative function (claim/contrast/consequence) | **MISSING** | — |
| Metaphor comprehension | **MISSING** | And it is not more lexicon |
| Entity identity across a film | **MISSING** | One scene of memory is the whole model |

## DIRECTOR

| Box | State | Reaches pixels how |
|---|---|---|
| Creative state curves (9 dials) | **EXISTS** | Every construction derives its numbers from them |
| Intent (prose → registers) | **EXISTS** | `bendStyle` — 7 of 9 body params move with direction |
| Verbs (6 closed nudges) | **EXISTS** | `constrain` override, survives restyle |
| Pins | **EXISTS** | Precedence 1, freezes the chain |
| Visual grammar (captured) | **EXISTS** | Per-operator appetites bias what is reached for |
| Visual language (per film/scene) | **EXISTS** | Operator appetite + representation rung |
| **World density** (sparse ↔ dense) | **MISSING** | The gap this map exists to name — see below |
| **Literalness** (literal ↔ displaced) | **PARTIAL** | `dislocation` moves *which construction*; it does not move *how displaced the depiction is* |
| Abstraction (physical ↔ abstract) | **EXISTS** | The ladder, and a permission gate on operators |
| Attention (subject ↔ environment) | **PARTIAL** | `plane.weight` now scales and populates the subject's construction; it is not yet a dial a director can move directly |
| Transformation (stable ↔ mutating) | **MISSING** | The fourth program type, unbuilt |
| Natural-language directing | **PARTIAL** | The register lexicon is the mechanism; there is no free-text UI path |

## SCENE PLAN

| Box | State | Reaches pixels how |
|---|---|---|
| `SETTING` | **EXISTS** | Becomes the ground under its subject (`plate_scene`) |
| `SUBJECT` | **EXISTS** | Becomes the construction |
| `COUNTERPOINT` | **EXISTS** | Becomes the ground; the only role no noun asks for |
| **`METAPHOR`** | **PLANNED** | Computed, weighted by abstraction, **built by nothing** |
| **`EDITORIAL`** | **PLANNED** | Same — typography arrives via the construction, not the plane |
| `plane.depth` | **EXISTS** | `applyPlane` sets `parallax_layers.depth` from the plan, not from `style.density` |
| `plane.weight` | **EXISTS** | Scale and population of the subject's construction. An unnoticed anomaly is 0.30 and visibly smaller |
| `CONTEXT` / `SECOND-STORY` / `TRACE` / `RED-HERRING` | **MISSING** | Aldershot roles, deliberately unbuilt |

**This block was the map's most useful finding.** Five of eight rows were
`PLANNED`; two have since been closed (`plane.depth`, `plane.weight`) and
three remain. The scene plan is further from the screen than it looks — it
currently reaches pixels through exactly two channels (which construction
is built, and what goes in the ground slot) and every richer thing it
computes is inert.

## COMPOSITION

| Box | State | Reaches pixels how |
|---|---|---|
| Two-input compositing | **EXISTS** | Five compositors; a ground is a real second chain |
| Ground type-checking | **EXISTS** | `groundSatisfies` refuses a plate to a field compositor |
| Ordered N-plane stack | **MISSING** | One ground slot, not a depth-sorted stack |
| Depth from the plan | **EXISTS** | `applyPlane` writes `parallax_layers.depth` from `plane.depth` — see the SCENE PLAN block |
| Foreground / midground / background as roles | **MISSING** | — |

## CONSTRUCTIONS · BEHAVIOURS · MATERIAL

| Box | State | Reaches pixels how |
|---|---|---|
| 8 constructions | **EXISTS** | Parameterised from the prose, not from a table |
| Dislocation (against the grain) | **EXISTS** | Five distinct constructions per beat |
| 12 operators | **EXISTS** | Params fixed — they had been on defaults for months |
| Behaviours (walk, swarm, synchronise) | **PARTIAL** | Expressed as body params (`gait`, `wander`, `count`); no behaviour vocabulary of its own |
| Materials (ink, pixel, paper, geometry) | **PARTIAL** | Real as operators; not addressable as a material choice |
| Procedural environments | **MISSING** | `plate_scene` is authored, not generated |
| Lighting / shadow | **MISSING** | Nothing in any family touches light |
| Transformation across representations | **MISSING** | — |

## CAMERA

| Box | State | Reaches pixels how |
|---|---|---|
| `camera_move` (documents) | **EXISTS** | Narrow, context-bound |
| `map_camera` (maps) | **EXISTS** | Narrow, context-bound |
| General camera (push/track/orbit/macro) | **MISSING** | No orthogonal camera any construction can be shot with |

## PIXELS

| Box | State | Notes |
|---|---|---|
| Deterministic render by frame index | **EXISTS** | No `Math.random()`; L2 in a pinned environment |
| Per-primitive hash + cache | **EXISTS** | Self-invalidating on param change |
| Retiming invalidates unchanged programs | **BROKEN** | The node hash includes the window — known, unfixed, and now more expensive per scene |
| Narration as master clock | **EXISTS** | Measured, frozen, hashed |
| Procedural score | **EXISTS** | Seeded, ducks under narration |
| Sonification | **BROKEN** | `sonify` declares `DATA → AUDIO` and contains no Web Audio call |
| Server-side render | **MISSING** | Browser only; L2, honestly claimed |

---

## The axis this map was written to name

> **"What must be present for the proposition to hold"** and **"how richly
> should that world be populated"** are two different questions, and the
> system has an answer only to the first.

Same proposition — *something strange is happening and nobody has noticed*
— admits at least four cinematic arguments:

| Reading | The frame | Why the viewer notices |
|---|---|---|
| **Sparse** | A nearly empty street, one strange figure, one distant pedestrian, enormous negative space | Because the world is so quiet |
| **Dense** | Dozens of pedestrians, cars, storefronts, signs, simultaneous micro-events | They have to *discover* it |
| **Surreal** | The city behaves normally; the anomaly is physically impossible | Nothing else in frame acknowledges the impossibility |
| **Systemic** | The city becomes a network and the anomaly propagates through it | The pattern is visible before the thing is |

The compiler currently produces one of these — roughly the sparse one, and
by accident rather than by choice, because a `COUNTERPOINT` is one
`plate_scene` and there is no dial that could make it eighty micro-events.

**This is not a missing primitive.** It is a missing *director dimension*,
and the plan already computes the number it would need — `plane.weight` —
and reads it nowhere.

---

## What this map says to build, if anything

Nothing yet, by instruction. But the ordering falls out of the table
rather than from preference:

1. **Make the planned things reach pixels before adding new planned
   things.** `plane.depth` → `parallax_layers` and `plane.weight` →
   density and scale of what is built are **done**, and doing them
   immediately surfaced a live bug: the unnoticed anomaly was weighted
   0.85 of the frame while the narration said nobody saw it. `METAPHOR`
   → an actual second construction is the next of the three that remain.
2. **World density as a real director dimension**, since the plan already
   computes its input.
3. **The N-plane stack**, which is what makes 1 and 2 worth having.
4. Everything else — camera, lighting, transformation, the remaining
   Aldershot roles — after there is a composition worth pointing a camera
   at.

The two `BROKEN` rows (retiming invalidation, `sonify`) are not on this
list because they are not capabilities. They are debts, and they should be
paid whenever they are next in the way.
