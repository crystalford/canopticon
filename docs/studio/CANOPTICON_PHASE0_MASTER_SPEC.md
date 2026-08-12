# CANOPTICON — Phase 0 Master Specification
## Essay-Seeded Deterministic Film Compiler

**Version:** 1.0 · **Target:** Cloudflare-native (Workers, Pages, D1, R2, Workers AI)
**Handoff to:** Claude Code

---

# PART 0 — WHAT THIS IS

Canopticon is **not** an AI video generator. It is a **deterministic editorial compiler**: a system where a film is the *compiled artifact* of a versioned, reproducible source representation.

```
ESSAY / SCRIPT
     ↓
NARRATIVE IR        (acts → sequences → scenes → beats)
     ↓
COMPOSITION MODEL   (global visual grammar + act-level evolution)
     ↓
CONSTRAINT SOLVER   (narration alignment → resolved time windows)
     ↓
RENDER DAG          (content-hashed nodes, cache-aware)
     ↓
FILM               (in-browser preview now; MP4 later)
```

**The thesis to prove in Phase 0:**

> Change one sentence → the solver re-anchors → only the affected blocks recompute → everything else is a cache hit → the operator can *see exactly why*.

Everything else is feature work. If that loop works and is legible, Canopticon is a new kind of production system. If it doesn't, it's another prompt-to-video wrapper.

**Three principles that must not be violated:**

1. **AI output is an input artifact, never a function.** TTS audio, alignment JSON, and LLM segmentation proposals are generated once, frozen, hashed, and committed to the project. The compiler never calls an AI service at render time.
2. **Timing is anchor-based, never frame-based.** No hardcoded frame ranges anywhere in the IR.
3. **The operator is always in control.** No auto-mutation of the IR. The system proposes; the human ratifies.

---

# PART 1 — THE COMPOSITION MODEL (the part that was nearly lost)

This is the creative heart of the system and must be in the schema from commit one — retrofitting it later means touching every renderer.

## 1.1 The core idea

The operator does **not** pick a block type per scene. That produces a slideshow assembled by a very intelligent robot.

Instead, the operator defines a **visual grammar** — the film's personality — and the system composes within it. Blocks are *selected and weighted* by that grammar, so the whole film shares one visual and sonic language.

## 1.2 Three levels of composition

```
FILM GRAMMAR      → the film's identity        (global)
ACT GRAMMAR       → dramatic evolution         (overrides global)
SCENE OVERRIDE    → deliberate exception       (overrides act)
```

Resolution order: `scene override → act grammar → film grammar`.

## 1.3 Schema

```json
{
  "composition": {
    "film": {
      "vocabularyMix": {
        "kineticType": 0.30,
        "essayDoc":    0.25,
        "simpleChart": 0.15,
        "abstractBg":  0.30
      },
      "behavior": {
        "energy":        0.60,
        "abstraction":   0.45,
        "visualDensity": 0.55,
        "typography":    0.70,
        "restraint":     0.50
      },
      "motifs": [
        { "concept": "time",        "blockType": "kineticType", "styleId": "motif_time" },
        { "concept": "institution", "blockType": "essayDoc",    "styleId": "motif_inst" }
      ],
      "rules": {
        "maxConsecutiveSameType": 2,
        "requireContrastAfterDensity": true
      }
    },
    "acts": [
      { "actId": "act_1", "vocabularyMix": { "essayDoc": 0.45, "kineticType": 0.20 } },
      { "actId": "act_2", "vocabularyMix": { "simpleChart": 0.40, "essayDoc": 0.15 } },
      { "actId": "act_3", "vocabularyMix": { "abstractBg": 0.45, "kineticType": 0.35 } }
    ]
  }
}
```

## 1.4 What the weights actually mean

They are **preferences, not quotas.** A 0.30 kineticType weight does not mean 30% of runtime is kinetic type. It means: when the composition engine selects blocks for a scene, kineticType is weighted 0.30 in the selection, and where it appears, its visual prominence (opacity, scale, screen share) scales with that weight.

