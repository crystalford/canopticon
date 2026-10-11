---
id: aldershot-product-concept-dossier
title: "ALDERSHOT: Product Concept Dossier"
kind: "Build brief"
topic: "Attention & feeds"
date: "2026-09-01"
shelf: ""
listed_in_library: false
source_file: "uploads/researchreports2/compass_artifact_wf-b2e78f30-d6dc-5d8d-839e-8e0f987e0cd1_text_markdown.md"
---

# ALDERSHOT: Product Concept Dossier
## An AI-native studio for documentary and video essays that makes the human more visible, not less

## TL;DR
- **Aldershot's thesis is that in a feed drowning in generative "slop," the scarce and valuable things are exactly what AI cannot fake — a creator's voice, taste, presence, and verifiable sourcing — so Aldershot should automate the drudgery of research, logging, and assembly while amplifying and protecting the human's authorship and evidence.** The product's defining move is inverting Descript's economics and philosophy: not "cheaper Descript," but a *documentary studio in a box* organized as an evidence-driven investigation workspace where every claim is backed by a real, inspectable source.
- The single biggest swing is the **"receipts layer": documentaries that ship with their evidence locker attached**, turning trust and provenance from a compliance burden into the signature experience and the moat — directly answering a documented 2025 collapse in audience trust (in Checkr's 2025 "Great Untrust" report, 39% of Americans said their single greatest AI fear is "not knowing what's real anymore," ranking above scams and identity theft) and the documentary industry's alarm over AI-generated imagery.
- The core architecture should be a set of **rooms** — the War Room (research/evidence), the Writers' Room (script + outline engine), the Recording Booth (blocked host-recorded lines), the Edit Bay (transcript-as-editor), and the Screening Room (cuts + receipts) — unified by one persistent source of truth (the creator's accumulating library and research graph), which is also the long-term moat.

## Key Findings

1. **The medium is inverting.** Video essays and documentaries have always been "found in the edit" — assembled from a mountain of footage through paper edits, string-outs, and radio cuts. AI collapses the labor of that pipeline (transcription, logging, first-pass selection) without collapsing the judgment. The product's job is to automate the highlighter, not the author.

2. **Scarcity has flipped.** As generative video floods every platform, homogenization is empirically real: Doshi & Hauser (Science Advances, July 2024) found that "generative AI–enabled stories are more similar to each other than stories by humans alone... an increase in individual creativity at the risk of losing collective novelty." Audience trust is cracking (39% of Americans name "not knowing what's real anymore" as their top AI fear — Checkr, 2025). The market will reward voice, presence, primary sources, and verifiable provenance — precisely the things Aldershot should refuse to automate.

3. **The winning interaction paradigm is mixed-initiative, evidence-bounded co-authorship.** Horvitz's mixed-initiative principles plus the essay-outline engine's existing "no unbacked claims / visible gaps" rule give Aldershot a distinctive stance: the AI drafts, sources, and assembles, but it may only cite what actually exists in the library, and it must show its gaps.

4. **The precedent tools all made a hidden thing directly manipulable.** Descript made the transcript the editor; Photoshop made compositing into layers; Figma made collaboration a feeling; Notion made documents into blocks. Aldershot's equivalent move is to make *the argument and its evidence* the manipulable object — a "narrative/evidence graph" you edit like text.

5. **Trust can be a feature, not a constraint.** A concrete standards ecosystem already exists to build on: the Archival Producers Alliance's Best Practices for GenAI in documentary, C2PA Content Credentials, and BBC Verify. Aldershot can ship the first consumer-grade "verified documentary" experience.

## Details

### 1. The medium itself, and a McLuhan tetrad

**What a video essay/documentary fundamentally is.** The essay-film tradition frames the form as *thinking on film* — a first-person line of argument fusing narration and image. Chris Marker's *Sans Soleil* (1983) is the canonical case: a "cinematic thinking process," a visual autobiography built from asides and digressions, narrated through a fictitious cameraman, where "memories are manifested as film images."\[1\] Marker's own principle — "Contrary to what people say, using the first person in films tends to be a sign of humility: 'All I have to offer is myself'"\[2\] — is the emotional core Aldershot must protect. Adam Curtis represents the other pole: the archive as instrument, "marrying the archive to the editing suite in the church of his own taste,"\[3\] using montage and pop-music counterpoint to "create a feeling"\[4\] that "bypasses rational analysis." Both traditions share a lesson central to Chris's "Gavel problem": *imagery is assembled, not illustrated*, and meaning lives in juxtaposition, not literal depiction.

