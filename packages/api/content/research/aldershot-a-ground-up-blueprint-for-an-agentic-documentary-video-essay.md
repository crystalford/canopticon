---
id: aldershot-a-ground-up-blueprint-for-an-agentic-documentary-video-essay
title: "ALDERSHOT: A Ground-Up Blueprint for an Agentic Documentary & Video-Essay Engine"
kind: "Build brief"
topic: "Prices & markets"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-f8890680-d9b0-5e8a-844b-32b5ea91505b_text_markdown.md"
---

# ALDERSHOT: A Ground-Up Blueprint for an Agentic Documentary & Video-Essay Engine

## TL;DR
- **Build a "script-is-the-timeline" documentary engine orchestrated by a crew of specialized agents**, where the highest-value investment is the research→script quality layer (STORM-style multi-perspective research + Dramatron/Re3/DOC hierarchical drafting + evaluator-optimizer critique loops), NOT the footage-matching layer. The authored script and visual direction are the moat; the editor and clipping tools are commodity plumbing you should assemble from open source.
- **The technical stack is achievable cheaply on Cloudflare**: a browser-based WebCodecs+WebGPU text editor (leverage Remotion/mediabunny/WebAV rather than building from scratch), OTIO/FCPXML export to DaVinci Resolve, agents as Durable Objects coordinated by Workflows, and R2's zero-egress storage as a structural cost advantage. Per-video AI cost can be driven under ~$1–3 with model routing, prompt caching (90% discount on cached reads), and Cloudflare Workers AI for bulk STT/embeddings.
- **Undercut Descript with a flat, media-minute-generous, bring-your-own-key-capable model** — Descript's September 23, 2025 shift to metered "media minutes" + AI credits is its weak flank. Bake in journalism ethics (SPJ principles, Archival Producers Alliance GenAI guidelines, YouTube synthetic-content disclosure) as first-class system objects, not afterthoughts — both an ethical necessity and a market differentiator for an investigative-journalism tool.

## Key Findings

1. **The best video essays win on research depth and narrative architecture, not visuals.** LEMMiNO, Hbomberguy, Folding Ideas, and Defunctland succeed through curiosity-loop structure, mystery-novel pacing, and exhaustively sourced argument — all machine-encodable as a "craft rulebook" of structural rules, not aesthetic guesses.
2. **Multi-agent architecture helps here specifically because documentary production decomposes into genuinely independent roles** (research, fact-check, visual direction, sound) — the exact condition Anthropic found makes multi-agent worth its ~15× token cost. It must be an orchestrator-worker hierarchy with human-in-the-loop gates and an evaluator-optimizer critique loop, not an autonomous free-for-all.
3. **A browser-first WebCodecs/WebGPU editor is now viable and cheap**, and mature open-source building blocks (Remotion, mediabunny, WebAV, ffmpeg.wasm, OpenTimelineIO) mean you should assemble, not reinvent. CRDTs (Yjs) over Durable Objects give collaboration and undo for near-free.
4. **Cost engineering decisively favors this build**: Cloudflare Workers AI Whisper at $0.0005/audio-minute, embeddings at $0.008–$0.015/1M tokens, and R2's zero egress make the per-video floor trivial; the real spend is frontier-LLM script/critique passes, which prompt caching and batching cut by 50–90%.
5. **Generative-AI ethics is now regulated territory**: YouTube's mandatory altered/synthetic disclosure (fully enforced May 21, 2025) and the Archival Producers Alliance Best Practices define hard constraints the system must enforce automatically, especially for an investigative-journalism product.

## Details

### 1. The Craft Rulebook (machine-encodable principles)

**Documentary theory as the type system.** Bill Nichols' six modes (poetic, expository, observational, participatory, reflexive, performative) from *Introduction to Documentary* should be a first-class enum on every project: the chosen mode(s) constrain block selection, narration style, and visual grammar. A Ken Burns–style historical piece is expository (authoritative VO, archival stills, music); an Adam Curtis piece is poetic/reflexive (archival collage, associative juxtaposition); a personal investigation is participatory/performative. Nichols explicitly notes modes blend and a dominant mode "does not dictate every aspect" of a film's organization, so model this as weighted tags, not a single hard category.

**Walter Murch's Rule of Six** (*In the Blink of an Eye*) becomes the editor's cut-scoring rubric, weighted exactly as Murch ranks them: Emotion (51%), Story (23%), Rhythm (10%), Eye-trace (7%), Two-dimensional plane of the screen (5%), Three-dimensional continuity (4%). Every candidate cut the Editor agent proposes gets scored against these six, with emotion dominant — crucially, this tells the agent when to *break* continuity for emotional truth, which is what separates authored editing from mechanical assembly.

