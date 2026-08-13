# Canopticon Studio: total overhaul brief

> **Provenance.** This document was authored outside the repository and
> handed over in conversation. An attempt to commit it directly failed
> (invalid parent SHA), so it existed only as chat text until it was
> committed here verbatim. It is a **brief**, not authority: where it
> contradicts `CANOPTICON_CREATIVE_CONSTITUTION.md`, the Constitution
> wins. `CANOPTICON_STUDIO_MAP.md` is this brief classified against what
> the code actually does, which is what §48 asks for first.

## Purpose

This is the product and architecture handoff for the next major Studio pass.

This is intentionally broader than a feature list. The goal is to turn Studio
from a functioning production UI into a coherent director's control surface
for deterministic, code generated cinema.

This brief supersedes the mental model of a fixed palette of visual effects.
The system should synthesize visual programs from narrative meaning,
directorial intent, visual language, reusable entities, materials, behaviours,
and operators. Existing primitives remain implementation vocabulary, not the
user facing product model.

## 1. Product thesis

Canopticon Studio is not primarily a video editor, TTS wrapper, template
library, or AI video generator. It is a **cinematic compiler and director's
control surface for deterministic, code generated cinema.**

```text
SCRIPT
   ↓
NARRATION
   ↓
TIMING
   ↓
DIRECTOR MODEL
   ↓
VISUAL PROGRAMS + SOUND PROGRAMS
   ↓
DETERMINISTIC RENDER
   ↓
FILM
```

The operator describes what the film should communicate and how it should
feel. Studio determines how to construct a visual and sonic treatment,
presents alternatives, and lets the operator direct the result.

The first generation must prove what can be achieved through code generated
media before depending on real footage or generative video. External imagery
and generative media are future material sources, not prerequisites for the
core engine.

## 2. Non-negotiable design principles

### 2.1 No template palette as the primary abstraction

Do not expose the original 100ish visual palette as the main way users create
shots. Those items may remain as low level primitives, constructions, motifs,
or effects internally.

The system should answer: *What is the best visual program for this sentence
in the context of this film?* — not: *Which preset should I select?*

The current problem where the system repeatedly chooses from the original
collection of visual patterns must be considered a fundamental product
problem. The answer is not simply adding more patterns. The abstraction itself
needs to change.

## 3. Code is the visual medium

Treat procedural rendering as the central medium. The palette is effectively a
programming language for visual matter.

The system should eventually be capable of generating: recognizable objects,
people, crowds, animals, creatures, architecture, rooms, cities, documents,
maps, diagrams, graphs, timelines, interfaces, typography, symbols, particles,
fields, geometric structures, pixel art, game like worlds, 2.5D objects,
pseudo 3D objects, abstract transformations, emergent simulations, procedural
environments.

A sentence about a smoke detector should be capable of producing a
recognizable procedural smoke detector. A sentence about centipedes should be
capable of producing actual procedural centipedes with morphology and gait.
This is an important proof point.

The distinction is not *a centipede themed visual effect* but *an actual
procedural centipede generated from a body plan and animated through code.*
The same principle should apply to arbitrary semantic entities.

## 4. Primitives are implementation vocabulary

Low level primitives should be typed, composable, seeded, deterministic,
testable.

But users should normally encounter higher level concepts: entity, material,
behaviour, construction, operator, grammar, directorial intent.

The user should not need to understand the primitive graph to create a
sophisticated shot. Engineer mode can expose it. Director mode should not.

## 5. Visual variety must be intentional

A film should not repeatedly choose the same technically valid effect.
Candidate generation should consider:

```text
semantic fit
visual novelty
style coherence
narrative value
continuity
technical cost
```

If the film has already used particle decomposition six times, the system
should understand that. If typography has dominated the previous three scenes,
the system should be able to propose a different representation. Repetition
should be intentional rather than accidental.

## 6. Director first, engineer second

The default UI should feel like directing a film, not operating a rendering
pipeline. Technical inspection remains available through an Engineer view.

The user should be able to say: *Make this stranger. Hold this longer. Make
the transformation more gradual. Make it more literal. Bring the city back.
Use the visual language from scene 4. Make the typography more aggressive.
Make the scene feel increasingly claustrophobic.*

