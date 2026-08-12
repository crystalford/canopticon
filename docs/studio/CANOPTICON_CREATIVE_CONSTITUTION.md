# CANOPTICON — Creative Architecture & Director Experience
## The Creative Constitution

**Status:** Sits *above* `CANOPTICON_PHASE0_MASTER_SPEC.md`. Where the two conflict, this document defines intent and the technical spec defines implementation. Read this first.

---

# THE NORTH STAR

> **Canopticon does not decide what the film should look like. The director defines the film's creative constraints, and Canopticon composes within them.**

That single sentence separates a *director's instrument* from an *AI director*. Every design decision below descends from it.

Corollary, which prevents the architecture drifting back toward an automated slideshow:

> **The system composes audiovisual passages from a visual grammar. Blocks are implementation primitives, not the director's vocabulary.**

The director should be able to direct an entire film without ever knowing that one renderer is Remotion and another is Manim.

---

# PART 1 — THE CREATIVE ONTOLOGY

The technical spec's primitives are `scene`, `block`, `props`, `seed`. Those are correct — for the compiler. They are the wrong vocabulary for the director.

The director's primitives are:

| Concept | What it means |
|---|---|
| **Intention** | What this passage is *for* — to ground, to unsettle, to prove, to release |
| **Tone** | Observational, analytical, elegiac, forensic, subjective |
| **Abstraction** | How far the image sits from literal depiction |
| **Density** | How much the audience is being asked to process |
| **Rhythm** | Rate of change — cuts, reveals, motion |
| **Motif** | A visual idea that recurs and develops |
| **Contrast** | Deliberate difference against what just preceded |
| **Tension / Release** | The pressure curve of the passage |
| **Evidence** | The weight of documentary proof being presented |
| **Human presence** | How much a person is in the frame, literally or by trace |
| **Temporal perspective** | Now, then, remembered, imagined, projected |

A filmmaker never thinks *"at 01:47 I want a force-directed graph."* They think *"this section should feel increasingly claustrophobic"* or *"we've given them too much information — pull back."*

Canopticon's job is to translate downward:

```
DIRECTORIAL INTENT
      ↓
CREATIVE POLICY        (constraints, curves, rules)
      ↓
EDITORIAL COMPOSITION  (what happens in this passage)
      ↓
VISUAL / SONIC LANGUAGE
      ↓
INDIVIDUAL SHOTS
      ↓
RENDERERS
      ↓
PIXELS + AUDIO
```

The technical spec starts at layer 4. This document starts at layer 1.

---

# PART 2 — CREATIVE STATE

## 2.1 The central idea

Every moment of the film has a **creative state** — a vector of continuous parameters describing what the film currently *is*.

Not:
```
frame = 18420
```

But:
```
time = 07:42

abstraction        0.48
visualDensity      0.71
motionEnergy       0.68
archivalWeight     0.22
typographicWeight  0.63
dataWeight         0.56
humanPresence      0.34
sonicDensity       0.61
experimentalism    0.31
restraint          0.42
evidenceWeight     0.55
```

These are **not settings for a block**. They are the state of the film. Individual shots are generated *from* the field, not assembled *into* it.

This is closer to music production than video editing. A composer doesn't place every oscillator by hand; they define tempo, key, dynamics, instrumentation, structure, tension. The notes emerge from the constraints.

## 2.2 Why this replaces flat per-act weights

The technical spec currently says:

```json
"acts": [
  { "actId": "act_2", "vocabularyMix": { "simpleChart": 0.40 } }
]
```

That is implementation-oriented. It says *which renderer* is favoured. It doesn't say *what the film is doing*.

Creative State says: in Act II, abstraction rises from 0.15 to 0.45, archival weight falls from 0.70 to 0.25, density climbs to 0.75, and human presence must never drop below 0.30. The vocabulary mix is then *derived* from that — not authored directly.

Vocabulary weights become an **output** of creative state, not an input. The director can still override them directly, but that's the exception, not the primary control.

