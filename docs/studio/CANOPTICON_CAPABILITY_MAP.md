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
| **World density** (sparse ↔ dense) | **MISSING** | The gap this map exists to name — see below. Its input and its output path both exist now; the dial does not |
| **Literalness** (literal ↔ displaced) | **PARTIAL** | `dislocation` moves *which construction*; it does not move *how displaced the depiction is* |
| Abstraction (physical ↔ abstract) | **EXISTS** | The ladder, and a permission gate on operators |
| Attention (subject ↔ environment) | **PARTIAL** | `plane.weight` reaches every layer's construction and the compositors between them; it is not yet a dial a director can move directly |
| **How importance MANIFESTS** (per grammar) | **MISSING** | One mapping for every film: weight means scale and population. A grammar that made a low-weight subject fragmented, occluded and intermittent instead would be a different film from the same 0.30 — and `applyPlane` is the one place it would go |
| Transformation (stable ↔ mutating) | **MISSING** | The fourth program type, unbuilt |
| Natural-language directing | **PARTIAL** | The register lexicon is the mechanism; there is no free-text UI path |

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
| Ordered N-plane stack | **EXISTS** | `stack.ts` — nested grounds, far to near. Cost, hash, film plan and usage all recurse |
| Depth from the plan | **EXISTS** | `applyPlane` writes `parallax_layers.depth` from `plane.depth` — see the SCENE PLAN block |
| Foreground / midground / background as roles | **EXISTS** | The stack's order IS the depth order, and it is semantic — a setting is behind its subject because that is what a setting is |
| A stack the frame budget cannot pay for | **EXISTS** | Drops the deepest layer and says how many, rather than trimming silently |
| Two second inputs on one chain | **MISSING** | A scene whose generic ground is a FIELD cannot also show its setting — one ground slot on the main chain, and `compose.ts` keys its params by primitive id |

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
by accident rather than by choice.

**This is not a missing primitive.** It is a missing *director dimension*.
Both halves of the plumbing it needs now exist: the plan computes
`plane.weight`, and `applyPlane` turns it into population (`plate_scene.cars`
moved 17 → 24 between two layers of one scene). What is still missing is
the dial itself — a director cannot say "make this world dense" and have
the whole stack answer, and every layer's population is still a function of
its own weight rather than of a stated density for the shot.

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