The system should translate those into directorial constraints rather than
forcing the user to manipulate low level animation parameters.

## 7. Director control surface

Replace a large collection of disconnected technical controls with a small
number of high level directorial dimensions:

```text
Representation   literal ↔ metaphorical
Fidelity         recognizable ↔ transformative
Novelty          familiar ↔ unexpected
Motion           still ↔ kinetic
Information      sparse ↔ dense
Attention        focused ↔ distributed
Rhythm           contemplative ↔ accelerated
Tension          stable ↔ unstable
Abstraction      concrete ↔ abstract
Continuity       shot based ↔ world based
Surprise         predictable ↔ unforeseen
```

These are constraints on synthesis, not direct effect selectors.

Provide sensible starting grammars — Documentary, Investigative, Essayistic,
Experimental, Archival, Scientific, Game Documentary, Analog Future, McLuhan
inspired — but these must define visual tendencies and grammar, not sequences
of templates.

## 8. Director intent

Each semantic beat or scene should support optional directorial intent:

```ts
DirectorIntent {
  understand?: string
  feel?: string
  notice?: string
  hide?: string
}
```

For example:

```text
UNDERSTAND  The crowd is becoming synchronized.
FEEL        Increasing unease.
NOTICE      The movement pattern.
HIDE        Why it is happening.
```

This should be editable in natural language. It is a major input to candidate
generation.

## 9. Visual grammar

Create a film level visual grammar that controls tendencies rather than
templates.

- **Materials** — ink, paper, pixels, geometry, light, particles, procedural
  objects, noise
- **Composition** — editorial, centered, asymmetric, diagrammatic, chaotic,
  cinematic
- **Motion** — mechanical, organic, abrupt, hypnotic, drifting, emergent
- **Transformation** — morph, fracture, dissolve, assemble, multiply,
  collapse, reveal
- **Typography** — caption, headline, embedded, environmental, kinetic,
  diagrammatic
- **Camera** — static, push, track, orbit, macro, impossible, top down
- **Texture** — clean, halftone, photocopy, CRT, paper, digital, game

The grammar should be a reusable named object. It should be possible to save,
duplicate, modify, apply to a scene, apply to an act, apply to the whole film.

## 10. Cinematic vocabulary

Establish a semantic vocabulary above raw primitives.

- **Entities** — objects, people, animals, places, documents, systems
- **Materials** — ink, paper, pixels, geometry, light, particles, noise,
  procedural surfaces
- **Behaviours** — walk, swarm, grow, fragment, assemble, orbit, collide,
  follow, hide, reveal, flock, synchronize
- **Relationships** — contains, connects, opposes, causes, precedes, follows,
  controls, contradicts
- **Cinematic operators** — reveal, zoom, track, transform, juxtapose,
  accumulate, isolate, repeat, frame, expose
- **Semantic operators** — literalize, metaphorize, contrast, foreshadow,
  contextualize, emphasize, abstract, ground

These should map to typed lower level programs.

## 11. World state and visual memory

Move beyond independent shot generation toward a persistent film world.

```text
WORLD STATE 01 → narration → WORLD STATE 02 → narration → WORLD STATE 03
```

A world can contain entities, attributes, positions, relationships,
populations, behaviours, visual identities, transformations.

`people.count = 12`. Then narration says *There were dozens.* The population
changes. Then narration says *They moved in synchronized waves.* The behaviour
changes. The renderer depicts the current state.

This enables continuity, foreshadowing, recurring motifs, meaningful
transformations, visual memory.

Do not build a full simulation engine immediately. Establish the data model
and a small set of persistent state transitions first.

## 12. Motifs

Recurring entities and ideas should be first class. A motif should have a
visual identity and an evolution history. Its representation can change:

```text
literal object → 2.5D object → pixel geometry → abstract swarm
```

The operator should be able to inspect every appearance and intentionally
preserve or alter continuity.

## 13. Candidate generation

For each semantic scene, generate multiple genuinely different visual
programs, scored on `semanticFit`, `visualNovelty`, `styleCoherence`,
`narrativeValue`, `continuity`, `technicalCost`.