Two distinct effects:
- **Selection weight** — how likely this vocabulary is chosen for a scene
- **Prominence weight** — how dominant it is when composited with other layers in the same scene

Phase 0 implements both, but simply: selection via weighted choice with the anti-repetition rule applied; prominence via layer opacity/scale.

## 1.5 Composition engine inputs

Block selection for a scene is a function of:

```
resolved vocabulary mix (film → act → scene)
+ narrative function of the scene (hook / evidence / turn / resolve)
+ semantic content of the narration (dates, numbers, quotes, entities)
+ recent visual history (anti-repetition)
+ available assets
→ block stack for this scene
```

**Critical guardrail:** narrative appropriateness overrides statistical preference. A high `abstraction` setting must not abstract a scene tagged `narrativeFunction: "evidence"`. Hard-code a small override table in Phase 0 rather than leaving this to weights alone.

## 1.6 The director's control surface

In the Editorial View, the operator sees sliders, not a block-type dropdown:

```
FILM GRAMMAR              LOW ────────────── HIGH
Kinetic Type              ──────●───────────
Essay Document            ─────────●────────
Chart / Data              ────●─────────────
Abstract                  ───────●──────────

BEHAVIOR
Literal    ←──────●──────────→  Abstract
Calm       ←────●────────────→  Frenetic
Restrained ←────────●────────→  Highly Designed
```

Moving a slider triggers a recompile. Because the underlying narration artifacts and unaffected blocks are cached, restyling the whole film is cheap — this is where the deterministic architecture pays off creatively, not just technically.

---

# PART 2 — EDITORIAL IR SCHEMA

## 2.1 Full shape

```json
{
  "$schema": "https://canopticon.dev/schemas/v0/editorial-ir.json",
  "projectId": "proj_001",
  "title": "Working Title",
  "irVersion": "0.1.0",
  "createdAt": "2026-08-12T00:00:00Z",

  "composition": { /* see Part 1.3 */ },

  "entities": [
    {
      "id": "ent_org_a",
      "type": "organization | person | document | concept | place",
      "label": "Display Name",
      "state": "active",
      "visualIdentity": { "primaryColor": "#FF4D17", "styleId": "entity_default" }
    }
  ],

  "assets": [
    {
      "assetId": "asset_vo_scene_001",
      "kind": "audio | alignment | image | data",
      "r2Key": "projects/proj_001/vo/scene_001_v3.mp3",
      "sha256": "…",
      "provenance": {
        "generatedBy": "workers-ai:tts-1",
        "params": { "voice": "…", "speed": 1.0 },
        "createdAt": "…",
        "sourceText": "The system was supposed to be temporary."
      }
    }
  ],

  "acts": [
    {
      "actId": "act_1",
      "title": "Setup",
      "sequences": [
        {
          "sequenceId": "seq_1",
          "scenes": [
            {
              "sceneId": "scene_001",
              "narrativeFunction": "hook | establish | evidence | turn | resolve",
              "status": "draft | ready_for_review | approved | flagged",
              "sourceRange": { "startChar": 0, "endChar": 142 },

              "narration": {
                "text": "The system was supposed to be temporary.",
                "voAssetId": "asset_vo_scene_001",
                "alignmentAssetId": "asset_align_scene_001",
                "alignmentGranularity": "chunk"
              },

              "timing": {
                "startAnchor": { "chunkId": "c_0", "offsetMs": 0 },
                "endAnchor":   { "chunkId": "c_2", "offsetMs": 200 },
                "minDurationMs": 3000,
                "maxDurationMs": 12000,
                "elasticity": "rigid | elastic"
              },

              "compositionOverride": null,

              "blocks": [
                {
                  "blockId": "blk_001",
                  "type": "KINETIC_TEXT",
                  "prominence": 0.65,
                  "seed": 421337,
                  "props": { "text": "…", "styleId": "kt_quote_primary" }
                }
              ],

              "notes": [
                { "noteId": "n_1", "timestampMs": 4200, "text": "too slow", "severity": "minor", "resolved": false }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## 2.2 Key schema decisions

- `sourceRange` links every scene back to character offsets in the source essay. This is what makes the Narrative View the single source of truth — edit the prose, and the system knows exactly which scenes are affected.
- `seed` is per-block and fixed. Never call `Math.random()` in a renderer.
- `provenance` on every asset, from day one. Cheap now, impossible to backfill.
- `alignmentGranularity` is explicitly `"chunk"` in Phase 0 and `"word"` in Phase 1 — the schema doesn't change when alignment improves.

---

# PART 3 — CONSTRAINT SOLVER

## 3.1 Algorithm (Phase 0)

```
for each scene in document order:
    startMs = alignment[startAnchor.chunkId].start + startAnchor.offsetMs
    endMs   = alignment[endAnchor.chunkId].end   + endAnchor.offsetMs
    natural = endMs - startMs
    duration = clamp(natural, minDurationMs, maxDurationMs)

    if duration != natural:
        slack = duration - natural
        if next scene is elastic:
            absorb slack into next scene
        else:
            cascade: shift all downstream scenes by slack

    emit resolved window { startMs, endMs: startMs + duration }