## 2.3 Creative state is continuous, not per-act

State is defined at **control points** and interpolated between them:

```json
{
  "creativeState": {
    "controlPoints": [
      { "at": { "actId": "act_1", "position": "start" },
        "values": { "abstraction": 0.15, "archivalWeight": 0.70, "visualDensity": 0.35, "humanPresence": 0.80 } },
      { "at": { "actId": "act_2", "position": "start" },
        "values": { "abstraction": 0.25, "archivalWeight": 0.45, "dataWeight": 0.55, "visualDensity": 0.60 } },
      { "at": { "sceneId": "scene_014" },
        "values": { "visualDensity": 0.85, "motionEnergy": 0.80 } },
      { "at": { "actId": "act_3", "position": "end" },
        "values": { "abstraction": 0.85, "archivalWeight": 0.10, "visualDensity": 0.30, "humanPresence": 0.70 } }
    ],
    "interpolation": "smooth",
    "invariants": [
      { "param": "humanPresence", "min": 0.30 },
      { "param": "corporateInfographicFeel", "max": 0.25 }
    ]
  }
}
```

Note the **invariants**: floors and ceilings that hold across the whole film regardless of what the curves do. "Never let this feel like a corporate explainer" is expressible.

---

# PART 3 — THE FILM ARC

The trajectory is the thing a good film has that a competent one doesn't. The director isn't saying "use more abstraction" — they're saying *"start grounded, gradually destabilize the visual language, become increasingly abstract as the argument reaches its conclusion."*

The Film Arc is the creative state rendered as an editable curve set:

```
                   ACT I         ACT II          ACT III

Archival           ████████      █████           ██
Data               ██            █████████       ██████
Abstraction        ██            ███             █████████
Visual density     ███           ██████          █████████
Human presence     ████████      ███████         ████████
Motion energy      ██            ██████          █████████
```

The director drags these curves. That is the primary act of direction in Canopticon.

**Reading the example above:** grounded and human at the start, analytical through the middle, abstract and dense at the climax — but human presence returns at the end. That's a complete directorial statement, made without naming a single renderer.

---

# PART 4 — THE DIRECTOR'S CONTROL SURFACE

The primary interface should not look like Premiere or Resolve. It should look like a **mixing console for narrative intent**.

```
CANOPTICON — THE FILM
───────────────────────────────────────────

VISUAL IDENTITY

  Literal      ──────────●──────────  Abstract
  Documentary  ────────────●────────  Designed
  Restrained   ──────●──────────────  Experimental
  Human        ────────────●────────  Systemic

FILM RHYTHM

  Calm         ──────────●──────────  Frenetic
  Sparse       ────────────●────────  Dense
  Slow         ───────●─────────────  Rapid

FILM ARC                    I      II     III
  Archival                  ███    ██     ▪
  Data                      ▪      ███    ██
  Abstraction               ▪      ▪      ███
  Density                   ██     ███    ███

MOTIFS
  TIME          → horizontal line + type      (used 4×, last: fragmented)
  INSTITUTION   → document surface            (used 2×, last: aged)
  UNCERTAINTY   → fragmented typography       (unused)

RULES  (3 active)
  · No abstract visuals before Act II
  · Return to TIME motif on every backward jump
  · Min 2s breathing room after any high-density passage
```

Four modes of control, in order of how often they're used:

1. **Identity sliders** — what kind of film this is
2. **Film Arc curves** — how it evolves
3. **Motifs** — the recurring visual vocabulary
4. **Rules** — hard creative constraints

Vocabulary mix sliders (kinetic type %, chart %, etc.) still exist, but demoted to an "Advanced / Vocabulary" panel. They're the derived layer.

---

# PART 5 — COMPOSITION INTELLIGENCE

## 5.1 The full input set

Block selection for a passage is a function of:

```
resolved creative state at this moment
+ narrative function of the passage      (hook / evidence / turn / resolve)
+ semantic content of the narration      (dates, numbers, quotes, entities)
+ motif history                          (what has been established)
+ recent visual history                  (anti-repetition)
+ visual rhythm history                  (density / breathing curve)
+ dramatic arc position                  (where in the trajectory)
+ active directorial rules
+ available assets
      ↓
audiovisual passage
      ↓
block stack (implementation)
```

The technical spec has the middle five. This document adds **creative state**, **motif history**, **rhythm history**, and **rules** — which is what enables long-range aesthetic decisions rather than locally-plausible ones.

## 5.2 Precedence when inputs conflict

Conflicts are guaranteed. Resolution order, highest wins:

1. **Explicit human override** — always wins, never silently discarded
2. **Directorial rules** — hard constraints the director set
3. **Creative state invariants** — floors and ceilings
4. **Narrative appropriateness** — never abstract an emotional interview because a slider said so
5. **Motif continuity** — develop the established treatment rather than invent a new one
6. **Rhythm / anti-repetition** — vary the surface
7. **Creative state preferences** — the curves
8. **Vocabulary mix** — the derived weights

**Motif continuity outranks anti-repetition.** Motifs *want* repetition; that's what makes them motifs. This resolves the conflict flagged as unknown #2 in the technical spec.

---

# PART 6 — VISUAL MEMORY

AI video systems optimize individual generations. Canopticon must optimize **memory across the whole work**. This is what makes a film feel authored rather than procedurally assembled.

The system maintains, per motif:

```json
{
  "motifId": "motif_time",
  "concept": "time",
  "establishedAt": "scene_002",
  "visualLanguage": { "primitive": "horizontal_line", "companion": "kinetic_type", "styleId": "motif_time_base" },
  "occurrences": [
    { "sceneId": "scene_002", "variant": "simple",     "state": "flat, documentary" },
    { "sceneId": "scene_009", "variant": "extended",   "state": "layered, annotated" },
    { "sceneId": "scene_021", "variant": "fragmented", "state": "broken, unstable" }
  ],
  "currentState": "fragmented",
  "developmentRule": "escalate_with_abstraction"
}
```

The same metaphor, evolving emotional state. The first timeline is flat and documentary; the final one is fragmented and unstable. The audience reads that as authorship.

Visual memory applies to any recurring element: a person, an institution, a place, a phrase, an idea, a piece of evidence, a sound, a colour, a specific animation behaviour. It binds directly to the `entities` already in the technical spec — entities carry state, motifs carry *treatment* of that state.

**When the composition engine encounters a concept with an established motif, developing it is the default. Inventing a new treatment requires a reason** (a rule, an override, or a deliberate `break_grammar` instruction).

---

# PART 7 — DIRECTORIAL RULES

These sit above renderer-level rules like `maxConsecutiveSameType`. They are creative constraints in the director's own language.

Examples the system must eventually express:

- Never use data visualization while a person is speaking emotionally
- Return to the TIME motif whenever the film jumps backward
- Do not use abstract visuals until Act II
- After every high-density passage, give at least 2 seconds of breathing room
- The final scene must contain a motif from the opening
- Never use the same transition twice consecutively
- Let archival photographs hold for at least 3 seconds
- Never use kinetic typography during interviews

Structure:

```json
{
  "ruleId": "rule_003",
  "statement": "Do not use abstract visuals until Act II",
  "trigger":   { "scope": "act", "match": "act_1" },
  "constraint":{ "type": "forbid_vocabulary", "target": "abstract" },
  "severity":  "hard"
}
```

`severity: "hard"` = the composition engine cannot violate it. `"soft"` = a strong preference, violation is reported in the Compile View with a reason.

**Phase 0 scope:** ship the rule *structure* and 3–4 built-in rule types (forbid vocabulary in scope, require motif on trigger, minimum hold duration, breathing room after density). Natural-language rule authoring is Phase 2.