The candidate list should not consist of ten minor variations of the same
preset. For *People walked around the city like insects:*

- **A** — literal procedural people gradually morph into procedural arthropods
- **B** — the city itself becomes an organism
- **C** — people become nodes in a biological network
- **D** — the scene becomes a pixel based game world
- **E** — the city map transforms into a swarm
- **F** — typography representing the people begins crawling across an
  architectural diagram

The operator is choosing among directorial interpretations, not effects.

## 14. Visual novelty / repetition inspector

At film level, expose repetition warnings — *particle decomposition appears 7
times; large centered typography appears 11 times; camera orbit appears 8
times; CRT treatment appears 6 times* — then offer to generate alternatives
for selected scenes.

Do not automatically eliminate repetition. Repetition can be a deliberate
motif. The system should identify it and let the director decide.

## 15. Timeline architecture

Narration/audio should be the temporal backbone of the film. Do not make
procedural visuals permanently dependent on hardcoded frame ranges.

```text
WORD → SENTENCE → PARAGRAPH → SEMANTIC BEAT → SCENE → ACT
```

Visuals should normally anchor to these semantic units and receive resolved
durations from the timing solver. Absolute timing is appropriate for external
media and genuinely fixed events. Derived timing is appropriate for procedural
visuals. A visual construction should be capable of stretching or recomposing
deterministically when its timing window changes.

## 16. Narration / TTS

Studio should treat narration as a first class production artifact and
temporal master.

**Provider** — keep Studio on native Workers AI. Do not add MiniMax or another
third party TTS dependency at this stage. Keep the provider abstraction so
another provider can be added later if the quality difference justifies it.

**Generation** — voice generation must be explicit operator action. Never
silently generate narration.

**Required capabilities** — voice selection, provider selection where
applicable, generate, preview, regenerate selection, stale detection,
script/spoken script separation, word timestamps, sentence timing, paragraph
timing, scene timing, explicit pauses, regeneration impact preview:

```text
3 sentences changed
1:17 audio affected
18 visual scenes will shift
37 visual programs remain valid
18 render chunks affected
```

The operator confirms the regeneration.

## 17. Voice audition

Before settling on the default native voice, provide a representative
audition. Do not evaluate voices on a single sentence. Test a long sentence, a
short sentence, a proper noun, a number, a dramatic pause, a philosophical
sentence, an investigative sentence. Then evaluate approximately five minutes
of continuous narration for intelligibility, prosody, pronunciation, pacing,
consistency, long form fatigue, sentence endings, dramatic suitability.

The decision should be made by ear.

## 18. Script vs spoken script

Maintain two layers. The **authored script** is the editorial source. The
**spoken script** is the exact text delivered to TTS, and may contain
deliberate pauses, pronunciation adjustments, segmentation and performance
direction without destroying the authored source.

## 19. Procedural sound engine

Do not make external AI music a requirement for the first build. Build a
deterministic native sound layer using code generated synthesis. Three layers:

- **Score** — ambient mood, drones, harmonic beds, pulses, evolving textures
- **Sound design** — procedural sounds representing objects, actions,
  transitions, events
- **Sonification** — information translated into sound

Start with a compact synthesis vocabulary: oscillators, noise, envelopes,
filters, LFOs, drones, pulses, harmonic beds, granular textures, delay, reverb,
simple spatialization. Higher level sound constructions should be synthesized
from these primitives.

The sound engine should be deterministic, timeline aware, cacheable, seedable.
Director dimensions can influence mood, tension, density, harmonic stability,
rhythmic complexity, sonic abstraction.

## 20. Information rhythm

Create a film/scene level concept of information rhythm. Sparse ↔ dense should
influence more than cut frequency: simultaneous visual information, visual
persistence, typography density, object count, camera movement, diagram
complexity, sound density, transition frequency.

Allow intentional arcs:

```text
calm → accumulation → acceleration → overload → silence → revelation
```

This is central to the desired immersive investigative/essayistic style.

## 21. Semantic typography

Typography is not merely a caption layer. Words can physically behave
according to meaning:

```text
collapse → letters collapse
fracture → letters fracture
spiral   → letters spiral
buried   → word becomes buried
expand   → type expands
connect  → letters connect
```

Typography should be generated through the same construction/operator system
as other entities.

## 22. Code generated visual media palette

The first build should deliberately explore the breadth of what code can
produce before relying on generated imagery or video. This is a capability
palette, not a preset palette.

- **Procedural objects** — recognizable objects built from geometry, curves,
  particles, layered primitives
- **Procedural creatures** — body plans, morphology, gait, flocking, swarming,
  emergent behaviour
- **Procedural environments** — cities, rooms, landscapes, grids, maps,
  abstract spaces
- **Diagrammatic media** — graphs, networks, timelines, flow diagrams, causal
  maps, maps
- **Data driven media** — bars, lines, fields, distributions, simulations,
  statistical representations
- **Typographic cinema** — kinetic typography, semantic typography, editorial
  layouts, type morphing
- **Pixel / game media** — pixel art, sprite systems, tile worlds, game HUDs,
  procedural game worlds
- **Particle / field media** — point clouds, fields, fluid like motion,
  flocking, attraction, repulsion, trails
- **Material transformations** — ink, paper, photocopy, halftone, CRT,
  scanline, noise, digital artifacting
- **Camera / composition** — macro, orbit, tracking, impossible camera,
  parallax, multi plane composition
- **Temporal structures** — accumulation, repetition, reveal, time
  compression, simultaneous timescales
- **Morphological transformations** — `object → diagram → text → particles →
  object`

The engine should be evaluated by what it can express, not how many primitives
it contains.

## 23. Future image material pipeline

Do not make generative imagery part of the first core dependency chain.
However, architect the material system so a future image can enter as a
material source:

```text
IMAGE → SEGMENTATION / POINTS / GEOMETRY / MATERIAL → PROCEDURAL TRANSFORMATION → ANIMATION
```

This allows a future image model to provide a recognizable object or scene
which Canopticon then breaks apart, reconstructs, pixelates, projects, maps,
morphs, animates, transforms. The procedural engine remains the animation and
compositing layer.

## 24. Future generative video

Keep generative video optional and late. It should be treated as a cached
material/source layer. It should never become the foundation of the product.
The core visual language must be capable of producing a compelling film
without generative video.

## 25. UX overhaul

The primary Studio experience should become a director workspace. Recommended
primary navigation:

```text
DIRECT   STORY   VISUALS   SOUND   TIMELINE   LIBRARY   ENGINEER
```

Keep this compact. Avoid dashboard sprawl.

## 26. DIRECT

The primary creative workspace. Prioritize: large picture, script, current
semantic scene, director intent, visual candidates, quick directorial
controls. The user should spend most of their time here.

## 27. STORY

Acts, scenes, semantic beats, script structure, motifs, world state. The
narrative layer.

## 28. VISUALS

Visual grammar, constructions, visual candidates, motif evolution, visual
library. The visual language layer.

## 29. SOUND

Voice, score, sound design, sonification, audio timeline.

## 30. TIMELINE

Integrated narration, words, sentences, scenes, visuals, world state, sound.
But the timeline should not become the dominant editing paradigm. It is an
inspection and timing surface, not the primary creative interface.

## 31. LIBRARY

Visual grammars, motifs, constructions, references, reusable worlds, sound
languages, saved directorial treatments.

## 32. ENGINEER

IR, primitive chains, types, cache, provenance, render graph, errors,
performance, dependency information. Technical concepts belong here. Do not
expose them by default in Director mode.

## 33. DIRECT workspace

```text
┌─────────────────────────────────────────────────────────────┐
│ CANOPTICON                         PROJECT       DIRECTOR   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                       LARGE PICTURE                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ CURRENT SCENE                                               │
│                                                             │
│ "They walked around the cities like insects."               │
│                                                             │
│ VISUAL IDEA                                                 │
│ People transform into procedural arthropods moving through  │
│ a procedural city.                                          │
│                                                             │
│ [KEEP] [TRY ANOTHER] [PUSH IT] [MAKE LITERAL] [MAKE STRANGE]│
├─────────────────────────────────────────────────────────────┤
│ STORY STRIP: scenes / thumbnails / motifs / states          │
└─────────────────────────────────────────────────────────────┘
```