```

## 3.2 Overflow / underflow handling (previously unspecified — must be decided)

Two failure cases the solver must handle explicitly:

**Narration longer than the visual can sustain.** A 40-second narration on a single `KINETIC_TEXT` block. Resolution: the composition engine splits the scene into multiple blocks at sentence boundaries within the narration, and flags the scene in the Editorial View with "auto-split: 3 blocks."

**Narration shorter than block minimum.** A 1.2-second narration on a `SIMPLE_CHART` with a 3s minimum. Resolution: the block extends past narration end into the following scene's head (a J-cut), *if* the next scene is elastic. If not, the block is compressed to the narration length and the scene is flagged `underrun` in the Compile View.

Neither case should silently produce a broken film. Both surface in the UI.

## 3.3 Solver transparency

The Editorial View must show, per scene:
```
c_0 @ 12,340ms  +0ms offset      → start 12,340ms
c_2 @ 15,120ms  +200ms offset    → end   15,320ms
natural 2,980ms · clamped to min 3,000ms · +20ms absorbed by scene_002 (elastic)
```

If the operator can't read *why* a scene sits where it sits, the system feels haunted and they'll stop trusting it.

---

# PART 4 — RENDER DAG & CACHE

## 4.1 Node hashing

```
NodeHash = SHA256(
    blockType +
    rendererVersion +
    canonicalJSON(resolvedProps) +
    resolvedTimingWindow +
    seed +
    referencedAssetHashes
)
```

`canonicalJSON` must sort keys — otherwise property reordering produces spurious cache misses.

## 4.2 What gets cached in Phase 0

Since Phase 0 has no MP4 export, the cache target is the **computed render artifact**: resolved props + timing + derived animation keyframes / draw instructions, serialized to JSON and stored in R2 under the hash.

This is the addition that keeps the core thesis provable from day one rather than deferring it to Phase 1's MP4 pipeline. The Compile View's numbers are real, not mocked.

## 4.3 Cache invalidation cascade

When a sentence changes:

```
1. Narrative View edit → sourceRange offsets shift
2. Affected scene(s) identified by sourceRange overlap
3. TTS regenerated for affected scenes only → new asset, new hash
4. Alignment regenerated → new asset, new hash
5. Solver re-runs for the whole film (cheap, pure computation)
6. NodeHash recomputed for every block
7. Blocks whose hash is unchanged → cache hit
8. Blocks whose hash changed → recompute
```

Note step 5: the solver always runs across the whole film. It's microseconds. Only *rendering* is cached.

## 4.4 Determinism levels

| Level | Guarantee | Phase 0 target |
|---|---|---|
| L1 Semantic | Same IR → same timeline structure & params | **Required** |
| L2 Frame | Same env → same pixels | **Required** (in-browser: same browser build) |
| L3 Artifact | Same env → byte-identical file | Deferred to Phase 1 (needs MP4) |

Never claim universal byte-identical output. Claim L1 always, L2 within a pinned environment.

---

# PART 5 — BLOCK REGISTRY & STYLE PRESETS

## 5.1 Phase 0 block types

| Type | Purpose | Key props |
|---|---|---|
| `KINETIC_TEXT` | Animated typography for key phrases | `text`, `styleId`, `emphasisWords[]` |
| `ESSAY_DOC` | Prose rendered as a document panel | `heading`, `body`, `highlightRange`, `cameraMove` |
| `SIMPLE_CHART` | Bar/line chart, data inline in IR | `values[]`, `labels[]`, `chartType` |
| `ABSTRACT_BG` | Full-frame gradient / noise / particles | `styleId`, `intensity`, `motionProfile` |

All four are code-only. No external asset ingestion in Phase 0.

## 5.2 Style preset registry (previously unspecified)

Presets must be a defined registry, not invented per-block, or the film has no visual identity. Ship a flat JSON:

```json
{
  "presets": {
    "kt_quote_primary":  { "font": "IBM Plex Serif Italic", "size": 72, "weight": 400, "motion": "word_stagger", "color": "var(--fg)" },
    "kt_statement":      { "font": "Geist Mono", "size": 56, "weight": 500, "motion": "fade_up", "color": "var(--accent)" },
    "doc_default":       { "surface": "paper", "cameraMove": "slow_push", "highlight": "underline" },
    "doc_evidence":      { "surface": "paper_aged", "cameraMove": "crop_reveal", "highlight": "box" },
    "chart_default":     { "palette": "mono_accent", "drawOn": "left_to_right", "gridlines": false },
    "bg_default":        { "kind": "gradient_noise", "intensity": 0.3, "palette": "dark" },
    "bg_tension":        { "kind": "particle_drift", "intensity": 0.6, "palette": "dark_warm" }
  },
  "tokens": {
    "--bg": "#0e0c09",
    "--fg": "#f3ede4",
    "--accent": "#FF4D17",
    "--muted": "#8a8378"
  }
}
```

Tokens align with the existing Aldershot design language (Geist Mono, IBM Plex Serif Italic, signal-orange). Presets reference tokens; blocks reference presets. Never hardcode a color in a renderer.

---

# PART 6 — THE FOUR EDITORIAL VIEWS

Named for what the operator *does*, not for metaphor.

## 6.1 NARRATIVE VIEW — "The Script"

**The single source of truth.** Most operator time is spent here.

- Full essay as editable prose (markdown)
- Right-margin minimap: colored bars showing scene boundaries and narrative functions
- Inline scene markers the operator can drag to re-segment
- Tag a sentence: `[HOOK]`, `[EVIDENCE]`, `[TURN]`, `[RESOLVE]`
- Margin badges per scene: `● cached` / `● will re-render` / `● missing narration`
- Editing a sentence shows a live hint: *"This invalidates 2 blocks in scene_003."*

**Interaction:** Type. Save. The system re-parses `sourceRange`, re-segments, and recalculates — without ever silently rewriting the operator's prose or structure.

## 6.2 EDITORIAL VIEW — "The Timeline"

The film's skeleton and its grammar.

**Left panel:** collapsible act → sequence → scene tree, drag to reorder.

**Center panel** (selected scene):
- Narration text + status (`recorded` / `tts_pending` / `aligned` / `alignment_stale`)
- Resolved timing window + solver explanation (Part 3.3)
- Block stack with prominence sliders
- `+ Add Block`, elasticity toggle, narrative function dropdown

**Right panel:** the **Director's Control Surface** (Part 1.6) — film grammar sliders, act-level overrides, behavior sliders. Changing these recompiles.

## 6.3 PREVIEW VIEW — "The Studio"

Watch the film. React to it. Nothing else.

- Full-width in-browser playback (canvas blocks + audio)
- Scrubber
- `+ Note` at any timestamp → `{ text, severity: minor|major|blocker }`
- Notes list, click to jump, mark resolved
- Per-scene status control: `draft → ready_for_review → approved`, or `flagged` if unresolved blocker notes exist

Deliberately sparse. This is the reflective pause, not a control panel.

## 6.4 COMPILE VIEW — "The Forge"

Proves the thesis. Should be boring, which is the point.

**Summary:** total time · blocks cached · blocks recomputed · cost · determinism level achieved.

**Per-block breakdown:**
```
✓ scene_001  Cold Open
   ✓ KINETIC_TEXT   CACHED     a8f9c…
   ✓ ABSTRACT_BG    CACHED     3b12e…

