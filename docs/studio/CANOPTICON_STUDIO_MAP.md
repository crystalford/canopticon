# Studio, mapped against the overhaul brief

> The brief is `CANOPTICON_STUDIO_OVERHAUL.md`, next to this file. Its own
> first instruction: *"Do not rewrite the repository blindly. First map the
> existing Studio architecture against this brief. Preserve what already
> satisfies it."* This is that map. Section numbers below are the brief's.
>
> Every area is classified **EXISTS** · **PARTIAL** · **MISSING** ·
> **FUTURE**, with the file that implements it. Written by the person who
> built most of it, which makes it useful and also makes it the sort of
> document that should be checked rather than trusted — every claim below
> names a file you can open.

---

## The headline

**The brief describes an architecture Studio largely already has, and a
product experience it largely does not.**

The compiler side — construction over selection, anchor-based timing,
audio as master clock, determinism, incremental caching, typed
composition, candidate generation — is built and tested. The director side
— a workspace organised around directing rather than compiling — is three
panels and a contact sheet.

So the honest reading of the brief's priorities: **P0 "Construction based
visual synthesis" is done. P0 "Narration as temporal backbone" is done.
P0 "Coherent Director UX" is barely started.** That is where the work is.

---

## §3–5 · Code as the medium, primitives as vocabulary, intentional variety

| Claim | State | Where |
|---|---|---|
| Primitives are implementation vocabulary, not the product model | **EXISTS** | `compile/construct.ts` — constructions and operators sit above the palette; `GET /vocabulary` names 8 constructions, 12 operators, 6 verbs rather than 128 primitives |
| A smoke detector produces a procedural smoke detector | **EXISTS** | `construct.ts` `fixture` — reads the noun and sets `vents`/`dome`/`led`; a detector vents and blinks where a camera domes and does not |
| A centipede has morphology and gait | **EXISTS** | `creature_chain` parameterised from the prose: segments, legPairs, gait, count, wander. "Nine numbered rooms" is a nine-segment chain |
| Candidate generation, several genuinely different | **EXISTS** | `constructPrograms` returns a sorted set; the film plan carries the alternatives; the Preview lists them |
| Novelty scored against what the film already used | **MISSING** | Scoring has `fit`, style appetite and cost. It has **no memory of the film's own history**, so it cannot know typography has dominated three scenes |
| Repetition surfaced at film level | **PARTIAL** | `views-overview.js` flags runs of 3+ scenes built the same way. It does not track construction-family usage, camera, or material across the whole film |

**The gap is novelty-as-a-score.** Everything needed is present — the
constructor already receives `sceneIndex` and `composeAll` already threads
`recentChains` — but the score never consults them.

## §6–8 · Director first, control surface, director intent

| Claim | State | Where |
|---|---|---|
| Director/Engineer separation | **MISSING** | Six views, all engineer-facing. COMPILE and LAB are technical surfaces shown by default |
| Picture is the largest thing on screen | **PARTIAL** | The Preview stage is large but shares the screen with a 320px inspector |
| Directorial dimensions rather than technical controls | **PARTIAL** | Nine creative-state parameters exist and are real. They are *named* technically (`visualDensity`, `archivalWeight`) rather than directionally (`Tension`, `Surprise`, `Continuity`) |
| Director verbs | **EXISTS** | `compile/verbs.ts` — six verbs writing a `constrain` override; survives restyle and recompile |
| Natural-language directing | **MISSING** | No free-text instruction path. The verbs are the closest thing and they are buttons |
| `DirectorIntent { understand, feel, notice, hide }` | **MISSING** | Nothing in the IR carries authorial intent per scene. This is the single largest *missing input* to candidate generation |

**`DirectorIntent` is the highest-value missing P0 item.** The constructor
currently infers everything from the prose's surface. It has no channel for
"this scene should feel inevitable" — and that is exactly the input that
would make candidates differ meaningfully rather than stylistically.