This is conceptual, not a rigid pixel specification. The main hierarchy should
be `film → scene → idea → directorial decision`, not `settings → controls →
parameters → effect selection`.

## 34. Natural language directing

The operator should be able to direct a selected scene with short
instructions: *Make it stranger. Less literal. Hold longer. Faster cuts. Make
typography more dominant. Bring the city back. Use the same visual language as
scene 4. Reveal the object more slowly. Make this feel more archival. Increase
the tension gradually.*

The system converts these into changes to directorial constraints.

## 35. Visual candidates UX

When a scene is selected, show approximately three to five genuinely distinct
candidates. Each should have a preview, one sentence explaining the
interpretation, visual grammar, construction summary, and useful confidence/fit
information if appropriate. Actions: KEEP, TRY ANOTHER, PUSH IT, MAKE LITERAL,
MAKE STRANGER.

The explanation should describe the idea, not the implementation.

- Bad: `particle_flow + bloom + camera_zoom`
- Good: *The crowd becomes a living network, with each person represented as a
  node and synchronized movement revealing hidden connections.*

Technical implementation remains available in Engineer mode.

## 36. Reference shots

Allow any successful shot to become a visual reference — **USE AS REFERENCE**.
The system extracts a visual grammar summary from the shot, then allows: apply
to this scene, apply to this act, apply to whole film, create new visual
language. A reference should influence future synthesis without simply
becoming a template.

## 37. Motif panel

Show recurring visual entities and their evolution (*SMOKE DETECTOR · 4
appearances*). Selecting it should reveal every appearance. Allow the operator
to control continuity, transformation, visual identity, abstraction
progression.

## 38. Film level repetition / balance

Provide a film level visual balance view tracking construction family usage,
typography usage, camera movement, material usage, abstraction, information
density, visual novelty.

The goal is not eliminating repetition. The goal is making repetition
intentional.

## 39. Timeline UX

Organize the timeline around narration.