↻ scene_002  Context
   ↻ ESSAY_DOC      RECOMPUTED 3b12e→d7f2k
       reason: alignment shifted (c_4 moved +150ms) → timing window changed
   ✓ ABSTRACT_BG    CACHED     7f2kb…

⚠ scene_004  Data
   ⚠ SIMPLE_CHART   UNDERRUN   narration 1.2s < min 3.0s, compressed
```

Every recompute states its reason. Every warning is actionable.

---

# PART 7 — BACKEND & STORAGE (previously unspecified)

## 7.1 Storage layout

**D1** (queryable, versioned):
```
projects        (id, title, created_at, current_ir_version)
ir_versions     (id, project_id, version, ir_json, created_at, parent_version)
assets          (id, project_id, kind, r2_key, sha256, provenance_json)
notes           (id, project_id, scene_id, timestamp_ms, text, severity, resolved)
render_cache    (node_hash, project_id, r2_key, created_at, last_hit_at)
```

**R2** (blobs):
```
projects/{projectId}/vo/{sceneId}_v{n}.mp3
projects/{projectId}/alignment/{sceneId}_v{n}.json
projects/{projectId}/cache/{nodeHash}.json
projects/{projectId}/uploads/{assetId}.{ext}
```

IR lives in D1 as a JSON blob per version — queryable enough for Phase 0, and versioning comes free.

## 7.2 Worker routes

| Route | Does |
|---|---|
| `POST /project` | Create project |
| `POST /import-essay` | Text → LLM segmentation proposal → IR skeleton (operator confirms) |
| `POST /generate-vo` | Workers AI TTS for a scene → R2 + asset record |
| `POST /upload-vo` | Accept `MediaRecorder` blob → R2 → STT alignment |
| `POST /compile` | Solve → hash → cache check → recompute misses → return report |
| `GET /project/:id` | Current IR |
| `GET /project/:id/versions` | Version history |
| `POST /project/:id/revert` | Revert to a version |
| `WS /compile-status` | Live progress during compile |

## 7.3 Essay → IR segmentation (previously unspecified)

Phase 0: a single Workers AI LLM call proposes act/scene boundaries and narrative function tags from paragraph structure. Output is a **proposal** rendered as draft markers in the Narrative View. The operator confirms, adjusts, or rejects. Never auto-applied.

The prompt asks for: scene boundaries at `sourceRange` char offsets, a `narrativeFunction` per scene, and a one-line rationale per boundary (shown on hover so the operator can judge the proposal).

## 7.4 Async states & failure handling (previously unspecified)

Every long-running operation needs three explicit UI states:

| Operation | Pending | Success | Failure |
|---|---|---|---|
| TTS generation | spinner on scene, other scenes still editable | audio player + waveform | inline error + `Retry` + fallback to manual recording |
| Alignment | "aligning…" badge | granularity badge (`chunk`) | `alignment_failed` → scene compiles with estimated timing + warning |
| Compile | progress bar via WS, per-scene ticks | Compile View report | partial report: which blocks succeeded, which failed, film still previewable with gaps |

**Rule:** a failure in one scene never blocks the rest of the film from compiling. Degrade, flag, continue.

## 7.5 Versioning & undo (previously unspecified)

Every compile creates an `ir_versions` row. The UI shows editorial diffs, not JSON diffs:

> *"Scene 3 narration changed · Act II chart weight 0.15 → 0.40 · 2 blocks recomputed"*

`Revert to this version` restores the IR. Assets are immutable and content-addressed, so reverting is free — old audio and cached renders are still there.

Git-like semantics underneath, no Git vocabulary in the UI.

---

# PART 8 — SCOPE BOUNDARIES

## 8.1 In scope for Phase 0

- Single-project-at-a-time workspace (project list is a simple index page)
- Four block types, code-only
- Chunk-level alignment
- In-browser preview (no MP4)
- Composition model: schema + selection + prominence + director sliders
- Real hash-based caching with visible reporting
- Versioning + revert
- Self-approval workflow (single operator)

## 8.2 Explicitly deferred

| Deferred | To |
|---|---|
| Word-level alignment | Phase 1 (needs better alignment source) |
| MP4 / ProRes export, FFmpeg stitch | Phase 1 |
| L3 byte-identical determinism | Phase 1 |
| Real asset ingestion (PDFs, photos, CSV) | Phase 1 |
| Maps, force-directed graphs, Manim inserts | Phase 2 |
| Sonification & sonic grammar | Phase 2 |
| Interview / multi-speaker dialogue grammar | Phase 2 |
| Accessibility render profiles (reduced-motion, high-contrast, audio-only) | Phase 2 — **but keep `renderProfile` as an IR field now** |
| OTIO export | Phase 2 |
| Multi-user collaboration | Phase 3 |
| Fork / remix / archive ("GitHub for films") | Phase 3 |
| Branching narrative | Probably never |

## 8.3 Known unknowns — decide during build, don't guess now

1. **Prominence compositing.** When `KINETIC_TEXT` at 0.6 and `ESSAY_DOC` at 0.4 occupy the same scene, what's the actual layout? Text over document with blur? Side-by-side? Start with a small hardcoded layout table per block-type pair; generalize only if it becomes painful.
2. **Anti-repetition vs. motif consistency.** These rules conflict: motifs *want* repetition, `maxConsecutiveSameType` forbids it. Motif reuse should be exempt from the anti-repetition rule. Verify this feels right in practice.
3. **Recompile trigger.** Auto-recompile on every keystroke is too aggressive; an explicit button is too slow for slider work. Suggested: debounced auto-recompile for composition sliders, explicit `Compile` for narrative edits (since those trigger TTS spend).

---

# PART 9 — THE VALIDATION DEMO

Build toward exactly this:

1. Paste a ~400-word essay. Accept the segmentation proposal (4–5 scenes).
2. Generate narration for all scenes via Workers AI TTS.
3. Set film grammar: essayDoc-heavy Act I, chart-heavy Act II, abstract-heavy Act III.
4. Compile. Watch the ~90-second film in Preview. Note the total time and cost.
5. **Change one sentence in scene 1.**
6. Compile again.
7. Open Compile View. Confirm:
   - scene_001 blocks recomputed, with a stated reason
   - scenes 002–005 all cache hits
   - rebuild time under 10s
8. **Then move one composition slider** (e.g. abstract 0.30 → 0.55).
9. Compile. Confirm: narration assets all cache hits (no TTS spend), only affected blocks recompute, film's character visibly changes.

Step 8–9 is the moment the architecture proves it's a *creative* tool and not just an efficient one.

---

# PART 10 — WHAT SUCCESS SOUNDS LIKE

> "I wrote an essay. It became a film with a coherent visual language I chose. I changed a sentence and it rebuilt in eight seconds and told me exactly what changed and why. I moved a slider and the whole film changed character without regenerating a single line of narration. I can revert to any previous version. Nothing happened that I didn't ask for."

If the build delivers that, Phase 1 (MP4, word-level anchors, real assets) is straightforward. If it doesn't, no amount of Phase 1 polish will save it.