## §9 · Visual grammar

| Claim | State | Where |
|---|---|---|
| Grammar as tendencies, not templates | **EXISTS** | `compile/grammar.ts` — per-operator appetites plus a representation rung; names no primitive |
| Captured from a film that already looks right | **EXISTS** | `POST /project/:id/grammar` compiles, reads what the film *did*, stores it named |
| Save / apply to scene, act, film | **PARTIAL** | Applies to the whole film. Not per-act or per-scene, and not stored outside the project that made it |
| Grammar dimensions (materials, composition, motion, camera, texture) | **PARTIAL** | Texture and transformation are real (the operator set). Composition and camera are not modelled at all |

## §11–12 · World state and motifs

| Claim | State | Where |
|---|---|---|
| Motifs as first-class, with development | **EXISTS** | `MotifSchema` with states and a development rule; `developMotif` escalates by abstraction or density |
| Persistent entity identity across a film | **PARTIAL** | `compose.ts` carries **one scene** of memory — a pronoun sentence inherits the last named subject. There is no entity registry and no visual identity that persists |
| World state as a thing narration mutates | **MISSING** | No `WorldState`. "There were dozens" escalates the *construction* within a scene; it does not update a population the next scene inherits |
| Motif panel showing every appearance | **MISSING** | — |

**This is the biggest architectural gap and the brief is right to rank it
P1.** The one-scene memory was built tonight and it is the seed of the
model, not the model.

## §15–18 · Timeline, narration, script vs spoken

| Claim | State | Where |
|---|---|---|
| No hardcoded frame ranges | **EXISTS** | Standing rule 2. Scenes anchor to `{sceneId}_start`/`_end` |
| Word → sentence → paragraph → scene → act | **PARTIAL** | Word, sentence (chunks), scene, act exist. **Paragraph and semantic beat do not** — a scene *is* the paragraph |
| Voice is the master clock | **EXISTS** | `sequenceAlignments` places scenes by measured duration; the cascade may not compress a narrated scene below its audio |
| Absolute vs derived timing | **EXISTS** | Made structural in `solver.ts` pass 3 |
| Explicit generation, never silent | **EXISTS** | `POST /narrate`, operator action only; `ttsCalls: 0` structurally |
| Preview, regenerate selection | **PARTIAL** | Preview yes. Regenerate-selection exists on the route (`sceneIds`, `force`) with **no UI** |
| Stale detection | **EXISTS** | `voiceStates()` — silent/ready/stale/orphaned, from the asset's own `sourceText` |
| Explicit pauses | **MISSING** | — |
| Script vs spoken script | **MISSING** | `narration.text` is the scene text. There is no separate spoken layer |
| Regeneration impact preview | **MISSING** | The cache diff computes exactly this after the fact. Nothing shows it *before* applying |

**Impact preview is cheap and high-value**: `diffAgainstSnapshot` already
produces the numbers. It needs a dry-run route and a confirmation panel.

## §19 · Procedural sound

| Claim | State | Where |
|---|---|---|
| Deterministic native synthesis, no music model | **EXISTS** | `lab/score.js` — seeded drone, filter, texture; verified through `OfflineAudioContext` |
| Score driven by director dimensions | **EXISTS** | density → filter, abstraction → harmonic stability, restraint → ceiling, act → centre |
| Ducks under narration | **EXISTS** | And drops further on a contested line |
| Sound design (objects, actions, transitions) | **MISSING** | — |
| Sonification | **MISSING** | `sonify` declares `DATA → AUDIO` and **draws a picture of sonification** |
| Cacheable, timeline-aware sound programs | **PARTIAL** | Deterministic and timeline-aware; not in the node cache |

## §20–21 · Information rhythm, semantic typography

