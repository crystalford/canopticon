---
id: design-brief-the-build-surface-for-aldershot-the-draft-room
title: "Design Brief: The Build Surface for Aldershot — \"The Draft Room\""
kind: "Build brief"
topic: "Attribution & credit"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-f020d890-fd65-596e-a476-8cd254a25f64_text_markdown.md"
---

# Design Brief: The Build Surface for Aldershot — "The Draft Room"

*A surface where a video essay gets built — from a bare thesis to a structured, sourced, piece-by-piece argument — before (or alongside) Editor X. Written for Claude Design.*

---

## TL;DR
- **Build a new surface, "The Draft Room," that sits between Home and Editor X** and turns a one-line thesis plus the creator's angle into a structured, sourced, iterating argument — points → pieces → documentary — instead of dumping the creator into a timeline-free editor that already assumes footage and a plan exist.
- **The core object is the Point (beat) card**, carrying the claim in the creator's words, their angle, drafted voiceover (gold), attached/proposed clips (green/cyan), generated device objects (violet), a shown-not-scored coverage meter, and clearly marked gaps. Points assemble into Pieces (5-minute mini-docs), which nest into long-form documentaries and recur across videos about the same figure.
- **The system does a real first pass instantly** ("Here's what I found") — expanding the thesis into candidate points, drafting voiceover to be rewritten, listing where footage can be *fetched* (royalty-free/public-domain) vs. where the creator must *go get it* (VOD archives, community clips), and proposing montages over voiceover with runtime estimates — then compounds session over session, with the creator's voice always leading and every AI contribution easy to reject.

---

## Key Findings

**1. Great video essays are built script-first, from a falsifiable thesis and 4–6 supporting sections.** Practitioner guides converge on the same skeleton: a focused *question* becomes a *thesis* ("a claim that could in principle be disproven"), which is outlined into 4–6 sections, then written as spoken prose — "full sentences, not bullet points — bullet lists sound like bullet lists when spoken." Natural narration runs at about 140–150 words per minute ("A script at 140–150 words per minute sounds like natural conversation," per teleprompter.works' 2026 guide; voice pro Lance Blair pegs documentary/eLearning narration at "around 140 words per minute"). This gives Aldershot a concrete rule for turning drafted voiceover into runtime: **~140 words ≈ 60 seconds**, so a coverage meter can estimate seconds-needed directly from a point's drafted script.

**2. Documentary practice already has the two objects this surface needs: the A/V script and the paper edit.** The two-column A/V script pairs *visuals* (left) with *audio/narration* (right) and is written *before* filming to "plan what visuals to capture"; the paper edit organizes real material into a narrative "before moving into an NLE." Peter Thompson's classic 1989 two-column template even recommends a **third column for story structure**, and using *strikethrough* rather than deletion so "you might change your mind tomorrow" — a direct precedent for Aldershot's "Left out, with reasons" and undo-everywhere principles. This validates the Draft Room's central layout: **claim/structure ▸ voiceover ▸ footage**, per point.

**3. The best "build before you make it" tools share a spine: linked views, a living outline, and cheap rejection.** Scrivener keeps Binder, Corkboard, and Outliner "always linked" so reorganizing in one reorganizes all three, and deliberately blurs "preparation and writing" so the same tools plan *and* build. Final Draft's Beat Board → Outline → Script is an explicit **"1-2-3 Workflow"** with color-coded beats; Arc Studio's Plot Board offers blank or templated (three-act / Save the Cat) starts and surfaces outline info while you write. Gamma turns an outline into a deck and lets you "change the outline, regenerate, and see improved results" — but its own guides warn the outline is "your last cheap edit" and that "you're still the one steering the story." Sudowrite's Story Engine (v3.0, 2026) goes premise → beats → prose and treats the outline as "a living document, not a prison."\[1\] NotebookLM + Perplexity model discovery → grounded synthesis. **What to borrow:** linked overview/detail zooms, a regenerable-but-editable outline, color-coded units, and one-keystroke accept/reject. **What to avoid:** Gamma-style "click generate and get a finished thing" (feels done, discourages building) and Sudowrite-style full auto-drafting of the argument (removes the author's voice).

