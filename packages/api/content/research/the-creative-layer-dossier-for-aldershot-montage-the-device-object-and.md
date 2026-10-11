---
id: the-creative-layer-dossier-for-aldershot-montage-the-device-object-and
title: "The Creative-Layer Dossier for ALDERSHOT: Montage, the \"Device Object,\" and the Sourcing Engine"
kind: "Build brief"
topic: "AI-directed development"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-b4bf8ea4-6b50-5031-a4f6-10fb4943cd99_text_markdown.md"
---

# The Creative-Layer Dossier for ALDERSHOT: Montage, the "Device Object," and the Sourcing Engine

## TL;DR
- The montage the user described is best modeled as a first-class, reusable **"device object"** — a supercut layer with declared parameters (clip set, count, pacing curve, effect, blend, opacity, audio behavior, entry/exit) that anchors to words or beats and floats over the base cut. This fits Aldershot's no-timeline, "roles not tracks" model cleanly, and the whole catalog of editorial devices (flash montage, match cut, split screen, speed ramp, jump cut, kinetic type) can be expressed as variants of the same object.
- The technology to make **authored, non-junk** montages already exists in research and is feasible on Chris's ffmpeg-in-Containers stack: beat/downbeat detection (librosa, madmom, BeatNet), text-driven montage assembly (Write-A-Video, SKALD, ESA), match-cut discovery (Netflix's WACV 2023 system), shot-type classification (MovieShots/SGNet), aesthetic scoring (LAION), and multimodal retrieval (Twelve Labs Marengo, CLIP/SigLIP). Authorship comes from selection rules — theme, arc, visual rhyme, variety constraints, taste profile, personal-footage-first — not from raw generation.
- The "more clips, more it can do" idea should be built as **shown-not-scored capability**: each device declares what it needs ("a memory montage wants ~8 clips of this kind — you have 5"), and a pull-list/checklist fills in as material arrives. The system can auto-fetch from the user's library and licensed/CC0/public-domain APIs (Pexels, Pixabay, Internet Archive/Prelinger, Wikimedia); it must NOT scrape YouTube (ToS-prohibited), so for platform clips it hands the user a responsible "download-and-upload" instruction grounded in their own fair-use/commentary judgment.

## Key Findings

### 1. Montage is not one thing — it is a family of grammars, and each maps to a decision rule
Soviet montage theory gives five distinct, buildable modes, and they are not interchangeable. Per Eisenstein's *Film Form* (as catalogued by StudioBinder, MasterClass, and Videomaker): **metric** montage cuts on fixed frame-lengths regardless of content (mechanical tension, accelerates by shortening pieces); **rhythmic** cuts on visual continuity/movement within the frame (cut on action); **tonal** cuts on the emotional/tonal register of shots; **overtonal** combines all three for abstract effect; **intellectual** juxtaposes two shots to produce a third idea (the collision). Underlying all of them is the **Kuleshov effect** — viewers derive meaning from the *juxtaposition* of two sequential shots, not from either shot alone (Wikipedia; No Film School). This is the single most important theoretical grounding for an AI editor: **meaning lives in adjacency**, so the system's job in a montage is choosing what sits next to what.

### 2. Walter Murch's Rule of Six gives the AI a rankable objective function
Murch's *In the Blink of an Eye* ranks six criteria for any cut, and crucially assigns weights: **emotion (51%), story (23%), rhythm (10%), eye-trace (7%), planarity/2-D (5%), spatial continuity (4%)**. In Murch's own words (reproduced at the Berkeley i-school blog): "if you are considering a range of possible edits... and you find that there is one cut that gives the right emotion and moves the story forward, and is rhythmically satisfying, and respects eye-trace and planarity, but it fails to preserve the continuity of three-dimensional space, then, by all means, that is the cut you should make... the top of the list—emotion—is worth more than all five of the things underneath it." This is directly usable as a scoring hierarchy: when the AI ranks candidate cuts or montage orderings, it should weight emotional/story coherence far above spatial continuity — the opposite of a naive "smoothest transition" optimizer.