| Claim | State | Where |
|---|---|---|
| Information rhythm as a film-level arc | **PARTIAL** | `visualDensity` is a real curve affecting chain length, ground, filter and score. It does not affect typography density, object count or transition frequency |
| Semantic typography — words behave according to meaning | **MISSING** | `text_displace` consumes `GEOMETRY + FIELD` and could do this. Nothing routes a verb like *collapse* or *swallow* to it |

**Semantic typography is the cheapest spectacular win available.** The
type primitives exist, the field compositors exist, `field_displace`
already moves pixels along a field. What is missing is a verb lexicon —
the same shape as `subject.ts`, matched on verbs instead of nouns.

## §25–41 · UX

Almost all **MISSING**. Present: OVERVIEW (contact sheet + repetition
runs), the VISUAL IDEA card with alternatives, director verbs, voice
audition, PROBE THE BINDING. Absent: DIRECT/STORY/VISUALS/SOUND/LIBRARY/
ENGINEER navigation, the picture-dominant workspace, the narration-first
timeline, the motif panel, the build-state flow, reference shots.

## §42–44 · Accessibility, provenance, caching

| Claim | State | Where |
|---|---|---|
| Provenance: hashes, seeds, renderer version, cache state | **EXISTS** | `hash.ts` (`RENDERER_VERSION` in every payload), `cache.ts` with a stated reason per recomputation |
| Multi-level cache | **PARTIAL** | Per-primitive node hashing and per-scene snapshots exist. TTS segments, word timings and rendered chunks are **not** cache layers |
| Timing-only change must not invalidate a program | **BROKEN** | The node hash includes the scene window, so **retiming invalidates every node in the scene** even when the program is identical. The brief names this exactly and it is currently wrong |
| Accessibility variants | **FUTURE** | Nothing forecloses it |

---

## The render is slow, and here is why

Reported: *"render is SUPER slow."* Three causes, separable:

**1. It is paced to the wall clock, by design and by necessity.**
`MediaRecorder` timestamps frames as they arrive, so frames must be handed
over in real time or the film plays fast. A six-minute film costs six
minutes minimum. `render.js` says so, and the panel says so.

**2. Frames now cost more than they did.** Every raster operator calls
`getImageData` at full resolution every frame, and a ground is a second
complete chain rendered per frame. `layer_mask` already builds its mask at
quarter resolution for exactly this reason; nothing else does.

**3. The pacing loop cannot recover.** If a frame takes longer than
`1000/fps`, the loop is already late and never catches up, so a rich film
renders *slower than real time* with no report of by how much.

**The real fix is WebCodecs `VideoEncoder`**, which encodes on frame
submission rather than on a clock and would make render time proportional
to compute rather than to duration. It was rejected once for a good
reason: hand-writing a WebM container produced a file that did not decode.
That reason argues for a muxer, not against the encoder — and this repo has
no build step, so it would need a vendored single-file muxer or an
`ArrayBuffer`-safe MP4 path.

**Cheap wins available first:** operators read pixels at half resolution
(they are quantising and dithering — the detail is being thrown away
anyway); cache a ground's frame when its chain has no motion; and report
the drift so "slow" is a number rather than a feeling.

---

## What I would build next, in order

1. **`DirectorIntent` on the scene** — the missing P0 input. Four optional
   strings, ratified like a reading, fed to candidate scoring.
2. **Novelty in the score** — the constructor already knows the scene
   index; give it the film's history so repetition becomes a cost.
3. **Regeneration impact preview** — the numbers already exist; expose
   them before applying rather than after.
4. **Fix the retiming invalidation** — split the node hash so a window
   change re-times without recomputing an unchanged program.
5. **Semantic typography** — a verb lexicon into the existing type and
   field primitives.
6. **World state** — the entity registry the one-scene memory is a
   stand-in for.
7. **Render speed** — half-res operators and drift reporting now;
   `VideoEncoder` when there is a muxer that can be trusted.

Director/Engineer navigation sits across all of it and should be done as
the workspace those pieces land in, not as a separate cosmetic pass.
