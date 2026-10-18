---
id: the-aldershot-product-bible-v1-0-september-2026
title: "The Aldershot Product Bible — v1.0 (September 2026)"
kind: "Build brief"
topic: "Video & design"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-5c6d95b9-4450-5ee6-9240-b008af01f993_text_markdown.md"
---

# The Aldershot Product Bible — v1.0 (September 2026)

Aldershot should win by being the one AI video editor that is predictable on price, honest about what it did, and better the longer you use it. That means three things: charge only for footage-hours ingested, never for edits; turn every keep, undo and restore into a taste profile you can see and edit; and build rights, provenance and accessibility in as features, not compliance chores. The 2025–2026 market has made this position both possible and urgent.

## TL;DR

- **The opening is trust, not features.** Descript moved to metered media minutes plus AI credits in September 2025; Cursor apologised and refunded after its June 2025 credit switch; Opus Clip bills one credit per source minute.\[1\]\[2\]\[3\] RevenueCat's 2026 data says AI apps earn 41% more per payer but churn 30% faster.\[4\] Creators now fear meters and "AI that says success." Aldershot's lead: ingest-only pricing, verified edits (every pass shows exactly what changed, with Undo), and a visible taste profile.
- **The rules changed in August 2026, and compliance can be a feature.** EU AI Act Article 50 and California SB 942 (as amended by AB 853) both became operative on 2 August 2026.\[5\] YouTube's July 2025 "inauthentic content" rename targets mass-produced templated video; commentary, clips and reactions stay under the unchanged reused-content policy.\[6\] Aldershot should put C2PA on every export, label only violet (generated) material, run a pre-publish rights check, and keep attribution for Canadian fair dealing. Its "added human value" is the product.
- **Build order for one person directing agents.** First harden and dogfood tighten and shorts-from-stream, with cost guards. Then a private beta with about 25 react/commentary creators and clippers. Then a public launch via Chris's channel plus a funded clipping campaign. The essay and device layers come after retention is proven, measured from month 3, not signup.

---

## Key Findings (Part A)

### 1. Taste that learns

**The key precedent shipped this year.** Spotify announced an editable Taste Profile at SXSW on 13 March 2026 (beta with New Zealand Premium users)\[7\] and expanded it on 23 September 2026. Spotify says users can "for the first time… see Spotify's brief interpretation of your taste," that "changes typically appear within a few hours," and that "you can edit or delete your notes whenever you want."\[8\] That is the pattern Aldershot needs: a short plain-language interpretation, editable notes, and a stated lag before edits take effect. Spotify's motivating failure was kids' listening and sleep sounds polluting profiles.\[7\]\[9\] Aldershot's equivalent is client work or a friend's footage polluting your style.

**Research supports learning from raw/published pairs.** "Automatic Non-Linear Video Editing Transfer" (arXiv 2105.06988) pulls framing, speed and lighting out of edited video and applies them to raw footage.\[10\]\[11\] EditDuet (SIGGRAPH 2025) evaluates a multi-agent editor on EditStock, a set of raw footage paired with final cuts.\[12\] "Learning to Cut by Watching Movies" (arXiv 2108.04294) learns from edited content alone because paired data is scarce.\[13\] Chris's vlog archive (raw plus published) is exactly that scarce pair data, which makes it the best cold-start asset.