**4. Mixed-initiative theory says share the wheel and make rejection nearly free.** Eric Horvitz's "Principles of Mixed-Initiative User Interfaces" (CHI '99, ACM, pp. 159–166, DOI 10.1145/302979.303030) argues for "an elegant coupling of automated services with direct manipulation."\[2\] Applied HAI guidance (Microsoft's 18 Guidelines; Google PAIR) adds: hand control back the instant the user reaches for it, show provenance, and "design for imperfection." For Aldershot this means the first pass should read as *scaffolding with visible seams*, not a finished draft — every proposed point, line, and clip is a labeled suggestion the creator can edit, dismiss, or regenerate without losing flow.

**5. Juxtaposition is a real, teachable technique — the engine behind "use his logic against him."** The Kuleshov effect (Lev Kuleshov, 1910s–20s) shows viewers "derive more meaning from the interaction of two sequential shots than from a single shot in isolation."\[3\] Soviet montage emphasizes *symbolic* association; the Kuleshov technique emphasizes *emotional* contrast.\[4\] This is the theoretical backbone of the "device object" (montage/flash montage over voiceover) and of the specific move Chris wants: placing a subject's own words against his actions. Aldershot can name this a **Contrast** or **Callback** device and build it from accumulated clips.

**6. Sourcing has a clear legal spine, and it differs between the US and Chris's Canada.** In the US, **fair use** (17 U.S.C. §107) weighs four factors, with *transformative* purpose (criticism/commentary) treated as most important. *Hosseinzadeh v. Klein*, 276 F. Supp. 3d 34 (S.D.N.Y. Aug. 23, 2017): Judge Katherine B. Forrest held the Klein reaction/commentary video "quintessential criticism and comment," a "classic example of fair use," and "decidedly not a market substitute"\[5\] — but the court pointedly refused to rule *all* reaction videos fair, distinguishing commentary from "a group viewing session without commentary."\[5\] In **Canada**, **fair dealing** is a "user's right" limited to a closed list of purposes (research, private study, education, parody, satire, criticism, review, news reporting). *CCH Canadian Ltd. v. Law Society of Upper Canada*, 2004 SCC 13 (para 53), sets six factors: "the purpose of the dealing, the character of the dealing, the amount of the dealing, the nature of the work, available alternatives to the dealing and the effect of the dealing on the work." Critically, for **criticism, review, or news reporting the Copyright Act (ss. 29.1–29.2) requires attribution** — naming the source and the author/performer/maker/broadcaster. **Design consequence:** attach the source clip where a factual claim is made, and auto-capture attribution metadata.

**7. Platform terms bound what the system may fetch.** Automated downloading from YouTube/Twitch is off-limits under their terms, so Aldershot must never auto-scrape. It *can* fetch royalty-free and public-domain material: Pexels/Pixabay video, Creative Commons Search, and the Prelinger Archives — "About 65% of the Archive's holdings are in the public domain (in the U.S.) because their copyrights have expired,"\[6\] and "Over 8,500 public domain films are available for download and unrestricted reuse"\[7\] at the Internet Archive.\[7\] For copyrighted VODs and clips of a specific figure, the surface must switch to **"go get these"** mode: tell the creator exactly where to look (a channel's VOD archive, community clip compilations, subreddit/fan-wiki timestamps) and what to search, then let them download and upload.

**8. Commentary about real people carries light, manageable risk — enough for a thin design layer, not a verification engine.** US defamation requires a *false statement of fact* (not opinion), published, causing reputational harm; public figures must prove **actual malice** — *New York Times Co. v. Sullivan*, 376 U.S. 254 (1964): a public official cannot recover "unless he proves 'actual malice' — that the statement was made with knowledge of its falsity or with reckless disregard of whether it was true or false." *Milkovich v. Lorain Journal*, 497 U.S. 1 (1990) warns there is no blanket "opinion" exemption —\[8\] "In my opinion Jones is a liar" still implies a provable fact — but *pure opinion based on disclosed, accurate facts* is protected (*Gertz*: "there is no such thing as a false idea"). Canada's parallel defence is **fair comment**: an honestly-held opinion on a matter of public interest, based on true facts, that\[9\] "any person could honestly express" (*WIC Radio v. Simpson*, 2008 SCC; *Hansman v. Neufeld*, 2023 SCC 14). Most US states plus D.C. have anti-SLAPP laws. YouTube's harassment policy separately bans "prolonged insults or slurs based on someone's intrinsic attributes"\[10\] and "encouraging abusive fan behavior." **This maps cleanly to two affordances:** distinguish *"my opinion"* from *"what happened"* on each card, and keep the source clip attached wherever a factual assertion is made.

---

## Details

### 3. The surface concept, name options, and where it lives

**What it is.** A calm, dark, "expensive-feeling" workspace where an argument is assembled from cards *before* it becomes a cut. It is not a whiteboard (no infinite empty canvas) and not the editor (no cut to fix). It is the missing middle: **outline + paper edit + pull list, made agentic.**

**Where it lives.** Add it as a **new step between Home and Editor X**, scoped *inside a Project*. Concretely:
- Home composer's **"essay" intent** (which today only scaffolds acts) opens the Draft Room instead of the editor.
- Navigation gains one item. Recommended order: **Home · Draft · Editor · Clipper · Footage · Projects · Settings** (the new "Draft" sits before "Editor" to signal sequence).
- Each Project shows its Draft Room and its cuts side by side; the composition bar (clips green / voice gold / another source cyan / generated violet / empty) carries across both.

**Name options** (pick one; the surface should have a plain, non-cute name in Aldershot's voice):
1. **The Draft Room** *(recommended — plain, filmmaking-native, pairs with "the read" and "rules" already in the product; evokes both "a draft" and a writers' room)*
2. **The Build** *(matches the owner's own words: "building the actual essay")*
3. **The Argument** *(names the true unit of work — the thing being built is an argument)*
4. **The Outline** *(honest but undersells the sourcing half)*
5. **Groundwork** / **The Bench** *(secondary options)*

The rest of this brief uses **The Draft Room**.

### 4. Core objects and their states

| Object | What it holds | Colour role | States |
|---|---|---|---|
| **Thesis** | The one-line claim ("DSP's argument against detractors") | neutral/white | empty · entered · revised (with history) |
| **Angle** | The creator's nuanced take, in their words | gold (it's the creator's voice) | empty · entered · expanded into points |
| **Point (Beat)** | The atomic unit: claim in creator's words · angle tag (*opinion* / *what happened*) · drafted voiceover (gold) · attached clips (green) · another source (cyan) · generated device (violet) · what's empty · coverage (sec covered / sec needed) | mixed | proposed · accepted · drafting · sourced · gap-flagged · left-out (with reason) · ready-for-editor |
| **Piece** | An ordered set of Points = a ~5-min mini-doc segment | neutral | draft · assembled · sent-to-editor · reusable |
| **Pull list** | Per-point list of clips: fetched vs. go-get, with search instructions & attribution | green (fetched) / cyan (external) | empty · proposed · fetched · awaiting-upload · slotted |
| **Device object** | Montage / flash montage / match cut / split screen / speed ramp over a voiceover stretch | violet | proposed (with runtime estimate) · built · placed · rejected |
| **Gap** | An explicit "still missing" marker on a point or piece | dim/outline | open · being-filled · resolved |

**State principles (from the research):** every AI-authored object starts *proposed* and labeled; accept/reject is one action; nothing is auto-deleted (left-out points keep their reason, like the paper-edit strikethrough); the coverage meter is *shown, not scored* (a filling bar, never a match-percentage).

### 5. Step-by-step flows

**Flow A — First round ("Here's what I found").** Triggered the moment the creator enters a thesis + angle. Without waiting, the system:
1. Expands the thesis into **candidate Points** (a rough structure — setup → supporting points → turn/steelman → payoff, per three-act documentary practice).
2. Drafts **one or two voiceover lines per point** (gold, marked "draft — rewrite me").
3. Proposes **where footage comes from** per point: a short *fetched* pull list (green, royalty-free/public-domain) and a *go-get* list (cyan, "search this channel's VODs for…", "check r/… for timestamped clips").
4. Pulls **candidates from the creator's own Footage** library (Moments/Threads/Sources) that match by meaning or exact words.
5. Proposes **device objects** over voiceover stretches with runtime math ("these 20 clips can cover ~30 sec; this montage adds ~40 sec over your thesis VO").
6. **Marks gaps** plainly.
Presentation: results arrive as a **loose column of proposed cards with visible seams**, headed "Here's a first round — nothing here is final." One primary action: *Start building.*

**Flow B — Iterating (slow, compounding).** Across sessions the creator revisits the thesis; splits/merges points; accepts, rewrites, or rejects proposals. As material accumulates, the system **re-proposes structure** ("You now have enough for a 5-min piece — want me to order these?") and offers **juxtapositions** it couldn't before ("You have his 2019 clip and his 2023 clip — a Contrast device would land here"). A **"Since you were away"** strip summarizes what it found or fetched. The creator can always revert.

**Flow C — Sourcing inside the build.** Each point owns its pull list. Fetched clips (green) arrive slotted; go-get clips (cyan) show as *awaiting upload* with instructions. **Uploaded clips auto-slot** into the point whose search they matched. The coverage meter fills as material arrives. Attribution metadata (source + author, for Canadian fair-dealing compliance) is captured on every clip and travels to the editor.

**Flow D — Handoff and skip.**
- **Handoff:** when a Point or Piece is ready, **"Send to Editor"** hands its ordered voiceover + slotted clips + device objects to Editor X as an editable cut. The Draft Room remains the **source of the argument**: edits to structure round-trip back (the read in Editor X links to its originating points; changing a point flags the affected cut).
- **Skip:** creators who already have footage and a plan use the Home composer's other intents (extract, tighten, compose, react) and go **straight to Editor X**, bypassing the Draft Room entirely. A persistent "Open in Editor" is available from any Draft Room state for those who want to jump early.

### 6. Screen-by-screen

**Screen 1 — Draft Room entry (from Home "essay" intent).**
- *Layout:* centered chat-style composer (consistent with today's Home). Field 1: **Thesis** (one line). Field 2: **Your angle** (multiline, gold caret). A quiet note: "Footage optional — we'll find where it could come from."
- *Empty state copy:* "What's the essay about, in one line? Then tell me your take on it."
- *Loading state:* "Reading your thesis… drafting a first round." (No spinner theatrics; a calm progress line.)
- *Primary action:* **See the first round →**

**Screen 2 — The First Round.**
- *Layout:* a single scrollable column of **Point cards** under a header: *"Here's a first round. Nothing here is final — accept, rewrite, or throw out anything."* A right rail shows the **argument shape** (Overview zoom) and a **coverage summary** bar.
- *Each Point card (populated):* title (claim in plain words) · a small toggle **[my opinion | what happened]** · drafted VO in gold with a "rewrite" affordance · a **Footage row** split into *Fetched* (green thumbnails) and *Go get* (cyan rows with search instructions) · a **device suggestion** chip (violet) with runtime estimate · a **coverage meter** (e.g., "0:30 of ~0:45") · a **gap** tag if under-covered.
- *Empty state (no library, no fetch hits):* card still shows drafted VO + go-get instructions + an open gap: "No clips yet — here's where to look."
- *Loading state (fetching):* green thumbnails ghost in with "fetching from Pexels / Prelinger…"
- *Failed state:* "Couldn't reach that archive. Your draft is saved — try fetch again, or upload your own." (Never blocks the build.)

**Screen 3 — Point detail (Blocks/Words zoom).**
- *Layout:* three-zoom parity with Editor X — **Overview** (all points) / **Blocks** (this point's VO + footage lanes) / **Words** (line-level VO editing). A **Seam "+"** between lines inserts *your voice*, *a reaction*, or *a clip* — identical grammar to Editor X so the surfaces feel continuous.
- *Coverage panel:* seconds-covered vs. seconds-needed, computed from VO word count (~140 wpm) and clip durations. Shown as a filling bar, never a score.
- *Copy on a gap:* "This point runs ~0:45 of voiceover but only 0:20 is covered. Want 15 more seconds of montage, or clips to go get?"

**Screen 4 — Pull list (per point).**
- *Layout:* two clearly labeled groups. **We can fetch these** (green; royalty-free/public-domain, one-tap add, license auto-noted). **Go get these** (cyan; each row: what to search, where — "his channel's VOD archive," "community clip compilation," "r/… timestamped thread" — and a drop target). Footer: "Automated downloading from YouTube/Twitch isn't allowed under their terms, so those you'll grab yourself."
- *Uploaded state:* a dropped file animates into its matching point; "Slotted into *the detractor-as-fuel economy.*"

**Screen 5 — Assemble into a Piece.**
- *Layout:* points as draggable cards in order; a running total ("4 points · ~4:40 · 78% covered"). Primary action: **Make this a piece.** Secondary: **Send to Editor.**
- *Copy:* "This is shaping into a 5-minute mini-doc. You can send it to the editor now, or keep filling gaps."

**Screen 6 — Project / series view (recurring coverage of one figure).**
- *Layout:* Pieces as reusable tiles under the Project; branching supported (as Projects already allow). A **"Reuse"** action drops an existing piece into a new video's Draft Room.
- *Copy:* "You've covered this figure before — reuse *the basement-dweller stereotype* piece, or branch it."

### 7. Colour roles and connections to existing surfaces
The Draft Room inherits the product's accent meanings exactly: **gold = your voice/angle**, **green = clips**, **cyan = another source**, **violet = generated (device objects)**, **red = record**, plus a **dim outline for gaps/empty**. This is the same legend as the Projects composition bar, so a point's coverage reads at a glance and stays legible when the piece moves to Editor X. The three zooms (Overview / Blocks / Words) and the Seam "+" grammar are lifted directly from Editor X so the two surfaces feel like one continuous instrument. Footage's Moments/Threads/Sources and "search by meaning or exact words" power the per-point candidate pulls. Undo is everywhere; nothing is auto-deleted; left-out points keep their reasons.

### 8. The worked DSP example
*(Walked neutrally, asserting no facts about the person; all claims are framed as the creator's opinion or as attached-clip evidence.)*

**Thesis (entered):** "DSP's argument against detractors."
**Angle (entered, gold):** "Use his own logic against him: detracting is a valid art form and is basically fuel for his empire; commentary about a person is content like any other; the 'basement-dweller' stereotype vs. the five-minutes-a-day reality; and behaviour provokes reaction — that's how social norms get enforced."

**First round — Points the system proposes:**
1. **The detractor-as-fuel economy** — *opinion.* Drafted VO: "If attention is the currency, then the people mocking you are minting it." *Go-get:* clips where the figure references his critics/numbers (his VOD archive; community compilations). *Fetch:* public-domain "economy/engine" B-roll (Prelinger) for the device. *Device (violet):* a 40-sec montage over the thesis VO. *Coverage:* 0:00 of ~0:50 — **gap open.**
2. **Commentary is content like any other** — *opinion.* Drafted VO + *fetch* generic "internet content" B-roll; *go-get* examples of mainstream commentary for a Contrast device.
3. **The 'basement-dweller' stereotype vs. five-minutes-a-day** — *opinion.* Device: split-screen contrast (violet). *Go-get:* the specific "basement dweller"-type remarks (attach the source clip wherever the video states he said something — factual assertion → clip attached, with attribution captured).
4. **Norm enforcement: why behaviour provokes reaction** — *opinion, with what-happened evidence.* This point mixes an argument (opinion, gold) with factual assertions that must each carry an attached clip (green/cyan) and source attribution.

**Example pull list (Point 1):**
- *We can fetch these (green):* 20 short public-domain / royalty-free clips (engines, printing presses, crowds) — "these 20 clips can cover about 0:30."
- *Go get these (cyan):* "Search his VOD archive for segments where he addresses critics; check the community clip compilation and the timestamped subreddit thread. Download and drop here." (No auto-download — platform terms.)

**Example device over the thesis voiceover:** a 40-sec flash montage (violet) juxtaposing the "fuel/engine" B-roll with the go-get critic-reference clips — a Kuleshov-style Contrast that literally stages "use his logic against him." Runtime note: "This montage covers ~0:40; your thesis VO is ~0:50 — 0:10 gap."

**Gaps shown:** Point 1 needs the go-get clips before the device can be built; Points 3–4 need the specific source clips before any factual line is allowed to stand without attachment.

**Becoming a piece, then a documentary:** once Points 1–4 are covered, "Make this a piece" yields a ~5-minute mini-doc ("*The Detractor Economy*"). Later videos reuse or branch it as one segment of a longer documentary on legacy-creator/audience dynamics, and the same figure's clip library and attributions carry forward across the series.

### 9. Responsible-commentary layer (light, not a verification engine)
Keep it minimal — heavy fact/claim/evidence verification belongs to CANOPTICON. In the Draft Room, add only:
- **The opinion/fact toggle** on every Point and, ideally, every VO line: **[my opinion | what happened].** Grounded in *Milkovich* (labeling something "opinion" doesn't cure a factual implication) and Canada's fair-comment rule (opinion must be recognizable as comment).
- **Clip-attached factual assertions:** when a line is marked *what happened*, the card nudges: "Attach the clip this refers to." This supports both fair-use/fair-dealing (evidence for a specific claim) and defamation safety (a true, shown fact isn't defamatory).
- **Attribution auto-capture** on every clip (source + author/creator) — required by Canadian fair dealing for criticism/review, and good practice everywhere.
- **A one-line wording nudge**, not a lecture: "Opinions read as opinions are safest — 'I think this is grifting' lands differently from 'this is fraud.'"
- **A quiet harassment guardrail:** if a line targets intrinsic attributes or invites pile-ons, a soft flag ("This reads as an attack on the person, not the behaviour — YouTube's harassment policy covers this"). No blocking, no scoring.

### 10. What NOT to build
- **No timeline** — this is not the editor; it's upstream of the cut.
- **No "click generate → finished essay."** The first pass must feel like *scaffolding with seams*, not a done thing (the Gamma trap). If it looks finished, creators stop building.
- **No auto-drafting the whole argument in the AI's voice.** The angle and VO are the creator's; AI drafts are labeled and disposable.
- **No match-score percentages or confidence numbers.** Coverage is *shown* (a filling bar), per the product's existing principle.
- **No streaks, badges, points, or cute copy.**
- **No "second brain" / knowledge-graph framing.**
- **No automated YouTube/Twitch downloading** — ever. Fetch only royalty-free/public-domain; everything else is "go get these."
- **No verification engine, no truth-scoring, no citation-checking** — that's CANOPTICON's job. Keep only the light opinion/fact + attach-the-clip layer.
- **No forced structure.** Templates (three-act, etc.) are offered, never imposed (the Arc Studio "blank or template" model).

---

## Recommendations

**Stage 1 — Ship the spine (MVP).** Build Screens 1–3: thesis+angle composer → first-round column of Point cards → point detail with the three zooms and Seam "+". Reuse Editor X's read/zoom/seam components wholesale. Wire the coverage meter to the **~140 wpm** rule. Success threshold: a creator can go from a one-line thesis to 4–6 accepted, VO-drafted points in a single session without touching the editor.

**Stage 2 — Sourcing.** Add Screen 4 pull lists with the **fetch vs. go-get** split, royalty-free/public-domain fetch (Pexels, Pixabay, CC Search, Prelinger/Internet Archive), auto-slotting of uploads, and attribution auto-capture. Threshold to proceed: uploaded clips reliably land in the right point, and every clip carries source+author metadata.

**Stage 3 — Pieces, iteration, handoff.** Add Screens 5–6 (assemble → piece → reuse/branch), "Since you were away," device objects (montage/contrast/callback) with runtime estimates, and the round-tripping **Send to Editor** / **Open in Editor** handoff + skip. Threshold: a piece sent to Editor X remains linked to its points, and editing a point flags the affected cut.

**Stage 4 — Responsible-commentary layer.** Add the opinion/fact toggle, attach-the-clip nudge, wording nudge, and soft harassment flag. Keep it to these four; resist scope creep toward verification.

**Benchmarks that would change the plan:** if creators consistently *skip* the Draft Room straight to the editor, shrink it to a lightweight pre-editor "outline strip" rather than a full surface. If the first pass is perceived as "too finished," increase the visibility of seams and the labeling of proposals. If fetch hit-rates for a given essay are low (niche subjects), lean harder into go-get instructions and de-emphasize fetched B-roll.

---

## Caveats
- **Legal notes are practitioner-level, not legal advice.** Fair use (US) and fair dealing (Canada) are decided case-by-case; *Hosseinzadeh v. Klein* explicitly declined to bless *all* reaction/commentary videos. Canada's fair dealing is a *closed* list of purposes and **requires attribution** for criticism/review — design must enforce attribution capture, and the brief recommends Chris keep a lawyer on call for edge cases.
- **Defamation exposure is real but bounded for public figures.** *NYT v. Sullivan*'s actual-malice bar and *Milkovich*/*Gertz*'s opinion protections favour honest, fact-based commentary; the design layer is a nudge, not a shield. Whether a given streamer is a "public figure" is fact-specific.
- **The DSP walkthrough asserts no facts about the person.** Every substantive claim in the example is framed as the creator's opinion or as evidence to be attached; this framing should be preserved in the product's own copy.
- **Some precedent details are vendor-published.** Final Draft 13's pricing ($199.99, discounted from $249.99), Sudowrite Story Engine v3.0 (2026), and Gamma's "first draft in under a minute" come from the vendors' own materials and reviews; treat as directional, not audited.
- **Runtime math is an estimate.** The ~140–150 wpm figure is a narration convention, not a guarantee; the coverage meter should be labeled as an estimate ("~0:45"), never a precise promise.
- **Platform terms change.** The "fetch vs. go-get" boundary depends on current YouTube/Twitch/stock-platform terms; the fetch allowlist should be maintained, not hard-coded.

---

## Open questions for Chris
1. **Name:** "The Draft Room," "The Build," or "The Argument"? (Recommendation: The Draft Room.)
2. **Nav vs. nested:** a top-level "Draft" step, or purely inside Projects reached via the Home "essay" intent?
3. **Granularity of the opinion/fact toggle:** per Point, per VO line, or both?
4. **Structure templates:** offer three-act / steelman-turn-payoff scaffolds, or stay fully freeform with only AI-proposed order?
5. **Device vocabulary:** do "Contrast," "Callback," "Montage," "Flash montage," "Split screen," "Speed ramp" match how you think, or do you want different names?
6. **Coverage display:** a filling bar only, or bar + plain-text seconds ("0:30 of ~0:45")?
7. **Fetch allowlist:** start with Pexels + Pixabay + CC Search + Prelinger/Internet Archive, or a narrower/wider set?
8. **Handoff granularity:** send individual Points to Editor X, or only whole Pieces?
9. **CANOPTICON boundary:** where exactly does "attach the clip" (here) end and claim/evidence verification (there) begin — and should the Draft Room deep-link into CANOPTICON when a claim needs real checking?
10. **Series memory:** how much should the surface proactively resurface prior pieces/clips about the same figure vs. waiting to be asked?

## Sources

1. [Your Outline Sucks: Fix It with Sudowrite's Scenes | Sudowrite](https://sudowrite.com/blog/your-outline-sucks-heres-how-to-use-sudowrite-beats-to-fix-it/)
2. [Principles of mixed-initiative user interfaces | Proceedings of the SIGCHI conference on Human Factors in Computing Systems](https://dl.acm.org/doi/10.1145/302979.303030)
3. [Kuleshov effect](https://en.wikipedia.org/wiki/Kuleshov_effect)
4. [What is the Kuleshov Effect? +How to Use It With Examples | Envato Tuts+](https://photography.tutsplus.com/articles/what-is-the-kuleshov-effect-how-to-use-it-with-examples--cms-108500)
5. [Judge sides with YouTubers Ethan and Hila Klein in copyright lawsuit | TechCrunch](https://techcrunch.com/2017/08/23/judge-sides-with-youtubers-ethan-and-hila-klein-in-copyright-lawsuit/)
6. [Prelinger Archives — Collections — The Public Domain Review](https://publicdomainreview.org/collections/source/prelinger-archives/)
7. [Prelinger Archives](https://en.wikipedia.org/wiki/Prelinger_Archives)
8. [www.law.cornell.edu](https://www.law.cornell.edu/supremecourt/text/497/1)
9. [Defence of fair comment: What it is and how it works | Lexpert](https://www.lexpert.ca/news/legal-faq/defence-of-fair-comment-what-it-is-and-how-it-works/389555)
10. [Harassment & cyberbullying policies - YouTube Help](https://support.google.com/youtube/answer/2802268?hl=en)
