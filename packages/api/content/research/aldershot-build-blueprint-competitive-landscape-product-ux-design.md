---
id: aldershot-build-blueprint-competitive-landscape-product-ux-design
title: "ALDERSHOT — Build Blueprint, Competitive Landscape & Product/UX Design"
kind: "Build brief"
topic: "AI-directed development"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-e8084209-0870-5c94-9bd6-e1599b3a7591_text_markdown.md"
---

# ALDERSHOT — Build Blueprint, Competitive Landscape & Product/UX Design

## TL;DR
- **Build it as a "script-is-the-timeline" agentic documentary engine, not another NLE.** No shipping tool does the full research → script → storyboard → scout clips → record-your-blocks → assemble loop for long-form video essays; that is genuine white space. Descript owns text-based editing, Eddie AI/Quickture own footage-first rough-cutting, and Invideo/Pictory own template auto-video — but nobody stitches a research/scriptwriting agent to host-recorded blocks and an archival scout. Aldershot should own the "authored documentary" niche.
- **Your Cloudflare stack is the right control plane but insufficient for heavy video.** Workers, D1, Vectorize, Durable Objects, Workflows, R2 and Workers AI handle orchestration, the script document, semantic scouting, and transcription well. Video rendering, FFmpeg mux/encode, and long-form composition must run in Cloudflare Containers (native FFmpeg) or an external renderer (Remotion Lambda / Shotstack / Creatomate). The smart MVP does NOT render in-app at all — it exports OTIO/FCPXML to Resolve.
- **The existing Gemini spec has the right skeleton but real bugs and big gaps.** Its OTIO exporter uses seconds-as-values, omits gaps and `available_range`, and mishandles rational time (all of which break Resolve import). It also completely omits the user's own recording blocks, teleprompter flow, reaction layouts, the research/fact-check agent, storyboard, visual (non-transcript) search, rendering, and legal guardrails. Fix the time model, add the record/reaction/research subsystems, and add visual search.

## Key Findings

### 1. Competitive landscape — where the white space is
The 2025–2026 market has split into four camps, and none occupies Aldershot's target square:

