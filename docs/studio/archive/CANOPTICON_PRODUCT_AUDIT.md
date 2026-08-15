# Studio — end-to-end product audit

> The question is no longer "is the compiler good". It is: **can a person
> use Studio to make a film?** This audit answers that by making one, from
> a blank database, and reporting what happened.
>
> Nothing was fixed while auditing. Findings are prioritised at the end.

---

## How this was run, and what it could not test

The deployed Worker is unreachable from this sandbox, so the audit ran
against a **real Studio**: `wrangler dev --local` serving `src/index.ts`
with a freshly migrated, **empty** D1. That is the genuine first-time-user
condition — no stored films, no fixtures, no demo assumptions — and every
finding below comes from driving the actual UI in a real browser, not from
reading source.

**Two steps could not be exercised**, and both fail honestly:

| Step | Result |
|---|---|
| `POST /project/:id/read` (interpretation) | `declined: 2, why: {call-failed: 2}`, reason carried through verbatim: *"Binding AI needs to be run remotely"* |
| `POST /tts/probe` (narration) | both candidates `threw: Binding AI needs to be run remotely` |

Workers AI has no local binding. Neither failure crashed anything, both
named the cause, and the film still compiled and played without them —
which is the *degrade, flag, continue* rule working. **Interpretation and
narration are therefore UNVERIFIED in this pass, not failed.** They need a
deployed re-run.

Everything else below was measured.

---

## The acceptance test, step by step

