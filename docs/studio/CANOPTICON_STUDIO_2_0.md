# Canopticon Studio 2.0 — a cinematic generation system

> The question this document answers: *how far can deterministic
> code-generated cinema go when the system is allowed to construct visuals
> rather than select from a finite palette?* Written after
> `CANOPTICON_VISUAL_PALETTE_MAP.md` established the premise this whole
> document depends on — the palette is not the bottleneck. Twenty
> families, 128 primitives, a real type system connecting them, and
> **almost everything on a fifty-item wishlist already exists or is one
> unwritten chain away.** The five missing capabilities that survived that
> audit (lighting/shadow, a fluid solver, environments-as-constructions, a
> general camera, image reconstruction) and the one structural gap
> (transformation across representations) are named again below, in their
> proper place in this architecture, not repeated as a list.
>
> This document does not re-litigate what's already built and tested —
> `compile/intent.ts`, `compile/relation.ts`, `compile/grammar.ts`,
> `compile/construct.ts`'s dislocation mechanism — it builds on top of
> them and says exactly where each sits in the redesign. Where this
> document proposes something new, it says NEW. Where the answer is
> already live, it says EXISTS and names the file.
>
> **Rule this document does not get to break**: standing rule 4, no
> `Math.random()`. Every "candidate generation," "possibility engine" and
> "visual arc" below is deterministic — seeded from scene index, motif id,
> or IR content — never sampled. A generation system that rolled dice
> would not be Canopticon; it would be the AI-video-generator this project
> has refused to become since its first sentence.

---

## 1. The complete procedural visual capability map

Delivered as its own document —
`docs/studio/CANOPTICON_VISUAL_PALETTE_MAP.md`. Not repeated here.
Referenced throughout this one. Its headline is this document's premise:
the substrate is wide; the construction layer on top of it is thin.

---

## 2. Construction taxonomy

**PARTIAL EXISTS.** `construct.ts` currently has eight constructions
(`body`, `fixture`, `paper`, `quantity`, `route`, `network`, `space`,
`type`), each keyed to what a sentence names. That is the right
*mechanism* — a construction reads the beat and emits a program — at the
wrong *grain*. Eight constructions tied to noun categories cannot be the
whole taxonomy a director thinks in, because a director doesn't think in
nouns; they think in what kind of thing the shot is *doing*.

**NEW: reorganise around seven creative categories**, each containing the
existing (and future) constructions as its members:

| Category | Existing members | New members this unlocks |
|---|---|---|
| **ENTITY** | `body`, `fixture` | procedural buildings, vehicles, crowds-as-individuals |
| **SYSTEM** | `network` | supply chains, bureaucracies, surveillance topologies — same primitive family (`G·NETWORK`), read from relational prose (`relation.ts`) instead of proper-noun counting |
| **EVIDENCE** | `paper`, `route` | claim→source→contradiction chains, reusing `document_surface`/`annotation`/`redaction` with a narrative sequence on top |
| **TEMPORAL** | none named yet | `H·TIMELINE` + `Q·CUT GRAMMAR` exist as primitives; no construction reads "before/after," "accumulation," "recurrence" from prose today |
| **TYPOGRAPHIC** | `type` | already the richest primitive family (`A·TYPOGRAPHIC`, 11 primitives); the construction is thin relative to what it could reach |
| **ENVIRONMENT** | `space` | the P0 gap from the palette map — `plate_scene` is authored, not generated; this category is where that gets fixed |
| **ABSTRACT** | implicit in `type`'s fallback | dislocation (§4 below) already lets any construction be reached against the grain; ABSTRACT names the *deliberate* choice to represent a non-depictable idea (fear, power, bureaucracy) rather than treating it as `type`'s leftover case |

This is a **relabelling and regrouping**, not a rewrite: every existing
construction keeps its `fit`/`dislocate`/`build` shape from `construct.ts`
(`interface Construction`, line ~249). The category is a property on the
construction (`category: "ENTITY" | "SYSTEM" | ...`), read by the Director
UX (§12) to group candidates, and by candidate scoring (§7) to enforce
category diversity rather than construction diversity — five candidates
that are all `ENTITY` variants is the same failure mode the sentence tests
already caught once, one level up.