**Design: the Style Card.**
- **Signals.** Explicit rule and note edits count most. Restores from Left out and undos are strong negatives. Keeps are weak positives (silence isn't approval). A dismissed proposal counts against a style only after it's been dismissed twice.
- **Representation.** Plain sentences with evidence counts, e.g. "You cut hedges ('I think', 'kind of') in commentary. Learned from 41 cuts, 3 restores." Each sentence compiles to a Rule in the same pure compute function, so taste is just default rules plus weights. That keeps it testable and explainable.
- **Scope.** Global → Intent (tighten/shorts/react/essay) → Project, with the narrower scope winning. New learnings land at Intent. They're proposed for Global after they recur across three or more projects.
- **Cold start.** Three options:
  - (Recommended) "Learn from my published videos": 3–5 raw/published pairs, or published videos alone.
  - A starter recipe.
  - "Decide for me": start neutral and show the first Style Card after five sessions.
- **Drift.** Signals have about a 90-day half-life. A monthly "Your style shifted" note shows what changed. Rules that haven't fired in 60 days show as "sleeping"; they're never deleted.
- **Privacy.** The profile is per account and not used for shared training without opt-in. It exports as JSON or Markdown. Reset takes a snapshot first so it can be undone. A "Don't learn from this project" toggle covers client work.
- **Honesty.** No "92% match." Show evidence counts and the last three examples instead.

### 2. Month six vs. day one

**The data is harsh.** RevenueCat's State of Subscription Apps 2026: "AI-powered apps generate 41% more revenue per payer, but they churn 30% faster."\[4\] Annual-plan retention is 21.1% for AI apps vs 30.7% for non-AI, and the first month accounts for 35% of annual cancellations.\[14\]\[15\] RevenueCat's August 2026 study of 3,500+ AI apps found high-retention apps keep 13.9% of paid subscriptions after a year and low-retention apps keep 1.4%. It also found that "Photo & Video… lean toward low" retention; that's Aldershot's category.\[16\] a16z advises measuring M12 against month 3 to discount "AI tourists," and calls 30–40% year-one retention "best in class."\[17\]\[18\]

**Sticky without dark patterns:**
- **Recipes.** A Recipe is a versioned bundle: intent, rules, Style overrides, captions, aspect ratios, devices, exports. Editing one asks "future projects only (Recommended) / also re-cut open projects."
- **Series.** A Series is a Recipe plus recurring sources plus shared Threads. A new episode pre-applies everything and shows "what's different this week."
- **Stale rules.** Anything that hasn't fired in 60+ days goes to sleep. A quarterly "tidy" offers one-press archiving. Nothing is deleted.
- **Dead projects.** After 30 idle days a project moves to "Resting." It keeps its transcript, Read and Moments; the media moves to colder R2 storage. The library stays searchable forever, because the archive is the moat.
- **Re-entry.** "Since you were away" is pinned: finished renders, what the system noticed in new footage, and one next step. Never a streak.
- **Avoid hostage-taking.** Opus Clip's free exports "become non-exportable after three days."\[19\] Aldershot promises read-only access and export for 90 days after cancelling.

### 3. Failure and edge cases

The rule for all of these: detect at ingest, say so in the Read in one line, offer a fix with a Recommended default, and never fail silently.

| Case | Behaviour |
|---|---|
| Bad audio | Read notes the rough stretches; offers voice stem-separation (Recommended); dotted underline on low-confidence words; cuts there are flagged as judgment calls |
| Multilingual, code-switching | Per-segment language ID and transcription; captions in the spoken language by default; never force-translate |
| Music-heavy | ♪ blocks become Moments; no word-level cuts inside music (cut on beats); rights flag |
| Silent B-roll | Kept as visual Moments with descriptions, searchable and usable at Seams or in montages; never dropped for being silent |
| Vertical source | Native 9:16; for 16:9 output, blur-fill or split screen (Recommended) |
| Screen recordings | Shorter pauses, never cut mid-click; OCR makes on-screen text searchable; zoom-to-cursor device |
| Multi-camera | Audio cross-correlation sync; active-speaker angle by default; "Angles" chip |
| Overlapping speakers | Stacked lines; a cut inside an overlap asks "keep both (Recommended)" |
| Corrupt / VFR uploads | ffprobe at ingest; always normalise to CFR proxies (Descript's guides tell users to run Handbrake first; Aldershot just does it);\[20\] trims corrupt tails with a note |
| 8-hour sources | Chunked parallel ingest; the Read streams chapter by chapter, so early chapters are usable before ingest finishes |

### 4. Accessibility

**The law.**
- **Ontario (AODA).** A solo business isn't caught by the website mandate. AODA requires WCAG 2.0 AA for private organisations with 50+ employees, and reporting starts at 20+.\[21\]\[22\] Sources conflict on obligations for smaller organisations, so that's unresolved.\[23\]
- **Federal (ACA).** The Accessible Canada Act's Digital Technologies Accessibility Regulations (SOR/2025-255, registered 5 December 2025) apply only to federally regulated sectors. They reference CAN/ASC-EN 301 549 (WCAG 2.1 AA, with a WCAG 2.2 update expected), with deadlines on 5 December 2027 and 5 December 2028.\[24\]\[25\] For Aldershot this is the procurement bar for future broadcaster, bank or telecom customers.
- **US (ADA).** ADA web duties for private firms rest on litigation, not a specific rule.
- **Recommendation.** Build to WCAG 2.2 AA now. It's cheaper than retrofitting, and it's a differentiator: a timeline is hostile to screen readers, but a transcript is a document. Aldershot can be the first serious editor a blind commentator can use end to end.

**Requirements:**
- **Screen readers.** The transcript is real document markup: one paragraph per block, words as inline elements. Every role and state is spoken ("Clip, from Source B, kept"; "Left out: repetition"). Progress and one-line reports go through polite live regions.
- **Keyboard.** Arrow keys move by word, Ctrl-arrow by sentence, Alt-arrow by block. Shift selects, Delete means "take out," Ctrl-K opens a palette with every verb, and there's play-selection. WCAG 2.2 specifics: the focus indicator is never obscured (2.4.11), every drag has an alternative (2.5.7), targets are at least 24 px (2.5.8), and authentication is accessible (3.3.8).
- **Captions.** Netflix English lint (42 characters per line, 2 lines, reading speed, linguistic line breaks), speaker IDs, sound tags, and both burned-in and SRT/VTT output.
- **Audio description.** The Read already holds visual descriptions. Aldershot drafts an AD script into speech gaps, voiced by the creator (gold) or TTS (violet), and exports it as an audio track plus WebVTT.
- **Colour-blind safety.** Gold/green/red is risky for deuteranopia. Colour is never the only carrier of meaning (SC 1.4.1). Each role also has a glyph and a pattern:

| Role | Colour | Glyph | Pattern |
|---|---|---|---|
| Your voice | Gold | ● You | solid left bar |
| Clip | Green | ▲ Clip | bracketed ends |
| Other source | Cyan | ◆ Src | dotted underline |
| Generated | Violet | ✦ AI | hatch plus "AI" badge, always |
| Record/destructive | Red | ■ | ring outline |

### 5. Pricing psychology and packaging

**What happened:**
- **Descript (September 2025).** Moved to media minutes, which count "every file you upload," plus AI credits.\[26\] Descript's Help Center says Studio Sound and Remove Filler Words "have a max cost of 30 credits per file/tool application" (third-party reviews cite roughly 10 per use), and Underlord is "non-deterministic: the same prompt can cost different amounts on different runs." Legacy users were auto-migrated after 17 November 2025.\[27\]
- **Cursor (16 June 2025).** Swapped 500 fast requests for $20 of usage.\[28\] CEO Michael Truell: "We recognize that we didn't handle this pricing rollout well and we're sorry."\[29\] Refunds covered 16 June–4 July, and Auto mode stayed unlimited.\[1\]\[30\]
- **Windsurf (21 April 2025).** Went the other way: "We've removed flow action credits," now charging per prompt "no matter how many steps Cascade takes."\[31\]\[32\]
- **Lovable.** PricingSaaS says it "made a meaningful pricing change every single month in 2025"; it moved to complexity-based Agent Mode pricing.\[33\]\[34\] Across the top 500 SaaS/AI companies there were more than 1,800 pricing changes in 2025, and credit models grew 126% year over year.\[33\]
- **Opus Clip.** One credit per imported minute ("a 60-minute podcast costs 60 credits whether it yields 5 clips or 20").\[2\] Free is 60 credits; Starter is $15 for 150; Pro is $29 for 300. Processing stops at zero.\[19\]
- **Captions (renamed Mirage, September 2025).** Went freemium in January 2025; credits are forfeited when you cancel.\[35\]\[36\]

**Lessons:**
1. People forgive limits they can predict.
2. Metering the agent's thinking (steps or tokens) is the most resented model; per-prompt and "unlimited default mode" are loved.
3. Meter inputs the user controls, not outputs the AI decides.
4. Change pricing rarely, grandfather existing users, and give 30+ days' notice.

**Recommendation: meter footage-hours ingested, and leave everything downstream unmetered.** Re-cuts, rules, chat passes, clipping, alternate cuts and 1080p renders are all free. The pitch: "You pay once per hour of footage. Editing is free forever."

| Plan | Price (USD) | Footage-hours/mo | Includes |
|---|---|---|---|
| Free | $0 | 3 | Full editor and Clipper; 1080p with a 2-second "Cut with Aldershot" tail card; projects never expire |
| Creator | $20/mo or $16/mo annual | 20 (1-month rollover) | No tail card, Tier 1 capabilities, Recipes, Style Card, share links |
| Pro | $40/mo or $32/mo annual | 60 (1-month rollover) | Priority queue, batch stream clipping, 4K, series, essay layer, multi-cam |
| Extra hours | $5 per 10 h | — | Asked at upload, never auto-charged |
| Violet | At cost + 20%, or BYOK | — | Dollar price shown before running |

- **Where free stops.** At volume, not quality: 3 hours is enough to finish one real video. Fair upgrade moments: removing the tail card, uploading beyond the remaining hours, 4K, batch-clipping an 8-hour stream.
- **A meter that doesn't run down.** Hours appear only in the upload dialog ("This 2h 10m stream uses 2.2 of your 14 remaining hours"). There's no draining bar, and nothing to watch while editing.
- **Fair use.** Publish the limits (e.g. 200 assistant passes and 100 renders a day). Past them, throttle to a slower queue instead of blocking, which is the same lesson as Cursor's unlimited Auto.
- **BYOK.** Violet only; BYOK on the core looks like a wrapper and adds support load. Cancelling takes two clicks, with 90 days of export afterwards.

**Unit economics on Cloudflare** (estimates to validate against the cost ledger):
- **Container pricing.** Containers reached GA on 13 April 2026. Since 21 November 2025, CPU bills on active use only ($0.000020 per vCPU-second). Memory ($0.0000025 per GiB-second) and disk bill on provisioned size whenever a container is awake.\[37\]\[38\]\[39\]
- **The danger is idle memory.** A standard-2 (1 vCPU, 6 GiB) that's awake but idle costs about $0.057/hour, or $1.37/day. The past $20 day works out to about 14–15 such containers left awake for 24 hours. The risk is awake-idle memory, not CPU.
- **Renders.** A 10-minute 1080p render at 2 vCPU for about 5 minutes costs roughly $0.02. Egress is $0.025/GB after 1 TB in North America and Europe.\[38\]
- **Ingest.** Target $0.25–$0.50 per footage-hour all-in (alignment, diarization, sampled visual descriptions, embeddings, moment cards on a small model, the Read built from hierarchical summaries). The Creator plan's worst case is $5–10 of COGS on $20; typical use gives about 75–85% gross margin.
- **Assistant.** Default to a mid-tier model and route to a frontier model only for plans and outlines (Claude Opus 5 lists at $5/$25 per million input/output tokens).\[40\] If the median assistant cost exceeds $3 per active user per month, fix routing before touching prices.

### 6. Rights and trust

**Platforms:**
- **YouTube monetisation.** On 15 July 2025 YouTube renamed "repetitious" to "inauthentic content," covering "content that is repetitive or mass-produced," with "no change to our reused content policy which reviews content like commentary, clips, compilations, and reaction videos."\[6\] Monetisation depends on added commentary, editing or educational value, which is exactly what the gold role represents.\[41\]
- **YouTube likeness detection.** Earlier in 2026 it was extended to all eligible creators over 18.\[42\] At Made on YouTube on 23 September 2026, YouTube said it will integrate "speaking voice detection with facial detection."\[43\]\[44\] Cloning anyone's voice other than the consenting account owner's is off-limits.
- **TikTok and Meta.** Both apply AI labels and read C2PA. Their 2026 policy specifics weren't re-verified; check before launch.

**Law:**
- **EU AI Act Article 50.** In force since 2 August 2026.\[45\] The Digital Omnibus (Regulation (EU) 2026/1744, in force 27 July 2026) delayed the high-risk rules but not transparency; per Morrison Foerster (11 September 2026), providers that sold AI systems in the EU before 2 August "have until December 2, 2026" to meet the marking obligations. Providers must machine-mark synthetic output, except where AI "performs an assistive function for standard editing or does not substantially alter the input data."\[45\] Deployers must disclose deepfakes; the duty is lighter for evidently artistic or satirical work.\[46\]\[47\] The Commission adopted guidelines on 20 July 2026 and deems the Code of Practice adequate; by the end of July 2026 "about 190 organisations across various sectors" had signed it, per the European Commission, including Anthropic, Google, Meta, Microsoft, Mistral and OpenAI; it also publishes EU AI icons. Fines go up to €15M or 3% of turnover.\[48\]
- **What that means for Aldershot.** Cuts, reframes and captions count as assistive. Generative extend, restyle, cloning and dubbing are violet and in scope.
- **California SB 942.** Operative 2 August 2026 via AB 853.\[49\] It covers providers with more than 1,000,000 monthly users, so Aldershot is below the threshold.\[50\] It requires latent and manifest disclosures and a detection tool, at $5,000 per violation.\[5\]\[51\] Platform duties start 1 January 2027,\[52\] and platforms will read provenance, so building for it now is cheap insurance.
- **Canadian fair dealing vs US fair use.**
  - Canada's fair dealing is limited to listed purposes: research, private study, education, parody, satire, criticism or review, and news reporting. Criticism, review and news reporting must mention the source and author.\[53\]\[54\]
  - Fairness then turns on the Supreme Court's six factors, and the Federal Court has held that copying 100% of a work isn't fair. The s.29.21 "YouTube exception" is non-commercial only.\[55\]\[56\]
  - US fair use is open-ended and "transformative"; Hosseinzadeh v. Klein upheld a reaction video as fair use.\[56\]\[57\]
  - Product consequence: Aldershot auto-generates attribution for every green or cyan clip and shows each clip's share of its source, a plain fraction rather than a score.

**What Aldershot must build:**
1. **"Before you post"** lists third-party clips with duration and share of the original, detected music (Recommended: swap for royalty-free or duck), faces of others, violet segments and missing attributions. Each item has a one-press fix. Aldershot can't query Content ID; it can match against catalogues it licenses and warn "likely to be claimed." This is framed as risk information, not legal advice.
2. **C2PA on every export**, recording ingredients and actions. Violet segments get the generative assertion plus the visible EU icon. Incoming C2PA is never stripped.
3. **Consent gates.** Voice and face generation only for the verified owner in v1, with a recorded consent phrase. Third-party likeness generation is disabled.
4. **React faces.** Offer blur for bystanders; never face-swap a third party.
5. **No automated downloading** from YouTube or Twitch. CANOPTICON owns claim verification.

### 7. Distribution and growth

**The clipping economy is real.**
- Whop Content Rewards pays per 1,000 verified views. Live July 2026 listings ran about $0.20–$6, many at $0.50–$3.\[58\]\[59\]
- A tracker from competitor Ascynd (so treat with caution) counted $2.58M paid to 8,466 earners, including $887,000 in February 2026.\[60\]
- Brands set minimum payouts and per-video caps.\[61\]
- Opus Clip already publishes Whop explainers.\[62\]
- At about $1 CPM a clipper's margin is time, so the fastest brief-compliant batcher wins.

**Loops that carry the product back out:**
1. **Tail card** on free exports. Paid users can opt into a "Cut with Aldershot" description line for one extra hour a month: a fair trade, not a nag.
2. **Share/review links** where collaborators comment on lines, not timestamps. Every link advertises "editing is reading."
3. **Public Recipes** with a before/after and author credit, imported in one click. This is the Canva/Figma community loop applied to editing direction.
4. **Brief import for clippers.** Paste a Whop or agency brief; it becomes Rules (hashtags, banned content, length, caption style) and drives a batch clip. Referrals earn a free month per paid user.
5. **Aldershot's own campaign.** About $1,000 at roughly $1 CPM (around 1M views) clipping Chris's build-in-public videos, with Aldershot use required. It's distribution and dogfooding at once.

**Precedents.** CapCut rode TikTok templates. Descript rode podcasters and free transcription. Opus Clip reported "$1 million ARR in 14 days after launch" (its own X post; co-founder Young Zhao has also described it as one month after beta launch) by doing one painful job. Canva and Figma spread through shareable artefacts. The pattern: one job done shockingly well, plus an artefact that travels.

**GTM for a solo builder.**
- **Launch video.** Chris's investigative channel carries it: "I built the editor because Descript's credits priced me out," cut in Aldershot, with the cost ledger on screen.
- **Beachhead.** React/commentary creators and clippers on Discord and Whop.
- **Paid acquisition.** None until M3 retention is proven.

### 8. Competitors' next moves (12–24 months)

Items marked "shipped" are confirmed; everything else is a prediction.
- **YouTube (shipped 23 September 2026).**
  - What shipped: a conversational editing partner "across Shorts and the YouTube Create app," Studio A/B testing of up to three cuts, live auto-dubbing, and "Watch With" extended to long-form.\[43\]\[63\]
  - What it means: simple Shorts editing is being commoditised, so Aldershot must win on long sources, the library, taste and essays.
  - Opportunity: export Alternate cuts as three variants for Studio testing.
- **Descript (shipped).** Underlord v2 claims "about 20% fewer AI credits," adds a multi-vendor model picker, plans before acting,\[64\] and has prompt templates. Next, likely: more autonomy and possibly simpler pricing. Users' complaints that Underlord reports "success!" when it failed mark the gap Aldershot must not repeat.\[65\]
- **Opus Clip (shipped).** Agent Opus is a generative prompt-to-video agent;\[66\] its edits regenerate "with the same Seedance model." There's also an MCP server so other agents can clip with it,\[67\]\[68\]\[69\] and active courting of Whop clippers. Next, likely: agent-to-agent distribution and brand-campaign tooling.
- **Adobe (shipped).** Premiere Rush left Adobe.com on 30 September 2025, and support ends 30 September 2026, in favour of Premiere on iPhone and desktop.\[70\]\[71\] Next, likely: more Firefly and text editing inside Premiere.
- **CapCut, Riverside, Mirage, Runway (predicted).** CapCut keeps free AI inside templates. Riverside pushes record-to-clips. Mirage goes further into avatars and ads (Mirage Studio launched on a $399/month business plan).\[72\] Runway stays generative-first.
- **Where Aldershot's lead holds.** 8-hour source competence, the library as long-term memory, editable taste, Rules with instance vs. policy, essays that only cite real clips, ingest-only pricing, and default provenance.
- **Where it gets copied.** Chat-to-edit, auto-clipping, verbs and text editing are already commodities.

### 9. Pre-mortem

- **Sora.** Launched 30 September 2025; monthly downloads fell from 3,332,200 in November 2025 to 1,128,700 in February 2026 (Appfigures via TechCrunch), a drop of about 66% in three months. a16z cited Sensor Tower's day-30 retention estimate of "sub-8%."\[73\] The shutdown was announced 24 March 2026, the app closed 26 April, and the API sunsets 24 September 2026.\[74\] *Pattern:* novelty with no recurring job, costs far above revenue, and likeness liability.\[75\]
- **Descript 2025.** *Pattern:* re-metering a beloved flat product and forcing migration.
- **Cursor 2025.** *Pattern:* a silent value cut behind an unchanged price. It recovered by apologising, refunding and keeping an unlimited default.
- **Premiere Rush.** *Pattern:* an incumbent's side product sunset, with Android users stranded before a replacement existed.\[76\]
- **Underlord complaints.** *Pattern:* false success reports; trust falls faster than capability rises.
- **Magisto, Lumen5, Kapwing, Clipchamp** (general knowledge, not re-verified here). *Pattern:* fully automated generic output with no sense of authorship; repeated pivots; absorption by a platform.

**Aldershot's risks, ranked:**
1. **Promise gap.** Mitigation: verified diffs from the compute function and rule-fidelity tests in CI.
2. **Cost runaway on one card.** Mitigation: the guards in the Claude Code brief.
3. **Scope sprawl.** Mitigation: gate each layer on retention.
4. **YouTube commoditisation.** Mitigation: go long-form and deep into the library.
5. **Tourist churn.** Mitigation: Recipes, Series, re-entry.
6. **Bus factor.** Mitigation: runbooks, a status page, export promises.

### 10. Craft as a process

Widely cited practices at Linear, Figma, Things and Superhuman (not re-sourced here): design systems and tokens, hard performance budgets (Superhuman's often-quoted 100 ms target), dedicated polish cycles, dogfooding, keyboard-first interaction, and saying no.

**How Chris copies this with Claude Code:**
1. **Specs first.** One page per feature covering the story, every state (empty/loading/streaming/error/success), copy, keyboard map, accessibility notes and acceptance tests. Specs live in the repo.
2. **Tokens as the single source.** No raw hex values, enforced by lint.
3. **Visual regression.** Playwright captures every state in dark, light, high-contrast and three colour-blind simulations. Any diff blocks merge.
4. **Evals as tests.** The golden set runs nightly: hard floor, rule fidelity, and binary judges validated on Chris's labels.
5. **Performance budgets in CI.** A rule toggle recomputes in under 50 ms on a 2-hour transcript; first Read token under 3 s; interactions under 100 ms.
6. **Polish Fridays.** Only papercuts Chris logged while dogfooding.
7. **An agent harness.** Claude Code runs typecheck, unit, visual, eval and axe-core checks before proposing a merge. Chris reviews outcomes, not code.

### 11. Earning devotion

Tools become part of someone's identity when they carry an opinion: Ableton (music as performance), Final Cut's magnetic timeline, Obsidian ("your files, forever"), Figma (multiplayer). Each also had shared artefacts, education and a community that teaches.

**What Aldershot believes that competitors don't say:**
1. Editing is reading; the timeline was a workaround.
2. Direction beats operation.
3. Your footage is a library, not a pile.
4. Honesty is a feature: show what was left out, admit gaps, never invent a clip.
5. Price the footage, not the thinking.
6. Your voice is the point. Gold is the most important colour, and it's exactly what YouTube's inauthentic-content policy rewards.
7. The medium is the message (McLuhan): make the video essay as cheap as the Short, and what gets made changes.

---

## Details: The Aldershot Product Bible (Part B)

### B1. Vision and point of view

**Positioning:** *Aldershot — editing is reading now. Drop your footage, say what you want, fix it in words.*

**Manifesto.**
> Video editing was built around a timeline because machines couldn't read. Now they can, so we threw out the timeline.
> In Aldershot you read your footage like a document, tell it what you mean, and it cuts. It shows everything it left out and why. It never invents a clip it can't point to. It learns how you edit, and it shows you what it learned so you can change it.
> We charge for footage, not for thinking. Once your hour is in, editing it is free: every cut, re-cut and idea.
> Your voice is the gold in every frame. Anything a machine generates is marked violet, credited, and never passed off as you.
> Your library is yours. It's never deleted, never held hostage, and more useful every month.

### B2. Who it's for

- **Beachhead:** react/commentary creators working from 45-minute to 3-hour sources. They edit often, need to show "added human value," and run weekly series.
- **Beachhead 2:** clippers who process 2–8-hour streams to a brief. They're price-sensitive and spread tools by word of mouth.
- **Expansion:** video essayists, then podcasters and YouTubers generally, then archive owners (including Chris). Later: small newsrooms and educators, where accessibility outputs and provenance win procurement.
- **Not for:** motion designers, colourists, or anyone who needs a frame-accurate timeline. Give them EDL/XML export later.

### B3. Product principles

1. **Direction first:** say it, fix it in words. No timeline, no scrubbing.
2. **Show, don't score:** no percentages, streaks, badges or points.
3. **Everything reversible:** Undo everywhere, a checkpoint before every pass, nothing auto-deleted. "Left out" is a place, not a trash can.
4. **Verified, not claimed:** every pass reports a computed diff; anything unbacked is a labelled gap.
5. **Few questions, good defaults:** one question widget (2–4 options, one Recommended, plus Decide for me / Skip / free text), governed by autonomy and a question budget.
6. **Report every automatic decision** in one line with Undo, and flag judgment calls.
7. **Predictable cost:** meter footage-hours only, and show the price before any paid action.
8. **Violet is a hard line:** disclosed, consent-gated, C2PA-credentialed.
9. **Your work is yours:** export anytime; taste and library are exportable.
10. **Accessible by construction:** WCAG 2.2 AA, keyboard-complete, screen-reader-native, colour never alone.
11. **Designed latency:** instant local recomputes, streamed LLM work, background renders, and always say which is happening.
12. **Calm and expensive-feeling:** plain-spoken; suggestions you pull, not pushed notifications.
13. **Your own footage first:** generation is the last resort.

**Resolved conflicts:**
- **Clipper scores vs. no percentages.** Clipper shows ranked bands (Strong / Worth a look / Long shot) with plain reasons, never a number.
- **Autonomy vs. question budget.** One control: Ask = 3 questions per pass, Recommend = 1, Auto = 0 with everything reported afterwards.
- **C2PA "violet only" vs. the Article 50 assistive exemption.** C2PA goes on all exports (source provenance is a trust feature); the visible AI label goes on violet only.
- **"More clips, more it can do."** Shown as unlocked devices ("Montage unlocked: 40+ visual Moments"), never as a meter.

### B4. The system map

```
FOOTAGE LIBRARY (ingest once): Sources → Moments → Threads
  layers: words → moments → chapters → videos → library; Read, embeddings, visuals
                         │ retrieval + summaries
     ┌───────────────────┼────────────────────┐
CONVERSATION SPINE ⇄ LIVING CANVAS ⇄ STYLE CARD (Global/Intent/Project)
ack→plan→act→review    (Cut or Essay Outline)
question widget         │
autonomy          EDITOR X zooms: Overview · Blocks · Words
                  Read · Rules · Seams · Left out · One more thought · Alternates
     │                   │                    │
 CLIPPER X        ESSAY LAYER             CREATIVE DEVICE LAYER
 bands+reasons    point cards, gaps,      montage, match cut, split,
                  coverage, pull lists    ramps, beat mode
     └──────────► PROJECTS (composition bar) ◄──────┘
                         │
          BEFORE YOU POST (rights · provenance · captions · AD)
                         │
          EXPORT (render · C2PA · SRT/VTT · AD track · review link)
```

- **The Library.** Everything reads from it; nothing re-ingests.
- **Spine and canvas.** The spine is the only place the AI talks; the canvas is the only place results live. Editor X zooms are views of the canvas, not rooms.
- **Rules as the common language.** Chat verbs, Style Card defaults, Recipes and campaign briefs all compile to Rules and the same pure compute function.
- **Projects.** A Project holds several canvases. Its composition bar shows the colour-role mix, with glyphs.

### B5. Core flows

Every flow uses the same turn shape: acknowledgement → plan (large tasks) → streamed act → review → chips.

1. **Tighten (45–120 minutes).**
   - Drop the file. The Read streams in (what this is, chapters, "rough audio at 14:20").
   - The recommended Recipe removes fillers, false starts and long pauses, and caps tangents at 40 s.
   - Each rule gets a one-line report ("Took out 212 fillers, 6 min").
   - Read, delete text, or toggle Rules (instant).
   - One "one more thought" A/B, then Before you post, then export.
2. **Shorts from a long stream (2–8 h).**
   - Drop the VOD or paste a brief. Chunked ingest streams chapters.
   - Clipper X ranks candidates in bands with reasons ("self-contained, hook at 0:02, payoff by 0:31").
   - Keeping or dismissing teaches the Style Card.
   - Batch 9:16 face-tracked reframe plus captions to the brief, a batch pre-publish check, then per-platform export.
3. **React.**
   - Upload your recording plus the source (which you downloaded yourself). Audio sync. Layout: matting-based picture-in-picture (Recommended).
   - Your reactions are kept (gold); the source (green) is trimmed to what you react to.
   - Share-of-original, auto-attribution and music duck are applied.
   - A nudge if gold drops below about 40% of runtime.
4. **Essay piece (5 minutes).**
   - Thesis plus angle produce 4–6 point cards from the library: voiceover (gold), clips (green), sources (cyan), gaps (labelled).
   - Pull lists split what can be fetched from what the user must upload. Coverage fills as progress.
   - Record voiceover at Seams; the cut assembles. Pieces nest into long-form.
5. **Montage.**
   - Select a point or Seam and ask for a flash montage under the voiceover.
   - The device picks by motif, visual rhyme and variety, your own footage first.
   - Beat mode needs a music track, which triggers the rights check. A/B two variants.
6. **Vlog from archive.**
   - "12 minutes on my year in Niagara." Threads across Sources propose an arc, with the alternatives shown as left out.
   - Voiceover at Seams, then cut. The Style Card learned from raw/published pairs pays off here.

### B6. Feature inventory

**Now (next ~90 days)**
- Harden the shipped editor: word timings, three zooms, Rules with live effect, instance vs. policy, Left out with reasons
- Chat spine with verified diffs and one-line reports; question widget plus the autonomy/budget control
- Streamed Read, the correction flow, and the §3 edge-case detectors
- Clipper X with bands and reasons; 9:16 face tracking; captions with Netflix lint
- Hard floor in CI, golden set, nightly evals
- Cost guards, idle-container reaper, ledger alerts
- Ingest-only Stripe billing
- Accessibility baseline
- C2PA on export and Before you post v1
- Sample-project first run and "Since you were away"

**Next (3–9 months)**
- Style Card v1 with cold start from published videos
- Recipes and Series; public Recipes
- Share/review links
- Brief import, batch clipping, and referral
- Matting react compositing; "duck only the music" stems; multi-cam sync
- Alternate cuts → YouTube three-way A/B
- Threads and the "possible videos" shelf
- Essay layer v1 in the UI
- Audio-description export
- Resting projects and storage tiering

**Later (9–18 months)**
- Device layer (montage, match cuts, split, ramps, beat mode) and Remotion graphics
- Tier 2 (2.5D, object removal, colour match)
- Violet Tier 3 behind consent gates (generative extend, restyle, own-voice dubbing)
- Deep raw/published style transfer
- EDL/XML export
- An Aldershot MCP server
- Teams, only if demanded

**Watch**
- YouTube's native editor scope
- Descript and Opus pricing
- EU Code of Practice and EN 301 549 v4 (WCAG 2.2)
- AB 853 platform duties (from 1 January 2027)
- Whop rates
- Canadian copyright reform

### B7. Quality bar and evaluation

- **Hard floor (blocks export):**
  - −14 LUFS (±1)
  - True peak ≤ −1 dBTP
  - 5–10 ms fades at cuts
  - No mid-word cuts
  - Caption lint
  - Reframe safety
  - CFR output
  - C2PA present
- **Rule fidelity:** unit tests on fixtures (e.g. "cap tangents at 40 s" → no tangent over 40 s).
- **Binary AI judges:** kept only if they agree with Chris's labels at least 85% of the time; rechecked quarterly.
- **Golden set:** 20–30 projects covering talking head, 8-hour stream, react, screen recording, bilingual, music-heavy, multi-cam and bad audio. Nightly; any regression blocks deploy.
- **Real-world signals:** keep and undo rate per pass, restores from Left out, time-to-first-export, and M1/M3/M6 retention anchored to M3.

### B8. Trust, rights, accessibility and ethics checklist

- [ ] C2PA on every export; incoming manifests preserved
- [ ] Violet: visible EU-icon label plus machine-readable assertion; third-party likeness disabled; owner consent recorded
- [ ] In-interface disclosure that the assistant is AI (Article 50(1))
- [ ] Before you post: clip shares, music, faces, attribution, violet list; "risk information, not legal advice"
- [ ] Auto-attribution for green and cyan material (fair-dealing mention requirement)
- [ ] No automated YouTube/Twitch downloading; licence metadata stored for fetched assets
- [ ] Gold-ratio nudge in react and clip flows; AI-disclosure toggles in platform export presets
- [ ] WCAG 2.2 AA: keyboard-complete, unobscured focus, drag alternatives, 24 px targets, screen-reader transcript, live regions
- [ ] Glyph plus pattern on every role; colour-blind visual regression; axe-core in CI; public accessibility statement
- [ ] Captions (burned-in plus SRT/VTT) and an audio-description track
- [ ] Style Card visible, editable, resettable, exportable; "don't learn from this project"; no training without opt-in
- [ ] No streaks or draining meters; two-click cancel; 90-day export after cancelling; price before paid action; 30-day notice and grandfathering on pricing changes

### B9. Pricing, packaging and unit economics

Plans as in §5: **Free (3 h) / Creator $20 (20 h) / Pro $40 (60 h)**, 20% off annual, one-month rollover, extra hours at $5 per 10, and editing unmetered within published fair use. Violet is pass-through with the price shown first.
- **Targets:** ingest ≤ $0.50 per footage-hour, render about $0.02 per 10 minutes, assistant ≤ $3 per active user per month, blended gross margin ≥ 75%.
- **Validation:** check against the per-job ledger on Chris's archive and the beta cohort. If ingest runs over $0.50/h, change routing before changing prices.
- **Break-even:** about 150 payers at a blended $25 (illustrative; replace with real overheads).

### B10. Growth and distribution plan

1. **Build in public:** monthly essays on Chris's channel, cut in Aldershot, with the ledger shown.
2. **Private beta:** 25 users (10 react/commentary, 10 clippers, 5 essayists) from Chris's audience and clipping Discords, with weekly office hours.
3. **Launch:** a ~$1,000 Whop campaign clipping the launch video, with Aldershot use required.
4. **Artefact loops:** tail card, review links, public Recipes with credit.
5. **Clipper referral:** a free month per referred paid user; brief import is the hook.
6. **Creator partners:** five mid-size commentary channels get a free Pro year in exchange for a public Recipe and an honest review.
7. **Accessibility outreach:** blind and low-vision creators and disability media. "The first editor you can use with a screen reader" is a true, rare claim if it's earned.

### B11. Moats and pre-mortem risks

**Real moats (if executed):**
1. The library as accumulated understanding. It's exportable, so the moat is usefulness, not lock-in.
2. Visible, editable taste trained on the creator's own pairs.
3. Long-source competence.
4. The trust stack (verified diffs, Left out, provenance, rights).
5. "Editing is free" pricing that credit-economics incumbents struggle to match.
6. Craft plus a point of view.

**Not moats:** text editing, chat-to-edit, auto-clipping, captions, reframing.

**Tripwires:**
- Undo rate above 30% on any verb (promise gap)
- Daily spend above 2× the 7-day median (cost)
- More than 30% of beta users call YouTube's native tool "good enough" for Shorts (commoditisation)
- M6 below 60% of M3 (tourists)
- More than one Later item in progress at once (sprawl)
- Any strike traced to an Aldershot default (rights)

### B12. Phased roadmap

- **Phase 0 — Harden and dogfood (Oct–Nov 2026).**
  - Deliverables: cost guards, verified diffs, the CI harness and golden set, edge-case detectors, ingest billing, the accessibility baseline, C2PA, Before you post v1.
  - Milestone: Chris ships 4 videos and 40 shorts entirely in Aldershot.
  - Metrics: zero cost incidents; zero mid-word cuts; Chris's undo rate under 20%.
- **Phase 1 — Private beta (Dec 2026–Feb 2027).**
  - Deliverables: 25 users, Style Card v1, Recipes, review links, brief import.
  - Metrics: 70% reach first export in under 15 minutes; keep rate above 60%; 60% weekly active; measured ingest COGS ≤ $0.50/h.
- **Phase 2 — Public launch (Mar–Jun 2027).**
  - Deliverables: pricing, launch video plus the Whop campaign, public Recipes, react compositing, stems, YouTube A/B export.
  - Metrics: 150 payers by June; anchored M3 ≥ 40%; margin ≥ 75%; refunds under 3%.
- **Phase 3 — Essay and archive (Jul–Dec 2027).**
  - Deliverables: essay layer v1, Threads and the shelf, audio-description export, device layer v1.
  - Metrics: 25% of Pro users build a Piece; essay users retain at least 1.3× better.
- **What would change the plan:**
  - YouTube's editor absorbs Shorts → move effort from Clipper to essay and archive.
  - Clippers dominate sign-ups → a Clipper-first plan with volume pricing.
  - Ingest COGS above $0.75/h → cut free to 2 hours and use smaller models.
  - New EU or Canadian rules hit editors → pull provenance work forward.

### B13. Briefs

**Brief to Claude Code — build first, in order:**
1. **Cost guards.**
   - Every Container gets `sleepAfter` of 2–5 minutes.
   - A cron Worker runs every 10 minutes and stops any awake container that has no active D1 job lease.
   - Per-user daily caps and a global kill switch are read from the ledger.
   - Alert at 2× the 7-day median.
   - External GPU calls get timeouts, jittered retries and a circuit breaker.
2. **Pipeline reliability.**
   - Queue messages carry idempotency keys (job ID plus stage).
   - Each stage writes its output to R2 before acking, so a retry resumes rather than redoes.
   - Dead-letter queue plus a "retry from stage" admin page.
   - One Durable Object per project as the single writer.
   - VFR→CFR proxies at ingest; long sources split into 20–30-minute chunks processed in parallel, then stitched.
3. **Verified diffs.** AI passes emit Rules or operations only. The pure compute function produces the cut, and the spine reports the computed diff, not the model's claim.
4. **CI harness.** Typecheck, unit tests, rule fidelity, hard-floor checks, Playwright visual regression across themes and colour-blind simulations, axe-core, performance budgets, and nightly evals. Any regression blocks deploy.
5. **Billing.** Stripe metered on footage-hours at upload only, with rollover and a price-before-action API for violet.
6. **Provenance.** Write C2PA in the export step; preserve incoming manifests.
7. **Observability.** Structured logs (job ID, stage timings, cost) into Analytics Engine, a status page, and a weekly digest to Chris.

*Constraints:*
- Cloudflare-native, with any GPU host behind one adapter.
- No platform downloading.
- Soft deletes only.
- One copy file; tokens only.
- WCAG 2.2 AA on every PR.
- Rules are the only mutation path.
- The model cites only real clip IDs; anything unresolvable becomes a Gap object.

**Brief to Claude Design — design first, in order:**
1. **Tokens.**
   - Role colours with glyphs and patterns (§4).
   - Dark (primary), light and high-contrast themes.
   - Reading-first type: generous leading, 65–75 characters per line.
   - Motion at 120–200 ms, with no bounce.
2. **Spine–canvas layout** in every turn state, including "I couldn't do that — here's why."
3. **Question widget and autonomy control.**
4. **Transcript at three zooms:** glyphs, Left-out ghosts, judgment flags, low-confidence underlines, Seams.
5. **Rules panel** with live counts and the instance-vs-policy prompt.
6. **Clipper cards** with bands and reasons.
7. **Style Card:** sentences, evidence, scope chips, sleeping rules, reset.
8. **Before you post.**
9. **Upload dialog with the hours line, and the pricing page.**
10. **"Since you were away."**
11. **Empty and first-run states** with the sample project.

*Constraints:*
- Calm, dark, plain copy: no exclamation marks, "magic" or "second brain."
- No percentages, streaks, badges or draining meters.
- Colour never alone; every drag has a keyboard or click alternative.
- Violet is always hatched and labelled "AI."
- Every destructive-looking action shows its Undo.
- Design every state.

### B14. Open decisions for Chris

| Decision | Recommended default | Why |
|---|---|---|
| Free branding | 2-second tail card | Honest; less ugly than a watermark |
| Free hours | 3/month | Enough to finish one video; revisit if COGS exceeds $0.75/h |
| Creator price | $20 monthly / $16 annual | Undercuts Descript Creator ($35 monthly / $24 annual), with unmetered editing\[77\] |
| Metering unit | Footage-hours at ingest | Legible, and the user controls it |
| BYOK | Violet only | Avoids looking like a wrapper |
| Style scope | Intent, promoted to Global after 3 projects | Prevents one project polluting the rest |
| Learning default | On, shown after 5 sessions, with a per-project opt-out | Cold start without surprise |
| Clipper display | Bands plus reasons | Honours the no-percentages rule |
| C2PA scope | All exports; visible label on violet only | Trust plus Article 50 fit |
| Third-party likeness generation | Disallowed in v1 | Deepfake and likeness risk |
| Beachhead | React/commentary, with clippers in parallel | Frequency plus growth loop |
| Resting media | Cold storage after 30 days, never deleted | The library is the moat |
| Post-cancel access | 90 days read-only plus export | Anti-hostage promise |
| Timeline export | EDL/XML later | Escape hatch builds trust |
| Launch | Chris's channel plus a ~$1,000 Whop campaign; no ads before M3 is proven | Cheap, authentic, measurable |

---

## Caveats

- **Competitor-sourced figures.** Opus Clip pricing (via Klap, Quso, Ssemble), Whop payout totals (via Ascynd) and some Descript details (via Sonix, Trebble) come from competitor-published pages. Check vendors' live pages before quoting them publicly.
- **Estimates.** Ingest and assistant costs are engineering estimates for the ledger to validate. The Cloudflare rates come from Cloudflare's docs.
- **Not legal advice.** This is a product-design summary of the law. No reported Canadian case covers reaction videos, so have a Canadian IP lawyer review the Before-you-post copy and attribution defaults.\[55\]
- **Not re-verified this pass.** TikTok/Meta 2026 label specifics, the ADA's application to private web apps, the European Accessibility Act micro-enterprise exemption, older case studies (Magisto, Lumen5, Kapwing, Clipchamp), and the craft-process specifics.
- **Predictions.** Competitor moves are predictions unless marked "shipped." YouTube's conversational editor was announced today, and its real scope is unknown.
- **Retention benchmarks.** RevenueCat's data skews toward mobile subscription apps; treat it as a floor to beat, not a forecast.

## Sources

1. [Clarifying our pricing · Cursor](https://cursor.com/blog/june-2025-pricing)
2. [Opus Clip Pricing: Credits, Free Plan, Trials | OpenShorts](https://www.openshorts.app/opus-clip-pricing)
3. [Descript's New Pricing (September 2025)](https://www.trebble.fm/post/descript-pricing-september-2025)
4. [State of Subscription Apps 2026 – RevenueCat](https://www.revenuecat.com/state-of-subscription-apps)
5. [California's AI Transparency Act Is Now Operative: Latent Disclosures, Detection Tools, and the 96-Hour Licence Revocation Clock | ComplianceHub.Wiki](https://compliancehub.wiki/california-ai-transparency-act-operative-august-2026-provenance-disclosure/)
6. [YouTube channel monetization policies - YouTube Help](https://support.google.com/youtube/answer/1311392?hl=en)
7. [Image Credits:Klaudia Radecka/NurPhoto (opens in a new window) / Getty Images](https://techcrunch.com/2026/03/13/spotify-will-let-you-edit-your-taste-profile-to-control-your-recommendations/)
8. [How to Use Our Taste Profile Feature to Shape Your Spotify Homepage — Spotify](https://newsroom.spotify.com/2026-09-23/taste-profile-shape-home-feed/)
9. [Spotify Introduces An ‘Edit’ Button for Your Algorithm](https://www.digitalmusicnews.com/2026/03/16/spotify-edit-button-algorithm/)
10. [Automatic Non-Linear Video Editing Transfer](https://arxiv.org/pdf/2105.06988)
11. [\[2105.06988\] Automatic Non-Linear Video Editing Transfer](https://ar5iv.labs.arxiv.org/html/2105.06988)
12. [EditDuet: A Multi-Agent System for Video Non-Linear Editing | Proceedings of the Special Interest Group on Computer Graphics and Interactive Techniques Conference Conference Papers](https://dl.acm.org/doi/10.1145/3721238.3730761)
13. [Learning to Cut by Watching Movies](https://arxiv.org/pdf/2108.04294)
14. [AI Apps Generate Revenue but Struggle With Retention](https://www.technewsworld.com/story/ai-apps-generate-revenue-but-struggle-with-retention-180236.html)
15. [The State of Subscription Apps in 10 minutes: lessons, trends, and benchmarks for 2026 | RevenueCat](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
16. [We studied 3,500+ AI-powered apps to see why some retain users better than others | RevenueCat](https://www.revenuecat.com/blog/growth/ai-app-retention-study)
17. [Cohort Retention Analysis in 2026: How to Separate Real Users From AI Tourists](https://userpilot.com/blog/cohort-retention-analysis/)
18. [The Great Expansion: A New Era of Consumer Software | Andreessen Horowitz](https://a16z.com/the-great-expansion-a-new-era-of-consumer-software/)
19. [OpusClip Pricing 2026: Plans, Credits & Real Costs](https://creatify.ai/blog/opusclip-pricing-plans-and-what-you-ll-actually-pay-in-2026)
20. [Descript Complete Guide 2026: Features, Pricing, How to Use & Master the All-In-One AI Editor | AI Tools DevPro](https://aitoolsdevpro.com/ai-tools/descript-guide/)
21. [AODA Compliance for Ontario Business Websites: WCAG 2.0 AA Explained](https://vertamarketing.com/aoda-compliance-ontario-business-websites/)
22. [AODA Compliance Ontario: A Complete Employer Guide (2026) - HRXconnect](https://hrxconnect.com/hr-consulting/aoda-compliance-ontario-2/)
23. [AODA Website Compliance: Complete Guide for Ontario Businesses (2026)](https://wcagsafe.com/blog/aoda-website-compliance)
24. [Accessible Canada Act (ACA) - EqualWeb](https://www.equalweb.com/platform/standards/aca.html)
25. [Canada's Accessible Canada Act: Digital Accessibility Deadlines 2027-2028 | RatedWithAI](https://ratedwithai.com/blog/canada-accessible-canada-act-digital-accessibility-2027)
26. [Descript pricing overhaul — media minutes, AI credits & top-ups explained](https://cotovan.com/post/descript-pricing-media-minutes-ai-credits-topups/)
27. [Understanding your legacy and sunset plan - Descript Help Center](https://help.descript.com/hc/en-us/articles/27653385141517-Understanding-Your-Legacy-and-Sunset-Plan)
28. [Cursor Faces Backlash Over Pro Plan Pricing Shift - FinTech Weekly](https://www.fintechweekly.com/magazine/articles/cursor-pricing-change-user-backlash-refund)
29. [Cursor apologizes for unclear pricing changes that upset users | TechCrunch](https://techcrunch.com/2025/07/07/cursor-apologizes-for-unclear-pricing-changes-that-upset-users/)
30. [What Happened to Cursor Pricing? 2026 Guide & 5 Cost Cutting Tips](https://www.finout.io/blog/what-happened-to-cursor-pricing-2026-guide-5-cost-cutting-tips)
31. [Windsurf on X: "We’ve removed flow action credits. In fact, we’ve fully revamped our pricing structure with 1 goal in mind: simplicity. And, we’re extending free GPT 4.1 and o4-mini for another week. Listen to the full announcement below. https://t.co/epSQ2tLGAl" / X](https://x.com/windsurf_ai/status/1914383253731205148)
32. <https://devin.ai/blog/pricing-v2>
33. [The app for independent voices](https://substack.com/@kylepoyar/note/c-196463953)
34. [Introducing Agent Mode (Beta): enabling Lovable to think, plan, and take actions autonomously | Lovable](https://lovable.dev/blog/agent-mode-beta)
35. [Understanding Credits - Captions Help Center](https://captions.ai/help/docs/ai-usage)
36. [Mirage raises \$75M to continue building models for its AI video-editing app Captions | TechCrunch](https://techcrunch.com/2026/03/24/mirage-raises-75m-to-continue-building-models-for-its-ai-video-editing-app-captions/)
37. [Cloudflare Sandboxes Are GA: Active-CPU Billing vs E2B/Daytona, Repriced Line by Line | bex.co](https://bex.co/blog/2026/09/09/cloudflare-containers-sandboxes-active-cpu-pricing)
38. [developers.cloudflare.com](https://developers.cloudflare.com/containers/pricing/)
39. [2025 11 21 new cpu pricing](https://developers.cloudflare.com/changelog/2025-11-21-new-cpu-pricing/)
40. [Claude Opus 5 Released: Launch Date, Pricing, Specs & Honeycomb | CallMissed](https://www.callmissed.com/blog/claude-opus-release-date-rumors-when-will)
41. [YouTube Inauthentic Content Policy: Who Loses Monetization](https://www.subsub.io/blog/youtube-inauthentic-content-policy-2025)
42. [YouTube expands AI likeness detection tool to more creators | Digital Watch Observatory](https://dig.watch/updates/youtube-ai-likeness-detection-creators)
43. [Made On YouTube 2026: All Announcements & New Features - YouTube Blog](https://blog.youtube/news-and-events/innovation-youtube-era-made-on-viewers-creators/)
44. [YouTube Adds AI Shorts Editing, Live Dubbing and Creator Protections | Superpower Daily](https://superpowerdaily.com/posts/youtube-introduces-ai-shorts-editing-and-wider-creator-likeness-detection)
45. [Quick Facts: Transparency rules for AI systems | Shaping Europe’s digital future](https://digital-strategy.ec.europa.eu/en/factpages/quick-facts-transparency-rules-ai-systems)
46. [The EU AI Act on 2 August 2026 - Legalithm](https://www.legalithm.com/en/blog/eu-ai-act-what-applies-2-august-2026)
47. [AI Act Article 50 Explained: UK Chatbot and Deepfake Rules](https://bratby.law/ai-act-transparency-obligations-2026/)
48. [The AI Act’s Transparency Obligations: Rules, Scope and Timeline](https://www.stibbe.com/publications-and-insights/the-ai-acts-transparency-obligations-rules-scope-and-timeline)
49. [SB 942 Now in Effect: Not Jan. 1, 2026 — CASRAI](https://casrai.org/news/california-sb-942-ai-transparency-act-effective-august-2026)
50. [California AI Transparency Act (SB 942): Effective Aug. 2, 2026 | AI Compliance Atlas](https://aicomplianceatlas.com/law/california-sb-942)
51. [California AI Transparency Law: What Businesses Need to Disclose and Implement | Secure Privacy Blog](https://secureprivacy.ai/blog/california-ai-transparency-law)
52. [California SB 942: The AI Transparency Act and Why It Matters for SNFs — Clearpol](https://clearpol.com/sb-942)
53. [Fair dealing](https://en.wikipedia.org/wiki/Fair_dealing)
54. [Fair dealing in Canadian copyright law](https://en.wikipedia.org/wiki/Fair_dealing_in_Canadian_copyright_law)
55. [Everyone’s a Critic: Copyright Considerations for YouTube and Twitch Reaction Videos (Part I) - Lexology](https://www.lexology.com/library/detail.aspx?g=78223a6d-3aae-4e30-9599-0021dab53b7a)
56. [Everyone’s a Critic: Copyright Considerations for YouTube and Twitch Reaction Videos (Part II) | Knowledge | Fasken](https://www.fasken.com/en/knowledge/2021/06/everyones-a-critic-copyright-considerations-for-youtube-and-twitch-reaction-videos-part-ii)
57. [Fair Dealing vs Fair Use in Canada: Copyright Exceptions Explained | Canada Lawyer Directory | Find Law Firms & Legal Services](https://lawyerinfo.ca/guides/money-taxes-ip/intellectual-property/fair-dealing-vs-fair-use-in-canada-copyright-exceptions-explained/)
58. [Whop Clipping: \$0.20 to \$6 per 1,000 Views (2026) - OpenClip](https://openclip.app/guides/whop-clipping-guide)
59. [Whop Clipping Platform: How It Works and What It Pays | Vyroclips](https://vyroclips.com/whop-clipping-platform-how-it-works-and-what-it-pays)
60. [Whop Clipping: What It Is & What It Pays (2026) | Ascynd](https://ascynd.io/en/blog/whop-clipping)
61. [Content Rewards - Whop Docs](https://docs.whop.com/memberships-and-access/third-party-apps/content-rewards)
62. [What Is Whop Content Rewards? Everything You Need to Know - OpusClip Blog](https://www.opus.pro/blog/whop-content-rewards)
63. [Made on YouTube 2026: Conversational AI Tools, Custom Feeds and Likeness Detection Unveiled for Creators | 📲 LatestLY](https://www.latestly.com/technology/made-on-youtube-2026-conversational-ai-tools-custom-feeds-and-likeness-detection-unveiled-for-creators-7617438.html)
64. [Announcing—Underlord v2 | Descript Changelog - Canny](https://descript.canny.io/changelog/announcingunderlord-v2)
65. [Problems with new Underlord AI "features" | Feature Requests | Descript](https://descript.canny.io/feature-requests/p/problems-with-new-underlord-ai-features)
66. [Opus Clip Launches New AI Video Agent! (Agent Opus)](https://dicloak.com/video-insights-detail/opus-clip-launches-new-ai-video-agent-agent-opus)
67. [Agent Opus Explained: OpusClip End-to-End AI Video Agent - Mervin Praison](https://mer.vin/2026/07/agent-opus-explained-opusclip-end-to-end-ai-video-agent/)
68. [Changelog | OpusClip](https://opusclip.canny.io/changelog)
69. [Video Editing & Clipping MCP Server for Claude, Cursor & ChatGPT | OpusClip](https://www.opus.pro/mcp)
70. [Premiere Rush discontinuation](https://helpx.adobe.com/in/premiere-rush/kb/end-of-life.html)
71. [Is Adobe Premiere Rush Discontinued? (2026) · Blitzcut](https://blitzcutai.com/blog/is-adobe-premiere-rush-discontinued)
72. [Captions rebrands as Mirage, expands beyond creator tools to AI video research | TechCrunch](https://techcrunch.com/2025/09/04/captions-rebrands-as-mirage-expands-beyond-creator-tools-to-ai-video-research/)
73. [State of Consumer AI 2025: Product Hits, Misses, and What’s Next | Andreessen Horowitz](https://a16z.com/state-of-consumer-ai-2025-product-hits-misses-and-whats-next/)
74. [OpenAI Kills Sora: 9.6M Downloads, \$1B Disney Pact \[2026\]](https://tech-insider.org/openai-sora-shutdown-9-6-million-downloads-disney-2026/)
75. [Sora 2 Shutdown 2026: The Real Story & Alternatives - SolidAITech](https://www.solidaitech.com/2026/07/sora-2-shutdown-explained.html)
76. [Mobile options after Premier Rush ends | Community](https://community.adobe.com/questions-105/mobile-options-after-premier-rush-ends-1531735)
77. [Descript Pricing 2026: Plans, Media Minutes, AI Credits & Alternatives - Shade](https://shade.inc/blog/descript-pricing)