The essay was ~600 words of real prose with four headings ("The Medium
Absorbs the Message"), chosen to produce multiple acts and to contain
printed figures (3.5 billion, 96 times a day).

| # | Step | Result |
|---|---|---|
| 1 | Open Studio | ✅ Lands on FILM. **But it opens on the built-in example**, not on an empty state — a first-time user sees someone else's film. |
| 2 | Create a new film | ✅ LIBRARY is one click; the primary action is `MAKE A FILM`. |
| 3 | Enter 600 words | ✅ |
| 4 | Generate | ✅ 6.0s → 39 scenes, 4 acts, 3:18, opened automatically on the film. |
| 5 | Understand the interpretation | ⚠️ Partly. FILM states a VISUAL IDEA per scene and *why*. **STORY, the surface whose job this is, has zero controls** and cannot be disagreed with. |
| 6 | Change visual approach | ✅ **Verified real** — see below. |
| 7 | Direct one scene | ✅ **Verified real** — verbs and prose direction both change the target scene and leave a control scene byte-identical. |
| 8 | Change narration mode | ⚠️ Reachable, unverifiable here (no AI binding). |
| 9 | Modify one scene | ✅ Pinning an alternative works and **survives a whole-film restyle**. |
| 10 | Watch the complete film | ❌ **The browser tab crashes at scene 21 of 39.** |
| 11 | Export | ⚠️ Produces a real, decodable VP9 file — **at 8.8× the correct duration**. |
| 12 | Reopen | ✅ Full reload restores the same film, same IR version, same language. |
| 13 | Continue editing | ✅ Edits continue and version correctly. **No undo anywhere.** |

---

## The finding that matters most: the control is real, the picture is not

Five visual languages, driven through the actual UI, canvas read back and
hashed at three fixed scenes:

```
surreal       149/288 primitives recomputed · 0 TTS · v2
documentary   149/288 · 0 TTS · v3
technical     149/288 · 0 TTS · v4
pixel         134/288 · 0 TTS · v5
kinetic       142/288 · 0 TTS · v6

s001 → 5 distinct frames across 5 languages
s009 → 5 distinct frames
s021 → 5 distinct frames
```

**The visual-language control is genuinely real.** It is not a style
preset, it reaches pixels, and it costs zero narration. That question is
settled.

The problem is what it reaches. Of the fifteen sampled frames:

- **two are effectively blank** (PIXEL and SURREAL at s021 — a black screen)
- the rest are **texture fields**: scanlines, dither grids, dot lattices
- **nothing in any of them depicts anything the sentence is about**

The essay's first line is *"Every new medium arrives claiming to be a
window."* The frame is horizontal grey scanlines. The engine's own stated
visual idea for it is *"A fixture, built from the noun itself — then
graded, then scanned."*

One frame in the whole export is genuinely good: **"36 people" in huge
type over a warm ground**, counting up to the verbatim figure 41. (That is
`counter` behaving exactly as designed — it eases to the exact substring
and holds. Not a bug.) That frame proves the system *can* make a striking
image. It is the exception.

> **The languages differ from each other as textures, not as visual
> arguments.** That is the creative P0, and it is not a UI problem.

---

## Ten questions, answered

**1. Can I make a film?** Yes. Blank DB → 39-scene film in 6 seconds, no
knowledge required. This works.

**2. Can I understand what the system decided?** Partly. Per scene, FILM
gives a plain-English visual idea, the engine's reasons, the figures it
lifted verbatim, and three alternatives. What is missing is the ability to
*disagree with the reading itself* — and STORY, where that belongs, is
read-only.

**3. Can I actually direct it?** Yes, more than expected. Six verbs
(STRANGER / GROUND IT / QUIETER / LOUDER / COLDER / WARMER) and four prose
fields (FEEL / UNDERSTAND / NOTICE / HIDE). Both **measurably changed the
target scene and left another scene byte-identical**. What is missing:
there is no *what I heard / what will change* step — it commits instantly,
and the readback is generic boilerplate ("Directed. The constructor reads
this to decide what to BUILD"), not a statement of what it actually heard.

**4. Can I control the visual language?** Yes — five, real, verified. The
eight compositional strategies are **not** in the pipeline (nothing in
`src/compile/` imports `experiments/strategy.ts`) and are correctly not
offered.

**5. Can I control cinematography?** **No. Nothing.** No camera, no light,
no colour. 98 hardcoded `bg()` calls to `#0d0f11`; 1 of 129 primitives
exposes any colour parameter. This is the largest single gap.

**6. Can I control audio?** Three modes are offered and honest. TTS is
wired; "record it yourself" is correctly absent and named as missing.
Unverifiable locally.

**7. Can I work scene by scene?** Yes on FILM — heard / built / why /
alternatives / direct, all per scene. There is no scene *list* to work
down, and STORY (which has the list) cannot direct.

**8. Can I see the whole film?** **No.** ENGINE→SHOTS is read-only with
zero controls. There is no timeline, no act structure view, no visual
trajectory, and — because of the crash — no way to watch it through.

**9. Can I revise without destroying what I like?** Half. A **pin survives
a whole-film restyle** — verified. But there is no lock at act or scene
level, and **no undo, history or revert anywhere in the product**, despite
`POST /project/:id/revert` and `GET /project/:id/versions` both existing
and working.

**10. Can I export something real?** A real file, wrong length. Verified
below.

---

## Capability ↔ reachability

**Backend capabilities with no UI path** — built, working, unreachable:

| Route | What it is | Why it matters |
|---|---|---|
| `POST /project/:id/revert` | roll back to any IR version | this IS undo, and question 9 depends on it |
| `GET /project/:id/versions` | the version list | you cannot revert to what you cannot see |
| `GET /project/:id/compile-runs` | compile history | ENGINE→COMPILE shows only the last run |
| `POST /voice/fidelity` | voice comparison | |
| `PUT /project/:id/ir` | replace the IR wholesale | dangerous; arguably should stay unreachable |
| `GET /primitives`, `GET /vocabulary` | the palette, from the server | the Lab uses its own copy |

**Creative dimensions the compiler reads that the UI cannot set:**

```
compiler reads:  abstraction  archivalWeight  attention  dataWeight
                 experimentalism  humanPresence  motionEnergy  restraint
                 typographicWeight  visualDensity  worldPopulation

UI offers:       abstraction  archivalWeight  dataWeight  visualDensity
                 humanPresence  motionEnergy  typographicWeight
                 experimentalism  restraint
```

**`worldPopulation` and `attention` are missing.** Both are real —
`compose.ts:405-406` reads them, `scene-plan.ts` translates them into
plane weight and count — and both are pinned at their 0.5 default forever
because nothing can write them. Two whole sessions of work on world
population landed in a dimension no one can move.

**Decorative control:** `SAVE CURRENT AS RECIPE` (ENGINE→PALETTE) has no
handler and the "Saved recipes" list beside it is four hardcoded strings.
It is the only handler-less button left in the product.

---

## Visual + directorial control inventory

| Control | Classification | Note |
|---|---|---|
| Visual language | **REAL + REACHABLE** | 5 values, verified to pixels |
| Abstraction | **REAL + REACHABLE** | curve, ENGINE→CREATIVE STATE |
| Density, motion energy, human presence, archival, data, typography, experimentalism, restraint | **REAL + REACHABLE** | curves, same place |
| Scene direction (6 verbs) | **REAL + REACHABLE** | verified per-scene, no leak |
| Scene direction (prose intent) | **REAL + REACHABLE** | verified; no preview before commit |
| Pin an alternative | **REAL + REACHABLE** | survives restyle |
| **World population** | **REAL + UNREACHABLE** | compiler reads it; no control exists |
| **Attention** | **REAL + UNREACHABLE** | same |
| Captured "look" (grammar) | **REAL + REACHABLE** | LIBRARY → SAVE THIS LOOK |
| Typography | **PARTIAL** | `typographicWeight` is a curve; word *choice* is automatic and undirectable |
| Geometry | **PARTIAL** | B·VECTOR primitives exist; reachable only if the constructor picks them |
| Illustrative construction | **PARTIAL** | constructions exist; no director-facing control |
| Transformation | **PARTIAL** | operators are chosen by appetite, never named by a director |
| Atmosphere | **PARTIAL** | an ATMOSPHERE plane exists in the graph; nothing sets it |
| Pacing | **PARTIAL** | the solver cuts; shot rate is not directable |
| Compositional strategy | **PLANNED** | authored, outside the pipeline, deliberately not offered |
| **Colour** | **MISSING** | 98 hardcoded `bg()` calls; 1/129 primitives takes a colour |
| **Camera** | **MISSING** | no concept anywhere |
| **Lighting** | **MISSING** | no concept anywhere |

**Semantic vs execution.** Everything reachable today is an *execution*
control — it changes how a sentence is drawn. The only *semantic* control
is the ratify/reject rail on a proposed reading, which needs a model call
and was unverifiable here. There is no way to tell Studio *"this sentence
is about the city, not the insects"* and have it re-read the sentence.
That is the gap behind question 2.

---

## Surface by surface

**FILM** — 14 controls, 284 words. The strongest surface. Shows what the
shot is, why, its figures, three alternatives, six verbs, four prose
fields. **Crashes at scene 21.** Still carries two pieces of stale copy
("reopen from FILMS" — there is no FILMS view) and its prose-direction
placeholders are from a different film entirely ("the crowd is becoming
synchronized" on an essay about media theory).

**STORY** — **0 controls, 115 words.** Shows the prose with scenes bound
to it, and does nothing else. Cannot merge or split a scene, rename an
act, change a reading, or re-segment. This is the emptiest surface in the
product and it is the one that should answer question 2.

**VISUAL** — 10 controls. Real language picker, real audio choice, real
voice tools. This surface is working.

**LIBRARY** — 18 controls. Create, open, delete, interpret, narrate, save
a look. **No duplicate, no rename.**

**ENGINE** — a clean index of four backstage surfaces. Correct.
→ **CREATIVE STATE**: 4 sliders + RECOMPILE. Real, and missing two
dimensions the compiler reads.
→ **SHOTS**: 0 controls. Should be the timeline; is a read-out.
→ **COMPILE**: 0 controls. Correct as an audit view.
→ **PALETTE**: 129 primitives, one decorative button.

**DIRECT** — does not exist as a surface. Direction lives inside FILM's
right column, which is the right place for scene-level work and no place
at all for film-level direction ("make the middle more surreal").

---

## Prioritised map

### P0 — prevents making a film

**P0-1. The FILM view crashes the tab at scene 21 of 39.**
Reproducible. `buildChain` allocates one full-size canvas per primitive
(`chain.js:151`), a ground chain allocates its own, and the `built` Map in
`views-b.js:62` is keyed by scene and **never evicted**. At 1076×760 that
is ~31MB per scene; 21 scenes ≈ 655MB of canvas backing store. The JS heap
reads a healthy 64MB right up to the crash, because canvas memory is not
in the JS heap — which is why this was never noticed. A 600-word essay is
enough to trigger it.

**P0-2. The export is 8.8× too long.**
An 8.36s film exports as a 73s VP9 file (measured twice: 73.2s and 82.3s).
The frames are correct and in order; the *timestamps* are wrong.
`encodeExact` paces `requestFrame()` to the wall clock, but the chains
cannot render 30fps, so MediaRecorder stamps each frame at its real
arrival time and the film plays back at about 1/9 speed. **The primary
artifact of the entire product is wrong.**

**P0-3. The film does not look like anything.**
Measured, not asserted: the five languages produce five genuinely
different frames, and every one of them is a texture field rather than a
depiction. Two of fifteen sampled frames are blank. This is the same
finding as "a murky abstract glitchathon", now with numbers, and it is an
engine problem rather than a product one.

### P1 — prevents directing a film

**P1-1. No undo, history or revert.** The backend has both routes. The UI
has no word for it anywhere on screen.

**P1-2. `worldPopulation` and `attention` are unreachable.** Real
compiler dimensions, permanently 0.5.

**P1-3. STORY cannot change the interpretation.** No merge, split, rename,
re-read or re-segment. Question 2's "I should be able to disagree" has no
surface.

**P1-4. Direction commits with no preview and no readback.** No "what I
heard / what will change" step; the confirmation is boilerplate.

**P1-5. No lock.** A pin protects one scene's chain. There is no act-level
or scene-level lock, so "make the middle more surreal" cannot be
expressed without risking Act I.

**P1-6. No film-level direction surface.** Everything directorial is
per-scene.

**P1-7. No timeline.** ENGINE→SHOTS is read-only; there is no view of the
film's structure, act boundaries or visual trajectory.

### P2 — confusing or inefficient

- **P2-1.** Studio opens on the built-in example, so a first-time user's
  first film is someone else's.
- **P2-2.** Stale copy: "reopen from FILMS" in two places; there is no
  FILMS view.
- **P2-3.** Prose-direction placeholders are from an unrelated film.
- **P2-4.** Alternatives are labelled with raw primitive chains
  (`type · grade + scanline · glyph_geometry → glyph_to_points → …`).
- **P2-5.** `SAVE CURRENT AS RECIPE` is decorative; the recipe list is
  hardcoded.
- **P2-6.** The render panel claims it "takes about as long as the film
  runs". It took 9×.
- **P2-7.** No duplicate or rename in LIBRARY.
- **P2-8.** `compile-runs` and `versions` exist and are unreachable, so
  ENGINE→COMPILE shows only the most recent run.

### P3 — missing advanced capability

- **P3-1. Cinematography has no home** — camera, light, colour. The
  largest conceptual gap; not a UI omission but an absent layer.
- **P3-2.** Compositional strategies are not in the pipeline.
- **P3-3.** Typography is a weight curve, not a directable medium.
- **P3-4.** Narration has no pacing, tone or per-paragraph regeneration.
- **P3-5.** No fork/compare between two versions of a film.

---

## What the audit says about the shape of the product

Three things came out of this that were not obvious before running it.

**The directing rail is more real than it looked.** Verbs, prose intent
and pinning all change the film, all stay local to their scene, and a pin
survives a restyle. That is the hard part of a creative tool and it works.
What is missing around it is *legibility* — a preview, a readback, an
undo — not mechanism.

**The gap is not between the compiler and the UI. It is between the
compiler and the screen.** Every product control tested reached pixels.
The pixels are the problem. No amount of product work fixes P0-3.

**Two capabilities were built into a dimension nobody can move.** World
population and attention are the clearest instance of the pattern this
project keeps hitting: a capability reaching PLANNED and stopping. The
cheapest guard is the one this audit used — for every dimension the
compiler reads, check that something can write it.