---

## 3. Transformation architecture

**NEW — the single highest-leverage addition in this document**, per both
the palette map's own conclusion and the six-track brief's emphasis.

### The core insight

Every existing program type — construction, operator stack, ground — is
**synchronous**: one thing, built once, held or animated in place for the
scene's duration. Transformation is different in kind, not degree: it is
**several different CONSTRUCTIONS, in sequence, within one continuous
visual thread**, where the audience watches the representation itself
change, not just the content within one representation.

```ts
// NEW, src/compile/transform.ts
export interface TransformStage {
  construction: string;      // one of construct.ts's construction ids
  nodes: PlannedNode[];      // built exactly as constructPrograms does today
  holdMs: number;            // how long this stage reads before the next begins
}

export interface TransformProgram {
  id: string;
  stages: TransformStage[];  // 2-4 stages; more reads as chaos, not argument
  bridges: string[];         // the primitive(s) at each seam — see below
  why: string;               // "people → network → data, as the crowd is counted"
}
```

### Why this is buildable now, not a research project

The palette map already verified the load-bearing claim: most
stage-to-stage transitions are **type-legal today**. `entity_render`
(`ENTITY→IMAGE`) into `image_to_points` (`IMAGE→GEOMETRY`) into
`force_layout` (`DATA→GEOMETRY`, needs a bridge) is exactly the
"people → network" hop the brief asks for, and two of its three legs
already chain. The missing piece was never the primitives. It's:

1. **A bridge table.** Where two adjacent constructions' output/input types
   don't already align (`GEOMETRY` → `DATA`, for instance), a named bridge
   primitive or short chain closes it. Most bridges are one hop
   (`data_to_particles`, `image_to_points`) that already exist; a small
   number are genuinely new and get named honestly as gaps, not silently
   faked.
2. **A seam plan**, reusing the crossfade/hold logic `shot-plan.ts`
   already has for cuts WITHIN one construction, generalised to cuts
   BETWEEN them. The visual grammar of the seam (hard cut, dissolve,
   `layer_blend`) comes from the same `LANGUAGE`/grammar bias already
   driving operator appetite in `construct.ts` — a McLuhan-esque grammar
   wants hard cuts at seams, a hypnotic-investigative one wants long
   dissolves.
3. **A trigger.** `constructPrograms` currently returns single-construction
   programs, best-scored first. A `TransformProgram` becomes a candidate
   in the same list when a beat's relation (`relation.ts`) or narrative
   arc (§5) implies motion between categories — "the workers became
   numbers" is a `relation` with `cause: forward` and a subject that
   changes category (person → data), which is a checkable, deterministic
   signal, not a guess.

### Motif-driven transformation across scenes, not just within one

The single-scene version above is the P0. The bigger claim in the
brief — a red thread returning as a network edge, then a timeline, then
fractured type — is `TransformProgram` stretched across the **motif
system** (§7 of the existing IR schema, `MotifSchema`) rather than one
beat: each `MotifOccurrence` already carries a `state`/`stateIndex`
(`developMotif` in `compose.ts` escalates by abstraction/density today).
Extending `MotifOccurrence` with an optional `category` lets
`developMotif`'s escalation choose a **new construction category** instead
of only a fiercer version of the same one — which is the mechanism behind
"the thread reappears as a network edge."

---

## 4. Director control model

**PARTIALLY EXISTS, needs consolidation, not replacement.** Three real
mechanisms exist today and they currently don't know about each other:

- **Verbs** (`compile/verbs.ts`) — six buttons, a closed set, writing a
  `constrain` override.
- **Intent** (`compile/intent.ts`) — free-text `feel`/`understand`/
  `notice`/`hide`, read by a register lexicon, biasing both construction
  score and the full creative-state (`bendStyle`).