```text
VOICE      ████████████████████████████████████████
WORDS      ||||||||||||||||||||||||||||||||||||||||
SENTENCES  ██████████   ███████████   █████████
VISUAL     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
WORLD      ●────●──────●────────●─────●
SOUND      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

Voice is the master clock by default. Visual programs attach to semantic
timing anchors.

## 40. Regeneration impact UX

Whenever a source change causes invalidation, show it before applying:

```text
VOICE             3 segments regenerate
TIMING            18 scenes retimed
VISUAL PROGRAMS   37 remain valid
RENDER            18 chunks
```

The operator then confirms. This makes the deterministic/incremental
architecture visible and trustworthy.

## 41. Build flow

Make production state obvious.

```text
SCRIPT ✓   VOICE ✓   TIMING ✓   DIRECT ✓   VISUALS ✓   SOUND ✓   BUILD →   MASTER
```

The user should always know what is ready, what is stale, what requires
approval, what will regenerate. A single **BUILD FILM** action should compile
the current approved state. It should not silently invent major directorial
choices without exposing them to the operator.

## 42. Accessibility / output variants

Architect visual programs so alternative deterministic outputs can eventually
be produced from the same source: captions, high contrast, reduced motion,
static/motion minimized, audio description, audio only. The full UI can come
later. The schema should not make these impossible.

## 43. Provenance / engineer view

Preserve deterministic engineering strengths: input hashes, program hashes,
seeds, renderer version, dependency versions, cache state, compute/cost
information, generated artifacts, invalidation graph.

Engineer view should answer *Why does this frame look like this?* and *What
changed that caused this render?*

## 44. Performance / caching

Treat the system like a compiler. Cache at multiple levels:

```text
1. script parse
2. TTS segment
3. word timing
4. semantic scene
5. construction
6. generated material
7. audio program
8. rendered scene/chunk
9. final composite
```

Changing one layer should invalidate only descendants. **Do not invalidate
procedural assets merely because their timing window changed if the underlying
program is unchanged.**

## 45. What not to build yet

Do not let the overhaul become an uncontrolled rewrite. Do not prioritize:
generative video, complex branching interactive films, full collaborative Git
UX, huge primitive catalogs, marketplace/community features, elaborate
character animation systems, photorealistic rendering, giant settings panels.

The immediate goal is a coherent, beautiful, highly controllable code
generated documentary and visual essay pipeline.

## 46. Priority order

**P0 · Coherent Director UX** — direct workspace, picture first hierarchy,
visual candidates, director intent, high level directorial controls,
Director/Engineer separation, clean film/story navigation.

**P0 · Narration as temporal backbone** — explicit voice generation, preview,
stale detection, selection regeneration, script/spoken script, pauses, timing
impact preview, native Workers AI provider abstraction.

**P0 · Construction based visual synthesis** — entities, materials,
behaviours, relationships, constructions, operators, typed composition,
candidate generation, visual novelty.

**P1 · Persistent cinematic world** — world state, visual memory, motifs,
continuity, transformations.

**P1 · Procedural sound** — ambient score, sound design, sonification,
deterministic synthesis, sound grammar.

**P1 · Film grammar / style** — visual grammars, reusable languages, reference
shots, motif evolution, information rhythm.

**P2 · Advanced material pipeline** — image to points/material, generated
imagery as optional source, richer pseudo 3D, advanced procedural
environments.

**P3 · Generative video** — optional, cached, sparse, never foundational.

## 47. Definition of done

A new user should be able to:

1. Write or paste a documentary/essay script.
2. Explicitly generate narration.
3. Hear the narration before committing it.
4. See measured sentence and paragraph timing.
5. Inspect semantic scenes.
6. State what each scene should communicate and feel like.
7. Receive several genuinely different visual interpretations.
8. Select or direct one without touching low level primitives.
9. See recognizable procedural objects/entities when appropriate.
10. See recurring entities maintain visual continuity.
11. Adjust the film's visual language globally.
12. Generate a simple procedural ambient score.
13. See voice, visual, world and sound timing together.
14. Edit one sentence and understand exactly what will regenerate.
15. Build the film deterministically.
16. Inspect technical details only when desired.

The resulting product should feel less like editing a timeline and more like
**directing a strange new cinematic medium.**

## 48. Implementation strategy

Do not rewrite the repository blindly. First map the existing Studio
architecture against this brief. Preserve what already satisfies the brief.

In particular: do not rebuild the legacy `packages/video` or
`packages/shared` narration system simply because its architecture differs
from Studio.

For every proposed change, classify it:

```text
ALREADY EXISTS          Expose it better.
EXISTS BUT INCOMPLETE   Extend it.
MISSING                 Implement it.
FUTURE                  Do not touch it yet.
```

Prefer incremental migrations and adapters over destructive rewrites. For each
P0 feature, identify current implementation location, target data model, UI
change, API change if needed, cache/invalidation implications, tests,
migration/backward compatibility notes.

Build vertical slices rather than disconnected infrastructure.

## 49. First vertical slice

```text
SCRIPT → WORKERS AI NARRATION → MEASURED TIMING → SEMANTIC SCENE
→ DIRECTOR INTENT → SYNTHESIZED VISUAL CANDIDATE → OPERATOR APPROVAL
→ DETERMINISTIC RENDER
```

Then extend that working slice with persistent motifs, sound, novelty, global
visual grammar, world state. Do not build enormous infrastructure without
proving the complete loop.

## 50. Product north star

The user writes: *They walked around the cities like insects.*

Canopticon should not respond with *Choose a visual preset.* It should propose
*Procedural arthropods moving through a procedural city, gradually
synchronizing into a collective gait.*

The user says: *Make it less literal.* Canopticon proposes *The city becomes a
network of moving organisms. The people dissolve into repeating biological
structures.*

The user says: *Hold on the transformation longer and make it feel
increasingly inevitable.* The system changes directorial constraints, timing,
construction, motion, sound and information rhythm without requiring the
operator to manually edit keyframes.

**That interaction is the product.** The code, renderer, primitives, TTS,
sound engine, cache, entities, operators and timeline are the machinery
underneath it. Do not optimize the machinery at the expense of making this
interaction possible and beautiful.