---

# PART 8 — THE OVERRIDE MODEL

The director must be able to say *"no — do this specific thing here"* without fighting the system or corrupting the architecture.

## 8.1 Override levels

| Level | Scope | Example |
|---|---|---|
| **Pin** | One block | "This exact treatment, here, don't touch it" |
| **Constrain** | One passage | "This passage must be archival-dominant" |
| **Exempt** | One passage | "Ignore the density rule here" |
| **Break** | One passage | "Deliberately violate the established grammar here" |

## 8.2 Rules that make overrides safe

1. **Overrides are never silently discarded.** If a recompile would contradict a pin, the system honours the pin and reports the tension in the Compile View — it does not resolve it unilaterally.
2. **Overrides are visible.** Any pinned or constrained passage is marked in the Editorial View, so the director always knows where they've taken manual control.
3. **Overrides survive restyling.** Moving a global slider does not wipe pins. This is the whole point: the director can restyle the film wholesale while their deliberate decisions hold.
4. **Overrides are revocable in one click.** "Release this pin" returns the passage to system composition.
5. **`break_grammar` is a first-class intent, not a hack.** "By Act III, break the grammar you established" is a legitimate directorial instruction and the system should support it as an override type rather than forcing the director to fight the consistency machinery.

---

# PART 9 — WORKED EXAMPLE

A 90-second passage, traced from script to pixels.

## 9.1 The script

> *"By 1997, the internet had already begun changing how people communicated. The institutions that were supposed to regulate it were still writing rules for the telephone. And by the time they caught up, the thing they were regulating no longer existed."*

## 9.2 Director's creative context

Position: end of Act II, approaching the turn into Act III.

Resolved creative state at this moment:
```
abstraction        0.25 → 0.55   (rising through the passage)
archivalWeight     0.45 → 0.20
dataWeight         0.50
visualDensity      0.55 → 0.75
motionEnergy       0.40 → 0.70
humanPresence      0.35          (invariant floor: 0.30)
typographicWeight  0.60
```

Active rules: *"Return to TIME motif on any backward jump."* · *"2s breathing room after high density."*

Motif memory: `TIME` established in scene_002 as a flat horizontal line, last seen in scene_009 as layered/annotated. `INSTITUTION` established as an aged document surface.

## 9.3 Creative interpretation

The composition engine reads:

- **Semantic content:** a date (1997), a historical transition, two entities (the internet as system, institutions as counterpart), an irony structure in the final sentence
- **Narrative function:** `turn` — this is the passage where the argument pivots
- **Creative state:** abstraction and density both climbing; archival receding
- **Motif triggers:** "By 1997" is a temporal anchor → TIME motif applies. "The institutions" → INSTITUTION motif applies.
- **Rhythm history:** previous passage was low-density → headroom to build

## 9.4 Composition decisions

The engine composes a passage of five moments, not five independent blocks:

| Moment | Intent | Treatment |
|---|---|---|
| 0.0–3.5s | Ground the date | TIME motif returns — but *developed*: the horizontal line from scene_002, now with the year emerging as kinetic type. Archival still at 0.45 so a photographic surface sits beneath. |
| 3.5–7.0s | Establish the counterpart | INSTITUTION motif — aged document surface, slow push. Density holding. |
| 7.0–11.5s | The gap opens | Both motifs on screen simultaneously, diverging. Data weight expresses as a widening measure between them. Density climbing to 0.70. |
| 11.5–15.0s | The irony lands | Abstraction peaks at 0.55 — the document surface dissolves while the timeline continues. Human presence held at floor via a residual photographic trace. |
| 15.0–17.0s | Breathing room | Rule-mandated. Density drops to 0.20. Near-still frame. |

Note what the director never specified: which renderer, which frame, which font size. They specified a trajectory and two motifs, and the rules did the rest.

## 9.5 Block realization (the implementation layer)

Only now does this become the technical spec's vocabulary:

```
moment_1: KINETIC_TEXT(prominence 0.55, styleId motif_time_base)
        + ESSAY_DOC(prominence 0.45, styleId doc_default)
moment_2: ESSAY_DOC(prominence 0.75, styleId motif_inst_aged)
        + ABSTRACT_BG(prominence 0.25)
moment_3: KINETIC_TEXT(0.40) + SIMPLE_CHART(0.40) + ABSTRACT_BG(0.20)
moment_4: ABSTRACT_BG(0.55) + KINETIC_TEXT(0.45, styleId motif_time_fragmented)
moment_5: ABSTRACT_BG(0.90) + KINETIC_TEXT(0.10)
```

Each with resolved timing windows from the constraint solver, fixed seeds, and content hashes for the cache.

## 9.6 What happens on a re-direct

The director drags the Act II abstraction curve from 0.55 to 0.80.

- Narration assets: **unchanged** (no TTS spend)
- Motif identity: **unchanged** (TIME is still TIME)
- Motif *state*: `fragmented` → `dissolved` — the treatment escalates
- Moment 4's block stack shifts toward ABSTRACT_BG dominance
- Moments 1–2 barely move (early in the curve)
- Moment 5 unchanged (rule-governed)
- Recompute: ~2 blocks. Everything else cache-hits.

**This is the moment the whole architecture justifies itself.** A single directorial gesture restyles the passage, the film's memory keeps it coherent, the rules hold the shape, and it costs a couple of cents.

---

# PART 10 — MAPPING TO THE TECHNICAL SPEC

| Creative concept (this doc) | Technical implementation (master spec) |
|---|---|
| Creative State | `composition.creativeState.controlPoints` — supersedes flat per-act `vocabularyMix` as primary input |
| Film Arc | The curve editor UI over control points |
| Vocabulary mix | **Derived** from creative state; still directly editable as an advanced override |
| Motif | `composition.motifs[]` + new `visualMemory[]` tracking occurrences and state |
| Directorial rule | `composition.rules[]` — extended from renderer rules to typed creative constraints |
| Override | New `overrides[]` at scene level: `pin` / `constrain` / `exempt` / `break` |
| Passage | A composed group of moments within a scene — sits between `scene` and `block` |
| Precedence order | Composition engine resolution order (Part 5.2) |

## 10.1 What changes in Phase 0

The technical spec is otherwise sound. Three amendments:

1. **Creative State replaces flat act weights as the primary authoring model.** Vocabulary mix becomes a derived, overridable output. This is a schema change, cheap now and expensive later.
2. **Visual memory becomes a real structure**, not just a `motifs` list. Motifs need occurrence history and current state, or they can't develop.
3. **Override types become first-class** (`pin` / `constrain` / `exempt` / `break`), with the guarantee that they survive restyling.

## 10.2 What stays deferred

Unchanged from the technical spec: no sonification, maps, Manim, interviews, OTIO, or accessibility profiles in Phase 0 — architectural hooks only. Natural-language rule authoring and natural-language re-direction ("make Act II feel increasingly mechanical") are Phase 2; ship the constraint structures first so the language layer has something to compile *into*.

## 10.3 The amended validation demo

The technical spec's demo proves the caching thesis. Extend it to prove the creative thesis:

1–7. *(unchanged — essay → film → one-sentence edit → cache-aware rebuild)*
8. **Drag the Act III abstraction curve upward.**
9. Confirm: no TTS regeneration, motifs *develop* rather than reset, rule-governed passages hold, only affected blocks recompute, and the film's character visibly changes.
10. **Pin one block. Restyle again. Confirm the pin survives** and the tension is reported rather than silently resolved.

Step 10 is the proof that this is an instrument and not an automaton.

---

# THE TEST

Every future feature, schema field, and UI decision should answer one question:

> **Does this let the director express intention, or does it make them specify implementation?**

If it's the latter, it belongs in the Advanced panel or nowhere.