### 3. Computational montage from text is a solved research problem, and shot *ordering* is now learnable
- **Write-A-Video** (Wang et al., ACM TOG / SIGGRAPH Asia 2019, Tsinghua/Beihang/Harvard/IDC) creates montages "using mostly text-editing": the user edits themed text; the tool does "cascaded keyword matching and visual-semantic embedding" to find candidate shots, then "an optimization method assembles the video montage" following cinematographic guidelines. This is essentially Aldershot's "editing is reading" thesis applied to montage.
- **SKALD** (Lu et al., ICCV 2025, Adobe/UCSD/Purdue; arXiv 2503.08010) builds "coherent video sequences from candidate shots with minimal reliance on text"\[1\] via a **Learned Clip Assembly (LCA) score** that "measures temporal and semantic relationships between shots to quantify narrative coherence," searched with beam search. Verbatim results: "SKALD achieves an improvement of up to 48.6% in IoU and a 43% speedup over the state-of-the-art methods. A user study further validates our approach, with 45% of participants favoring SKALD-assembled videos, compared to 22% preferring text-based assembly methods" — where the 22% baseline is specifically CLIP4Clip.
- **ESA** (Chen et al., arXiv 2511.02505, 2025) uses energy-based models to learn assembly *style* from reference videos, extracting "shot size, camera motion, and semantics"\[2\] and scoring candidate sequences by "alignment with reference styles"\[2\] — the computational basis for Aldershot's "cut it like this video" feature.
- **Cinematic-aware shot sequence ordering** (Li, Xu, Tian, Neurocomputing 2026 / arXiv 2503.17975, Shanghai University) formalizes the **Shot Sequence Ordering (SSO)** task with Kendall-Tau distance as the metric and a "Cinematology Embedding" that injects movie metadata and shot labels as prior knowledge.\[3\] Benchmarks released: AVE-Order, ActivityNet-Order, AVE-Meta (code at github.com/litchiar/ShotSeqBench).

### 4. The building blocks for "creative, non-junk decisions" are all available and cheap-ish
- **Beat/rhythm:** librosa (lightweight tempo/beat), madmom (most accurate offline, RNN+DBN downbeat tracking), BeatNet (real-time, sub-50ms). Music structure segmentation (verse/chorus/drop) via MSAF and the Harmonix Set benchmark. Beat detection is quoted at 97–99% accuracy for clear-rhythm genres (pop/rock/EDM/hip-hop), dropping to 90–95% for jazz/classical/irregular meters.\[4\]
- **Match cuts / visual rhyme:** Netflix's "Match Cutting: Finding Cuts With Smooth Visual Transitions" (Chen, Ziai, Tucker, Xie, WACV 2023) — shot segmentation (TransNetV2), near-duplicate removal,\[5\] then image/motion/audio embeddings to rank candidate pairs by framing, motion, or character-silhouette similarity. Per the paper: "We annotate and release a dataset of approximately 20,000 labeled pairs... In addition, we release code and embeddings for reproducing our experiments at github.com/netflix/matchcut."
- **Shot type & camera motion:** MovieShots/SGNet (Rao et al., ECCV 2020) — 46K+ shots from ~7K trailers,\[6\] 5 scale classes (ECU/CU/Medium/Full/Long) and 4 movement classes (static/motion/push/pull),\[7\] ~87.5% scale accuracy on the MovieShots test set. MovieNet (Huang et al., ECCV 2020) adds 92K cinematic-style tags across 1,100 movies.\[8\] This lets the AI enforce variety constraints ("don't put three wides in a row") and honor genre grammar.
- **Aesthetic scoring:** LAION-Aesthetics Predictor (V1 linear / V2 MLP on CLIP ViT-L/14 embeddings) scores images 1–10; usable to reject soft, badly-exposed, or ugly frames from candidate pools. Caveat: the model encodes its creator's personal taste and has documented demographic/style biases\[9\] (audit: arXiv 2601.09896), so it should be a *floor filter*, not the arbiter of what's "good."
- **Multimodal retrieval:** Twelve Labs Marengo (2.7/3.0) generates video-native embeddings for semantic search "by what's actually in it, not metadata someone typed,"\[10\] with a quoted "180x run time indexing" (10,000 hours in <1 hour).\[11\] Platform pricing ~$0.042/min indexing.\[12\] Open-source alternative: CLIP/SigLIP frame embeddings — per Mixpeek's 2026 benchmark, "Latency varies wildly: X-CLIP at 192ms (local GPU) vs Marengo at 18s (API processing)," but frame-averaged SigLIP is "a poor proxy for video understanding"\[13\] because temporal structure is lost. Self-hosted SigLIP-2 costs roughly $32 per 1M pairs at 60% GPU utilization.\[14\]

