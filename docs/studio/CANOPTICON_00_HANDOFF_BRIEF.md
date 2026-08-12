# CANOPTICON — Claude Code Handoff Brief
## Start Here

This is the entry point for a four-document package. Read this first, then the three specifications in the order given below.

---

# 1. WHAT YOU ARE BUILDING

Canopticon is a **deterministic editorial compiler for documentary and video-essay film**. A film is the *compiled artifact* of a versioned, reproducible source representation — not a one-off render.

```
ESSAY / SCRIPT
     ↓
NARRATIVE IR            acts → sequences → scenes
     ↓
CREATIVE STATE          the film's evolving personality
     ↓
COMPOSITION ENGINE      intent → primitive chains
     ↓
PROCEDURAL PALETTE      what code can paint with
     ↓
CONSTRAINT SOLVER       narration alignment → time windows
     ↓
RENDER DAG              content-hashed, cache-aware
     ↓
FILM
```

**It is not** an AI video generator, a prompt-to-video wrapper, or a template engine. If a design decision would make it resemble any of those, it is the wrong decision.

## The thesis Phase 0 must prove

> Change one sentence → the solver re-anchors → only affected primitives recompute → everything else is a cache hit → the operator can see exactly why.
>
> Then move one creative slider → the whole film changes character → narration never regenerates → motifs *develop* rather than reset.

The first half proves it is efficient. The second half proves it is an instrument. Both are required.

---

# 2. READING ORDER

| # | Document | Answers | Authority |
|---|---|---|---|
| 1 | `CANOPTICON_CREATIVE_CONSTITUTION.md` | What does the director express? | **Highest.** Defines intent. |
| 2 | `CANOPTICON_PRIMITIVE_ATLAS.md` | What can the machine paint with? | Defines the palette and its interfaces. |
| 3 | `CANOPTICON_PHASE0_MASTER_SPEC.md` | How does it compile, cache, and store? | Defines implementation. |

**Conflict resolution:** Constitution > Atlas > Master Spec. Where the Master Spec contradicts the Constitution, the Constitution wins and the spec is amended. The Master Spec's Part 10.1 and the Atlas's Part 7.1 already list the known amendments — apply them rather than implementing the superseded version.

Specifically, three things in the Master Spec are **superseded**:

1. Flat per-act `vocabularyMix` → replaced by **Creative State control points** (Constitution Part 2). Vocabulary mix becomes a derived, overridable output.
2. Four fixed block types → replaced by **recipes over typed primitives** (Atlas Part 1.1). Blocks remain as convenient defaults; the composition engine must be able to reach past them.
3. Per-block cache hashing → replaced by **per-primitive cache hashing** (Atlas Part 7.1). Materially better incremental rebuilds.

---

# 3. STANDING RULES

These are not negotiable and every design decision must respect them.

1. **AI output is an input artifact, never a function.** TTS audio, alignment JSON, and LLM segmentation proposals are generated once, frozen, hashed, and committed. The compiler never calls an AI service at render time.
2. **Timing is anchor-based, never frame-based.** No hardcoded frame ranges anywhere in the IR.
3. **The operator is always in control.** The system proposes; the human ratifies. No auto-mutation of the IR.
4. **No `Math.random()`.** Enforce by lint rule. Everything stochastic takes a seed.
5. **Every primitive declares typed inputs and outputs.** This is what makes the palette composable. A primitive that consumes nothing and produces only final pixels is a recipe, not a primitive.
6. **Overrides survive restyling.** A pinned decision is never silently discarded by a recompile; tension is reported, not resolved unilaterally.
7. **Determinism is claimed honestly.** L1 (semantic) always. L2 (pixel) within a pinned environment. L2-GPU for shader/3D primitives — same GPU only. Never claim byte-identical output in Phase 0.
8. **Degrade, flag, continue.** A failure in one scene never blocks the rest of the film from compiling.

---

# 4. BUILD SEQUENCE

## Stage 1 — Skeleton (no visuals yet)

- IR parser and schema validation (Master Spec Part 2)
- D1 tables + R2 key layout (Master Spec Part 7.1)
- Worker routes stubbed (Master Spec Part 7.2)
- Constraint solver with debug output (Master Spec Part 3) — including the overflow/underflow cases in 3.2
- Node hashing + cache store (Atlas Part 7.1 — per-primitive granularity)

**Milestone:** a hand-authored IR resolves to correct time windows, and re-running with one changed value produces the correct cache hit/miss set. No rendering yet.

## Stage 2 — The primitives that prove code is a medium

In this order (Atlas Part 8.8):

1. `noise_field` + `flow_field`
2. `glyph_to_points`
3. `particle_flow` + `particle_seek`
4. **Motion craft layer** — `ease_profile`, `damping`, `overshoot`, `seamless_loop`
5. Compositing — `blend`, `mask_apply`, `blur`, `color_transform`, `nest`

