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
| **World population** (sparse ↔ dense) | **EXISTS** | `style.population` → `plane.population` → `applyPlane`. 0.1/0.5/0.9 gives 17/41/67 cars on one scene, and does not touch the subject |
| **Literalness** (literal ↔ displaced) | **PARTIAL** | `dislocation` moves *which construction*; it does not move *how displaced the depiction is* |
| Abstraction (physical ↔ abstract) | **EXISTS** | The ladder, and a permission gate on operators |
| Attention (subject ↔ environment) | **EXISTS** | `style.attention` redistributes weight across the planes the scene already has. Subject scale 0.378 → 0.475 as its world falls 48 → 35 |
| **Expression without meaning** | **EXISTS** | Attention applies AFTER the roles are fixed, so the proposition is invariant by construction. Asserted across a 3×3 grid: one role set, nine pictures |
| **How importance MANIFESTS** (per grammar) | **MISSING** | One mapping for every film: weight means scale and population. A grammar that made a low-weight subject fragmented, occluded and intermittent instead would be a different film from the same 0.30 — and `applyPlane` is the one place it would go |
| Transformation (stable ↔ mutating) | **MISSING** | The fourth program type, unbuilt |
| Natural-language directing | **PARTIAL** | 10 registers. "Make the city feel huge and indifferent" reads as population +0.75, attention −0.70 and reaches the picture. There is still no free-text UI path |

## SCENE PLAN

| Box | State | Reaches pixels how |
|---|---|---|
| `SETTING` | **EXISTS** | Becomes the ground under its subject (`plate_scene`) |
| `SUBJECT` | **EXISTS** | Becomes the construction |
| `COUNTERPOINT` | **EXISTS** | A layer of the stack, built by its own construction |
| **`METAPHOR`** | **PLANNED** | Computed, weighted by abstraction, **built by nothing** |
| **`EDITORIAL`** | **PLANNED** | Same — typography arrives via the construction, not the plane |
| `plane.depth` | **EXISTS** | `applyPlane` sets `parallax_layers.depth` from the plan, and orders the stack |
| `plane.weight` | **EXISTS** | Scale and population of each layer's construction, and the compositor's `opacity`/`sink` |
| Setting carried between scenes | **EXISTS** | "At first nobody noticed" is still in the city — same memory the subject had |
| `CONTEXT` / `SECOND-STORY` / `TRACE` / `RED-HERRING` | **MISSING** | Aldershot roles, deliberately unbuilt |

**This block was the map's most useful finding.** Five of eight rows were
`PLANNED`; three have since been closed and two remain (`METAPHOR`,
`EDITORIAL`). The scene plan used to reach pixels through exactly two
channels — which construction is built, and what single primitive went in
the ground slot. It now reaches them through an ordered stack, so a plan
that finds a setting *and* a counterpoint no longer has to discard one of
them.

## COMPOSITION

| Box | State | Reaches pixels how |
|---|---|---|
| Two-input compositing | **EXISTS** | Five compositors; a ground is a real second chain |
| Ground type-checking | **EXISTS** | `groundSatisfies` refuses a plate to a field compositor |
| Ordered N-plane stack | **EXISTS** | `graph.ts` — nested grounds, far to near. Cost, hash, film plan and usage all recurse |
| Depth from the plan | **EXISTS** | `applyPlane` writes `parallax_layers.depth` from `plane.depth` — see the SCENE PLAN block |
| Foreground / midground / background as roles | **EXISTS** | The stack's order IS the depth order, and it is semantic — a setting is behind its subject because that is what a setting is |
| A stack the frame budget cannot pay for | **EXISTS** | Drops the deepest layer and says how many, rather than trimming silently |
| Two second inputs on one chain | **EXISTS** | A scene now carries a setting, a counterpoint AND a field at once. Beat 3 of the test paragraph is `field_displace ⌞ gravity_field` over a stacked world |
| `ground` as a privileged concept | **RETIRED** | A scene is a typed tree. `planGround` survives demoted to ATMOSPHERE proposer — one child among others, not the gate all layering had to pass |
| Typed interaction between nodes | **EXISTS** | A node's OUTPUT decides how it composes. IMAGE layers; FIELD inverts onto `field_displace` because it must be read as numbers |
| Recursive containment | **PARTIAL** | `SceneNode.children` nests and `flattenGraph` recurses correctly, asserted three levels deep. No construction yet POPULATES a child's children |
| Controlled stochasticity | **EXISTS** | Population is a character, not a count. Seeded ±18% jitter, no `Math.random()`, and the jitter never crosses the dial |

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

**Two of these are now reachable and the axis is built.** `worldPopulation`
and `attention` are director dimensions, biases like everything else,
neutral at 0.5 so no existing film moved. Measured on "At first nobody
noticed":

| | cars in the world | subject scale |
|---|---|---|
| population 0.1 | 17 | 0.427 |
| population 0.5 | 41 | 0.427 |
| population 0.9 | 67 | 0.427 |
| attention 0.1 (environment) | 48 | 0.378 |
| attention 0.9 (subject) | 35 | 0.475 |

The subject does not move with population, on purpose: "dozens of them" is
a number the essay printed, and a world dial that multiplied it would be
the director editing the prose. Same firewall the figures keep.

**Surreal and Systemic are still out of reach**, and neither is a dial —
surreal needs a construction that can be physically impossible, systemic
needs the anomaly to propagate through the world rather than sit in it.

---

## What this map says to build, if anything

Nothing yet, by instruction. But the ordering falls out of the table
rather than from preference:

1. **Make the planned things reach pixels before adding new planned
   things.** `plane.depth` → `parallax_layers` and `plane.weight` →
   density and scale of what is built are **done**, and doing them
   immediately surfaced a live bug: the unnoticed anomaly was weighted
   0.85 of the frame while the narration said nobody saw it. `METAPHOR`
   → an actual second construction is the next of the two that remain.
2. **The N-plane stack** — **done**. Nested grounds, far to near, each
   layer a real construction carrying its own weight. It is what makes 1
   and 3 worth having, because a weight is only interesting once there is
   something for it to be weighted *against*.
3. **World density as a real director dimension**, since the plan
   computes its input and the stack now spends it.
4. Everything else — camera, lighting, transformation, the remaining
   Aldershot roles — after there is a composition worth pointing a camera
   at.

The two `BROKEN` rows (retiming invalidation, `sonify`) are not on this
list because they are not capabilities. They are debts, and they should be
paid whenever they are next in the way.