### 5. Music-video grammar: performance layer underneath, flash inserts on top
The user's instinct is exactly the professional workflow. Editors cut the **performance/base layer first** ("your edit needs a framework, and b-roll ain't gonna cut it"\[15\] — No Film School), then layer B-roll/narrative and flash inserts over it. Flash cuts create "frantic, dynamic" energy and compress "a long history" into seconds (CineD on A$AP Rocky's "D.M.B."). Genre grammar is specific: hip-hop cuts on beats 1 and 3 with flash frames and color burns on accents; EDM rewards beat-synced zoom pulses and strobes on the drop;\[16\] the key restraint rule is "one beat-synced zoom per section reads as intentional. One per beat reads as noise"\[16\] (Kudoflix). Place the *midpoint* of a whip/flash effect on the beat, not its start.

### 6. Sourcing: what Aldershot can legally fetch vs. what the user must supply
- **Auto-fetchable (build API integrations):** The user's own library and past projects (green); **Pexels** (CC0-style Pexels License, free commercial use, 200 req/hr default, requires attribution link) and **Pixabay** (Content License, unlimited requests) — but note **Pexels' ToS explicitly prohibits using its API to build datasets or train ML/AI models**, so Aldershot must treat fetched clips as end-user creative material, not training data; **Internet Archive / Prelinger** public-domain footage (per Prelinger's own Collections Summary, "The archives holds some 45,000 completed films... Approximately 60% of the completed films are in the public domain," under CC Public Domain Dedication on each film's detail page — but "public domain materials may occasionally incorporate copyrighted elements");\[17\] **Wikimedia Commons**. Generated footage (violet) via a text-to-video provider.
- **User-must-supply (do NOT auto-fetch):** YouTube and other platform clips. YouTube's ToS prohibits accessing content "through any technology or means other than the video playback pages... the embeddable player, or other explicitly authorized means," and bans automated systems/robots. Aldershot must never stream-rip. Instead it should (a) offer **embeds** where a live player suffices, and (b) for commentary/react use, present a responsible instruction: "Download this clip yourself if your use qualifies as fair use (commentary, criticism, news, teaching are common examples; courts decide case-by-case) and upload it here." The system frames the decision; the user makes and owns it. Creative-Commons-licensed YouTube content is the clean exception.

### 7. Rendering feasibility is strong on ffmpeg, with a clear heavier tier
FFmpeg's `blend` filter supports ~30 blend modes (screen, overlay, multiply, lighten, grainmerge, etc.) and `overlay` supports alpha, timed enable ranges, PiP scaling, and fades — so flash montages, film-burn/light-leak overlays (screen blend), grain (geq/grainmerge), split screen, PiP, freeze frames, speed ramps (setpts), Ken Burns (zoompan), and color shifts (LUTs/curves) are all native and containerizable. The heavier tier — clean rotoscope/masked cutouts (needs a segmentation model like SAM/Mask R-CNN), complex kinetic typography, and springy motion-graphics — is better served by **Remotion** (React-based programmatic compositing, Lambda-style parallel chunked rendering) as a second renderer alongside ffmpeg.

## Details

### A. The Device Catalog (with AI decision rules)
Each device below is a candidate "device object." For each: *purpose · typical rhythm · footage it needs · when the AI proposes it.*