**Milestone:** the text-dissolution chain runs end to end —
`text_layout → glyph_to_points → particle_seek → particle_flow → particle_trail`
A word assembles from scattered particles, holds, dissolves into drift. If this looks good, the premise holds.

## Stage 3 — The documentary workhorses

- Documents family — `document_surface`, `document_layout`, `annotation`, `redaction`, `camera_move`
- Typography remainder — `text_stagger`, `text_scramble`, `variable_axis`, `text_mask`
- Data — `chart_cartesian`, `counter`, `data_to_particles`
- Timeline — `timeline_linear`

**Milestone:** a real 90-second passage from an actual essay compiles and is watchable.

## Stage 4 — Direction

- Creative State model with control points and interpolation
- Composition engine with the full precedence order (Constitution Part 5.2)
- Visual memory / motif development (Constitution Part 6)
- Override types — `pin` / `constrain` / `exempt` / `break`
- Director's Control Surface UI

**Milestone:** dragging an abstraction curve changes the film's character; motifs develop rather than reset; a pinned block survives.

## Stage 5 — Remainder

Cut grammar, interface emulation, maps, raster/pixel, shaders, remaining compositing. Cut from the bottom if time runs short.

## The five views

Build alongside stages 1–4, not after:

| View | Purpose |
|---|---|
| **Narrative** | Write and segment the essay. Single source of truth. |
| **Editorial** | Scenes, timing, blocks, and the Director's Control Surface. |
| **Preview** | Watch. Leave timestamped notes. Set scene status. |
| **Compile** | Audit what recomputed and why. Deliberately boring. |
| **Lab** | Primitive playground. Scrub parameters, save recipes, measure real per-frame cost. |

Build **Lab first** among the views — it is how you discover whether a primitive actually reads on screen before wiring it into the pipeline.

---

# 5. ACCEPTANCE CRITERIA

The build is done when all ten pass:

1. Paste a ~400-word essay; accept the segmentation proposal; get 4–5 scenes with `sourceRange` offsets bound to the prose.
2. Generate narration for all scenes via Workers AI TTS; alignment stored as a frozen, hashed artifact.
3. Set a Film Arc — grounded Act I, analytical Act II, abstract Act III.
4. Compile. Watch a ~90-second film in Preview. Compile View reports time, cost, cache state, and determinism level.
5. Change one sentence in scene 1. Recompile.
6. Confirm: scene 1's affected primitives recomputed **with a stated reason**; scenes 2–5 are 100% cache hits; rebuild under 10s.
7. Drag the Act III abstraction curve upward. Recompile.
8. Confirm: **zero TTS regeneration**; motifs *develop* (state escalates) rather than reset; rule-governed passages hold; only affected primitives recompute; the film's character visibly changes.
9. Pin one block. Restyle again. Confirm the pin survives and any tension is **reported, not silently resolved**.
10. Revert to a previous version. Confirm assets and cached renders are still valid (content-addressed, so reverting is free).

Criteria 8 and 9 are the ones that distinguish this from every other tool in the category. Do not treat them as stretch goals.

---

# 6. OPEN DECISIONS

Three things are deliberately unresolved — they are cheaper to settle against running code than in a spec. Make a call, document it, and flag it in the Lab:

1. **Prominence compositing.** When two primitives share a moment at 0.6/0.4, what is the actual layout? Start with a small hardcoded layout table per primitive-family pair; generalize only if it becomes painful.
2. **Recompile trigger.** Auto-recompile on every keystroke is too aggressive; an explicit button is too slow for slider work. Suggested: debounced auto-recompile for creative-state sliders (no TTS cost), explicit `Compile` for narrative edits (which spend TTS).
3. **Chain cost ceilings.** `estimatedCostMsPerFrame` values in the Atlas are guesses. Measure them in the Lab and set real budgets.

Resolved already, do not re-litigate: **motif continuity outranks anti-repetition** (Constitution Part 5.2). Motifs want repetition; that is what makes them motifs.

---

# 7. WHAT IS EXPLICITLY OUT OF SCOPE

MP4/ProRes export · word-level alignment · L3 byte-identical determinism · real asset ingestion (PDFs, photos, CSV) · Manim adapter · sonification · interview/multi-speaker grammar · accessibility render profiles *(keep `renderProfile` as an IR field)* · OTIO export · multi-user collaboration · fork/remix · natural-language re-direction · branching narrative.

Architectural hooks only. Do not build these.

---

# 8. THE TEST FOR EVERY DECISION

> **Does this let the director express intention, or does it make them specify implementation?**

If the latter, it belongs in an Advanced panel or nowhere.

And for every primitive:

> **Does it produce a typed output another primitive can consume?**

If not, it is a recipe, not a primitive.
