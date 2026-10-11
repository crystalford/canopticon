---
id: eight-innovative-animation-visualization-ideas-for-code-first-document
title: "Eight Innovative Animation & Visualization Ideas for Code-First Documentary Production"
kind: "Research"
topic: "AI-directed development"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/Canopticon Research Documents-20260927T175515Z-1-001/Code-First Documentary Animation_ Eight Deterministic Visualization Ideas for Remotion Pipelines.md"
---

# Eight Innovative Animation & Visualization Ideas for Code-First Documentary Production

## TL;DR
- **Seven of the eight ideas are technically shippable today in a code-first stack (Remotion + Web Audio/Tone.js + d3), because determinism is already solved:** d3-force ships a fixed-seed linear congruential generator, Tone.js renders via OfflineAudioContext, and Remotion made `getAudioData` deterministic by defaulting to 48000 Hz ("In versions before 4.0.121, the default value was undefined, leading to undeterministic behavior across devices rendering"). The genuinely hard one is dual-output branching video (idea #6), which is a data-model/standards problem, not a rendering problem.
- **The reason these combinations haven't shipped is organizational, not technical:** documentary graphics live in After Effects (timeline/keyframe tools) where sonification, constraint-solving, and provenance chains have no native home, while the web/dataviz research that solved these problems (Erie, constraint-based breakpoints, narrative-vis theory) never crossed into linear film production. Code-first video (Remotion) is the missing bridge.
- **The loudest cautionary tale is Netflix's interactive division:** after building bespoke "Branch Manager" tooling for Bandersnatch, Netflix delisted 20 of 24 interactive titles on December 1, 2024 and removed the final two (Bandersnatch and Kimmy vs. the Reverend) on May 12, 2025 — proof that branching video's failure mode is tooling/maintenance cost and audience fatigue, not the core technology.

## Key Findings

1. **Sonification is real, deterministic, and documentary-proven** — NASA's Chandra program and the Audio Universe planetarium show demonstrate data-to-sound in narrative contexts, and Tone.js's `Tone.Offline()` / OfflineAudioContext plus Remotion's `visualizeAudio` make frame-precise sync achievable.
2. **Force-directed graphs are already deterministic** — D3 6.0 (August 26, 2020) made all built-in forces fully deterministic via a seeded LCG (`randomSource`), so a layout can be pre-computed, seeded, and frame-exported identically every render.
3. **Timeline-as-data and temporal layering are underexplored but low-risk** — both are essentially rendering problems with strong perceptual-science and UI-design precedent (Ableton, audio-editor aesthetics), and no determinism obstacles.
4. **Constraint-based animation is mature in adjacent fields** (Cassowary → Apple Auto Layout; Autograph's responsive motion design) but rarely used as the primary animation paradigm in video; determinism depends on fully constraining the system.
5. **Provenance visualization has strong journalistic precedent** (ProPublica "How We Analyzed") but no animated, code-first "chain of custody" grammar exists — the clearest greenfield opportunity.
6. **Branching video is a solved rendering problem but an unsolved standards/economics problem** — OTIO models linear cuts well but branching narratives need a DAG the format doesn't natively privilege; Netflix's retreat is the cautionary tale.
7. **Responsive/adaptive visualization has a fresh academic foundation** — Schöttler et al.'s constraint-based breakpoints (IEEE TVCG, vol. 31 no. 9, pp. 4593–4604) show how to make visualizations adapt to *data volume*, not just screen size.
8. **The unifying enabler is Remotion** — a React framework that renders deterministic MP4s frame-by-frame, uniquely positioned to host all eight ideas because "everything is a React component controlled by the library."

## Details

### 1. Sonification in Linear Video/Documentary

**Real-world precedents.** The strongest is NASA's Chandra X-ray Center "A Universe of Sound" program, running since 2020, led by visualization scientist Kimberly Arcand with the SYSTEM Sounds team (astrophysicist Matt Russo, musician Andrew Santaguida) and accessibility consultant Christine Malec. It produced a NASA+ documentary, "Listen to the Universe," explicitly about how the sonifications are made. The mapping scheme translates image position to time (a left-to-right or top-down scan), brightness to volume, and wavelength/color to pitch (red = lower pitch, green = medium, blue = higher). A striking example of data-faithful *temporal* mapping comes from Chandra's Feb 28, 2024 release of the pulsar wind nebula MSH 15-52: "The light curve... from the dead star's collapsed core is heard in pulses that occur almost 7 times every second as it does in the original data." The program was built off earlier Chandra work aimed at blind and visually impaired audiences.

The second major precedent is **Audio Universe: Tour of the Solar System** (2021), a 35-minute planetarium/flat-screen show from astronomers at Newcastle and Portsmouth universities, built on the open-source **STRAUSS** (Sonification Tools and Resources for Astronomers Using Sound Synthesis) Python code. Crucially, "the soundtrack was designed first so that it would be educational and enjoyable on its own, and only then were visual animations added" — an inversion of normal documentary workflow directly relevant to code-first production. Star color → pitch, brightness → volume, position → stereo/surround panning.

**Academic foundation.** Sonification for narrative and accessibility is well-developed: Siu et al., "Supporting Accessible Data Visualization Through Audio Data Narratives" (CHI 2022, Stanford/Follmer lab) combine image descriptions and sonification with a heuristics-based auto-generation approach for time-series data; Hoque et al., "Accessible Data Representation with Natural Sound" (CHI 2023) introduce "Susurrus," using natural sounds so BLV users can perceive multiple simultaneous data streams. The key enabling artifact is **Erie: A Declarative Grammar for Data Sonification** (CHI 2024, arXiv 2402.00156), which compiles a Vega-Lite-style spec to Web Audio, supporting tone designs, encoding channels (time, duration, pitch, loudness, tapping, panning, reverb, speech), and composition (repeat/sequence/overlay). Erie explicitly notes that using Tone.js directly forces developers to "manually scale data values to auditory values" — Erie exists to abstract that away.

**Technical feasibility & determinism.** This is the strongest determinism story of all eight ideas. Tone.js provides `Tone.Offline()`, which renders all scheduled nodes into a buffer using OfflineAudioContext "much faster than real time." Because scheduling is against an offline transport rather than a wall clock, output is reproducible. The known limitation is documented in Tone.js issue #436: offline rendering blocks the UI thread and "rendering of more than a couple of minutes [is] not feasible" in-browser — so long-form sonification should be rendered in chunks or server-side. Remotion completes the loop: `getAudioData()` loads a source and, since v4.0.121, defaults to a fixed 48000 Hz sample rate specifically because the prior `undefined` default "led to undeterministic behavior across devices rendering"; `visualizeAudio({fps, frame, audioData, numberOfSamples})` returns per-frame amplitude arrays; `visualizeAudioWaveform()` does the same tuned for voice; and `useAudioData()` wraps loading in `delayRender()`/`continueRender()` so a frame is never captured before audio data is ready. Remotion can render audio+video to a single MP4 (AAC audio, default 48000 Hz) via `renderMedia()`/`npx remotion render`.

**Gaps.** Nobody has shipped a *linear documentary* that treats sonification as a first-class, frame-synced narrative device (as opposed to accessibility add-on or standalone art). The blocker is workflow: After Effects has no sonification grammar, and the sonification research community targets interactive web/accessibility, not rendered film. Erie + Remotion is the untried bridge.

**Remotion sketch.** Precompute offline: run Erie (or a Tone.js `Tone.Offline()` pass) to produce a `.wav`, plus a JSON array of per-frame feature values (pitch/amplitude/event markers). In Remotion, `<Audio src={wav}/>` for playback; drive the visual layer from the JSON keyed by `useCurrentFrame()`. Because both the audio buffer and the JSON are precomputed deterministically, every render is identical.

### 2. Force-Directed Graph Animation for Video

**Real-world precedents.** Network graphs are a documentary/journalism staple (character-relationship maps, corporate-structure webs, social networks). Filmmaker Magazine notes that outlets like FiveThirtyEight and Vox popularized the data-driven style now expected in documentaries, typically produced in After Effects. Academic work like "GraphDance" (a semantics-driven framework for authoring narrative data videos in graph structure) shows the research community actively formalizing animated-graph storytelling.

**Determinism — fully solved.** This was historically the biggest objection ("the layout looks different every reload," d3 issue #1002). It is now resolved: the official D3 6.0 release notes (released August 26, 2020) state "All built-in forces are now fully deterministic (including 'jiggling' coincident nodes)," and d3-random "includes a fast linear congruential generator for seeded randomness"; `forceSimulation.randomSource` "defaults to a fixed-seed linear congruential generator." Additionally, nodes with unset x/y are initialized "in a phyllotaxis arrangement, so chosen to ensure a deterministic, uniform distribution." Same graph + same seed = pixel-identical layout every time.

**Technical feasibility.** The recommended pattern is a *static* layout: call `simulation.tick()` in a loop with `simulation.stop()` to compute final positions headlessly (d3 docs recommend a web worker for large graphs). For video you can either (a) precompute all node positions per frame and export as JSON, then render in Remotion, or (b) run the simulation to equilibrium and animate the reveal. ForceAtlas2/Gephi and Cytoscape.js are alternatives for very large graphs; d3-force works well below ~10,000 links (cf. the "Leipzig Layout" implementation note).

**Gaps.** The tooling to go from "seeded d3 layout" to "frame-exported MP4" isn't packaged — practitioners rebuild it each time. Remotion + a headless d3-force tick loop closes this, but no off-the-shelf component exists.

**Remotion sketch.** In a Node build step, run `forceSimulation(nodes).force(...).stop()`, then `for (let i=0;i<300;i++) simulation.tick()`, capturing `nodes.map(n=>({x,y}))` per tick into a frames array. Save as JSON. In Remotion, read the JSON and interpolate node positions by `useCurrentFrame()`, drawing SVG lines/circles. Seed via `.randomSource()` for reproducibility.

### 3. Timeline-as-Data Visualization

**Concept.** Make the timeline itself the visualization — waveform/histogram/density of content mapped along the scrubber — so structure becomes legible (dense = climax, sparse = breathing room). This is the "musicalization of structure."

**Precedents.** The aesthetic is native to audio/video editors: Ableton Live's arrangement view, and every NLE's waveform track. In dataviz this is the "annotated timeline / density strip" pattern. Remotion is unusually well-suited because it *is* a timeline abstraction driven by frame number, and its media-utils package ships `getWaveformPortion()` and `createSmoothSvgPath()` (turn waveform points into a smooth SVG path) — the exact primitives for rendering a data-timeline.

**Determinism.** Trivial — a pure function of precomputed data arrays and `useCurrentFrame()`. No physics, no randomness.

**Gaps.** More a design convention that hasn't been named/standardized than a technical gap. The blind spot: film editors think of the timeline as a *tool*, not as *content to show the viewer*.

**Remotion sketch.** Precompute a density array (events-per-second, or transcript word-density). Render a horizontal strip with bars whose height = density; overlay a playhead at `useCurrentFrame()/durationInFrames * width`. Use `createSmoothSvgPath()` for a waveform-style envelope. Optionally sync a low bass drone whose amplitude tracks density (see idea #8).

### 4. Constraint-Based Animation

**Precedents & tools.** Constraint solving underpins UI layout more than motion design. The **Cassowary** linear-arithmetic solver (Borning, Marriott, Stuckey, Xiao, UIST 1997) is the canonical example — it became Apple's Auto Layout in OS X Lion (2011) and iOS, and inspired Grid Style Sheets and Android's ConstraintLayout/MotionLayout. In the video/motion space, **Autograph** (by Left Angle, the team behind Natron; distributed by Maxon and free even for studios as of 2026) is the notable "next-gen" tool with a "relative definition system" and native responsive-design workflow — render one composition to multiple formats/aspect ratios from a single file, connecting external CSV data to automate content. Animation-synthesis research (e.g., performance-capture solvers) uses velocity/acceleration constraints to guarantee temporal continuity between frames.

**Feasibility & tradeoffs vs. keyframes.** Constraints excel at *responsive* and *relational* layout ("keep this label beside that node; keep everything inside the safe area") where keyframing every variant by hand is intractable. Keyframes remain better for expressive, hand-authored motion. The Sparkles analysis notes Cassowary is "overkill" for one-shot static layout (a batch LP solver would do) but that its incremental architecture turns per-update cost "from O(constraints) into O(touched-constraints)" — a major win when layouts are re-solved every frame (animation, resize, scroll).

**Determinism.** A linear solver like Cassowary is deterministic given the same constraint system and priorities; the caution is that under-constrained systems can have multiple valid solutions, so you must fully constrain (or fix priorities) to guarantee identical output across renders.

**Gaps.** No mainstream code-first video tool exposes a constraint solver as the animation primitive. You'd wire kiwi.js (a Cassowary port) into Remotion yourself.

**Remotion sketch.** Import kiwi.js; per frame, build a constraint system from the data (element sizes, non-overlap, safe-area, aspect ratio), solve, and read out x/y/size for each element. Because the solve is deterministic, the frame is reproducible. Use `useCurrentFrame()` to animate the *constraints* (a target value easing over time) rather than the positions directly.

### 5. Provenance Visualization — Chain of Custody

**Precedents.** Investigative journalism already documents "how we know this": ProPublica's "Methodology / How We Analyzed" companion articles (e.g., the HIPAA privacy-violation analysis describing OCR/Tabula parsing of 5,000+ pages, or the linear-regression methodology in their Educational Opportunity Project) are the gold standard, and ProPublica has published an explicit AI-use disclosure policy ("If AI plays a meaningful role... we will clearly disclose its use to our audience"). Academic citation networks are the other precedent. But these are static prose or static graphs — none animate the chain source → quote → verification → conclusion.

**Micro + macro annotation grammar.** The **rough-notation** library (by the RoughJS author) provides animated, hand-drawn annotations — underline, box, circle, highlight, strike-through, bracket — at 3.8 kB gzipped, with `annotate()` and `annotationGroup()` for ordered reveals and configurable `animationDuration`. This handles *micro* annotation (highlighting a specific quote/word). A *macro* grammar (the overall chain structure) would be a separate layout layer (a DAG of evidence nodes). Layering them: rough-notation for the "this specific fact" emphasis, a force/tree layout for the "here's the whole evidence graph" view.

**Determinism.** rough-notation uses RoughJS, which has inherent randomness in its sketchy strokes — but RoughJS accepts a `seed` option, so with a fixed seed the hand-drawn look is reproducible. This must be set explicitly or each render's "roughness" differs.

**Gaps.** The clearest greenfield: no code-first "provenance grammar" exists that animates a verification chain with layered micro/macro annotation. The blocker is that it requires a data model of evidence (claims, sources, verification steps) that journalism tools don't standardize.

**Remotion sketch.** Model evidence as a typed DAG (nodes: source, quote, verification, conclusion; edges: "supports"/"contradicts"). Lay out with d3-hierarchy or seeded d3-force. Reveal nodes sequentially by `useCurrentFrame()`; as each connects, fire a seeded rough-notation annotation on the relevant text. Keep RoughJS `seed` fixed.

### 6. Interactive/Branching Linear Video

**Precedents.** Netflix's *Black Mirror: Bandersnatch* (2018) is the landmark, built with bespoke tooling called **Branch Manager** — a story-map that was "translated into a computer-readable spreadsheet that Netflix's engineers used to implement the film," with branching handled by "state tracking" and componentized/IMF media delivery. Earlier interactive documentaries include *Journey to the End of Coal*, *Bear 71* (NFB), and *The Boy in the Book / Choose Your Own Documentary* (Nathan Penlington), plus platforms like Eko, Stornaway.io, Twine (authoring), and Mindstamp (branching video hosting). YouTube's *A Heist with Markiplier* is another mass-audience example.

**The cautionary tale (critical).** Netflix has now *abandoned* the format. In early November 2024, Netflix confirmed to The Verge it would remove most interactive titles; on December 1, 2024 it delisted 20 of 24 titles, with spokesperson Chrissy Kelleher stating: "The technology served its purpose, but is now limiting as we focus on technological efforts in other areas." The four survivors were pulled through 2025 — *Ranveer vs. Wild* and *You vs. Wild* in January 2025, and the final two, *Bandersnatch* and *Kimmy vs. the Reverend*, on May 12, 2025 (Variety: "UPDATE, May 12, 6:01 a.m. PT: Netflix has removed 'Black Mirror: Bandersnatch' and 'Unbreakable Kimmy Schmidt: Kimmy vs the Reverend' from the streaming service") — ending Netflix's interactive era entirely. The lesson: branching video's failure mode is the ongoing engineering/maintenance burden and player-support cost, not the authoring concept. A code-first approach that renders to *standard* formats (not a proprietary player) directly mitigates this.

**Export formats — the real technical gap.** OpenTimelineIO (OTIO, Academy Software Foundation) is the modern interchange format — "a modern EDL" with an API — but it models *linear* editorial cuts (clips, tracks, transitions, markers, metadata; media referenced externally). Branching is fundamentally a directed acyclic graph; Wikipedia's NLE entry notes EDLs are "pointer-based playlists" while a DAG is used for still-image edits. OTIO does not natively privilege a narrative DAG, and EDL cannot represent branches at all. The open problem is a data model that is *simultaneously* renderable to (a) a linear MP4 (pick a default path) and (b) an interactive web player (the full DAG).

**Determinism & feasibility.** Rendering each *path* deterministically is easy in Remotion (each path is a linear composition). The hard part is authoring the DAG once and emitting both outputs — a solvable engineering problem, but you must build the intermediate format.

**Remotion sketch.** Represent the story as a JSON DAG (nodes = scenes with `durationInFrames`; edges = choices). For linear MP4: topologically pick a default path, concatenate scene `<Sequence>`s, render. For web: ship the same JSON to a Remotion Player-based front end that swaps the active scene on user choice. One source of truth, two renderers.

### 7. Responsive/Adaptive Animation

**Academic foundation.** The key paper is Schöttler, Dykes, Wood, Hinrichs & Bach, "Constraint-Based Breakpoints for Responsive Visualization Design and Development," IEEE Transactions on Visualization and Computer Graphics, vol. 31, no. 9 (2025), pp. 4593–4604, DOI 10.1109/TVCG.2024.3410097 (arXiv 2409.01339). Its insight directly answers the "adapt, not just resize" question: conventional breakpoints are "static, pre-defined widths" that "do not account for changes to the visualized dataset." Constraint-based breakpoints instead "evaluat[e] visualization-specific constraints on the size of visual elements, overlapping elements, and the aspect ratio of the visualization and available space" — so a viz adapts to *any dataset* at *any size* without manual breakpoint updates. Demos cover choropleth maps, cartograms, node-link diagrams, and scatterplots (responsive-vis.github.io/breakpoints).

**Precedents in tooling.** Vega-Lite and Plotly support responsive specs; D3 has responsive patterns; Autograph markets a native responsive-design/multi-format workflow. The novel move for video is making animation *itself* adapt to data volume — e.g., a network with 20 nodes gets a labeled node-link diagram, one with 2,000 gets an adjacency matrix, from the same spec.

**Determinism.** Deterministic per (dataset, target size) — the constraint evaluation is a pure function of inputs. This is a strength: you can render a mobile 9:16, a 16:9 1080p, and a 4K version from one composition, each reproducible.

**Gaps.** Remotion supports arbitrary compositions/dimensions but has no built-in constraint-breakpoint layer; you'd port the Schöttler approach. Nobody has combined data-adaptive breakpoints with rendered video output.

**Remotion sketch.** Define a "view stack" (designs for small/medium/large + data-density thresholds). At composition setup, evaluate constraints (element size, overlap, aspect ratio) against the actual data and target dimensions; pick the design that satisfies them. Render each target size as a separate Remotion composition sharing the data.

### 8. Temporal Layering — Multiple Timescales Simultaneously

**Perceptual foundation.** Vision science supports showing fast + slow together: temporal integration operates across timescales "from less than a quarter of a second" to "multiple seconds or even minutes" (ScienceDirect review, 2025), and recent work (eLife 2025; PLOS Biology 2025) identifies distinct attention-dependent vs. attention-independent mechanisms operating "across all scales." This is the scientific basis for using opacity/focus/blur to separate a slow trend from daily noise — the perceptual system genuinely processes concurrent temporal regularities.

**Sound as temporal anchor.** The idea's own hypothesis — slow bass = long trend, high frequency = daily noise — maps cleanly onto Erie's overlay composition (idea #1) and onto the natural-sound parallelism Hoque et al. exploit in "Susurrus" (humans can attend to multiple simultaneous natural sounds). A genuinely novel, well-grounded combination.

**Determinism.** Fully deterministic — layered precomputed data + opacity/blur as a function of `useCurrentFrame()`, plus an offline-rendered multi-layer audio bed.

**Gaps.** Untried in linear documentary. The blind spot is that film grammar defaults to *one* timescale per shot (either a montage-fast cut or a slow drift), rarely both encoded simultaneously with sound as the disambiguator.

**Remotion sketch.** Layer 1: slow-moving trend line at full opacity, thick stroke, paired with a low-frequency Tone.js drone whose pitch tracks the trend. Layer 2: high-frequency daily noise as thin, semi-transparent, slightly blurred marks, paired with high-frequency ticks. Both driven by `useCurrentFrame()`; audio precomputed via `Tone.Offline()`. Use CSS `filter: blur()` and opacity to push noise "behind" the trend.

## Recommendations

**Stage 1 — Ship the two lowest-risk, highest-novelty ideas first (weeks, not months):**
1. **Timeline-as-data (#3)** and **temporal layering (#8)**. Both are pure functions of precomputed data + `useCurrentFrame()`, have zero determinism obstacles, and use Remotion primitives (`getWaveformPortion`, `createSmoothSvgPath`) that already exist. Build these to establish the code-first pipeline.
2. **Sonification (#1)** as the flagship differentiator. Adopt Erie for the sonification grammar (don't hand-roll Tone.js scaling), render audio offline to `.wav` + per-frame JSON, sync in Remotion. Benchmark: a 2–3 minute segment where the soundtrack is authored first (Audio Universe model) and visuals follow.

**Stage 2 — Add the deterministic graph + provenance layer:**
3. **Force-directed graphs (#2)** via a headless seeded d3-force tick loop exported to JSON. This is a solved determinism problem; the only work is packaging.
4. **Provenance chains (#5)** — the biggest greenfield. Build a small evidence-DAG data model + seeded rough-notation micro-annotation. This is your defensible IP.

**Stage 3 — Adopt constraint-based responsive rendering:**
5. Port **Schöttler et al.'s constraint-based breakpoints (#7)** and optionally **kiwi.js/Cassowary constraint animation (#4)** so one composition renders 9:16, 16:9, and 4K deterministically and adapts to data volume. Threshold to prioritize: only build this once you're delivering to ≥3 aspect ratios regularly.

**Stage 4 — Approach branching video (#6) with extreme caution.** Build it only as a JSON-DAG that renders a *linear MP4 by default* and *optionally* powers a Remotion Player web experience. Do **not** invest in a proprietary interactive player. **Kill-criterion:** if branching authoring/maintenance exceeds ~20% of production time or requires a bespoke player, stop — that is precisely the trap Netflix fell into.

**Cross-cutting benchmarks that would change the plan:**
- If Tone.js offline rendering can't handle your segment lengths in-browser (>~2 min, per issue #436), move sonification rendering server-side or chunk it.
- If d3-force layouts exceed ~10,000 links, switch to ForceAtlas2/Gephi headless or Cytoscape.js.
- If you need multiple aspect ratios before Stage 3, pull constraint-based breakpoints forward.

## Caveats

- **Determinism requires explicit configuration, not defaults.** d3-force is deterministic only if you don't reseed; RoughJS/rough-notation is reproducible only with a fixed `seed`; Remotion audio is deterministic only at v4.0.121+ (fixed 48000 Hz). Each must be pinned.
- **Tone.js offline rendering has a hard practical ceiling in-browser** (issue #436: multi-minute renders "not feasible," block the UI thread, and OfflineAudioContext can't run in a web worker). Plan for server-side or chunked rendering for long-form.
- **Remotion licensing is not open-source.** It is source-available with a free tier for individuals/small teams and a paid company license for larger businesses — a real cost/compliance factor for a studio.
- **Branching video's failure is documented and recent.** Netflix's own retreat (Dec 2024 – May 2025) should temper enthusiasm; the format's risk is maintenance and audience fatigue, not feasibility.
- **The academic-to-film gap is the core reason these are unshipped.** The techniques exist in HCI/dataviz research (CHI, IEEE TVCG) and in web tooling, but documentary production lives in After Effects. This is an integration opportunity, but it means limited off-the-shelf tooling — expect to build glue code for every idea except #1 (Erie) and #3/#8 (Remotion primitives).
- **One low-quality source flagged:** a 2026 comparison blog claiming Remotion does "no audio waveform analysis" contradicts the official `visualizeAudio`/`visualizeAudioWaveform` docs and should be disregarded; Remotion is a generation/rendering tool, not a footage editor, which is the accurate distinction.
- **Some cited perceptual-science papers are very recent (2025) articles;** the multi-timescale processing consensus is well-established, but specific dual-mechanism claims are still settling.
- **One source-attribution note:** the "7 pulses per second" light-curve quote describes the pulsar wind nebula MSH 15-52 (Chandra, Feb 28, 2024), not IC 443/the Jellyfish Nebula, whose sonification is instead a top-down brightness scan.