**Layered / montage-family devices**
- **Flash / memory montage** — purpose: compress time, evoke memory/emotion, raise energy. Rhythm: 4–12 clips over 2–6s, each 6–20 frames, often accelerating (metric montage). Needs: 8+ short, thematically-linked clips; a "hero" last clip. AI proposes when: a line references the past/a list/a rush of events, or over a chorus/drop. Effect default: warm grade + optional film burn on the final clip.
- **Training / Hollywood montage** — purpose: show progress/effort over time. Rhythm: 6–15 medium clips, 0.5–1.5s each, tonal. Needs: process/effort footage in a consistent location set. AI proposes: over "and then I practiced/built/learned…".
- **Intellectual-montage insert** — purpose: create an idea by collision (Kuleshov). Rhythm: 2–3 pointed shots. Needs: two semantically contrasting clips. Use sparingly; flag as "strong statement."
- **Supercut / theme reel** — purpose: gather all instances of a motif ("every time I said 'actually'"). Needs: many retrieval hits of one pattern. Natural fit for clip-channel/commentary users.

**Cut-level devices**
- **Match cut / graphic match** — purpose: fluid, "authored" transition on shared shape/motion. Needs: two shots with matching silhouette/composition/motion (Netflix pipeline finds these). AI proposes at seams where a high-scoring pair exists.
- **Jump cut** — purpose: compress dead time, energy, comedic beat. Needs: same-framing clips. Core to vlog/talking-head; already implied by Aldershot's "cut the hedging" rules.
- **Smash cut** — purpose: abrupt tonal reversal. Needs: two high-contrast clips + audio hit.
- **J / L cuts** — audio leads/lags picture; already scoped as Aldershot's one precision tool (seam nudge). Belongs in "roles" via declarative ducking.
- **Cutaway / insert** — purpose: cover a cut, add detail, hide a trim. Needs: relevant B-roll or insert of hands/objects.