**Sheila Curran Bernard's *Documentary Storytelling*** supplies the "find the story" doctrine: nonfiction needs character, stakes, conflict, and an arc, not just information. Encode as required narrative-spine fields (protagonist/POV, central dramatic question, stakes, complication, turn, resolution).

**Retention/hook craft** distilled from the exemplars and the YouTube-craft literature:
- **Curiosity-gap / open-loop structure** (LEMMiNO's "mystery novel" method): every segment answers one question while opening another. Encodable as a graph constraint — each block must either open or close a named "loop," and no loop stays open past a maximum span.
- **Hook taxonomy** (eight working patterns: curiosity gap, bold/contrarian claim, proof/result-first, story cold open, question, pattern interrupt, listicle, tutorial). Hook length scales with format: ~5–15s for standard long-form with the payoff-promise landing by ~second 8; 15–30s (never >45s) for long essays.
- **In-medias-res openings** (Johnny Harris: "It started with the murder of their prophet in Illinois") and visual-anchor-before-context framing.
- **Change every 3–5 seconds** — a new shot, zoom, graphic, or SFX — to prevent visual/audio flatlining (a documented drop-off driver is static talking-head over the opening 30s).
- **Writing for the ear**: short spoken sentences, one idea per breath, front-loaded subjects, concrete nouns.

**Per-creator craft profiles.** Rather than one rulebook, ship encodable "style presets" derived from the exemplars: LEMMiNO (slow-burn mystery, sparse narration, deep research), Johnny Harris (kinetic maps, personal-quest framing, focal-length intimacy), Nerdwriter/Every Frame a Painting (visual analysis, essay-on-image), Folding Ideas/Hbomberguy (long-form argument, deadpan, receipts-on-screen), Kurzgesagt (motion-graphics explainer — needs no synthetic disclosure since clearly animated), Defunctland/Summoning Salt (historical-arc with musical build), Wendover/Vox (data-viz + map explainer), Adam Curtis (archival collage/associative), Errol Morris (Interrotron direct-address interview + stylized reenactment), Ken Burns (stills + Ken Burns move + letters-as-VO), Asif Kapadia (all-archival, no talking heads). Each preset parameterizes: narration density, shot-length distribution, VO-vs-oncam ratio, music role, graphic style, and archival strategy. A McLuhan note where genuinely useful: the tetrad (what a medium enhances/obsolesces/retrieves/reverses) is a productive *editorial-angle generator* for the Researcher agent when finding a thesis on any media/technology subject — offer it as an optional lens, not a forced frame.

### 2. The Agent Crew (orchestrator-worker mapped to a real production crew)

Anthropic's own guidance is the design authority. Two hard lessons: (a) multi-agent systems cost ~15× the tokens of a chat and only pay off when the task decomposes into independent parallel threads and its value is high; (b) their research system used an orchestrator (Opus 4 lead) delegating to parallel workers (Sonnet 4) and, per Anthropic's post *How we built our multi-agent research system*, that setup "outperformed single-agent Claude Opus 4 by 90.2% on our internal research eval," with token usage explaining roughly 80% of the performance variance on their BrowseComp evaluation. Documentary production is a near-ideal fit because roles are genuinely separable.

**Architecture: orchestrator-worker + evaluator-optimizer + human gates.**

- **Executive Producer / Showrunner (Orchestrator)** — Opus-class. Owns the project plan and state, decomposes the piece into stages, delegates to workers, runs quality gates, manages human approval checkpoints. Persists plan to durable storage early (Anthropic's "externalize state before context fills" lesson — the lead saves its plan to memory before the context window is at risk of truncation past ~200K tokens).
- **Researcher** — runs the STORM/Co-STORM multi-perspective research loop (below). Output: sourced research dossier (claims + citations + perspectives).
- **Archival Researcher/Producer** — finds primary sources, archival footage/stills, rights status. Output: exhibit candidates with provenance and clearance metadata.
- **Fact-Checker** — extracts atomic claims, verifies each against sources, flags unverifiable claims. Output: claim ledger with verification status and source links.
- **Story Producer/Writer** — hierarchical draft (Dramatron/Re3/DOC method): logline → beats → outline → block-level script.
- **Script Doctor/Critic (Evaluator)** — LLM-as-judge scoring against the craft rubric; loops with the Writer (evaluator-optimizer) until thresholds met or human intervenes.
- **Director** — shot-by-shot visual direction and storyboard; assigns block types and visual treatments.
- **Assistant Editor/Logger** — transcribes, logs, and vector-indexes all footage/media (transcript + visual embeddings).
- **Editor** — assembles the rough cut against Murch's Rule of Six; proposes reviewable timeline diffs.
- **Sound Designer + Music Supervisor** — room tone, SFX, ducking, loudness, music selection/generation with licensing checks.
- **Motion Graphics/Map Designer** — kinetic typography, data-viz, maps (Remotion/Motion Canvas templates).
- **Narration/VO Coach** — rewrites for spoken delivery; drives teleprompter and TTS/host-record.
- **Clearance & Legal (E&O-style)** — rights, fair-use/fair-dealing analysis, attribution.
- **Standards & Practices / Ethics** — SPJ principles, disclosure labels, corrections.
- **Shorts/Clips Producer** — derives short-form from the structured script (below).

**Handoff artifacts as JSON schemas.** Every handoff is a typed, validated document (validate at each gate — Anthropic's "gates between steps" pattern). Example block model:

```json
{
  "block_id": "b012",
  "type": "PRIMARY_EXHIBIT",           // NARRATION|HOST_ONCAM|REACTION|PRIMARY_EXHIBIT|B_ROLL|DOCUMENT|GRAPHIC|MUSIC
  "script_text": "The memo, dated March 3rd, contradicts the official timeline.",
  "narrative_role": "complication",
  "loop": {"opens": "what_did_they_know", "closes": null},
  "documentary_mode": ["expository","participatory"],
  "claims": ["c045"],                    // links to claim ledger
  "exhibits": [{"asset_id":"a231","provenance":"NARA RG59","rights":"public_domain","disclosure":null}],
  "visual_direction": {"treatment":"document_highlight","motion":"push_in","duration_s":6.5},
  "audio": {"vo": true, "music_bed":"tension_low", "duck_db": -12},
  "human_approved": false
}
```

**When multi-agent hurts:** for tightly coupled sub-tasks (e.g., fine-grained continuity editing where every agent needs the same shared context)\[1\] prefer a single agent or a Workflow with deterministic steps. Anthropic itself notes most coding-style tasks with heavy interdependencies are poorly suited to multi-agent. Reserve the full crew for the decomposable, high-value stages (research, script, visual direction).

**Cloudflare implementation.** Each agent is a Durable Object via the Cloudflare Agents SDK (persistent per-project state, embedded SQL storage, single-writer correctness, hibernation when idle — millions can exist at ~zero idle cost). Long, multi-step, retriable jobs (transcription, render, batch verification) run as Cloudflare Workflows (`step.do()` persists each step and resumes from the last success on failure; you pay for active compute, not wall-clock — ideal for hour-long renders). The Agents SDK now supports sub-agents (`subAgent()`), typed RPC, and (as of 2026, in preview) Project Think durable-execution primitives (fibers, `stash`, `onFiberRecovered`); treat those as a directional bet, not a foundation. MCP servers expose tools (search, archive APIs, render) to agents. The Claude Agent SDK can drive the reasoning-heavy roles.

### 3. The Research + Script Quality Engine (the most important layer)

This is where "not generic" is won. Pipeline stages:

**Stage A — Multi-perspective research (STORM/Co-STORM).** STORM's core insight: the bottleneck is *asking good questions*, and direct prompting yields shallow ones. Its fix — perspective-guided question asking (survey related articles to discover distinct expert perspectives) + simulated conversations between a "writer" and a grounded "expert." In the Stanford STORM paper (Shao et al., arXiv:2402.14207), human evaluation by ten experienced Wikipedia editors (each with 500+ edits and 1+ year of experience) found "more of STORM's articles are deemed to be organized (by a 25% absolute increase) and broad in coverage (by 10%)." Co-STORM adds a moderator agent and a human-in-the-loop discourse protocol. Implement as parallel "perspective" sub-agents (each a different expert lens on the topic) interrogating grounded sources, then curate into an outline — a natural fit for Cloudflare parallel workers.

**Stage B — Primary-source & OSINT verification.** For investigative work, layer Bellingcat-style OSINT verification (geolocation, chronolocation, cross-source corroboration, reverse image search) and a claim-extraction→verification loop. Each atomic claim gets: source(s), verification status, confidence, and a "needs human" flag. The Fact-Checker runs as an evaluator over the Writer's draft.

**Stage C — Story-finding & argument mapping.** Build an explicit argument map (thesis, sub-claims, evidence, counter-arguments) and a narrative spine (protagonist/POV, central dramatic question, stakes, arc). This is the difference between an essay and a listicle.

**Stage D — Hierarchical drafting (Dramatron + Re3 + DOC).** Dramatron's hierarchical prompt-chaining (logline → characters → beats → descriptions → dialogue) solves the long-range coherence that flat generation can't, generating scripts far beyond 1,000 words from a single logline. Re3's Plan-Draft-Rewrite-Edit modules and DOC's detailed-outliner + detailed-controller add coherence over thousands of words. For Aldershot: logline → narrative spine → beat sheet → block-level outline → block drafts, each stage grounded in the research dossier and claim ledger.

**Stage E — Style emulation.** Fine-tune-free voice matching: embed the creator's past scripts, retrieve exemplar passages, and few-shot the Writer with them; maintain a per-creator style card (sentence length, diction, rhythm, signature moves).

**Stage F — Evaluator-optimizer critique loop.** The Script Doctor scores against a rubric and returns targeted diffs; the Writer revises; loop until thresholds or a human gate. Rubric dimensions (1–5 each, with anchored descriptions): thesis clarity, evidence sufficiency, source quality, narrative tension (loop discipline), hook strength, spoken-delivery quality, originality/non-genericness, factual-verification coverage, ethical/disclosure compliance.

**Human-in-the-loop is mandatory at:** research-dossier sign-off, thesis/angle approval, final-script approval, and any unverified-claim or synthetic-asset decision. Everything the agent proposes is a reviewable diff on the block document — never an autonomous overwrite.

### 4. Visual Storytelling & the Director Layer (avoiding "stock-footage slop")

**Authored visual direction, not tag-matching.** The Director agent generates a shot list where each block gets an explicit *treatment* (archival still with Ken Burns move; document highlight/push-in; map build; kinetic type; reenactment; data-viz; visual metaphor; match cut into next block) plus visual-variety constraints (no two adjacent blocks share a treatment; recurring visual motifs tracked across the piece). This is what makes it feel directed rather than assembled.

**Multimodal clip judging.** Use video-understanding models to score candidate clips for semantic relevance, tone, composition, and quality, and to "watch" and critique the rough cut. Twelve Labs' Marengo (multimodal embeddings in a unified any-to-any vector space; Marengo 3.0 launched late 2025 with hour-long video support) and Pegasus (video-language reasoning over long clips) are purpose-built for this; Gemini video understanding and Claude vision are alternatives. Index all footage as embeddings in Vectorize for transcript+visual semantic search (the Assistant Editor's job). A vision model acting as a rough-cut critic closes the loop: it flags dead air, mismatched tone, jump cuts, and pacing problems — mirroring LAVE's use of VLM-generated footage descriptions as the substrate for LLM editing decisions.

**Generative video (Veo, Sora, Runway, Kling) — capability, cost, ethics.** Approximate 2026 per-second API costs: Kling 3.0 ~$0.10/sec (cheapest premium), Runway Gen-4.5 ~$0.15/sec, Veo 3.1 Fast ~$0.15/sec / Standard ~$0.75/sec (native 4K + audio), Sora 2 ~$0.10–0.50/sec. Use gen-video sparingly and ethically: **only for clearly-labeled illustration/recreation, never to fabricate evidence.** The Archival Producers Alliance *Best Practices for Use of Generative AI in Documentaries* is the governing standard — endorsed by the IDA, POV, Firelight Media, Catapult Film Fund, Impact Partners, BIPOC Film & TV (Canada), A-DOC, the Documentary Producers Alliance, the Alliance of Documentary Editors, Kartemquin, DC/Dox, the D-Word and WITNESS, plus 50+ individual filmmakers including Ken Burns and Peter Nicks; the APA itself represents 300+ archival producers. It prioritizes real primary sources; internal and audience transparency; cue sheets for all GenAI elements; listing AI-generated content in credits like archival/music; and avoiding fabricated assets that could be mistaken for the real historical record. **YouTube's altered/synthetic disclosure rule** (announced March 18, 2024; mandatory disclosure fully live May 21, 2025) requires the "Altered or synthetic content" label whenever realistic content could mislead a viewer into thinking a real person/place/event was real — but explicitly NOT for clearly-animated, VFX, or production-assistance AI (script/idea generation). Aldershot must auto-generate a disclosure recommendation and cue sheet from asset metadata, and block export of undisclosed realistic synthetic content depicting real people/events.

### 5. Editing Intelligence & Sound

**Text-driven editing lineage.** The academic foundation: Fried et al. (SIGGRAPH 2019) text-based editing of talking-head video (edit the transcript, an optimization stitches matching segments — though its face-synthesis component raises the deepfake ethics Aldershot should NOT replicate for real people without disclosure); Leake et al. (2017) computational editing for dialogue-driven scenes using film-editing "idioms"; B-Script for automatic B-roll insertion; Write-A-Video; and the 2024 LLM-agent wave — LAVE (a plan-and-execute LLM agent with VLM-generated footage descriptions and user approval at each step) and ExpressEdit (natural language + sketching, parsing temporal/spatial/operational references). Aldershot's Editor should follow LAVE's plan-and-execute-with-approval pattern.

**Rough-cut algorithm.** Because the script is the timeline, assembly is largely deterministic: each block maps to its selected exhibit/clip with the Director's treatment and duration. The intelligence is in: best-take selection (from multiple host recordings, scored on fluency/energy/eye-contact), filler/silence/breath removal (transcript-driven), J/L cuts (audio leads/trails picture), cutting on rhythm/beat, and continuity checks — all scored through the Murch Rule-of-Six rubric.

**Sound.** Room-tone fill, SFX per transition/emphasis, adaptive music ducking (e.g., −12 dB under VO), loudness normalization to platform targets (−14 LUFS for YouTube). **AI music licensing (2025–2026) is unsettled but clarifying:** the RIAA sued Suno & Udio (June 2024); Universal settled with Udio (October 2025); Warner settled with Udio (Nov 19, 2025) and became "the first major record label" to settle with Suno (Nov 25, 2025); Universal and Sony remain in litigation with Suno, with a pivotal fair-use ruling expected around mid-2026. Practical rule for Aldershot: paid-tier Suno/Udio grant *commercial-use rights* but NOT guaranteed copyright (the US Copyright Office requires meaningful human authorship); free tiers are personal-use only. Safer defaults: licensed libraries, Creative Commons, or human-composed music. Track music provenance and license in the block model. ElevenLabs (music + TTS) and Stable Audio are alternatives with their own terms.

### 6. The Clipping Layer (Opus Clip-style, but native)

**Aldershot's structural advantage: it already has the block script.** Opus Clip's "ClipAnything" performs four-dimensional analysis (visual frames, audio sentiment, facial expression, emotional peaks) on raw footage precisely because it has no script to work from. Aldershot derives shorts *natively* from the structured script — self-contained segments (a closed curiosity loop, a strong claim + payoff, a complete story beat) are already marked up, so clip selection is a graph query, not a guess.

**Virality/hook scoring.** Opus Clip's Virality Score (0–99) weights Hook, Flow, Value, and Trend;\[2\]\[3\] clips scoring >70 reportedly outperform <50 by ~3× in engagement (treat as a ranking heuristic, not an oracle — reviewers note ~40% of generated clips get discarded and the single "best" pick often isn't the top performer). Aldershot should score derived shorts on the same axes using script metadata plus a hook-quality LLM judge.

**Mechanics.** Auto-reframe to 9:16 with active-speaker/face/object tracking; animated word-by-word captions (Opus reports 97%+ English caption accuracy);\[4\] platform presets (YouTube Shorts, TikTok, Reels) with correct aspect ratios, loudness, and caption-safe zones. Reuse the same WebCodecs/WebGPU pipeline as the main editor.

### 7. Building the Editor Cheaply (the Descript-alternative core)

**Architecture: browser-first WebCodecs + WebGPU.** WebCodecs gives GPU-accelerated decode/encode in-browser (no server round-trips; CapCut reportedly saw an 83% traffic boost after moving to WebCodecs+WASM). WebGPU handles compositing effects/transitions as shaders. Cross-origin isolation headers (COOP/COEP) are required for high-res `VideoFrame` pixel reads and advanced WebGPU. Discipline: every `VideoFrame` must be explicitly `.close()`d to avoid GC-induced frame drops in the 60fps pipeline.

**Leverage, don't reinvent — recommended open-source building blocks:**
- **mediabunny** — WebCodecs helper (memory management, file I/O, muxing); the ecosystem is consolidating around it (Remotion is phasing out its own `@remotion/webcodecs` in favor of Mediabunny).\[5\] Use for decode/encode/mux.
- **Remotion** —\[6\] React-based programmatic video for motion graphics, lower-thirds, maps, kinetic type, and the final render. **License caveat: Remotion requires a paid company license for teams of 4+** — fine for a solo builder now; budget for it later.
- **Motion Canvas / Revideo** — procedural animation for data-viz and explainer graphics.
- **OpenCut / Omniclip / Twick / openvideodev's react-video-editor** — reference multi-track timeline UIs (drag/trim/split, WebCodecs export, R2/S3 assets) to study or fork.
- **ffmpeg.wasm** — fallback transcode/probe in-browser.
- **OpenTimelineIO** — the interchange spine (below).
- **WebAV** — WebCodecs-based editing SDK.

**Timeline data model: OTIO-native internally.** Store the timeline in an OpenTimelineIO-compatible JSON model (tracks, clips, rational time — `{num, den}` — to avoid floating-point drift). This makes export trivial: **OTIO (.otio/.otioz) imports natively into DaVinci Resolve** and Premiere Pro (25.6+); also emit FCPXML 1.10 and Premiere xmeml for other NLEs (libraries like retime-nle and @chatoctopus/timeline already generate all three from one model). This directly serves the "export to Resolve or render" requirement. Note OTIO's effects support is still limited — pre-render anything OTIO can't describe and flag the export as partial rather than silently dropping it.

**Transcript↔timeline mapping.** Maintain a bidirectional map: each transcript word → media timecode → timeline clip. Editing the text (delete a sentence, reorder) propagates to the timeline; this is Descript's core UX and the Fried et al. transcript-edit model.

**Collaboration & undo via CRDTs.** Use Yjs (or Automerge) for the document (script + timeline), backed by a Durable Object per project (single-writer correctness, WebSocket fan-out, hibernation). CRDTs give real-time multiplayer, offline edits, and undo/redo essentially for free.

**Preview vs. final render.** Client-side WebCodecs for real-time preview and even final export of short pieces; for long/heavy renders, offload to a Cloudflare Container running headless Remotion/ffmpeg as a Workflow step. Use proxy (low-res) media for editing, full-res for final.

**How Descript works under the hood (publicly known):** transcript-first editing where the document is the source of truth and word edits map to the underlying media; Studio Sound, filler-word removal, and Overdub voice cloning are ML features layered on top. Aldershot replicates the transcript-as-timeline paradigm but adds the authored block model and agent crew on top.

### 8. Cost Engineering to Beat Descript

**Descript's weak flank.** Effective September 23, 2025, Descript replaced transcription hours with metered "media minutes" + AI credits, migrating existing users to "Legacy and Sunset" plans. Tiers (per user/month, annual–monthly): Free $0 (60 media minutes, 100 one-time AI credits, watermarked exports); Hobbyist $16–24 (~600 min); Creator $24–35 (~1,800 min, 4K, Studio Sound); Business $50–65 (~2,400+ min). Users complain the dual-meter model makes real costs unpredictable — three separate 10-minute files consume 30 media minutes not 10, still images count as 1 second of media each, unused minutes/credits don't roll over, and top-ups expire 12 months after purchase. This is the opening.

**Per-video AI/compute cost model (illustrative: a 15-min finished essay from ~60 min raw):**

| Step | Unit price (2026) | Est. per video |
|---|---|---|
| Transcription (Cloudflare Workers AI Whisper) | $0.0005/audio-min | ~$0.03 (60 min) |
| Visual indexing (optional, Twelve Labs Marengo) | ~$0.033/min | ~$2.00 (skip unless deep visual search needed) |
| Embeddings (OpenAI 3-small $0.02/1M, or CF $0.008–0.015/1M) | — | <$0.05 |
| Research + script (Sonnet-class $3/$15 per 1M, cached) | caching −90% reads, batch −50% | ~$0.50–1.50 |
| Critique/eval loops (Haiku $1/$5 per 1M for bulk; Sonnet for hard) | — | ~$0.20 |
| Rough-cut critique (vision) | varies | ~$0.10–0.30 |
| TTS (if used) | ElevenLabs $50–100/1M chars; OpenAI tts-1 $15/1M; CF MeloTTS $0.0002/min | $0.03–$2 |
| Storage/egress (R2) | $0.015/GB-mo, **zero egress** | ~$0.05–0.20 |
| Render (Container Workflow) | active compute only | ~$0.10–0.50 |
| **Total** | | **~$1–3/video** (excluding optional Twelve Labs & premium TTS) |

**Minimization strategies:**
- **Model routing**: Haiku ($1/$5), Gemini Flash, or GPT-4o-mini ($0.15/$0.60) for bulk logging, classification, and filler detection; Sonnet ($3/$15) for script and critique; Opus ($5/$25) only for the orchestrator's hardest planning.
- **Prompt caching**: Anthropic cache reads cost ~10% of base input (a 90% discount) — cache the research dossier, style cards, and rubric across all block generations. The Batch API is 50% off for non-interactive passes.\[7\]
- **Cloudflare Workers AI** for all bulk STT and embeddings (free 10,000 Neurons/day, then $0.011/1k Neurons; Whisper $0.0005/min; embeddings $0.008–$0.015/1M tokens).
- **R2 zero-egress** ($0.015/GB-month storage, no bandwidth charges) is the structural moat vs. S3 for a video tool serving large files.
- **Client-side compute**: WebCodecs preview/export and in-browser Whisper (WebGPU)\[8\] push work to the user's device.
- **Bring-your-own-API-key**: let power users plug in their own Anthropic/OpenAI/ElevenLabs keys, removing your marginal AI cost entirely for them.

**Proposed pricing (undercut + sustainable):**
- **Free**: generous non-watermarked short-form + limited long-form, BYO-key for AI features.
- **Creator ~$12–15/mo**: flat, generous media-minutes, a pooled AI allowance sized so typical usage costs you <30% of revenue; no dual-meter confusion.
- **Pro ~$29/mo**: full crew, unlimited projects, higher AI allowance, priority render, Resolve/OTIO export.
- **BYO-key discount** on every tier. Position explicitly against Descript's credit anxiety: "flat, predictable, and you can bring your own key."

### 9. Evaluation & Quality Measurement

**Per-layer automated metrics:**
- **Research depth**: source count/diversity, perspective coverage (STORM-style), primary-source ratio, claim-verification coverage.
- **Factual accuracy**: % claims verified, unverified-claim flags, citation grounding (does each claim trace to a source?).
- **Script craft**: LLM-as-judge rubric (thesis, evidence, tension/loop discipline, hook, spoken-delivery, originality) on anchored 1–5 scales; benchmark against embedded exemplar scripts.
- **Visual relevance**: vision-model semantic match between block intent and selected clip; visual-variety constraint satisfaction.
- **Pacing**: shot-length distribution vs. preset target; loop-span compliance; "change every 3–5s" adherence.
- **Audio**: loudness (LUFS) compliance, ducking correctness, silence/filler residue.
- **Retention prediction**: hook score + open-loop density as a proxy (validate against real analytics over time).

**Agent evaluation practices** (Anthropic): evaluate with small samples + LLM judges early; measure outcomes not paths (embrace non-determinism); build observability first; simulate agent runs in a sandbox to catch failure modes before production. Keep a golden set of the creator's best past videos as regression benchmarks.

### 10. Journalism Ethics & Standards Baked In

**SPJ Code of Ethics** four principles as system objects: Seek Truth and Report It (verification, sourcing), Minimize Harm, Act Independently (disclose conflicts), Be Accountable and Transparent (corrections, explain choices). Each becomes a checklist the Standards agent enforces at gates.

**Concrete mechanisms:**
- **Sourcing transparency**: every claim carries its sources; a public "sources/methods" appendix can be auto-generated.
- **Corrections workflow**: versioned scripts, a corrections log, and the ability to re-export.
- **AI-element disclosure**: auto-generate the GenAI cue sheet (APA Best Practices) and the YouTube altered/synthetic disclosure recommendation from asset metadata; block export of undisclosed realistic synthetic content depicting real people/events.
- **Human-simulation guardrails**: never synthesize a real person saying/doing something they didn't without explicit disclosure and approval (APA + YouTube rule).
- **Canadian context**: the builder is in Ontario, so note fair *dealing* (not US fair use) under the Copyright Act — allowable purposes are research, private study, criticism, review, news reporting, education, parody, and satire, with attribution — plus defamation exposure and the RTDNA Canada and CAJ ethics guidelines as the Canadian analogues to SPJ. Confirm specifics with a media lawyer before publishing investigative work.

## Recommendations (phased build order for Claude Code)

**Phase 0 — Spine (weeks 1–4).** Data model first: the block schema, OTIO-native timeline model, transcript↔timeline map, and the project Durable Object with Yjs CRDT. Ship a bare text-based editor (WebCodecs preview via mediabunny, OTIO/FCPXML export, R2 storage). *Benchmark:* import media → transcript-edit → export a timeline DaVinci Resolve opens cleanly.

**Phase 1 — The script engine (weeks 5–12).** This is the moat — build it before the fancy editor. Implement STORM-style multi-perspective research → claim ledger → hierarchical draft (Dramatron/Re3/DOC) → evaluator-optimizer critique loop, with human gates and reviewable diffs. Orchestrator + Researcher + Writer + Fact-Checker + Script Doctor as Durable Object agents; long jobs as Workflows. *Benchmark:* on a known topic, produce a sourced, non-generic script that beats a single-prompt baseline on the rubric and passes your own eyeball test.

**Phase 2 — Director + assembly (weeks 13–20).** Visual direction, footage vector-indexing (Vectorize), clip judging (Twelve Labs/Gemini/Claude vision), rough-cut assembly scored on Murch's Rule of Six, sound/ducking/loudness. *Benchmark:* a watchable rough cut with authored (not tag-matched) visuals and a vision-model critique pass.

**Phase 3 — Clipping + polish (weeks 21–26).** Native shorts derivation from the block script, 9:16 auto-reframe, animated captions, virality scoring. *Benchmark:* one long piece → a batch of platform-ready shorts.

**Phase 4 — Ethics, disclosure, pricing, launch (weeks 27+).** Wire in SPJ/APA/YouTube-disclosure enforcement as hard gates, corrections workflow, BYO-key, and the flat pricing tiers. *Benchmark:* the system cannot export undisclosed synthetic content, and per-video cost telemetry confirms <$3.

**Thresholds that change the plan:** if per-video frontier-LLM cost exceeds ~30% of a Creator-tier subscription, push harder on routing/caching or default more usage to BYO-key. If multi-agent coherence problems appear or token cost balloons (watch the ~15× multiple), collapse tightly-coupled stages into single-agent Workflows. If Remotion's team license or gen-video costs dominate, prefer Motion Canvas/Revideo and licensed-library footage. If Twelve Labs' ~$0.033/min indexing is too dear, reserve it for projects where deep visual search is core and use cheaper frame-sampling + Claude/Gemini vision otherwise.

## Caveats
- **Speculative/forward-looking items flagged:** Cloudflare "Project Think" durable-execution primitives are in preview (APIs may change); the Sora consumer app is reported to be retiring in 2026 with the API continuing; gen-video prices are volatile and dropping fast. Treat all as directional.
- **AI-music copyright is genuinely unsettled** pending the Suno fair-use ruling expected around mid-2026; paid-tier commercial rights ≠ copyright ownership. Default to licensed/CC/human-composed music for anything you monetize; consult counsel.
- **Deepfake/face-synthesis techniques** (Fried et al. talking-head editing) are technically adjacent but ethically off-limits for real people without disclosure — do not build the "synthesize new words in someone's mouth" feature for journalism.
- **Virality scores are rankings, not predictions** — validate against your own analytics before trusting them.
- **Claude model naming beyond the confirmed 4.x family** could not be verified against Anthropic's official pricing page; use the verified 4.x rates (Opus $5/$25, Sonnet $3/$15, Haiku $1/$5 per 1M tokens)\[7\] and re-check current pricing at build time. Cloudflare's official Workers AI page lists Whisper at $0.0005/audio-minute (41.14 Neurons/min); use that rather than lower third-party figures.
- **Canadian legal specifics** (fair dealing, defamation, CRTC) are noted at a high level; the builder should confirm with a media lawyer before publishing investigative pieces, especially any using AI-generated or archival material.

## Sources

1. [Dissecting the SWE-Bench Leaderboards: Profiling Submitters and Architectures of LLM- and Agent-Based Repair Systems](https://arxiv.org/pdf/2506.17208)
2. [What is the Virality Score on OpusClip? - Opus Clip](https://help.opus.pro/docs/article/virality-score)
3. [Opus Clip Guide 2026 | AI Tool Radar](https://aitoolradar.io/guides/opus-clip)
4. [OpusClip: #1 AI video clipping tool to create viral shorts](https://www.opus.pro/home-a-b)
5. [@remotion/webcodecs | Remotion | Make videos programmatically](https://www.remotion.dev/docs/webcodecs/)
6. [GitHub - snack-dev/browser-studio: The Video Creation Engine: Edit videos with code, featuring the fastest WebCodecs renderer for in-browser video processing. · GitHub](https://github.com/snack-dev/browser-studio)
7. [Anthropic API Pricing in 2026: Complete Guide — Models, Caching, Batch & Optimization](https://www.finout.io/blog/anthropic-api-pricing)
8. [API overview | Remotion | Make videos programmatically](https://www.remotion.dev/docs/api)