- **Relation** (`compile/relation.ts`) — read from the prose itself, not
  authored by the director, but bending the same state dials.

**NEW: unify these as one layered bias stack**, applied in this fixed
order, each layer able to lean on but never overwrite the one before it
(exactly `bendStyle`'s existing contract, generalised):

```
FILM GRAMMAR (captured or authored, whole-film default)
  → ACT-LEVEL ARC POSITION (§5, where this beat sits on the film's arc)
    → SCENE RELATION (relation.ts, a fact about THIS sentence)
      → DIRECTOR INTENT (intent.ts, this scene's instruction)
        → DIRECTOR VERB (verbs.ts, an explicit nudge)
          = resolved Style for constructPrograms
```

This is not a new mechanism — `bendStyle` already composes (compose.ts
applies verb-nudge then intent-bias today); it's making the composition
order explicit, complete, and inspectable, so the Director UX (§12) can
show *which layer* is responsible for a given number, which is the
"why does this look like this" question the Engineer view already
promises for cache but not yet for creative state.

**NEW, and this is the actual UX unlock**: natural-language directing as a
first-class input, not a stretch goal. `readIntent`'s register lexicon
(nine registers today) is the whole mechanism a free-text box needs — it
already declines honestly when it can't read something
(`describeIntent`'s "nothing read"). The UI work is a text field and a
readback, both cheap; the compiler work is already done.

---

## 5. Film-level visual grammar (the visual arc)

**NEW capability, EXISTS as raw material.** `resolveStateAt` and
`scenePosition` (`creative-state.ts`) already place every scene on the
film's timeline as a fraction 0..1 and resolve the creative state's
control-point curve at that position — this is *already* how "the film
gets more abstract toward the end" works, if a director drags the
abstraction curve up over time.

What's missing is naming this as a **first-class arc concept** rather than
"whatever shape the operator happened to drag." Two additions:

1. **Named arc templates** — `calm → accumulation → acceleration →
   overload → silence → revelation`, per the brief's own example — as
   presets for the *existing* control-point curves, not a new mechanism.
   Applying one writes control points exactly the way dragging the curve
   does today (`saveCreativeState`), so it is inspectable and editable
   after the fact, never a black box.
2. **Category pressure as a curve, alongside the existing nine.** Right
   now density/abstraction/energy/etc. are continuous curves; construction
   *category* (§2) is discrete. A tenth "systemic pressure" curve
   (0 = individual/literal, 1 = systemic/abstract) biases which
   CATEGORY a beat reaches for, the same way `intent.style` biases
   individual dials today — "Act III, systems emerge" becomes a real,
   draggable curve rather than a director manually re-stating intent on
   every scene in the act.

This directly prevents the "demo reel" failure the brief names: variety
becomes a *consequence* of the arc moving through categories over time,
not an anti-repetition penalty layered on top of otherwise-arbitrary
choices.

---

## 6. Motif system

**PARTIAL EXISTS**, extended by §3's transformation work above. What's
additionally needed and not yet covered:

- **A motif panel is UX, not compiler work** — `MotifSchema` and
  `developMotif` already carry everything the brief's "every appearance,
  inspectable" ask needs. This is a `GET /project/:id/motifs` route
  (new, trivial) and a Lab view (new, the actual work), not new compile
  logic.
- **Cross-scene visual identity persistence** is the one real gap. Today,
  `carried` (compose.ts's one-scene subject memory) answers "what is this
  pronoun about" for the CONSTRUCTOR. A motif needs the same question
  answered for the RENDERER: does "the red thread" get the same seed,
  the same colour, the same segment count each time it appears, so it
  reads as the same object rather than a coincidentally similar one. This
  is a small, real addition: a `visualIdentity` hash per motif, folded
  into each occurrence's seed derivation (`hash.ts` already seeds
  deterministically from scene index; extending the seed input to include
  a stable motif id is additive, not a redesign).

---

## 7. Candidate generation and selection

**EXISTS, needs three additions.** `constructPrograms` already generates
several genuinely different programs, scores them, and returns them
sorted — the Preview already surfaces alternatives. What the brief's
"visual possibility engine" asks for beyond that:

1. **Category-diverse candidates, not construction-diverse.** `diversify`
   (construct.ts) already promotes the first program of each distinct
   construction. Promoting by CATEGORY (§2) instead is a one-line change
   to that function's grouping key, and it's what actually produces "a
   literal, an investigative and a metaphorical reading" rather than
   "three constructions that all happen to read as literal."
2. **Novelty against film history.** Named in `CANOPTICON_STUDIO_MAP.md`
   as the P1 gap and unaffected by anything since — `constructPrograms`
   still doesn't consult `recentChains`. Fixing this is: pass a
   `recentCategories: string[]` alongside the existing `recentChains`,
   penalise a category streak in scoring the same way `restraint` already
   penalises node count. Small, and it's the mechanism that makes an arc
   (§5) *enforceable* rather than merely *suggested*.
3. **Candidate explanation in director language, not chain language.**
   `Program.why` today reads like `"the prose drew the route explicitly,
   in 4 stages"` — accurate and useful in Engineer mode, wrong for
   Director mode. NEW: a second field, `Program.pitch`, a template-filled
   sentence built from the construction's category + the beat's subject +
   whether it's dislocated (`"The crowd becomes a living network"` vs.
   `"a body of 8 segments"`). Deterministic string templates per category,
   not a model call — standing rule 1 still applies to anything shown
   live, including a sentence describing a chain.

---

## 8. Camera / compositing model

**GAP, correctly named in the palette map, elaborated here.** Two
separate things the brief asked for, and they compose differently:

### Camera — NEW, one general orthogonal primitive family

`camera_move` and `map_camera` are the only camera-shaped primitives
today, both narrow. A general `Q · CAMERA`-style family (reusing the
existing letter budget or extending `L·3D`) needs exactly the moves the
overhaul brief names: push, track, orbit, macro, top-down. Because the
whole palette is 2D canvas math (confirmed in the palette map — no
WebGL), "camera" here means the same thing `L·3D`'s wireframe/point-cloud
primitives already do: a projection matrix applied at draw time, not a
GPU camera object. This is buildable with the existing toolchain; it is
new code, not a new dependency.

### Compositing planes — NEW, and this is the addition beyond what
either prior document proposed

The user's own addition to this brief, and correctly identified as
missing from everything before it: **the palette has two-input
compositing (`layer_over` et al.) but no concept of an ordered N-plane
stack** — foreground / midground / background / typography / particles /
environment / atmosphere, composited in a fixed depth order with the
camera able to move THROUGH it.

```ts
// NEW, src/compile/composite.ts
export interface Plane {
  role: "background" | "environment" | "midground" | "foreground"
      | "typography" | "atmosphere";
  program: Program;          // this plane's own construction, built normally
  depth: number;             // 0 (far) .. 1 (near) — feeds parallax_layers' existing depth param
}
export interface CompositedScene {
  planes: Plane[];           // depth-sorted
  camera: CameraMove | null; // §8's new family
}
```

This is not a new rendering technique — `parallax_layers` (`M·COMPOSITING`)
already takes a `depth` parameter per layer and `drift_parallax`
(`T·MATERIAL`) already does lateral drift keyed to depth. What's missing
is the **plan**, not the primitive: nothing today decides that a scene
should have an environment plane AND a foreground entity AND typography as
three separately-built, separately-composited programs rather than one
linear chain. This is the mechanism that turns "smoke detector" into the
brief's own example — `environment → wall → detector → shadow →
particles → camera → text → atmosphere` — each layer a small
`constructPrograms` call in its own right, composited by depth rather than
concatenated in one chain.

**Depends on §3's lighting/shadow gap for the "shadow" plane to be real**
rather than faked with a dark ellipse — named as a real dependency, not
elided.

---

## 9. Image as procedural material

**DEFERRED BY STANDING DECISION**, per overhaul brief §23 — this section
exists to say precisely where the door is left open, not to walk through
it. When a future image source arrives (Workers AI image generation, an
uploaded reference), the entry point is a single new primitive class:

```
IMAGE (from any source)
  → image_to_points   (EXISTS — S·ENTITY, IMAGE→GEOMETRY)
  → image_to_mask     (NEW — the one genuine palette gap the map found:
                        nothing generates a mask from an arbitrary image)
  → image_to_contour   (NEW — no edge-detection primitive exists)
  → [reconstruction]  (NEW — §1's other named gap)
```

Everything downstream of that entry point — particles, geometry,
compositing, transformation — is **already built**, because those
consumers only care about typed `IMAGE`/`GEOMETRY`/`MASK` payloads, not
where the pixels originated. This is the concrete version of "an image
becomes a material the procedural system can operate on rather than
replacing it": the type system already enforces it, because
`image_to_points` cannot tell a generated smoke detector from a plate an
uploaded photo produced. The only new work when this door opens is the
three new primitives above and an ingestion route; nothing in
`construct.ts` or `compose.ts` needs to change.

---

## 10. Procedural environments

**Restated from §2/§8 as its own item because it's independently P0.**
The construction is new (§2's ENVIRONMENT category); the primitives it
needs mostly exist (`l_system`, `recursive_geometry`, `extrude`,
`wireframe`, `point_cloud` — all already type-chainable per `canChain`).
The one missing primitive is a **noise-driven layout generator** — rooms,
streets, floor plans as a graph laid out from a seed, analogous to how
`force_layout` lays out a network today but for enclosed space rather than
open topology. This is the single new primitive this document proposes
adding to the palette (as opposed to the palette map's list of gaps,
which are almost all "build the construction," not "build the
primitive").

---

## 11. Semantic / narrative architecture

**EXISTS at the sentence level, GAP at the argument level.**
`relation.ts` reads who-acts-on-whom within one clause; `intent.ts` reads
one scene's directorial instruction. Neither reads across scenes for
**narrative function** — is this beat a claim, a contrast, a consequence,
a revelation — which the earlier session's own roadmap named as Test D
and has not yet been run.

**NEW, scoped narrowly on purpose**: a small, closed set of narrative
function markers (`claim`, `evidence`, `contrast`, `consequence`,
`revelation`), read the same deterministic way `relation.ts` reads cause —
transition words and structural position (a beat immediately following an
`EVIDENCE`-category construction is a plausible `consequence` candidate;
a beat containing `but`/`however`/`in fact` at its head is a plausible
`contrast`). This directly feeds §3 (a `revelation` beat is a strong
transformation trigger — the representation should visibly resolve) and
§5 (an arc template can be defined in terms of narrative function
positions, not only scene index).

Deliberately NOT scoped here: metaphor detection. The earlier session's
own conclusion stands — the lexicon is a mechanism, not a theory of
meaning, and metaphor is exactly the kind of thing a closed word list
cannot honestly claim to read. Left for a future, separately-designed
pass; not silently assumed solved by narrative function.

---

## 12. Director UX

**MISSING**, per `CANOPTICON_STUDIO_MAP.md`'s own finding, restated here
with the shape this document's other sections imply for it.

**Primary navigation**: `DIRECT · STORY · VISUALS · SOUND · TIMELINE ·
LIBRARY · ENGINEER`, per the overhaul brief §25 — unrevised here because
nothing in this document changes that answer.

**DIRECT is where §4, §5 and §7 meet**: a scene's candidates (§7, grouped
by category per §2, each with a `pitch` sentence not a chain string),
the layered bias stack (§4) shown as sliders that report which layer set
which value, and the arc position (§5) shown as a marker on a film-length
strip so a director sees where "now" sits on the curve they're editing.

**The technical implementation is the smallest part of this document**:
every field the Direct view needs already exists on `ComposedScene`,
`Program`, and the new `pitch`/`category` fields §7 and §2 add. This is a
view-layer project, reusing `bridge.js`'s existing pattern of adapting
Worker JSON into what a view reads — not a new compiler surface.

---

## 13. Film timeline UX

**PARTIAL EXISTS.** `shot-plan.ts` and `solver.ts` already produce
exact windows; the Preview already plays them. What's described in the
overhaul brief §39 — voice/words/sentences/visual/world/sound as
stacked tracks — is a rendering of data that mostly already exists
(`sequenceAlignments`'s word timings, `ComposedScene`'s per-scene state,
§6's motif occurrences) plus one new track (§8's plane stack, §3's
transform stage boundaries). Explicitly **not** the primary creative
surface, per the brief's own instruction — an inspection view, arrived at
FROM Direct, not the default screen.

---

## 14. How advanced users reach the underlying procedural system

**EXISTS**, and this document doesn't change it: ENGINEER mode, showing
the IR, the chain, the cache, the primitive registry — everything Direct
mode deliberately hides. The only change this document implies is scope:
Engineer mode grows to show §3's transform stages, §8's plane stack and
§4's bias-layer breakdown as inspectable data, in the same spirit as
today's per-primitive reasons (`ComposedNode.reason`) — every new
mechanism this document proposes gets an Engineer-mode surface as a
condition of being built, not an afterthought.

---

## 15. Architecture for eventual archival / generated video / human assets

**DEFERRED BY STANDING DECISION**, per overhaul brief §24. Restated
briefly because §9 makes the shape concrete: any external material —
archival footage, a generated frame, a human-supplied asset — enters
through the same `IMAGE` typed boundary §9 describes. It is a material,
never a replacement renderer. Nothing in this document's other sections
assumes it will ever exist; nothing in this document's other sections
would need to change if it never does.

---

## 16. Rendering / caching model

**EXISTS, with one known defect and one new cost.**

- Per-primitive SHA-256 hashing (`hash.ts`), cache diffing (`cache.ts`),
  `RENDERER_VERSION` invalidation — all correct and tested, confirmed
  again during the parameter-plumbing work (the fix was self-invalidating
  precisely because the hash includes resolved params).
- **Known defect, restated from `CANOPTICON_STUDIO_MAP.md`**: the node
  hash includes the scene's timing window, so a pure retiming — no
  program change — still invalidates every node in the scene. Still
  unfixed. This document doesn't add new urgency to it beyond what was
  already recorded, but §3 and §8 both add MORE nodes per scene
  (multiple transform stages, multiple composited planes), which makes
  this existing defect proportionally more expensive every time a film
  is retimed. Worth fixing before §3/§8 ship, not after.
- **New cost, named honestly**: §8's plane stack means a scene with four
  composited planes costs roughly four independent `constructPrograms`
  calls plus a composite pass, not one. §16's render-speed section
  (below) already accounts for this.

---

## 17. Accessibility

**FUTURE**, unrevised from the overhaul brief §42 and
`CANOPTICON_STUDIO_MAP.md`'s classification. Nothing in this document's
schema changes foreclose it — `Plane.role`, `TransformStage`, and the
narrative-function markers are all additional structured data a
captions/high-contrast/reduced-motion renderer could read the same way
the primary renderer does. Not designed further here; flagged as still
open.

---

## 18. Performance strategy

**EXISTS as diagnosis** (`CANOPTICON_STUDIO_MAP.md`'s three-cause render
analysis — wall-clock pacing, full-resolution `getImageData`, a pacing
loop that cannot recover), **worsened by this document's own proposals**,
stated plainly rather than hidden:

- §8's plane stack multiplies per-scene primitive calls.
- §3's transform stages mean a scene now potentially holds several full
  programs in sequence rather than one.

Both make the existing "cheap wins first" list (half-resolution operator
reads, caching a motionless ground's frame, reporting drift) MORE
necessary, not less, and move `VideoEncoder` + a trustworthy muxer from
"eventually" to "before §3 and §8 ship to every project," because the
render-time math genuinely changes once a scene can hold four planes and
three transform stages instead of one chain.

---

## 19. Evaluation benchmarks

**NEW.** Nothing in this codebase currently answers "did this change make
Studio better" except manual judgment and the sentence tests this session
ran ad hoc. Three cheap, deterministic benchmarks worth building
alongside the above, each a `vitest` suite in the existing pattern:

1. **Category diversity over a real essay** — compile a real multi-scene
   essay, assert the top candidate's category doesn't repeat more than N
   times in a row without an arc-curve reason. Directly measures §5 and
   §7's actual effect, the same way the sentence tests measured §4's.
2. **The five/seven-sentence relation stress tests, kept as a permanent
   regression suite** — already written this session
   (`construct.test.ts`), not new work, just flagged as belonging in
   this section's inventory.
3. **A transformation soundness check** — every `TransformStage` seam in
   a real film's compiled output must be `canChain`-legal or explicitly
   bridged; assert zero silent gaps, the same discipline the parameter
   audit just proved valuable elsewhere in this exact codebase.

---

## 20. A concrete Studio 2.0 roadmap

In dependency order — each phase either depends on the one before it or
is independently shippable, marked accordingly.

**Phase 0 — hygiene, before anything else** *(independent, cheap, do
first)*
- Fix the `sonify` lie (§1 / palette map).
- Fix the retiming-invalidates-everything cache defect (§16).
- Land `DirectorIntent` on the scene schema for real narrative-function
  markers (§11) to attach to, if not already broad enough.

**Phase 1 — the construction taxonomy (§2)** *(independent)*
Relabel and regroup existing constructions into the seven categories.
Almost entirely a `construct.ts` refactor; no new primitives.

**Phase 2 — transformation, single-scene (§3)** *(depends on Phase 1
for category labels)*
The bridge table, the seam plan, the trigger from `relation.ts`. Ships as
a new candidate type in the existing alternatives list before it ever
touches the UI.

**Phase 3 — candidate generation upgrades (§7)** *(depends on Phase 1)*
Category-diverse promotion, novelty-against-history, `pitch` sentences.
Small, high-leverage, and makes Phase 6 (Director UX) worth building.

**Phase 4 — film-level arc (§5)** *(depends on Phase 1)*
Named arc templates over existing curves; the new tenth "systemic
pressure" curve.

**Phase 5 — camera + compositing planes (§8)** *(depends on Phase 1;
independent of 2-4)*
The new camera family; the `Plane`/`CompositedScene` types; wiring
`parallax_layers`/`drift_parallax` to a real depth-sorted stack instead
of one linear chain.

**Phase 6 — Director UX (§12)** *(depends on Phases 1, 3, 4 having real
data to show)*
The actual product experience. Everything before this phase is
compiler work in service of this phase; nothing in this phase is
possible before Phases 1 and 3 exist.

**Phase 7 — motif panel + cross-scene visual identity (§6)**
*(independent, can run parallel to Phase 6)*

**Phase 8 — procedural environments (§10)** *(depends on Phase 1's
ENVIRONMENT category existing to hold it)*

**Phase 9 — lighting/shadow** *(independent; do after Phase 5, since
compositing planes are what make lighting matter — a lit foreground
entity over a flat background plane is not yet a lit scene)*

**Not phased — left exactly where the palette map and overhaul brief put
them**: image material (§9), archival/generated video (§15),
accessibility (§17) — deferred by standing decision, doors left open,
not designed further until a real need arrives twice, per this project's
own oldest rule.

---

## What "The Form Is the Claim" is, and isn't, evidence of

Restated once, plainly, because it's the frame this whole document sits
inside: that film is **proof that the substrate can produce something
coherent enough to feel intentional even while the parameters driving a
third of its operators were silently disconnected.** It is not the target
aesthetic. It is not the ceiling. Once §§2–8 above ship, a film compiled
from the same essay should be recognisably the same PROJECT — same
prose, same facts, same argument — and a different, wider, more
legible piece of cinema. If it isn't, this document's central claim was
wrong, and that is a testable, falsifiable outcome, the same way the
sentence tests were.