Harun Farocki's concept of the **"operational image"** — "images that perform or participate in tasks... not for edification, not for reflection" — is unexpectedly the deepest lens for an AI-native documentary. AI-sourced and AI-generated footage is, natively, operational imagery: made by machines, for machine processes, then repurposed for human perception. Aldershot's aesthetic challenge is Farocki's: convert operational images (search results, clip-scouting matches, auto-generated B-roll) into "artistic discourse" rather than letting them flatten into slop. The desktop-documentary movement (Kevin B. Lee, Chloé Galibert-Laîné, Catherine Grant's [in]Transition work) already showed the way — "desktop subjectivity," treating the screen "as both a camera lens and a canvas,"\[5\] embedding "each video, image or news article... as I found it, in its original interface." That is a ready-made native aesthetic for an AI research tool: don't hide the research surface, *perform* it.

**McLuhan tetrad of the AI-native documentary:**
- **Enhances:** speed and volume of research, sourcing and assembly; the solo creator's reach toward "team-scale" output; the density of evidence a single video can carry.
- **Obsolesces:** the manual paper edit / string-out / logging drudgery; the credit-metered scarcity of tools like Descript; stock-footage "illustration"; the funded team as a *precondition* for ambitious work.
- **Retrieves:** the essay-film's first-person authorship and the Curtis/Marker "church of one's own taste"; the investigative evidence board / research wall; the artisanal, hand-assembled montage; orality (the recorded human voice returns to the center).
- **Reverses into:** slop and homogenization when pushed to full automation — a flood of indistinguishable AI documentaries, collapse of audience trust, and the "creative scar." (Doshi & Hauser's co-author Oliver Hauser frames the mechanism as a social dilemma: because AI-inspired writing is rated more creative, individuals are incentivized to use it more, "but by doing so the collective novelty of stories may be reduced further.") This reversal is the central risk the product design must resist.

The "medium is the message" of an AI-authored documentary is this: **when the edit becomes automated, the automation itself becomes the message** — audiences increasingly read "this was made by a machine" as the meaning, and (per the "trust penalty" research) discount it. Therefore the product must make the *human's* fingerprints — voice, presence, sourcing, judgment — the figure, and push the automation to the ground. Figure/ground: the AI should be ground (infrastructure); the author and evidence should be figure.

### 2. What becomes scarce and valuable

The homogenization research is now robust. Doshi & Hauser (Science Advances 10(28):eadn5290, July 2024) found AI assistance made individual stories more creative but converged them toward each other, raising "individual creativity at the risk of losing collective novelty"; follow-on work describes a "creative scar" where induced homogeneity keeps climbing months after AI is withdrawn. Lexical diversity drops; outputs converge. In a market of converging content, **divergence is the scarce asset** — and divergence comes from the human's idiosyncratic taste, not the model.

On the demand side, trust is the story. Checkr's 2025 "Great Untrust" report (3,000 US consumers) found the top AI fear was "not knowing what's real anymore" (39%), ranked above scams and identity theft, and "shared equally across all generations." Documentary professionals at IDFA 2025 warned that AI-generated images produce "a sense of mistrust towards documentary filmmaking,"\[6\] with panelists cautioning people "will stop believing anything."\[7\] Marketing research (NIM) shows a measurable "trust penalty" for content audiences perceive as machine-made, and that transparency labels alone "reveal a fundamental problem but don't solve it." The Animoto 2025 study's conclusion is the design brief: "Let AI handle production tasks like transcription and initial edits, but keep humans visible in the final video."

**What Aldershot should amplify vs. automate:**
- *Automate (ground):* transcription, logging, clip scouting, first-pass selects, string-outs, reframing, captions, format conversion, research retrieval, citation tracking.
- *Amplify (figure):* the creator's voice (literal recorded voice and editorial POV), taste decisions, the argument's structure, the choice of what's true and what matters.
- *Deliberately do NOT intervene:* the writing of the core thesis; the final judgment on a contested claim; the host's on-camera presence and delivery; the moral choices in an investigation. These are where "the human's struggle, taste, or presence is the value" — and, per the research, where automation destroys trust and homogenizes.

### 3. Paradigm-shift precedents

Every breakthrough creative tool made a *previously hidden or expert-gated layer* into a directly manipulable object:
- **Descript / text-based editing** made the transcript the timeline ("if you can edit text, you can edit video"). Recent HCI work (arXiv 2509.16811) notes these tools "operate at the clip or asset level and do not maintain a persistent, editable representation of *narrative structure*" — precisely Aldershot's opening.
- **Photoshop layers, Figma multiplayer, Notion blocks, GarageBand, CapCut templates** each lowered a threshold and, crucially, changed how the work *felt* ("collaboration as a feeling"; "note-taking as a playground for structure and self-expression").
- **Cursor / agentic coding** established the current frontier paradigm: an agent that acts across a whole project under human direction, with the human reviewing diffs and keeping the wheel.

The tools-for-thought lineage points at the highest ambition. Engelbart's augmentation, Bret Victor's **explorable explanations** ("a reading environment could become an environment to think in" by embedding live models, not just presenting data — and his warning against "dead fish," immutable figures you can't manipulate), Andy Matuschak's work, and Ink & Switch's malleable/local-first software all argue for artifacts that are *interactive and inspectable*. Horvitz's **mixed-initiative** principles (1999) — share the wheel; hand control back the instant the user reaches for it; use dialog to resolve uncertainty the model can't; make rejection nearly free — are the interaction bible for Aldershot's chat-and-verbs surface.

**The paradigm Aldershot could pioneer:** *evidence-bounded, mixed-initiative narrative authoring* — an agent crew that researches and assembles, but is constitutionally constrained to cite only real library clips and to render every unbacked beat as a visible, labelled gap. This is Chris's existing essay-outline principle elevated to the product's core interaction law.

### 4. How real makers work — and the "team you can't afford"

The documentary process is remarkably consistent: research wall → paper edit (reading transcripts, marking passages) → selects → string-out → radio cut → assembly → rough cut → fine cut. "The film is found in the edit." A paper edit works "because reading is faster than watching" — an editor reads an hour-long transcript in ten minutes. The drudgery is explicit: "Making the string-out from the paper edit, timestamp by timestamp, takes forever... There's no creativity in the process." The layered timeline discipline (STRINGOUT\[8\] → SELECTS → STORY → CUT) is exactly the structure Aldershot can automate the mechanics of while preserving the judgment.

The joy is in the finding — the unexpected juxtaposition, the archival gem, the moment the story clicks. The drudgery is logging, timestamp translation, format wrangling, and the sheer inability of one person to do the work of a research team, a writers' room, an assistant editor, and a fact-checker at once. **The "team you can't afford" is Aldershot's product definition:** a researcher, an archivist/assistant editor, a story editor, and a fact-checker, available to a solo creator — the roles a funded channel (Vox; Johnny Harris's team, whose credits include named story editors and researchers; LEMMiNO; Folding Ideas) has and a solo journalist in Niagara Falls does not.

### 5. Core metaphor and architecture

Evaluated framings:
- *Documentary studio in a box* — warm, accurate, but generic.
- *Newsroom* — implies speed/commodity news, wrong register.
- *Writers' room* — captures ideation but not evidence or edit.
- *IDE for narrative* — powerful and true (Cursor analogy), but cold for a creative audience.
- *Investigation workspace / evidence locker* — the most distinctive and defensible, and it directly encodes the trust moat.
- *Instrument you play / collaborator with taste* — the right emotional aspiration.

**Recommended synthesis: an investigation studio organized as rooms, playable like an instrument, defensible like an evidence locker.** The rooms map onto the real workflow and give the product a legible spatial architecture:
- **The War Room** — research and the evidence board; the persistent research graph; sources come alive as inspectable objects.
- **The Writers' Room** — the essay-outline engine; structure the argument; every beat backed or flagged as a gap.
- **The Recording Booth** — blocked, teleprompter-style host-recorded lines; the creator records only their parts and everything flows as one continuous piece.
- **The Edit Bay** — the transcript-as-editor; strike words to cut; contextual text-based editing with toggles.
- **The Screening Room** — watch the assembled cut with its receipts layer; export many formats from one source of truth.

The unifying substance is the **source of truth**: one persistent, accumulating library + research graph per creator, which every room reads and writes. This is both the UX spine and the moat.

### 6. New formats — the big swings, ranked

**Tier 1 — Achievable and distinctive (build first):**
1. **The receipts layer / evidence locker.** Videos ship with an inspectable evidence panel: every claim links to its source clip, document, or citation; unbacked beats are visibly flagged. Grounded in the essay-outline engine that already exists, in C2PA Content Credentials, and in the Archival Producers Alliance guidelines. This is the signature experience and the moat.
2. **One investigation, many cuts.** From one source of truth, generate a 60-second vertical, a 10-minute explainer, a 60-minute documentary, a podcast, and an article. Directly rides the documented long-form + short-form + podcast convergence and YouTube's move to the TV screen.
3. **Reverse documentary.** Start from a footage/library and let the agent find the story — the "footage-led paper edit" automated. High value for creators sitting on archives.

**Tier 2 — Ambitious and differentiating:**
4. **Living documentaries that update and self-correct** as facts change — the video as a versioned, maintainable artifact with a visible correction history (trust feature, not gimmick).
5. **The channel as a canon / knowledge graph** — every video builds on a persistent body of research; new work can cite and reuse the creator's own prior evidence. This compounds the moat.

**Tier 3 — Moonshots (validate demand before investing):**
6. **Explorable/interactive documentaries** in the NFB lineage — *Bear 71*, *Out My Window/Highrise*, *Welcome to Pine Point* (the NFB devotes 20% of its production budget to interactive works). Combine "linear, story-driven audio with exploratory imagery."\[9\] Genuinely valuable for education/investigation; risk is high production effort per piece and uncertain audience appetite outside festivals.
7. **Collaborative/crowd-sourced investigations** in the Bellingcat/Forensic Architecture mold — "open verification," multi-source triangulation, a volunteer community. Powerful for investigative journalism; risk is moderation and verification burden.
8. **Branching/personalized documentaries** — lowest priority; mostly gimmick outside specific educational uses.

### 7. Authorship, voice and taste as the product

The through-line of Chris's Gavel framework — register extraction, symbolic displacement, director–painter–cinematographer "triples," voiceover-image modes, the six scene-population roles — is a *taste engine*. The strategic insight from the homogenization research is that **taste is the anti-slop moat**: since AI converges to the mean, a system that encodes and applies a creator's specific, idiosyncratic visual and editorial grammar produces the divergence audiences reward.

This suggests making **"looks," "voices," and editorial sensibilities into first-class, ownable, potentially shareable/tradeable assets** — the triples as saveable per-project visual grammars; voiceover-image modes (illustrate, counterpoint, diverge, held abstract) as toggles; the register-extraction logic as a reusable style object. Designing for taste means the product should have opinions and let the creator overrule them cheaply (mixed-initiative), accumulating a personal grammar over time. This is also a marketplace opportunity: a creator's signature "look" could be licensed — though this risks accelerating homogenization if looks become templates, so it should be gated toward *composition* over *copying*.

### 8. Trust and ethics as a signature feature

This is Aldershot's clearest wedge into investigative journalism and its strongest differentiator. A concrete standards scaffold exists:
- **Archival Producers Alliance (APA) Best Practices for GenAI in Documentaries** (published September 2024, launched at the Camden International Film Festival; a Tool Kit and Case Studies followed in 2025). Four named areas: *the value of primary sources, transparency, legal considerations, and ethical considerations when using human simulations*.\[10\] It distinguishes\[10\] **inward transparency** (with teams, distributors, subjects) from **outward transparency** (with audiences), and recommends concrete practices:\[10\] temporary watermarking of GenAI material during editing, and **cue sheets recording prompts, software version, date, descriptions, and timecodes for every GenAI element**. On disclosure, it advises rendering it in the film's own "visual vocabulary" rather than a blunt "generated by AI" watermark. Endorsed by\[11\] NBC Universal Academy and 30+ documentary production companies in the US and Canada; the APA had\[12\] 300+ members in 2024, growing past 500 by 2025–26; developed with input from\[13\] Stanford, MIT Media Lab, PBS, and a UCLA law clinic.
- **C2PA Content Credentials** — the open "digital nutrition label" standard co-founded\[14\] February 2021 by Adobe, Microsoft, BBC, Arm, Intel, and Truepic; the Content Authenticity Initiative passed 5,000 members in 2025 and Content Credentials shipped in consumer devices (Samsung\[15\] Galaxy S25, January 2025; Google Pixel 10, September 2025). Caveat: Golaszewski et al. (2026), "Verifying Provenance of Digital Media: Why the C2PA Specifications Fall Short" (arXiv 2604.24890), found the specs "currently flawed, incomplete, inconsistent, and vulnerable to misuse," and advise treating C2PA as "an emerging technology, not a mature solution." Aldershot should therefore treat provenance as *one signal among several*, not proof.
- **BBC** launched Content Credentials publicly in March 2024, initially on content from its **BBC Verify** team. In the BBC News Labs "News for All" trial (reported in BBC written evidence to UK Parliament, MLI0053), "83% of participants reported increased trust in the media after seeing content credentials; 96% found the feature useful; and 96% found it informative" — though the BBC notes this skews toward existing BBC audiences.

**A "verified documentary" standard, Aldershot-native:** every export carries a provenance manifest (what's real footage, what's archival with source, what's AI-assisted and how), the cue sheet is generated automatically, disclosure is rendered in the film's own visual vocabulary (per APA's advice against blunt watermarks), and the receipts layer is the audience-facing proof. This turns the APA guidelines and C2PA from compliance overhead into the product's headline experience.

### 9. Who it's for, and the wedge

**Archetypes and jobs-to-be-done:**
- *Solo investigative creator/journalist (Chris himself; the beachhead):* "Do the work of a team I can't afford, without diluting my voice or my credibility."
- *Video essayist:* "Compress research and assembly so I can publish more of my ideas."
- *Educator / documentary student:* "Teach argument-from-evidence; make sources inspectable."
- *Small newsroom / nonprofit:* "Produce trustworthy visual investigations at low cost with a defensible provenance trail."
- *Researcher / knowledge worker:* "Turn a body of research into explanatory video."

**The wedge:** the solo investigative/video-essay creator who is priced out or credit-throttled by Descript and repelled by "stock-footage slop." The market timing is strong: long-form is booming (per Tubular Labs via eMarketer, US creators uploaded 6.6 million videos ≥20 minutes in Q1 2026, a 53.5% jump from 4.3 million in Q1 2023); YouTube is now the TV-screen leader (more\[16\] than 50 of YouTube's global top 100 channels by watch time had TV as their most-watched screen in 2025); and the documentary/video-essay format is explicitly ascendant. **Long-term ambition:** become the system of record for evidence-based visual storytelling — the place a creator's entire investigative corpus lives, compounds, and ships in any format, with trust built in.

### 10. Signature experiences and delight

- **First run:** point Aldershot at a topic or a folder of footage and watch the War Room populate an evidence board with real, inspectable sources — the "team showed up" moment.
- **The recording session:** the teleprompter feeds blocked lines; you record only your parts; the piece flows as one continuous cut — the "I only had to be the host" moment.
- **First assembled cut:** watching a full rough cut appear from your research, with gaps honestly flagged rather than papered over — the "it didn't lie to me" moment.
- **Sources come alive:** clicking a claim in the Screening Room and seeing the exact clip/document behind it — the "receipts" moment that builds trust in the tool the way BBC's credentials built trust with audiences (83% increased trust in the trial).

The research on emotionally compelling software (Figma, Notion — where "you can sense the presence of a designer at the core") points to *feel* and *coherence* over feature count; healthy habit formation should come from the compounding library and the pride of a finished, defensible piece, not dark-pattern engagement loops.

### 11. Moats and positioning

**Moats, in order of durability:**
1. **The accumulating library + research graph** (switching cost compounds with every project).
2. **Trust brand / verified-documentary standard** (hard to retrofit; first-mover advantage in a market desperate for it).
3. **Taste assets** (triples, looks, voice modes) that encode divergence against a homogenizing field.
4. **Format innovation** (receipts layer, one-source-many-cuts, living docs).
5. **Community** (especially if collaborative investigations mature).

**Positioning against incumbents:** Descript, CapCut, and Opus Clip "operate at the clip or asset level and do not maintain a persistent, editable representation of narrative structure." Aldershot's one-sentence position: *"Descript edits your clips; Aldershot builds your case."* Against generative-video tools (which produce the slop audiences distrust), Aldershot's stance is the opposite: **assembled from real evidence, not conjured** — the anti-slop, pro-provenance documentary studio. Do not compete on being a cheaper Descript; compete on being a category Descript isn't in.

## Recommendations

**Stage 0 — Sharpen the wedge (now):** Position explicitly as "the team you can't afford" for solo investigative and video-essay creators. Keep the evidence-bounded rule (only real clips; visible gaps) as the product's constitutional law — it is the differentiator, not a limitation. *Benchmark to advance:* Chris and a handful of design-partner creators can take a project from topic to publishable cut faster than their current workflow, without voice dilution.

**Stage 1 — Ship the receipts layer (next):** Make provenance the headline experience. Auto-generate the APA-style cue sheet, render disclosure in the film's own visual vocabulary, and give every export an inspectable evidence panel. Adopt C2PA Content Credentials but treat them as one signal (given the documented vulnerabilities), backed by your own receipts. *Benchmark:* audiences and design partners report the receipts layer increases trust (mirror the BBC's 83%/96% trial framing with your own users).

**Stage 2 — One source, many cuts (then):** Ship 60s/10m/60m/podcast/article export from one source of truth to ride the long-form + short-form + podcast convergence and YouTube-on-TV trend. *Benchmark:* creators publish across ≥3 formats from a single Aldershot project without re-editing.

**Stage 3 — Compound the moat:** Turn the library into a channel-level knowledge graph (every video builds on prior research) and make taste assets (triples, looks, voice modes) saveable and reusable. *Benchmark:* returning creators reuse prior evidence/looks in new projects — the switching cost is now real.

**Stage 4 — Validate the moonshots:** Prototype one living/self-correcting documentary and one explorable piece (NFB lineage) with a design partner before committing roadmap. *Threshold to invest:* a moonshot must show either clear audience pull or a trust/differentiation payoff that Tier 1–2 features don't already deliver.

**What would change the plan:** If audience trust research reverses (audiences stop penalizing AI content), de-emphasize the receipts moat and lean into speed/volume. If homogenization pressure proves less commercially punishing than expected, taste assets drop in priority. If Descript ships a persistent narrative/evidence layer, accelerate the community and trust-brand moats, which they cannot quickly copy.

## What NOT to build
- **Don't automate the thesis, the contested-claim judgment, or the host's presence.** These are where value and trust live; automating them triggers the trust penalty and homogenization.
- **Don't build a generative-video "slop" engine.** It competes on the exact axis audiences distrust and undermines the trust moat.
- **Don't over-invest in branching/personalized docs** — mostly gimmick outside narrow educational cases.
- **Don't treat C2PA as proof** — it is a signal with documented vulnerabilities; the human-inspectable receipts layer is the real trust product.
- **Don't build dark-pattern engagement loops** — habit should come from a compounding library and finished, defensible work.
- **Don't turn taste "looks" into copy-paste templates** — that accelerates the homogenization you're positioned against; gate them toward composition.

## Open questions Chris should decide
- **Audience-facing vs. maker-facing trust.** Is the receipts layer primarily a *creator* confidence tool (the model didn't lie to me) or a *viewer* trust artifact (published with the video)? The answer reorders Stage 1.
- **How opinionated should the taste engine be?** A collaborator "with its own taste" is emotionally powerful but risks overriding voice; where is the dial between suggestion and imposition?
- **Marketplace for looks/voices — yes or no?** It's a moat and a revenue line, but also a homogenization vector. Composition-only licensing may thread it.
- **Investigative journalism vs. video-essay creator as the true beachhead.** Both are served by the same core, but they imply different trust bars, different go-to-market, and different tolerance for automation.
- **Compete with Descript directly, or route around it?** "Build your case" vs. "edit your clips" is a category-creation bet; the alternative is a faster, cheaper editor that fights on Descript's turf.
- **Where does generated imagery belong at all?** Given the trust penalty, is any synthetic footage acceptable in a "verified documentary," or is Aldershot's brand purity (assembled from real evidence only) itself the differentiator?

## Caveats
- Several trend datapoints (creator-economy figures, YouTube-on-TV shares, long-form upload growth) come from industry/vendor sources (eMarketer/Tubular, Think with Google, trade press) and reflect a genuine but commercially-narrated trend; treat magnitudes as directional.
- The homogenization findings are strong but drawn largely from text/short-fiction and image tasks; their transfer to long-form video authorship is a reasonable inference, not a measured result.
- Provenance standards are evolving and imperfect: Golaszewski et al. (2026) found C2PA "flawed, incomplete, inconsistent, and vulnerable to misuse,"\[17\] and even proponents (NIM) concede transparency labels alone don't solve the trust deficit.
- APA membership and endorsement figures vary by date (300+ in 2024 → 500+ by 2025–26), reflecting growth; the exact current signatory tally is not published as a single number.
- McLuhan's tetrad is a heuristic, not a predictive model; it is used here to structure insight, not to forecast.
- The full APA guidelines PDF could not be loaded directly; the four named principles and verbatim quotes are sourced via the PBS Standards article authored by the APA's three directors — reliable, but secondary to the PDF itself.

## Sources

1. [Chris Marker and Sans Soleil - Historical Materialism](https://www.historicalmaterialism.org/figure/chris-marker-and-sans-soleil/)
2. [Personal Effects: The Guarded Intimacy of Sans Soleil | Current | The Criterion Collection](https://www.criterion.com/current/posts/484-personal-effects-the-guarded-intimacy-of-sans-soleil)
3. [Can’t Get You Out Of My Head: An Emotional History of the Modern World – The Stinging Fly](https://stingingfly.org/review/cant-get-you-out-of-my-head-an-emotional-history-of-the-modern-world/)
4. [Adam Curtis's Documentary Films: Emotional Truth Telling Through the Language of Conspiracy Theory -](https://gettherapybirmingham.com/adam-curtiss-documentary-films-emotional-truth-telling-through-the-language-of-conspiracy-theory/)
5. [Kevin B. Lee and Lého Galibert-Laîné – VOX](https://centrevox.ca/en/video-program/reading-binging-benning)
6. [AI-Generated Images Lead to Audiences' Distrust, Threaten Documentary](https://variety.com/2025/film/festivals/ai-generated-images-threaten-future-of-documentary-1236583466/)
7. [Iranian Docs Dominate IDFA Awards, Festival Head Talks Political Films](https://variety.com/2025/film/news/a-fox-under-a-pink-moon-wins-at-idfa-1236586607/)
8. [How to Build String-Outs and Selects for Documentary Editing | Aspect](https://aspect.inc/blog/post-production/how-to-build-string-outs-and-selects-for-documentary-editing)
9. [Bear 71 by Jeremy Mendes & Leanne Allison | NFB Interactive Short Film](https://www.shortoftheweek.com/2012/01/23/bear-71/)
10. [Archival Producers Alliance Develops Guidelines for AI Use in Documentaries](https://www.pbs.org/standards/blogs/standards-articles/archival-producers-alliance-develops-guidelines-for-ai-use-in-documentaries/)
11. [Archival Producers Alliance: Best Practices for Use of Generative AI in Documentaries - Ethics and Journalism](https://ethicsandjournalism.org/2024/10/11/archival-producers-alliance-best-practices-for-use-of-generative-ai-in-documentaries/)
12. [Archival Producers Alliance | International Documentary Association](https://www.documentary.org/project/archival-producers-alliance)
13. [Best Practices For Use of GenAI in Documentaries](https://www.desktop-documentaries.com/best-practices-for-use-of-gen-ai-in-documentaries.html)
14. [JUMBF](https://en.wikipedia.org/wiki/JUMBF)
15. [5,000 members: building momentum for a more trustworthy digital world](https://contentauthenticity.org/blog/5000-members-building-momentum-for-a-more-trustworthy-digital-world)
16. [How YouTube creator marketing drives growth - Think with Google](https://business.google.com/en-all/think/search-and-video/youtube-creator-marketing-creator-led-growth/)
17. [Verifying Provenance of Digital Media: Why the C2PA Specifications Fall Short](https://arxiv.org/pdf/2604.24890)