**Motion / speed / spatial devices**
- **Speed ramp** (Kolder-style) — accelerate into/out of a moment; ffmpeg `setpts`/`minterpolate`.
- **Slow motion / time-lapse** — emotional dwell / time compression (Neistat's constant time-lapse to "skip dead time").
- **Whip-pan / zoom transition** — Neistat/Kolder signature; match the blur direction across the cut; place blur peak on beat.
- **Freeze frame** — punctuation, introductions.
- **Split screen / grid / PiP / layered collage** — simultaneity, comparison, reaction-over-source (core react/commentary layout; Aldershot's PiP presets).

**Texture / graphic devices**
- **Kinetic typography / text overlays** — emphasis, captions, punchlines.
- **Ken Burns on stills** — bring photos alive (zoompan).
- **Glitch / film burn / light leaks / grain** — texture, era, memory (screen-blend overlays).
- **Color shift for flashback/memory** — a grade delta signaling "this is the past."
- **Stutter / strobe / echo-ghost trails** — beat-synced kinetic accents (AMV/velocity grammar).

### B. The "Device Object" design
A device is a declarative object with these parameters, all directable by language and editable by hand:
- **clip set** (green/gold/cyan/violet roles; from a saved search, a Thread, or hand-picked)
- **count & pacing curve** (e.g., 8 clips, accelerating; or even metric)
- **duration** (absolute, or "over the chorus," or "this line")
- **effect** (grade, film burn, glitch, none)
- **blend & opacity** (normal/screen/overlay; 100% or ghosted)
- **audio behavior** (duck base, ride music, or silent)
- **entry & exit** (hard cut, whip, dip-to-white, cross-dissolve)

**Anchoring:** to *words* (word-timed transcript from Ingest) or to *beats/downbeats/structure* (music analysis). Because the base cut is text-anchored, a device pinned to "over this line" survives edits to surrounding text.

**Appearance in the three zooms:**
- **Overview:** the device shows as a single labeled band (e.g., a violet-edged "Flash montage · 8 clips · chorus") floating above the base ribbon.
- **Blocks:** it appears as a stacked layer over the relevant block(s), with a "+" seam handle; you can see its clip count and effect chips.
- **Words:** it pins to the exact word/beat range, showing the in/out anchor and a live thumbnail strip of its clips.

**Directed by language:** "flash eight memory clips over the chorus, fast, warm grade, film burn on the last one" parses to `{device: flash_montage, count: 8, anchor: chorus, pacing: fast/accel, grade: warm, effect_last: film_burn}`. "Make it slower / use the Rome clips instead / lose the film burn" are single-parameter edits. Instance vs. policy applies: "not that clip" (instance) vs. "no drone shots in montages" (policy that re-filters every device's candidate pool).

**Fit with "roles, not tracks":** a device is just a bundle of role-tagged clips with a placement and a blend. Its audio obeys the same declarative ducking as any role. This keeps the mental model consistent — a montage is "a clip role, placed and blended," not a new track type.

### C. Selection principles that make a montage feel authored, not random
Drawing on Kuleshov (adjacency), Murch (emotion-first ranking), and the assembly literature (SKALD/ESA/SSO):
1. **A motif/theme** — every montage answers "what is this about?" One retrievable concept anchors the clip set.
2. **An internal arc** — build → peak → release; the "hero" clip lands on the strongest beat/word. (Metric acceleration is the simplest arc.)
3. **Visual rhyme and deliberate contrast** — use CLIP/SigLIP/Marengo similarity to order clips so shapes/motion rhyme, then break the pattern once for emphasis (Netflix match-cut logic + intellectual collision).
4. **Variety constraints** — shot-type classification prevents monotony (no three wides in a row; alternate scale/motion).
5. **Pacing tied to music** — cut on downbeats for majors, offbeats for experimental; not every beat gets a cut.
6. **Taste profile** — learn the creator's typical pace, grade, and effect restraint from their past projects; default to their palette.
7. **Personal footage first** — always prefer the creator's own clips over stock; stock/PD/generated only fill genuine gaps.
8. **Coherence bar** — an LCA/energy-style score (SKALD/ESA) rejects orderings below a threshold; if the pool can't clear the bar, the system says so rather than shipping junk.

**Showing its reasoning briefly:** one line per proposal — "8 Rome clips, warmest first→coldest last, cut on the chorus downbeats; skipped the drone shot (your 'no drones in montages' rule)." Enough to trust or correct, never a wall of text.

### D. The idea-to-layer workflow (mapped to the user's own steps)
The user described: have the idea → decide where it goes → source clips → select/order → set pace+effect → layer/blend → review. Aldershot handles each:
1. **Idea** — either the user asks ("flash montage here") or the system offers via **"It has one more thought: a flash montage of the Rome clips over this line."** Exactly one A/B proposal at a time (Editor X's existing pattern).
2. **Placement** — the "+" seam or a highlighted word range; the device snaps to word/beat anchors.
3. **Sourcing** — the system runs a creative retrieval query against the pool and shows candidates; if the pool is thin, it opens the pull list (Section F).
4. **Select & order** — auto-selected + reorderable; "more like this" expands; variety/aesthetic filters applied.
5. **Pace & effect** — pacing curve and effect chips, all language- or hand-editable.
6. **Layer & blend** — role, blend mode, opacity, audio behavior.
7. **Review** — fast preview (low-res proxy); **quick alternates**: slower / faster / different clip set / different grade, each a one-tap A/B.

### E. Music and rhythm
- **Detection:** madmom for offline downbeat accuracy; librosa for lightweight tempo; BeatNet if any live use. Structure (verse/chorus/drop) via MSAF-style segmentation so device entries can target "the chorus" or "the drop."
- **Alignment:** cuts and device entries snap to beats/downbeats; effect *peaks* land on beats.
- **Music-video mode:** music is the base layer; performance footage underneath; flash inserts on top — exactly the layering the user saw.
- **Licensing:** integrate cleared/licensed catalogs (Epidemic Sound, Artlist-style) and AI-generated music options; never redistribute copyrighted tracks. Where **stems** are available, per-stem energy (drums vs vocals) can drive which layer cuts.

### F. The sourcing layer — "the more clips, the more it can do" (shown, not scored)
- **Clip pool & capability gating:** each device declares requirements. The UI states capability plainly: "A memory montage wants ~8 clips of this kind — you have 5. Add 3 to unlock." No points, no badges — just a capability that visibly becomes available (consistent with Aldershot's "progress is shown, not scored" principle).
- **Pull lists / shot lists:** "Here are 30 clips to start from," grouped by purpose (e.g., "8 golden-hour wides," "6 hand close-ups," "4 crowd shots"). Each item shows whether the system can fetch it or the user must supply it.
- **Fetch matrix:**
  - *User library / past projects* → auto (green), instant.
  - *Pexels / Pixabay (CC0-style)* → auto via API, with required attribution; not for training.
  - *Internet Archive / Prelinger / Wikimedia (public domain / CC)* → auto, check each item's license flag; warn about embedded third-party elements.
  - *Generated (violet)* → auto via text-to-video provider.
  - *Screen recordings* → user captures; system gives a record button.
  - *"Go shoot this" prompts* → for vloggers: "You need a 3s establishing wide of the street — grab it next time out."
  - *YouTube / platforms* → **user-supplied only**; embed where possible; otherwise the responsible "download-if-fair-use-and-upload" instruction.
- **Checklists that self-fill:** as clips arrive (fetched or uploaded), they auto-slot into the matching pull-list line via retrieval matching, and the capability meter for dependent devices updates live.

### G. Robust creative search & retrieval
Multimodal search over the creator's footage for *creative* (not evidentiary — that's CANOPTICON) purposes:
- **By content:** "hands," "golden hour," "crowds," "close-ups of faces" — via Marengo or CLIP/SigLIP frame embeddings + frame captions (LAVE-style visual narrations at ~1 fps with a VLM).
- **By shot type / motion / color / mood / location / time / people / audio** — shot-type via SGNet-style classifier; color/motion via cheap CV; audio via transcript + audio embeddings.
- **By similarity:** "more like this" (nearest-neighbor in embedding space) — the engine behind visual rhyme.
- **Manual layer:** browsing, bins/collections, tagging — always available, because retrieval will miss things and creators have taste the model doesn't.
- **Cost reality:** Marengo indexing ~$0.042/min hosted, or self-host SigLIP-2 (~$32/1M pairs) for a cheaper open path; frame-level embeddings lose temporal nuance, so a hybrid (cheap frame index for breadth + video-native embeddings for key sources) is the pragmatic build. Results feed *directly* into a device's clip set — search *is* the sourcing UI.

### H. Uniqueness and taste safeguards
- **Personal-footage-first** ranking (own clips outrank stock at equal relevance).
- **Learned style profile** from past projects (pace, grade, effect frequency, preferred shot types).
- **Restraint by default** — effects off or subtle unless asked; "one accent per section" rule.
- **Coherence bar** — reject sub-threshold orderings (SKALD LCA / ESA energy).
- **Style references** — "cut it like this video": analyze the reference's shot-size/motion/pacing distribution (ESA's approach) and match *statistics*, not copy content.
- **Aesthetic floor** — LAION-style score filters out technically weak frames, used only as a floor given its known biases.

### I. Rendering feasibility tiers
- **Tier 1 (ffmpeg-native, containerizable now):** flash montage, jump/match/smash cuts, cutaways, split screen/grid/PiP, freeze frame, speed ramp, slow-mo/time-lapse, whip/zoom transitions (with pre-blur), film burn/light leaks/grain (screen/grainmerge blend), color shifts (LUTs), Ken Burns (zoompan), beat-synced cutting, basic text overlays, J/L cuts.
- **Tier 2 (needs Remotion or richer compositing):** springy kinetic typography, complex multi-layer motion graphics, data-driven templated lower-thirds.
- **Tier 3 (needs ML models):** clean rotoscope/masked cutouts (SAM/Mask R-CNN segmentation), subject-isolated echo trails, advanced match-on-action.
- **Fast previews:** render proxies at low resolution; use the live-player approach (Remotion Player) for interactive scrubbing of graphic devices; cache device renders keyed by parameters so A/B alternates are near-instant.

## Recommendations

**Build order — ranked signature devices (ship first → later):**
1. **Flash/memory montage device** — the user's core request, highest emotional payoff, Tier-1 renderable, and the natural showcase for the whole "device object" model. Ship with word- and beat-anchoring, accelerating pacing, warm-grade + film-burn defaults.
2. **Beat-synced base cutting + music-video mode** — madmom/librosa integration; makes montages feel professional immediately and unlocks all beat-anchored devices.
3. **Match-cut seam suggestions** — implement the Netflix WACV 2023 pipeline over the project's shot pool; surface as "It has one more thought" proposals. This is the clearest "authored, not junk" signal.
4. **Creative multimodal search + pull lists** — the sourcing engine; start with the user's own library (free, no ToS risk) + Pexels/Pixabay/Internet Archive APIs.
5. **Split screen / PiP / grid** for react/commentary users — high demand, Tier-1.
6. **Speed ramps, whip/zoom transitions, texture overlays** — the vlog "polish" pack.
7. **Style-reference matching (ESA-style)** and **learned taste profile** — the differentiators, once there's enough per-user history.

**Thresholds that change the plan:**
- If self-hosted SigLIP-2 retrieval quality tests below usable NDCG on Chris's own footage, switch key-source indexing to Marengo despite the per-minute cost.
- If beat detection accuracy on the target genres falls below ~90% in testing, add a manual beat-nudge (mirroring the seam-nudge philosophy) before shipping music-video mode.
- If the coherence-bar (LCA/energy) reject rate is high on real pools, that's the signal to lean harder on pull-lists ("you need more clips") rather than shipping weak montages.

**Legal/operational guardrails to set now:**
- Never scrape YouTube/platforms; embeds or user-uploads only; phrase the download instruction as the user's fair-use decision.
- Treat all fetched stock as creative material, never training data (Pexels ToS).
- Store per-clip license/attribution metadata and auto-generate the attribution/credits block on export.
- Flag public-domain clips that may contain embedded copyrighted elements.

## Caveats
- **Vendor claims:** Twelve Labs' figures are vendor-published and internally inconsistent — its Dec 2025 launch blog states Marengo 3.0 hits "78.5% composite benchmark performance versus 61.8% for Amazon Nova and 50.2% for Google Vertex," yet its own product page instead lists "Google Vertex sits at 52%, Amazon Nova at 55%"; embedding-dimension figures also differ (Mixpeek reports 3.0 = 512-dim vs 2.7 = 1,024-dim). Independent benchmarking on Chris's own footage is needed before committing.
- **Aesthetic scoring is biased:** the LAION predictor encodes one person's taste and documented demographic/style skews — use only as a quality floor, never as the taste arbiter.
- **Beat detection degrades** on jazz/classical/irregular meter (90–95% vs 97–99% for pop/EDM); music-video mode is safest launched for clear-rhythm genres first.
- **"Authored" is a moving target:** SKALD/ESA/SSO are recent (2025–2026) and mostly evaluated on curated datasets and user-preference studies, not on messy personal vlog archives; expect a tuning gap on real Aldershot pools.
- **Fair use is case-by-case:** the system can inform but must never adjudicate; commentary/react creators bear the legal decision, and the UI copy must make that explicit without giving legal advice.
- **Legal terms drift:** platform ToS and stock licenses change; the fetch matrix needs periodic review.
- **Frame-averaged embeddings lose time:** cheap CLIP/SigLIP frame indexing is good for breadth but weak on motion/temporal meaning; don't over-rely on it for motion-based devices.

## Open questions for Chris
1. What's the realistic average project size (clip count/hours) — this sets whether hosted Marengo indexing is affordable or self-hosted SigLIP is mandatory?
2. Which user segment leads v1 — your own vlog archive, clip channels, or commentary/react? Each weights the device catalog differently (montage vs supercut vs PiP).
3. Do you want a second renderer (Remotion) from the start for Tier-2/3 devices, or ship Tier-1-only on ffmpeg and defer?
4. How aggressive should "It has one more thought" be about *proposing* montages unprompted — always-on suggestions, or only when asked?
5. For licensed music, buy into Epidemic/Artlist-style catalogs, lean on AI-generated music, or both?
6. Should the taste profile be per-project, per-user, or shareable as a "style preset" others can apply?
7. What's the appetite for storing and auto-slotting user uploads against pull-lists — how much automation vs. manual bin control do your users actually want?

## Sources

1. [\[2503.08010\] SKALD: Learning-Based Shot Assembly for Coherent Multi-Shot Video Creation](https://arxiv.org/abs/2503.08010)
2. [ESA: Energy-Based Shot Assembly Optimization for Automatic Video Editing](https://arxiv.org/pdf/2511.02505)
3. [\[2503.17975\] Shot Sequence Ordering for Video Editing: Benchmarks, Metrics, and Cinematology-Inspired Computing Methods](https://arxiv.org/abs/2503.17975)
4. [How to Use AI to Match Cuts to Music Beats in Video | Wideframe](https://try.wideframe.com/blog/how-to-use-ai-to-match-cuts-to-music-beats/)
5. [(PDF) Match Cutting: Finding Cuts with Smooth Visual Transitions](https://www.researchgate.net/publication/364519039_Match_Cutting_Finding_Cuts_with_Smooth_Visual_Transitions)
6. [\[2008.03548\] A Unified Framework for Shot Type Classification Based on Subject Centric Lens](https://arxiv.org/abs/2008.03548)
7. [A Unified Framework for Shot Type Classification Based on Subject Centric Lens — Lacuna](https://lacuna.tiptreesystems.com/work/a-unified-framework-for-shot-type-classification-based-on-subject-centric-lens/wrk_d24ef8cd178e5ecd51907091c675f795)
8. [MovieNet: A Holistic Dataset for Movie Understanding | Springer Nature Link](https://link.springer.com/chapter/10.1007/978-3-030-58548-8_41)
9. [The Algorithmic Gaze of Image Quality Assessment: An Audit and Trace Ethnography of the LAION-Aesthetics Predictor](https://arxiv.org/pdf/2601.09896)
10. [TwelveLabs: Video Intelligence Platform & API](https://www.twelvelabs.io/)
11. [Video Embeddings for Multimodal Search - TwelveLabs](https://www.twelvelabs.io/product/embed)
12. [TwelveLabs Pricing: API Plans and Costs](https://www.twelvelabs.io/pricing)
13. [GitHub - mixpeek/video-embedding-benchmark: Head-to-head benchmark of multimodal embedding models for text-to-video retrieval. 6 models, 20 CC0 videos, 60 queries, reproducible IR metrics (NDCG, MRR, Recall). · GitHub](https://github.com/mixpeek/video-embedding-benchmark)
14. [Multimodal Embeddings on GPU Cloud: SigLIP-2, JinaCLIP-v2, and Cohere Embed-v4 (2026) | Spheron Blog](https://www.spheron.network/blog/multimodal-embedding-models-gpu-cloud-siglip2-jinaclip-cohere/)
15. [5 Tips for Speeding Up Your Music Video Edit | No Film School](https://nofilmschool.com/speed-up-music-video-edit)
16. [Music Sync Video Editing Techniques for Pro Results – Kudoflix Video Editing](https://kudoflix.com/blog/2026/07/22/music-sync-video-editing-techniques/)
17. [Archivos Prelinger: Licencias, Acceso, Colecciones - Panix](https://translate.google.com/translate?client=srp&hl=es&sl=en&tl=es&u=https%3A%2F%2Fwww.panix.com%2F%7Efootage%2Fprelarch.html)