- **Text-based editors (Descript).** Descript is the category king of "edit video like a document." Its "Underlord" agentic co-editor first debuted as part of Descript's "Season 6" product updates on **April 1, 2025**, marking a major shift toward AI editing assistance; it turns plain-language prompts into edits, with a model picker exposing Claude Sonnet and others. Pricing moved to a credit model in September 2025 (Media Minutes for storage/transcription + AI Credits for AI actions), drawing consistently negative community reaction; Hobbyist $16/mo annual ($24 monthly), Creator $24/mo ($35 monthly), Business $50/user/mo; the free tier is 60 media minutes + 100 AI credits + watermark-free 720p. A Descript API entered early access in 2026 with Zapier and Claude/MCP hooks. Underlord chats are saved and scoped per project, private to each user. **Gap:** Descript is built for talking-head/podcast spoken-word content, not researched, archival-heavy documentary with a scripting agent.
- **Footage-first agentic rough-cutters (Eddie AI, Quickture, Selects, Jumper).** These ingest raw footage and return an assembled cut. Eddie AI (v4 by IBC 2026) imports up to 100 hours, logs/syncs/multicam-groups, separates interviews from B-roll, does visual B-roll edits and music-synced montages, exports to Premiere/FCP/Resolve, offers "expert agents" trained on named filmmakers (e.g., a "MrBeastMethod" agent), moved from subscriptions to a credit model, and\[1\] can join a Blackmagic Cloud or Premiere Productions project as an agent operating the NLE UI. Quickture (~$499/mo, demoed at Avid's booth) analyzes/transcribes footage and builds rough cuts from a discussion. Jumper adds a searchable footage index with agentic MCP editing (needs ~$599 Pro tier for agentic + facial recognition). **Gap:** they assume you already shot everything; they don't research a topic, write a script, or scout external archival clips.
- **Template / generative auto-video (Invideo AI, Pictory, Runway, Synthesia, CapCut, Vivideo).** Type a prompt, get a finished short video from stock + TTS. Great for social, weak for authored long-form with a distinctive voice. Runway (Gen-4 in 2026) is generation-led.
- **Short-form clip extractors (Opus Clip, Gling, CapCut, Captions).** Turn long videos into shorts. Opposite direction from Aldershot.

Supporting infrastructure Aldershot should buy rather than build: **Twelve Labs** for multimodal video understanding (Marengo 2.7 embeddings + Pegasus video-language model reasoning over up to two hours; the free plan provides 600 minutes of accumulated indexing free of charge; indexing about $0.042/min one-time, input video about $0.021/min, and embedding infrastructure cost is calculated monthly at **$0.0015 per minute**); **Shotstack/Creatomate/Remotion** for rendering; **Supadata** for transcripts.

**White space Aldershot can own:** the *authored* documentary/video-essay pipeline where a research+script agent produces a shot-mapped script, the human records only their blocks against a teleprompter, and an archival scout fills every visual slot — assembled as one continuous piece. This is Johnny-Harris-in-a-box for investigative creators, and no competitor spans it end-to-end.

### 2. Product & UX — chat + blocks + text editing
The correct mental model is **Notion-block-editor meets Cursor's agentic diff-approval meets Descript's transcript-as-timeline.** The script document *is* the project; the timeline is a derived view.

- **Three-pane layout.** Left: **chat/agent panel** (the "Director") that proposes changes as reviewable diffs. Center: the **block script document** (the source of truth). Right: **inspector** for the selected block (candidate clips, toggles, take manager).
- **Block model** (each block is one row in the script, rendered sequentially):
  - `NARRATION` (VO you or AI read) · `HOST_ONCAM` (your "record me" blocks) · `REACTION` (source clip + your PiP commentary) · `PRIMARY_EXHIBIT` (the evidence clip/document being discussed) · `B_ROLL` (muted illustrative footage under VO) · `DOCUMENT` (screenshot with animated highlight) · `GRAPHIC` (map/lower-third/title card) · `MUSIC` (bed).
- **Chat maps to block operations** via tool calls: "tighten the intro" → merges/trims blocks with a visible diff; "find better B-roll for block 7" → re-runs scout, populates candidates in the inspector; "make block 4 a reaction to the CBC clip" → changes `block_type` and layout. Every agent action is a proposed diff the user accepts/rejects (Cursor pattern), which is essential for investigative-journalism trust.
- **Recorded lines stay linked** because each `HOST_ONCAM`/`NARRATION` block owns its take(s); word-level alignment maps your spoken words back to the scripted words, so the block's on-timeline duration updates automatically and the continuous piece re-flows. Descript's "Eye Contact" and teleprompter features validate the read-from-script UX.

### 3. Research & scriptwriting agent
Model the "Director" as a multi-stage Workflow: (1) research pass (web search + source fetch with citation capture and a fact-check/claim-support step suited to investigative journalism); (2) outline in genre structure (Hook → Conflict/Development → Resolution → Lesson, the arc used by video essays and documentaries per StudioBinder); (3) full script with visual direction written *simultaneously* with the prose — Johnny Harris's documented method is to script and visually-direct at once with color-coded notes for visual assets and fact-checking, to craft a clear "promise" in the title/hook, and to lead with a visual anchor before context ("look at this bridge in Colombia…"); (4) the Director parser breaks the script into timed visual blocks. Aim for a strong 15-second hook (thumbnail > title > opening line in importance) and open curiosity loops.

**On the 3–5-second block rule:** it is directionally right for B-roll density (video essays cut fast) but wrong as a universal rule. On-cam host blocks and primary exhibits often run 8–30 seconds; forcing 3–5s fragments would shred evidence presentation. Recommendation: make block duration a function of `visual_role` (B-roll 2–5s, exhibits/host as-needed) and target speaking rate 130–160 wpm.

**Director JSON output schema** (per block): `block_type`, `visual_role`, `narration_text`, `target_concept` (for scouting), `estimated_duration_ms`, `source_citations[]`, `record_required` (bool), `layout` (for reaction/PiP), `exhibit_ref`, `music_cue`.

### 4. Self-recording, teleprompter & reaction
- **Recording tech.** MediaRecorder is the simplest capture path but encodes in real time (a 5-minute take costs 5 minutes wall-clock), offers limited codecs (no HEVC/AV1), and can drift a few ms over long takes. WebCodecs gives hardware-accelerated, GPU-side H.264 encoding (supported in ~95%+ of browsers per Can I Use 2025) and is the better path for quality, with MediaRecorder as fallback. For host blocks (short lines), record locally and upload the blob to R2 via presigned URL — the Riverside pattern of "record local, upload after" beats streaming quality. Cloudflare Realtime/Calls is for live multi-party, not needed for solo block recording.
- **Teleprompter flow.** Show only the current block's line; support multiple takes per block; auto-select best take via transcript alignment (Whisper word timestamps) comparing spoken vs scripted words; flag retakes where alignment confidence is low. Word-level alignment is what keeps recorded lines snapped to the script.
- **Reaction mechanics.** PiP layouts (source video + host cam), pause-source-while-host-comments, synced playback. **Legal pattern (see §6):** in *Hosseinzadeh v. Klein* (No. 16-CV-3081, 276 F.Supp.3d 34, S.D.N.Y. Aug. 23, 2017), District Judge Katherine B. Forrest granted summary judgment for the Kleins, writing "Any review of the Klein video leaves no doubt that it constitutes critical commentary of the Hoss video; there is also no doubt that the Klein video is decidedly not a market substitute for the Hoss video." The Kleins' ~14-minute reaction used a combined 3 minutes 15 seconds of the 5-minute-24-second Hoss video. But the court explicitly declined to bless *all* reaction videos, distinguishing\[2\] "group viewing sessions without commentary." The 2025 H3H3-as-plaintiff suit alleged that reaction streamers' reactions to Klein's Hasan Piker video "were not fair use as they reacted to the entire video with minimal commentary"; Klein registered the video with the Library of Congress beforehand to strengthen the claim, and on July 31, 2025 his team filed a subpoena to unmask r/h3snark moderators. Product implication: enforce commentary-to-source ratio and clip-length guardrails.

### 5. Clip scouting & media sourcing
- **Two retrieval modes.** (a) Transcript/semantic search over an owned R2 library indexed in Vectorize (the spec's approach) — good when dialogue matches the concept. (b) **Visual search** via CLIP/SigLIP frame embeddings or Twelve Labs Marengo — essential when there's no dialogue ("scenes with dinosaurs," "moments showing teamwork"). Add shot-boundary detection (PySceneDetect / TransNetV2) so clips are cut at real scene edges, not arbitrary offsets.
- **Vectorize constraints matter.** Index dimension ceiling is 1,536 at 32-bit;\[3\] `@cf/baai/bge-base-en-v1.5` outputs 768 dims;\[4\] topK caps at 50 when requesting values/metadata;\[5\] up to 10M vectors/index;\[3\] 10 metadata indexes, 10KiB metadata/vector; string index uses first 64 bytes, filter size max 2048 bytes.\[6\] Twelve Labs Marengo embeddings are 1,024-dim — they FIT in Vectorize, which lets you store visual embeddings natively. This is a key upgrade to the spec.
- **External sources.** YouTube via Supadata (100 free requests/mo; paid from $5/mo up to $297/mo; 1 credit per captioned transcript, ~2 credits/min for AI-generated when captions are disabled; AI fallback is its differentiator; no MCP integration) — but downloading/scraping YouTube violates its ToS and carries risk. Prefer legitimate archival APIs: Internet Archive (CC/PD stock-footage collection, Prelinger), Wikimedia Commons (100k+ videos), Library of Congress (API limited to ~15 requests/min), US National Archives, NASA/CDC/DVIDS public-domain, Pexels (free API, no attribution required, JS/Ruby/.NET SDKs),\[7\] Pixabay (free, unlimited requests, photo-heavy),\[8\] Storyblocks (fixed-fee API, royalty-free with $20k indemnification),\[8\] Pond5/Getty/Shutterstock (commercial APIs).
- **Caption fallback.** When captions are disabled: audio → Whisper on Workers AI, or Deepgram/AssemblyAI for word-level timestamps + diarization (Supadata itself lacks diarization/custom vocab).

### 6. Legal & copyright
- **Canada (your jurisdiction).** Fair dealing (Copyright Act ss. 29, 29.1, 29.2) covers research, private study, criticism, review, news reporting, education, satire, parody. Criticism/review/news reporting **require attribution** (source + author/performer/maker/broadcaster if given). Fairness is assessed on the six *CCH v. Law Society of Upper Canada* (2004) factors: purpose, character, amount, alternatives to the dealing, nature of the work, and effect on the market. There is also the non-commercial UGC ("mash-up"/"YouTube") exception under s. 29.21.
- **US comparison.** Fair use (17 USC §107) four-factor test; transformativeness is usually determinative but\[9\] post-*Warhol* (2023) "transformative" is no longer an automatic win. *Hosseinzadeh v. Klein* is the anchor precedent for commentary/reaction.
- **Product features that reduce risk:** per-clip source tracking + attribution logs (auto-generate a credits/citations list), clip-length guardrails, a commentary-vs-source ratio meter for reactions, a "commercially available alternative?" check (relevant to Canadian fairness analysis and the s.29.21 requirement that there be no substitute), and a music-licensing gate. YouTube Content ID avoidance = short excerpts, transformative commentary, licensed/PD music.

### 7. Documents, graphics & motion
- **Document exhibits.** Use Cloudflare Browser Rendering (now "Browser Run," `@cloudflare/puppeteer` 1.0.4 / `@cloudflare/playwright` 1.55 GA Sept 2025,\[10\] requires `nodejs_compat`) to headless-screenshot articles/tweets/documents at\[11\] 1920×1080 default; overlay animated highlighter.\[11\] Billing began Aug 20, 2025: the paid tier includes\[12\] 10 browser-hours/mo, then about $0.09/browser-hour + $2.00 per concurrent browser above the included amount; the free plan is\[13\] capped at ~10 min/day (429 error beyond). Concurrency limits (historically ~2 concurrent per account) mean you should queue screenshot jobs asynchronously via Workflows and reuse sessions via Durable Objects.
- **Ken Burns / motion.** For pan-and-zoom on stills and title cards, Remotion (React-based) is the cleanest programmatic path; lightweight motion can also be CSS/WebCodecs on the client. Maps and lower-thirds are best as Remotion or SVG-driven components.

### 8. Rendering & NLE export
**Two distinct outputs. Ship the export path first, the render path later.**

- **NLE interchange (MVP).** Generate `.otio` and FCPXML in pure TypeScript — no C++ bindings needed. Existing TS libraries prove this (e.g. `@chatoctopus/timeline` emits FCPXML 1.8 + xmeml v5 + OTIO with frame-aligned rational-time math; an `otio-wasm` TypeScript path also exists). **Correct OTIO schema (verified against the AcademySoftwareFoundation serialized-schema docs):**
  - Top-level `Timeline.1` whose single `tracks` field is a `Stack.1` (note: `Timeline` uses `tracks`, everything else uses `children`).
  - The Stack's `children` are `Track.1` objects, each with `"kind":"Video"` or `"kind":"Audio"`. Painter order: first entry = bottom layer, last entry = top (so V2 over V1 comes after V1 in the array).
  - Emit `Clip.1` with a **singular `media_reference`** (an `ExternalReference.1` with `target_url` and `available_range`) for maximum Resolve/Premiere compatibility. `Clip.2` (with a `media_references` dict + `active_media_reference_key`) is current on `main` but Clip.1 is the lower-risk form and deserializes everywhere.
  - **RationalTime is `{value, rate}` where `value` is a FRAME COUNT, not seconds** (2s @ 24fps = `{value:48, rate:24}`).
  - A clip's `source_range` is the trim into the media (in the media's own time coordinate) and must sit inside the media_reference's `available_range` (the full media extent).
  - **Clips are positioned by preceding them with `Gap.1` items whose `source_range.duration` equals the offset** — tracks are strictly sequential, not absolutely positioned. Per the docs, "the Gap at the front of a track is used just to offset" the following clip. For solid black instead of transparency, use a Clip with a `GeneratorReference` (confirm the exact `generator_kind` string).

  Minimal verified structure:
  ```json
  {
    "OTIO_SCHEMA": "Timeline.1",
    "name": "My Timeline",
    "global_start_time": {"OTIO_SCHEMA":"RationalTime.1","rate":24,"value":0},
    "tracks": {
      "OTIO_SCHEMA": "Stack.1", "name":"tracks", "children": [
        {"OTIO_SCHEMA":"Track.1","name":"V1","kind":"Video","children":[
          {"OTIO_SCHEMA":"Gap.1","name":"Gap","source_range":{
            "OTIO_SCHEMA":"TimeRange.1",
            "start_time":{"OTIO_SCHEMA":"RationalTime.1","rate":24,"value":0},
            "duration":{"OTIO_SCHEMA":"RationalTime.1","rate":24,"value":48}}},
          {"OTIO_SCHEMA":"Clip.1","name":"Shot_001","source_range":{
            "OTIO_SCHEMA":"TimeRange.1",
            "start_time":{"OTIO_SCHEMA":"RationalTime.1","rate":24,"value":86400},
            "duration":{"OTIO_SCHEMA":"RationalTime.1","rate":24,"value":120}},
            "media_reference":{"OTIO_SCHEMA":"ExternalReference.1",
              "available_range":{"OTIO_SCHEMA":"TimeRange.1",
                "start_time":{"OTIO_SCHEMA":"RationalTime.1","rate":24,"value":86400},
                "duration":{"OTIO_SCHEMA":"RationalTime.1","rate":24,"value":1440}},
              "available_image_bounds":null,
              "target_url":"file:///media/shots/Shot_001.mov"}}
        ]}
      ]
    }
  }
  ```

  **The Gemini spec's bugs, confirmed:** (1) using seconds as values with rate 30 causes frame drift and "not on edit frame boundary" errors; (2) no gaps means every clip collapses to t=0 (butted at the track head); (3) placing clips without timeline positions is invalid; (4) missing `available_range` causes Media Offline / failed linking. Also ensure a consistent, correct `rate` throughout (mixing 24 vs 23.976 = `24000/1001`, or 30 vs 29.97, causes sync drift), use the `.otio` extension, always set `kind` on tracks, and use resolvable `target_url` paths. J-cuts/L-cuts are done by offsetting audio vs video clips on separate tracks (leading/trailing gaps of different lengths). Resolve has supported OTIO natively since v18.5, so 19/20 import is solid when the file is well-formed. On EDL/AAF: OTIO reads AAF (Rust-only, read-only) but cannot write AAF; EDL (CMX3600) is single-track only — fine as a fallback, not a primary. You can downgrade schema versions with `otioconvert -A target_schema_versions="{'Clip':1,'Marker':2}"` if a specific Resolve build is picky.
- **In-app render to MP4 (v2).** Options and economics:
  - **Cloudflare Containers (native FFmpeg):** Workers Paid ($5/mo) required; billed per 10ms active; memory $0.0000025/GiB-s (25 GiB-s included); up to 4 GiB RAM + ~0.5 vCPU per instance at launch; scales to zero. Best fit for the Cloudflare-native goal, but limited vCPU makes long-form final encodes slow — best for proxies/thumbnails/audio extraction.
  - **Remotion Lambda:** distributes a render across many Lambdas (up to ~200 of 1,000 regional concurrency per render); targets Full HD < ~80 min (output caps ~5 GB ≈ 2 hrs 1080p); multi-minute videos render "for a few pennies," a 10-min 1080p transcode on Lambda ~$0.30; AV1 unavailable; store big assets in R2 to dodge S3 egress. Needs a Remotion company license.
  - **Shotstack / Creatomate:** JSON-to-video APIs. Shotstack:\[14\] 1 credit = 1 min regardless of resolution, ~$0.25/min at the low tier ($49 for 200 min at 720p), resolution-flat and\[15\] ~10× faster/min; Creatomate uses computational pricing (720p@25fps\[16\] ≈ 14 credits/min, Essential $54/mo for 2,000 credits) so 4K/60fps costs more and\[16\] TTS is billed on top.
  - **WebCodecs client-side:** free compute, GPU-accelerated, but you own container muxing and it's fragile for 10–60 min pieces.

  **Recommendation:** MVP exports OTIO to Resolve (zero render cost, pro finishing). v2 adds a "quick preview render" via Cloudflare Containers/FFmpeg for proxies, and offers Remotion Lambda or Shotstack for final MP4 when the user wants a hands-off finish.

### 9. Audio
- **Loudness.**\[17\] YouTube's preferred loudness level is **−14 LUFS integrated** — if a program measures −10 LUFS, YouTube lowers it by 4 dB to reach the target; it only turns loud content down, never up. Target −14 LUFS integrated with a −1 dBTP true-peak ceiling. Layered mix targets from practitioners: dialogue/talking-head ≈ −16 LUFS, background/B-roll ≈ −24 LUFS, music bed ≈ −14 LUFS pre-duck, master limiter at −1 dB. Users can verify with\[17\] "Stats for nerds" → Volume/Normalized.
- **Ducking.** Sidechain-duck music under narration;\[18\] keep music roughly 18–20 dB below narration during speech (aligns with W3C accessibility guidance of ≥20 dB below foreground speech). This maps directly to the A3_Music_Bed track automation the spec wants.
- **Cleanup.** Noise removal + loudness normalization on ingest (Workers AI or an external audio API); capture room tone.
- **AI voice.** Offer ElevenLabs (or similar) strictly for placeholder/scratch VO and pickup lines, gated behind explicit consent and clear labeling — never to fabricate a real person's voice. This is an ethics guardrail, not just a feature.

### 10. Architecture & phased build

**System architecture (Cloudflare-native control plane):**
- **Workers** = API + agent orchestration endpoints.
- **Durable Objects** = one per project = the live editing session / script-document state + chat history (mirrors Descript's per-project chat scoping); also hosts reusable Browser Rendering sessions.
- **Workflows** = long-running pipelines: ResearchWorkflow, ScoutWorkflow, TranscribeWorkflow, RenderWorkflow (durable, retryable).
- **D1** = relational store (revised schema below).
- **Vectorize** = two indexes: `aldershot-transcript-index` (768-dim bge) and `aldershot-visual-index` (1,024-dim Marengo/CLIP).
- **R2** = all media (owned library, recorded takes, screenshots, renders); reference from Remotion via R2 HTTP URLs to avoid egress.
- **Workers AI** = embeddings, Whisper transcription, LLM for lighter tasks; heavier scripting/reasoning via external Claude through AI Gateway.
- **Cloudflare Containers** = FFmpeg mux/encode/proxy.
- **External** = Twelve Labs (visual understanding), Supadata (transcripts), archival APIs, ElevenLabs (optional TTS), Remotion Lambda/Shotstack (optional final render).

**D1 schema revisions to the Gemini spec:**
- Keep `media_assets`, `projects`, `script_blocks`, `candidate_clips` but:
  - Expand `script_blocks.block_type`/`visual_role` enums to the block model in §2 (add HOST_ONCAM, REACTION, GRAPHIC, MUSIC).
  - Add `record_required`, `layout_json`, `source_citations_json`, `estimated_duration_ms` to `script_blocks`.
  - New table `takes` (block_id, r2_key, take_number, transcript_json with word timestamps, alignment_score, is_selected).
  - New table `sources` (project_id, url, title, author, license, retrieved_at) for attribution logs.
  - `candidate_clips`: add `embedding_source` (transcript|visual), `license`, `attribution`, `clip_length_ms`, and a `legal_flag`.
  - Add `visual_embedding_status` alongside `transcription_status` on `media_assets`.
  - Store millisecond timestamps as seconds or windowed values in Vectorize metadata (per Cloudflare guidance) to keep range filters fast.

**Cost estimate per finished 15-minute video (rough):** transcription/embeddings on Workers AI + a modest Twelve Labs index (say 60 min indexed ≈ ~$2.50 one-time at $0.042/min) + monthly embedding infra at $0.0015/min, a few dozen Browser Rendering screenshots (well within the 10 included browser-hours), LLM scripting via external Claude (a few dollars), and — if rendered — Remotion Lambda pennies-to-~$0.50 or Shotstack ~$0.25/min (~$3.75). Total well under ~$10/video if you render; near-zero incremental if you export to Resolve.

**Phased roadmap (scoped for Claude Code):**
- **MVP — the smallest end-to-end slice:** topic → Director produces block script (with `record_required` flags) → teleprompter records HOST_ONCAM/NARRATION blocks to R2 → scout owned-library clips via transcript Vectorize search → export valid `.otio` to Resolve. Proves the concept with zero render infrastructure.
- **v1:** add visual search (Twelve Labs/CLIP), document screenshots + Ken Burns, external archival APIs, attribution logs + legal guardrails, audio normalization/ducking, best-take auto-selection.
- **v2:** in-app rendering (Containers proxy + Remotion/Shotstack final), reaction layouts with PiP, AI-voice scratch VO, collaboration.

## Details
Full findings are integrated above under each of the ten numbered areas, including pricing, schema, code, and trade-offs. The through-line: Aldershot's defensible position is the *authored* pipeline (research → script → record → scout → assemble) that no incumbent spans, built on a Cloudflare control plane with video-heavy work offloaded to Containers/Remotion/Shotstack and NLE finishing delegated to Resolve via correct OTIO.

## Recommendations
1. **Build the MVP slice exactly as scoped above and do NOT build a renderer first.** Export OTIO to Resolve. This de-risks the hardest 80% (research → script → record → scout) without touching video encoding. **Threshold to move on:** you can take a topic to a Resolve-importable timeline with your recorded blocks in under an hour of wall-clock, with clips landing at correct positions and media online.
2. **Fix the OTIO exporter immediately** using the verified schema: frame-count rational time, explicit gaps for positioning, `available_range` on every media_reference, `Clip.1` + singular `media_reference`, consistent `rate`. Validate by round-tripping through DaVinci Resolve 20. This is the single highest-leverage correction to the existing spec.
3. **Add a second Vectorize index for visual embeddings** (1,024-dim Marengo or CLIP) plus shot-boundary detection. Transcript-only search will fail on archival footage with no dialogue — the core of documentary B-roll.
4. **Make the agent diff-based and citation-first.** Every Director change is a reviewable diff; every claim carries a source in the `sources` table. This is your journalism-credibility moat and your legal-defensibility layer.
5. **Bake legal guardrails into the data model, not the UI afterthought:** attribution logs, clip-length caps, reaction commentary-ratio meter, licensed-music gate, "commercially available alternative" check. **Escalate to a Canadian IP lawyer before monetizing** if reaction/archival use is heavy — the 2025 H3H3 plaintiff suit shows the boundary is where commentary is thin and source use is near-total.
6. **Defer in-app rendering to v2; when you add it, start with Cloudflare Containers/FFmpeg for proxies and Shotstack or Remotion Lambda for finals.** Benchmark real cost per 15-min render before committing; if it exceeds ~$5/video or renders slower than ~1× realtime, keep export-to-Resolve as the default finish.

## Caveats
- Pricing and product details (Descript credits, Eddie AI, Twelve Labs, Cloudflare Containers/Browser Rendering, Shotstack/Creatomate, Supadata) are from 2025–2026 vendor and third-party pages and change frequently; verify current numbers before committing budget.
- Several competitor capabilities (Eddie AI v4 agents joining NLE projects, the Descript API, ChatGPT/Adobe integrations) come from vendor announcements and trade press; treat forward-looking claims as marketing until tested.
- Fair dealing/fair use analysis here is general information, not legal advice; *Hosseinzadeh v. Klein* explicitly does not bless all reaction videos, and post-*Warhol* US law tightened "transformative." Get jurisdiction-specific counsel.
- YouTube scraping/downloading via third-party APIs violates YouTube ToS regardless of transcript-API convenience; prefer licensed/PD/archival sources for anything you redistribute.
- The exact OTIO version bundled in Resolve 19/20 and the `generator_kind` string for solid-black generators were not independently confirmed; validate on your target build. Schema versions above are stable and forward/back-compatible via OTIO's upgrade system.

## Sources

1. [Eddie AI v4 Explained – Visual B-Roll Edits, Reference Edits, an Agent That Joins Your NLE Project | CineD](https://www.cined.com/eddie-ai-v4-explained-visual-b-roll-edits-reference-edits-an-agent-that-joins-your-nle-project/)
2. [H3H3 Productions](https://techcrunch.com/?p=1530683)
3. [developers.cloudflare.com](https://developers.cloudflare.com/changelog/product-group/ai/2)
4. [Vectorize and Workers AI · Cloudflare Vectorize docs](https://developers.cloudflare.com/vectorize/get-started/embeddings/)
5. [The Cloudflare AI Stack: Workers AI, Vectorize, AI Gateway, AI Search (2026)](https://www.cipher.co.th/en/blogs/cloudflare-ai-stack-explained/)
6. [Cloudflare Vectorize Skill | Agent Skills](https://agent-skills.md/skills/secondsky/claude-skills/cloudflare-vectorize)
7. [Free Image and Video API – Pexels](https://www.pexels.com/api/)
8. [We reviewed the top 10 stock video footage APIs so you don’t have to](https://www.plainlyvideos.com/blog/stock-video-api)
9. [H3H3/Ethan Klein Sues 3 Reaction Streamers - Plagiarism Today](https://www.plagiarismtoday.com/2025/06/23/h3h3-ethan-klein-sues-three-reaction-streamers/)
10. [Cloudflare Browser Rendering - Complete Reference Skill | Agent Skills](https://agent-skills.md/skills/ovachiever/droid-tings/cloudflare-browser-rendering)
11. [Changelog · Cloudflare Browser Run docs](https://developers.cloudflare.com/browser-run/changelog/)
12. [cloudflare-browser-rendering - Skill | Smithery](https://smithery.ai/skills/secondsky/cloudflare-browser-rendering)
13. [Frequently asked questions about Cloudflare Browser Run · Cloudflare Browser Run docs](https://developers.cloudflare.com/browser-run/faq/)
14. [Shotstack - Pricing](https://shotstack.io/pricing/)
15. [Creatomate alternatives - Shotstack](https://shotstack.io/vs/creatomate-alternatives/)
16. [Creatomate Pricing & Alternative 2026 — Side-by-Side Comparison](https://json2video.com/how-to/creatomate-alternative/)
17. [YouTube Loudness Normalization — Target LUFS for Video | Critical Listening Lab](https://www.criticallisteninglab.com/en/learn/loudness/youtube)
18. [YouTube Audio Levels: LUFS Targets, True Peak and a Simple Export Checklist – Pure Audio Insight](https://pureaudioinsight.com/blogs/content-production/perfect-youtube-audio-levels-creators-technical-guide)
