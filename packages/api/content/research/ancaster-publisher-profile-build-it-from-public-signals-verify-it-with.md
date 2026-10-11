---
id: ancaster-publisher-profile-build-it-from-public-signals-verify-it-with
title: "Ancaster Publisher Profile: Build It From Public Signals, Verify It With OAuth, Sell It as a Signed Audience Card (Research Pass 19, September 2026)"
kind: "Research pass"
topic: "Attribution & credit"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-c42b26a8-c4b2-5867-91de-09f2de2a5e80_text_markdown.md"
---

# Ancaster Publisher Profile: Build It From Public Signals, Verify It With OAuth, Sell It as a Signed Audience Card (Research Pass 19, September 2026)

Ancaster should build every publisher a two-layer profile. First, a public-content draft appears within minutes of the publisher pasting one URL: topics, formats, voice, audience needs and sponsor history, all inferred and labelled with confidence. Second, one-click OAuth connections upgrade the audience and performance fields from "inferred" to "measured". The whole thing ships as a signed, publisher-owned Audience Card that powers offer matching, auto-built sales assets and an advertiser-facing sales desk. Nothing on the market combines consented measured stats, need-level audience inference, cross-channel relations and cryptographic portability in a single publisher-owned object. That gap is Ancaster's opening.

## TL;DR

- **Build it from public content, verify it with OAuth, and never blur the two.** YouTube's Analytics API gives consented age, gender, geography and traffic-source data. Its June 2026 derived-metrics amendment allows custom scores and brand-suitability scoring but forbids inferring sensitive audience attributes, including age. So demographics must be *measured*, while topics, needs, voice and sponsor history can be *inferred*. TikTok, LinkedIn and Spotify offer thin or no commercial audience APIs, so for those channels the profile relies on content inference and publisher-uploaded exports.
- **Incumbents fall into two camps, and neither is publisher-owned or need-level.** Brand-side databases (Modash, HypeAuditor) mostly scrape and model public data. Consented first-party marketplaces (Paved's ESP-verified badge, CreatorIQ's YouTube Creator Partnership API integration, beehiiv's verified clicks) verify stats inside their own walls. Scraped estimates are unreliable: a May 2025 test by The Podcast Host found Rephonic's download estimates averaged 51.6% accuracy across 14 shows. None of them publishes a portable, signed, publisher-controlled profile that separates measured from inferred claims and models *audience needs* rather than demographics.
- **Recommended first 90 days:** paste-one-URL onboarding; YouTube + RSS + newsletter archive as the first sources, with YouTube Analytics and beehiiv/Kit OAuth as the "verify" upgrade; a living verified media kit as the first output; an inbound-first sales layer (public Audience Card plus a gated agent sponsor desk) before any outbound; and a signed JSON Audience Card at a well-known URL, wrapped as a W3C Verifiable Credential 2.0 later. Run the calibration, advertiser A/B and offer-holdout experiments described in section 9 before making any accuracy or lift claims to customers.

## Key Findings

1. **Owner OAuth is the only honest source of audience demographics.** YouTube (Analytics API), Instagram (Graph API insights for professional accounts), beehiiv/Kit/Ghost (API keys or OAuth), podcast hosts (host dashboards and exports) and personal sites (Plausible/GA4) expose measured audience data only to the owner. Everything else is inference.
2. **Platform terms now reward exactly the design Ancaster wants.** Since June 1, 2026, YouTube lets audited analytics developers compute custom scores, revenue projections (labelled as third-party estimates) and brand-suitability scores for "influencer marketing, vetting, and matchmaking".\[1\] The conditions: those metrics must be distinguished from API data, and sensitive attributes must not be inferred.\[2\] Measured-vs-inferred labelling is a compliance requirement, not just good manners.
3. **Public-content inference is cheap and strong for some things and dangerous for others.** In "Beyond Memorization: Violating Privacy via Inference with Large Language Models" (ICLR 2024, arXiv:2310.07298), Robin Staab, Mark Vero, Mislav Balunović and Martin Vechev of ETH Zurich's SRI Lab tested 520 real Reddit profiles and found LLMs reach "up to 85% top-1 and 95.8% top-3 accuracy at a fraction of the cost (100×) and time (240×) required by humans" when inferring personal attributes. That makes demographic inference about *individual commenters* a privacy hazard Ancaster should refuse to build. Aggregate need and intent mining (questions, pain points, stage, budget signals) is the safe, high-value use.
4. **The best field evidence that audience-aware matching pays comes from academia, not affiliate networks.** The CARI framework (customer-aware influencer–product matching with graph neural networks) reported +105% influencer endorsement rate, +243% customer purchase rate and +153% spending per endorsement view in a randomized field experiment on an Asian influencer-commerce platform.\[3\] I found no public, controlled evidence from affiliate networks linking profile-match quality to EPC. Ancaster should generate that evidence itself with holdouts.
5. **Buyers pay for verification, but the market's verification is siloed.** Paved's "Verified Badge" comes from a direct ESP integration.\[4\] CreatorIQ integrated YouTube's first-party viewership data for opted-in YouTube Partner Program creators in March 2026.\[5\]\[6\] beehiiv's ad network pays on unique human opens and verified clicks.\[7\] Each proves stats only inside its own marketplace. A portable, signed card the publisher carries anywhere does not exist.
6. **Outbound selling is legally narrow in Canada.** Under CASL, "conspicuous publication" implied consent requires that the recipient published the address themselves, with no "no solicitation" statement, and that the message be relevant to their role.\[8\] In 3510395 Canada Inc. (Compu.Finder) v. Canada (AG), decided June 5, 2020 (the Supreme Court of Canada refused leave in March 2021), the Federal Court of Appeal held that this does not permit mining third-party directories; in the CRTC's words, conspicuous publication "set[s] a higher standard than the simple public availability of electronic addresses." Auto-drafted pitches must go out from the publisher's own mailbox, to addresses the brand itself published, with a proof trail.

---

## 1. What Can Be Known About a Publisher, and How

### 1.1 Platform-by-platform access map

Status legend: **Verified this pass** means confirmed against official docs or primary sources in this research pass. **Prior knowledge, re-verify** means a well-established fact I did not re-fetch this pass; check the current docs before building on it.

| Platform | With owner OAuth / key (measured) | Public / unauthenticated | Costs, limits, terms |
|---|---|---|---|
| **YouTube** | Analytics API: `viewerPercentage` by `ageGroup`, `gender`, country/province; views and watch time by traffic source and playback location; retention; top videos; subscribed status (verified this pass)\[9\]\[10\] | Data API: channel/video metadata, public counts, comments, captions where available | Per Google's "Quota and Compliance Audits" page (updated 2026-09-14), the Data API's default allocation is "100 search.list calls, 100 videos.insert calls, and 10,000 units per day combined for all other endpoints"; more requires the YouTube API Services Audit and Quota Extension Form. Developer Policies III.E.4: Analytics-API data and statistics may be stored "as long as is necessary" with active consent, but authorization must be rechecked every 30 days. Other authorized data and non-authorized data: delete or refresh within 30 days.\[11\] Derived-metrics amendment (from June 1, 2026): custom scores, revenue estimates, tags, sentiment and brand-suitability scoring are allowed; inferring sensitive protected attributes (age, race, religion, politics, sexual orientation, health) of audience or creator is not (verified this pass)\[1\]\[2\] |
| **Podcasts** | Host analytics: Spotify for Creators (demographics, platform mix, engagement; CSV download on web only), Apple Podcasts Connect (Apple-only dashboard), Transistor/Buzzsprout (downloads, apps, locations; Buzzsprout advertises IAB-certified stats)\[12\]\[13\] | RSS: full episode archive, show notes, publish cadence, often transcripts or chapters; OP3 prefix stats for shows that opt in | Spotify has no public podcast-analytics API. A developer request for one sits unanswered on the Spotify Community forum (verified this pass).\[14\] Transistor has a REST API with analytics endpoints (prior knowledge, re-verify). Treat Apple and Spotify as **publisher-uploaded exports** |
| **beehiiv** | API: publication stats (`stat_active_subscriptions`, `stat_average_open_rate`, `stat_average_click_rate`, totals sent/opened/clicked), per-post stats, aggregate post stats; OAuth scopes such as `subscriptions:read` (verified this pass)\[15\]\[16\] | Web archive of posts | Dashboard reports "verified" clicks and click-to-open rates, and post reports exclude automation sends (verified this pass).\[17\] Read aggregate stats only; never export subscriber lists (processor rule) |
| **Kit, Ghost, Substack** | Kit v4 API (OAuth) for subscriber counts and broadcast stats; Ghost Admin API for members and posts (prior knowledge, re-verify) | Substack: public archive and RSS only. No official public API (prior knowledge, re-verify) | Substack publishers must paste a dashboard screenshot or CSV; mark these as "publisher-attested", not "measured" |
| **Instagram** | Graph API insights for Business/Creator accounts (`instagram_manage_insights`): follower age brackets, gender, top 45 cities/countries, active hours; reach/views/saves/shares per media. Demographics only for accounts with 100+ followers, up to 48 h delay; `impressions` replaced by `views` on April 21, 2025\[18\]\[19\]\[20\] | Business Discovery gives basic public counts for other professional accounts | Meta's Graph API "Rate Limits" docs put Instagram Platform endpoints under Business Use Case limits per app–user pair: "Calls within 24 hours = 4800 * Number of Impressions" over a rolling 24-hour window (Business Discovery and Hashtag Search fall under Platform Rate Limits instead). Meta's Platform Policy prohibits scraping |
| **TikTok** | Display API/Login Kit: `user.info.basic`, `video.list`, profile and stats scopes (follower, like, video counts), per-video view/like/comment/share counts (verified this pass)\[21\]\[22\] | Nothing sanctioned at scale | **No audience demographics in commercial APIs.** The Research API is limited to approved academic/non-profit researchers; the FAQ says creators, advertisers and commercial users are ineligible; 1,000 requests/day (verified this pass)\[23\]\[24\] |
| **X** | Owned reads at about $0.001 per resource (secondary sources)\[25\]\[26\] | Post reads at $0.005 each\[26\]\[27\]\[28\] | Pay-per-use became the default in February 2026. New signups cannot buy Basic/Pro,\[27\] and legacy Basic migrated to pay-per-use (May 21, 2026 announcement, per Blotato). Monthly read cap: 3M in X's docs snippet vs 2M in several third-party guides. Treat as conflicting and check the console. TechCrunch (Oct 21, 2025) reports X introduced "a $42,000-per-month enterprise tier" in March 2023 |
| **LinkedIn** | Community Management API for approved partners; member post analytics narrowly available (prior knowledge, re-verify) | Public posts are visible, but LinkedIn's User Agreement bars scraping | Treat LinkedIn writers as **paste-your-posts plus analytics-export** users. Do not crawl |
| **Twitch** | Helix API: channel info, VODs, clips; follower totals and subscriber data need broadcaster scopes (prior knowledge, re-verify) | Public stream metadata | Chat is rich intent data but ephemeral. Use EventSub only with broadcaster consent |
| **GitHub** | OAuth: private contribution stats if granted | REST/GraphQL: repos, stars, forks, topics, README content, release cadence, dependents; 5,000 req/h authenticated, 60/h unauthenticated (prior knowledge, re-verify) | The richest *public* signal source for developer educators: stack, languages, tools actually used |
| **Personal sites** | Plausible Stats API or GA4 Data API: sources, top pages, countries, devices (prior knowledge, re-verify) | sitemap.xml, RSS, rel=me links, schema.org, robots.txt | Respect robots.txt and `noai`-style directives. Crawl only the publisher's own declared domains |

### 1.2 What needs OAuth vs what can be inferred

- **Needs OAuth (measured, consented):** age/gender/geo of the audience, retention, traffic sources, open/click rates, subscriber counts behind private dashboards, site analytics. These are the only fields that can be labelled "verified" to advertisers.
- **Inferable from public content (with confidence scores):** topical graph, depth, recurring series, format mix, cadence, voice, sponsor history (disclosed #ad, "sponsored by", podcast host-reads), collaborations and guests, audience *needs* and *stage* from comments and questions, content gaps, brand-safety flags.
- **Must not be inferred:** sensitive or protected attributes of the audience or creator. This is barred for YouTube-derived data by the June 2026 amendment,\[2\] and it is the wrong thing to build anyway given Staab et al.'s findings.

### 1.3 Terms on scraping and AI analysis

- YouTube permits NLP on comments for aggregate sentiment and "Channel Happiness" scores, but not profiling users on protected attributes.\[2\] Stored non-authorized data expires in 30 days.\[11\]
- Meta and LinkedIn prohibit scraping. TikTok provides no commercial path to demographics.
- **Design rule:** use each platform's own OAuth for the publisher's own data, crawl only the publisher's own site and feeds, and keep commenter-level data transient (extract needs, then discard handles).

---

## 2. What the Profile Should Contain

### 2.1 How state-of-the-art systems represent creators

| System | What it infers | How | Accuracy concerns | Pricing (as found) |
|---|---|---|---|---|
| **Modash** | Audience age/gender/location/interests, brand affinity, fake-follower rate, lookalikes, past sponsors\[29\]\[30\] | Crawls public profiles on IG/TikTok/YouTube above 1,000 followers (380M+ profiles) and runs ML models\[31\]\[32\] | Audience demographics are modelled, not consented | From $299/mo (MakerStack review, 2026)\[33\] |
| **HypeAuditor** | Audience location, age, gender, language, "ethnicity", estimated income/education/marital status; fraud\[34\] | "Publicly available information… statistical modeling"; does not access insights; relies on GDPR Art. 14 legitimate interest\[35\] | Claims 95.5% fraud detection with 0.73% mean error (vendor, unvalidated). No published accuracy for demographics\[35\] | Plans from $299/mo billed annually (vendor blog, updated Sept 16, 2026)\[36\] |
| **CreatorIQ** | First-party viewer demographics and interests | YouTube Creator Partnership API integration (March 26, 2026) for opted-in YouTube Partner Program creators; also Snapchat\[6\]\[37\] | High quality, but only for program creators | No public price; roughly $30k–$60k/yr per Vendr-based estimates (third-party)\[38\]\[39\] |
| **Upfluence, GRIN, Aspire, Captiv8, Later Influence** | Discovery databases plus CRM; audience estimates; affiliate/sales tracking via Shopify | Mix of opt-in creator connections and public data | Same modelled-demographics problem (not individually verified this pass) | Mostly quote-based |
| **Passionfroot / Zest** | ICP fit, content style, performance patterns across campaigns\[40\] | Creator storefronts plus a "proprietary creator graph" from thousands of campaigns; Zest also finds creators *outside* the platform\[41\]\[42\] | Vendor claims; no public accuracy data | Creator fees 5% organic / 15% partner-network deals (third-party review);\[43\] raised a $15M Series A led by Insight Partners in July 2026; claims 13× revenue growth\[44\] |
| **Paved** | Newsletter reach and engagement | Direct ESP integration → "Verified Badge"; open pixel (browser, OS, country, no PII); manual self-report otherwise\[4\]\[45\] | Self-reported numbers are unverified | 30% commission on marketplace bookings, 40% on ad-network earnings (publisher-paid)\[46\] |
| **beehiiv Ad Network** | Match by topic, audience, engagement\[47\] | First-party platform data | Estimated payouts based on history\[7\] | CPM on unique opens or CPC on verified unique clicks; non-exclusive; recap about 96 h after send;\[7\]\[48\] paying out more than $1M/month to publishers (eMarketer)\[49\] |
| **SparkLoop, Swapstack** | Recommendation/cross-promo matching | ESP-connected referral data (not re-verified this pass) | n/a | Rev-share (not re-verified) |
| **Magellan AI** | Podcast ad spend, advertiser rosters, reach and demographics | ML ad detection across 50,000+ podcasts; spend *modelled* from ad counts, download estimates and CPMs; demographics licensed from Experian (Oct 2025)\[50\]\[51\]\[52\] | Spend is modelled; IAB-certified measurement per Podnews (Feb 4, 2026)\[51\] | Not public\[53\] |
| **Podscribe** | Attribution, verified impressions | Pixels plus household IP matching plus Tapad/Neustar device graph; claims 85%+ match rates\[54\] | Vendor claim | $250/mo plus $1.50 CPM for the first 2M podcast impressions\[55\] |
| **Rephonic** | Listener estimates, demographics, audience overlap graph, sponsors from transcripts\[56\] | "Hundreds of publicly available data points"; "listeners also subscribed" graph; transcripts for 45M+ episodes\[56\]\[57\]\[58\] | The Podcast Host's May 2025 test: 51.6% average accuracy, only 5 of 14 shows above 70%, two outliers excluded (one at −1,395%)\[58\] | $99 / $149 / $299 per month\[57\] |
| **SparkToro** | Where an audience pays attention: sites, podcasts, YouTube, keywords, demographics | Datos opt-in clickstream panel plus crawled public LinkedIn/social profiles plus search data; no generative AI in affinity scores\[59\] | Self-described as "directional rather than exact"; noisy for niches; English-only (US/CA/UK)\[60\]\[61\] | Free; Business $150/mo; Agency $300/mo\[62\] |
| **Similarweb** | Site traffic and audience | Panels plus ISP/partner data plus modelling (not re-verified this pass) | Weak for small sites | Quote-based |
| **GWI** | Consumer attitudes and media habits | Surveys: 960K annual sample across 53 markets, quarterly since 2013; internet users aged 16–64 only\[63\]\[64\] | Survey weighting; cannot profile individual creators | Plus $150/user/mo; higher tiers by quote\[65\] |
| **vidIQ, TubeBuddy, Social Blade, Tubular** | Channel growth, SEO, estimated earnings | YouTube API (OAuth for your own channel, public data for others) | Social Blade's earnings use a $0.25–$4.00 RPM band and "assume every view is monetized"; history only from when a profile is first tracked\[66\]\[67\] | Social Blade $59.99–$1,439.99/yr; vidIQ Boost reported at $19 or $39/mo (sources conflict)\[67\]\[68\]\[69\] |

**What none of them do:**
1. Profile the *publisher's* whole cross-channel footprint as a single entity owned and controlled by the publisher.
2. Separate measured, attested and inferred claims with per-field provenance and signatures.
3. Model **audience needs and jobs-to-be-done** (not just demographics or interests) and link them to purchasable offers with program-rule compliance.
4. Make the profile portable and cryptographically verifiable outside their walls.

### 2.2 Proposed profile schema (design; field names are Ancaster inventions)

Every field carries `{value, provenance: measured|attested|observed|inferred, source, as_of, confidence, evidence[]}`.

1. **Identity and channels:** canonical publisher ID (the publisher's own domain), verified channel handles (rel=me, OAuth), cross-links.
2. **Topical graph:** themes → subtopics → entities (tools, brands, concepts), each with depth score (share of content, recency, technical level), recurring series, and an "authority" signal (engagement per topic vs the channel baseline).
3. **Format and cadence:** format mix per channel (long video, Shorts, episode, issue, thread, stream), length distribution, publish rhythm, and consistency score.
4. **Voice and trust signals:** tone descriptors, disclosure hygiene (how consistently sponsorships are disclosed), correction behaviour, first-hand-testing ratio (share of recommendations with visible use).
5. **Audience, measured:** demographics, geography, language, device, traffic sources, retention, open/click rates. OAuth only.
6. **Audience, inferred needs:** roles, skill level, stage, budget band, jobs-to-be-done, pain points, recurring questions. These come from comments, replies and questions, aggregated, with an example quote count per claim and no individual profiling.
7. **Engagement quality:** comment depth (median words, question share), creator reply rate, saves/shares per view, verified click-through, and a "conversation vs applause" ratio.
8. **Cross-channel relations:** which topics travel between channels, funnel shape (e.g., YouTube → newsletter signup sources), and measured overlap where analytics exist.
9. **Growth and seasonality:** 12–36-month trajectory per channel, topic-level seasonality, change-points.
10. **Brand safety and suitability:** GARM-style category flags on content, controversy spikes, and publisher-declared exclusions.
11. **Sponsor history:** disclosed sponsors by date, category and format (from descriptions, show notes, host-read transcripts, #ad tags), plus Ancaster Referral Receipts where they exist.
12. **Adjacent publishers:** embedding neighbours, actual collaborations and guests, shared sponsors, and a "constellation" candidate list.
13. **Opportunities:** content gaps (high-demand questions with no matching content), offer gaps (needs with no matching offer in the index), sponsor-category gaps.
14. **Commercial terms:** rate card, inventory calendar, program permissions (from the 401-offer index rules), exclusivity.

---

## 3. AI Methods for Profile Building and Cross-Relations

### 3.1 Pipeline (Cloudflare-native)

1. **Ingest (Queues + Workers):** crawl RSS, sitemaps, YouTube metadata/captions and GitHub READMEs into R2; OAuth pulls into D1 as dated snapshots.
2. **Transcribe** only where no captions or transcripts exist, using Whisper on Workers AI. This is the biggest cost variable.
3. **Chunk + embed** with bge models on Workers AI and store in Vectorize. Vectorize caps vectors at 1,536 dimensions (per a third-party architecture guide),\[70\] so use bge-base/bge-m3-class models.
4. **Topic modelling:** use embedding clustering (BERTopic-style HDBSCAN over chunk embeddings) rather than LDA, with a small LLM labelling clusters and assigning a depth score.
5. **Entity and relation extraction:** a structured-output LLM pass per chunk returns entities, relations (`uses`, `recommends`, `compares`, `sponsored_by`, `guest_of`), sentiment and a first-hand flag, then writes them into a D1 edge table (publisher–topic–entity–need–offer–advertiser).
6. **Comment and question mining:** classify each comment as question, pain, praise, purchase intent or other; extract the need; cluster questions by embedding; rank clusters by frequency × recency × unanswered status. Drop commenter handles after extraction.
7. **Persona inference:** produce *aggregate segment cards* ("~30% of questions come from people self-describing as beginners"). Every claim carries a count, sample quotes and a confidence score. Never produce per-commenter attribute inference: Staab, Vero, Balunović and Vechev (ETH Zurich, ICLR 2024) showed on 520 real Reddit profiles that LLMs infer personal attributes at "up to 85% top-1 and 95.8% top-3 accuracy", and the privacy harm of doing that is exactly what Ancaster must avoid. Bias risk: commenters are not the audience (vocal minority, platform skew). Always label these cards "commenter-derived".
8. **Creator similarity:** build a profile embedding (weighted mean of topic-cluster centroids plus format/cadence features) and run nearest neighbours in Vectorize, re-ranked by explicit relations (shared guests and sponsors). InfluMatch (arXiv, July 2026) argues for criteria-conditioned retrieval with per-criterion evidence-grounded justifications rather than fixed attribute filters, and reports frontier-quality creator search at 4B-model cost.\[71\] That is the right pattern for an auditable match.
9. **Knowledge graph:** keep it in D1 as typed edges, not a graph database. Sponsorship-matching research (CARI's triadic influencer–product–customer graph neural network) supports modelling the audience as a first-class node rather than matching creator to product directly.\[3\]
10. **Change detection:** weekly Durable Object alarms re-embed new content; topic-share drift (Jensen–Shannon distance between monthly topic distributions), a change-point on growth, and new sponsor categories trigger "profile changed" events feeding the program-change watchdog.

### 3.2 Compute cost estimate per publisher (Ancaster estimate, not measured)

Assumptions: 200 long-form items (about 2,500 words each), 3,000 comments, a small Workers AI LLM priced around $0.05/M input and $0.34/M output tokens (the example rate in one Cloudflare pricing guide).\[72\] Workers AI bills $0.011 per 1,000 Neurons with 10,000 free Neurons/day.\[73\]

| Step | Tokens | Est. cost |
|---|---|---|
| Embedding the archive (~0.7M tokens) | 0.7M | well under $0.05 |
| Extraction pass (1.2M in / 0.15M out) | 1.35M | about $0.11 |
| Comment classification (0.3M in / 0.05M out) | 0.35M | about $0.03 |
| Cluster labelling and profile synthesis | 0.2M | about $0.02 |
| **Initial build, text only** | | **about $0.20** |
| Monthly refresh (new items only) | | **about $0.01–$0.05** |
| Transcription where no captions exist | per audio minute | dominant cost; measure it before promising anything |

The planning conclusion holds even if these figures are off by 3×: inference is not the constraint. API quotas, terms and honesty are.

### 3.3 Honesty architecture

- **Four provenance levels**, shown as visible badges:
  - **Measured:** OAuth, signed snapshot.
  - **Attested:** a publisher-uploaded export or screenshot.
  - **Observed:** public counts.
  - **Inferred:** LLM output, with a confidence score and linked evidence.
- **Calibration:** for publishers who connect OAuth, compare earlier inferred fields (e.g., "mostly US", "mostly practitioners") against measured values and publish the calibration curve internally. Show customers only calibrated confidence levels.
- **Customer-facing rule:** advertisers see measured stats as numbers, and inferred traits only as labelled "signals" with evidence counts, never as percentages that look measured. YouTube's amendment requires this distinction anyway.\[2\]

---

## 4. Using the Profile: Offer Targeting

### 4.1 Match score (design)

`Fit = NeedFit × TopicFit × RulesPass × Safety × Timing` → ranked by `ExpectedValue = predicted EPC × expected clicks − saturation penalty`

- **Audience-need fit:** cosine similarity between offer "job" embeddings and the publisher's question/pain clusters, weighted by cluster volume. This is the core differentiator.
- **Topical fit:** overlap with the topic graph at subtopic depth; penalize topics the publisher covers only shallowly.
- **Program rules (hard gate):** the 401-offer index's per-rule permissions (channel allowed, email allowed, paid search, geo, coupon policy) are checked against the publisher's channels and measured geography.
- **Commission economics:** payout × measured or estimated conversion × cookie window × reversal rate.
- **Predicted EPC:** start from network-published EPC where the program has one; shrink toward a category prior (empirical Bayes) until Ancaster has outcomes.
- **Saturation:** the share of adjacent publishers already promoting the offer (from sponsor-history extraction); high saturation lowers novelty but raises proof availability. Show both.
- **Brand safety:** the publisher's declared exclusions plus the offer's category.
- **Timing:** topic seasonality × offer promo calendar × delayed-purchase windows (feeding the "keep it" layer).

### 4.2 Evidence on match quality vs conversion

- **Strongest:** the CARI randomized field experiment (+243% purchase rate) shows audience-aware matching beats creator-only matching on a real platform.\[3\] It is one platform in Asia with product commerce, not affiliate SaaS, so treat it as directional.
- **Vendor claims:** Passionfroot's Zest says it "surfaces patterns in which creator-platform-format combinations work for your ICP",\[40\] and Collabstr and Modash promote lookalikes. None publishes controlled lift.
- **Missing:** public, controlled affiliate evidence that profile fit predicts EPC. **The test that would produce it:** for each publisher, randomize the placement slot between the profile-ranked offer and a popularity-ranked baseline (the holdout machinery already exists in the sponsor marketplace) and compare EPC and 30-day reversal-adjusted revenue over at least 8 weeks.

### 4.3 Learning across publishers without pooling lists (design)

- Each publisher tenant keeps its own subscriber-level data. Only **cell-level aggregates** leave the tenant: (offer × topic-cluster × format × geo-band) → clicks, conversions, revenue.
- A cell is published to the shared model only when at least 5 distinct publishers contribute (k-threshold), and aggregate EPC gets small differential-privacy noise before it is shared.
- The shared model is a hierarchical prior used for cold-start ranking. No email addresses, no user IDs, no cross-publisher identity joins. This keeps Ancaster a processor and fits CASL/PIPEDA expectations.

---

## 5. Using the Profile: Build for the Publisher (Minimal Effort)

### 5.1 What Ancaster can generate automatically

| Output | Uses | Effort for publisher |
|---|---|---|
| **Living verified media kit + rate card** | Measured stats, topic graph, sponsor history, comparables | Approve once; auto-updates |
| **Stack/recommendations page** | Tools the publisher has *actually demonstrated* (first-hand flag), matched to allowed offers, with per-placement links | Review and edit draft |
| **Content ideas** | Unanswered question clusters × offer gaps × seasonality | Pick or ignore |
| **Sponsor-ready segments** | Recurring series that match advertiser categories, packaged as inventory | Approve |
| **Newsletter recommendation segments** | Needs clusters → recommendation blocks for the newsletter desk | Approve per issue |
| **Sponsor pitch deck** | Audience Card + case evidence (Referral Receipts, holdout lift) | Approve |
| **Pricing guidance** | Comparable publishers' public rates plus the publisher's measured reach | Accept or adjust |
| **Growth recommendations** | Cross-channel funnel gaps (e.g., strong YouTube, weak newsletter capture) | Read |

### 5.2 Rate benchmarks available

- **Collabstr 2026 report** (21,000+ collaborations, 200,000+ creators):\[74\] average package price was highest on Twitch at $398, then YouTube at $311, then Instagram at $214.\[75\] Instagram brands actually paid an average of $193,\[74\] and about 80% of collaborations cost under $300.\[75\] Collabstr's price calculator draws on rates from over 1.2M marketplace influencers.\[76\] Marketplace data skews toward small creators.
- **Newsletters:** beehiiv's own blog cites $10–$75 CPMs generally and $50–$100+ for specialized B2B (vendor content).\[77\] beehiiv's ad network pays per unique open or verified click.\[48\] Paved reports sponsorships "typically averaging around $5K" (vendor).\[78\]
- **Podcasts:** Rephonic's CPM heuristics rest on its own estimates, which The Podcast Host found averaged about 51.6% accurate.\[58\]\[79\]
- **Beacons, Stan:** media-kit/link-in-bio tools (not re-verified this pass). None of the kits found pull *verified cross-channel* stats into a signed artifact.
- **Recommendation:** present pricing guidance as a range with the comparables shown ("3 similar newsletters list $X–$Y"), never as "your fair price".

### 5.3 Policy risks of AI-generated outputs

- **Google scaled content abuse:** the policy was introduced in March 2024 and enforced from May 5, 2024. It is method-agnostic, and the August 2025 spam update (Aug 26–Sep 22, 2025) strengthened SpamBrain against thin affiliate and near-duplicate pages.\[80\]\[81\] Rule: Ancaster generates *one* stack page per publisher from first-hand evidence, never programmatic page farms, and requires publisher edits before publishing.
- **FTC:** the Endorsement Guides require clear disclosure of material connections. The Consumer Reviews and Testimonials rule (16 CFR Part 465, effective October 2024) bans buying or selling fake indicators of social-media influence (prior knowledge, re-verify). Verified stats are a compliance *asset* here.
- **Platform rules:** posting AI-drafted content to YouTube/Instagram is fine when a human edits it. Automated comment-to-DM must follow Meta's messaging windows (planned feature; re-verify policy before launch).

---

## 6. Using the Profile: Sell the Publisher to Advertisers

### 6.1 How advertisers buy today

- **Influencer databases (brand-side):** Modash, HypeAuditor, CreatorIQ, GRIN, Upfluence, Aspire. Search on scraped or modelled profiles, then cold outreach.
- **Self-serve marketplaces:** Collabstr, Passionfroot, Paved, beehiiv Ad Network. Creator storefronts, platform-verified stats, take rates of 5–40%.
- **Podcast networks and intelligence:** Magellan AI shows which brands sponsor which shows (modelled spend); Podscribe does attribution.\[82\]\[83\]
- **B2B creator marketplaces:** Passionfroot (customers include Figma, ElevenLabs and Replit per its July 2026 funding coverage).\[44\]
- **What buyers want:** verified audience (hence Paved's badge and CreatorIQ's first-party YouTube integration), outcome proof, brand safety, and fair pricing. Every incumbent solves one of these inside its own marketplace.

### 6.2 The sales layer on the publisher's behalf (design)

1. **Public, advertiser-facing Audience Card page** at the publisher's own domain (`/sponsor`). It shows measured stats with "verified via YouTube Analytics, as of date" badges, inferred need signals clearly labelled, sponsor history, inventory and the rate range.
2. **Advertiser matching:** rank brands by (a) need-fit to the publisher's question clusters, (b) evidence of active spend, and (c) category availability. Spend signals and their limits:
   - **Meta Ad Library API:** returns commercial ads only for ads delivered to the EU/UK in the past year; political/issue ads go back 7 years.\[84\] A Canadian or US brand that never targets Europe is invisible to the API, though visible on the website.\[85\]
   - **Google Ads Transparency Center:** browseable, thin records\[86\] (not API-verified this pass).
   - **Podcast/newsletter sponsor histories:** from Ancaster's own transcript and issue extraction across public archives. This is the strongest signal because it shows *creator-channel* spend.
   - **Affiliate program listings:** from the 401-offer index. A brand with a program is already paying for creator distribution.
3. **Auto-drafted pitches the publisher approves:** sent from the publisher's own mailbox via bring-your-own-key, one brand per message, citing the specific need cluster and a verified stat.
4. **Gated agent sponsor desk:** an MCP/HTTP endpoint and chat on `/sponsor` where brand agents or humans ask questions. It answers only from the signed card, quotes the publisher's floors and availability, and escalates to the publisher before any commitment.
5. **Collective packages ("constellations"):** a bundle of consenting similar publishers, sold with aggregate measured reach (deduplicated where overlap is measurable) and a single proof report.

### 6.3 Evidence from market players

- **Passionfroot's Zest** proves brands will let an agent shortlist creators, including off-platform creators, from a campaign graph.\[42\]
- **beehiiv** proves publishers accept network-matched ads when payouts are per verified open or click and non-exclusive.\[48\]
- **Magellan AI** proves sponsor-history intelligence sells to buyers.
- None of the three sells *for* the publisher with the publisher's own proofs.

### 6.4 Legal constraints

- **CASL (Canada):** a commercial electronic message to a brand contact needs consent or an exemption. The conspicuous-publication test requires (1) the recipient published the address, (2) no statement refusing solicitation, and (3) relevance to their role. It excludes addresses mined from third-party directories (3510395 Canada Inc. (Compu.Finder) v. Canada (AG), FCA, June 5, 2020, leave to the Supreme Court of Canada refused March 2021; the CRTC had found 317 CEMs sent without consent in CRTC 2017-368, and reduced the penalty from $1.1M to $200,000). The sender bears the burden of proof, so Ancaster stores the URL, capture date, address, a no-refusal check and a role-relevance note for every pitch.\[87\]\[88\] Each message needs sender identification, a physical address and one working unsubscribe link.\[89\]\[90\]
- **CAN-SPAM (US):** B2B cold email is permitted with accurate headers, a non-deceptive subject, a physical address and an honoured opt-out.
- **Audience privacy:** only aggregates appear on the card. No subscriber lists move between tenants. Commenter-level extraction is transient.

---

## 7. Portability and Ownership: "The Profile Carries"

**Position: yes. Make the profile a signed, publisher-owned asset.** This is Ancaster's most defensible move, because it converts siloed verification into a portable one.

- **Precedents:**
  - Paved's ESP-verified badge (platform-locked).\[4\]
  - CreatorIQ's first-party YouTube viewership integration (platform-mediated).\[6\]
  - OP3 open podcast stats, which Rephonic uses to verify listeners.\[58\]
  - W3C Verifiable Credentials 2.0. The seven specs, including Data Model 2.0, Data Integrity EdDSA/ECDSA, JOSE/COSE securing and Bitstring Status List for revocation, became W3C Recommendations on May 15, 2025.\[91\] BBS selective-disclosure cryptosuites reached Candidate Recommendation Draft in April 2026.\[92\]
  - AT Protocol (Bluesky) domain-verified identity via DNS or `/.well-known/atproto-did` (prior knowledge, re-verify).
- **Proposed format (invention):** `https://publisher.example/.well-known/audience-card.json`. It is a JSON document signed with an Ed25519 key held in Ancaster's KMS on the publisher's behalf, with the publisher able to export or rotate the key. Each measured field embeds the source, the query window and Ancaster's attestation signature; inferred fields carry confidence and evidence counts. There is an agent-readable variant (JSON-LD) and a human page.
- **Phase 2:** wrap measured sections as VC 2.0 credentials (issuer: Ancaster; subject: the publisher's domain DID) with a Bitstring Status List so stale stats can be revoked.
- **Could it become an open standard Ancaster leads?** Plausibly, if it stays tiny: an "Audience Card v0" spec of about 20 fields, with provenance levels and an open verifier. The advantage comes from being the first issuer with real OAuth attestations, not from owning the format. **Evidence of demand does not exist yet.** Test it by publishing the spec and checking whether 3+ advertisers or agencies will ingest cards in a pilot.
- **Risks:**
  - *Privacy:* only aggregates, with thresholds (no demographic cell under about 5% or about 100 people).
  - *Gaming:* stats bought with fake engagement. Mitigate with engagement-quality fields, retention and verified-click ratios, plus FTC fake-indicator rules as a deterrent.
  - *Staleness:* stale stats are visible when `as_of` dates are old; expire attestations after 30–90 days. YouTube requires 30-day re-authorization anyway.\[11\]
  - *Platform terms:* republishing YouTube API data in a card must follow display and derived-metric rules; keep raw values attributed to "YouTube Analytics".

---

## 8. What Has Nobody Done? Big Swings

All eight ideas below are **Ancaster inventions**; the evidence noted is adjacent, not direct.

1. **Demand Ledger: need-first offer sourcing.** The profile's unanswered, purchase-intent question clusters become public "open needs" (aggregate, anonymised). Ancaster recruits advertisers or affiliate programs to fill them.
   - *For:* CARI shows audience-aware matching lifts purchase rates; Rephonic and Magellan show buyers pay for demand intelligence.
   - *Against:* niche needs may be too small for brands to bother.
   - *Feasibility:* high. It reuses question clustering and the offer index.
   - *Defensibility:* a cross-publisher need graph at the cell level that no scraped database has.
2. **Constellations: bundled audiences.** Groups of 5–20 consenting adjacent publishers are sold as one verified package, with a deduplicated measured reach where overlap is measurable and a shared holdout lift report.
   - *For:* Rephonic's audience graph and beehiiv's network show buyers value aggregated reach.
   - *Against:* coordination, revenue splits, and the weakest member dragging down quality.
   - *Feasibility:* medium. Durable Objects for the package ledger.
   - *Defensibility:* signed per-member proofs.
3. **Proof-carrying negotiator.** An agent sponsor desk that negotiates only within publisher-set floors and answers every buyer question with a signed claim ("CTR 4.1%, measured, beehiiv API, Aug 2026").
   - *For:* buyers already accept agents (Zest).
   - *Against:* buyer trust in a seller-side agent; mistakes in commitments.
   - *Feasibility:* high for Q&A, medium for pricing.
   - *Defensibility:* Referral Receipts and holdout lift as proof sources nobody else has.
4. **Next-quarter need forecast.** Forecast which needs the audience will have next quarter from question-velocity trends × seasonality × ecosystem launches (GitHub releases, program changes from the watchdog).
   - *For:* change detection is cheap.
   - *Against:* forecast accuracy is unproven. **No evidence exists.** Test by back-testing a 6-month holdout of each publisher's history.
   - *Defensibility:* longitudinal per-publisher data.
5. **Profile-to-product.** When a need cluster is large, persistent and poorly served by existing offers, Ancaster drafts a product brief for the publisher (template, course outline, tool spec) with demand evidence.
   - *For:* beehiiv reports subscription revenue climbing from about 30% to about 85% of creator revenue on its platform (vendor claim).\[93\]
   - *Against:* it pulls the publisher away from affiliate revenue.
   - *Feasibility:* high (a document generator).
   - *Defensibility:* moderate.
6. **Reverse marketplace for declared needs.** Advertisers bid for the right to *answer* a declared need in a specific publisher's next issue or video, priced per verified click, with the publisher's veto.
   - *For:* beehiiv's CPC-on-verified-clicks proves the payout primitive.\[7\]
   - *Against:* thin liquidity early.
   - *Feasibility:* medium. It sits on top of the existing marketplace.
   - *Defensibility:* need-level inventory is unique.
7. **Audience Card open standard + verifier.** A public spec plus a free verifier page any brand or agent can paste a card URL into.
   - *For:* VC 2.0 is now a W3C Recommendation;\[91\] platform verification is siloed.
   - *Against:* standards die without adoption.
   - *Feasibility:* high (small spec, Workers verifier).
   - *Defensibility:* first issuer with OAuth-backed attestations.
8. **Anti-offer profile.** Using comment sentiment and churn after past sponsors, the profile records what the audience *rejects* (categories and formats that caused unsubscribes or negative comments) and blocks those offers automatically.
   - *For:* beehiiv tracks unsubscribe rates per post; YouTube allows sentiment scoring.\[2\]\[94\]
   - *Against:* sparse signals.
   - *Feasibility:* high.
   - *Defensibility:* it protects publisher trust, which is Ancaster's brand.

---

## 9. Synthesis: The Publisher Profile Product

**Purpose sentence:** *Ancaster turns everything a publisher has already published into a verified, portable profile of who their audience is and what it needs, then uses that profile to pick offers, build sales assets and sell the publisher to advertisers, with every claim labelled as measured or inferred.*

**Onboarding (three steps, one required):**
1. Paste one URL (website, link-in-bio or any channel). Ancaster discovers the other handles via rel=me, link pages, RSS and channel "about" links, and shows a draft profile built from public content.
2. Confirm the channels that are yours (one click each).
3. Optional "Verify" buttons: YouTube OAuth, beehiiv/Kit/Ghost key, Plausible/GA4, podcast-host export upload. Each one flips fields from inferred to measured.

**How it powers everything:**
- Profile → offer ranking (section 4).
- Profile → auto-built kit, stack page and ideas (section 5).
- Profile → Audience Card + sponsor desk + pitches (section 6).
- Change events → watchdog and "keep it" timing.

**Build vs integrate:**
- **Build:** crawler, extraction, need clustering, graph, card signing, sponsor desk.
- **Integrate:** platform OAuth, ESP APIs, affiliate APIs.
- **Do not build:** demographic inference and a scraped creator database. Both are terms-risky and commoditized.

**Honest claims vs tests:**

| Can claim now | Must test first |
|---|---|
| "Stats marked Verified come directly from your connected YouTube/beehiiv account, dated" | "Profile-matched offers earn more" (offer holdout) |
| "Signals marked Inferred are AI-derived from N public comments/posts" | "Verified cards get more sponsor replies" (advertiser A/B) |
| "Nothing about individual subscribers leaves your account" | Inference accuracy percentages (calibration study) |
| Rate ranges shown with named public comparables | "Fair price" or forecast accuracy |

### Decisions (founder format)

**D1. Data sources to start with**
- A. YouTube (Data + Analytics), podcast/blog RSS, newsletter archive + beehiiv/Kit API, GitHub. **Recommended.**
- B. All platforms, including Instagram/TikTok/X.
- C. Public-only crawl.
- *Decide for me:* **A.** These have the best official APIs and archives; X costs money per read, and TikTok/LinkedIn give little.

**D2. OAuth vs public-only**
- A. Public draft first, OAuth to "verify". **Recommended.**
- B. OAuth required up front.
- C. Public-only.
- *Decide for me:* **A.** Minimum effort and an instant wow moment, and only measured fields reach advertisers as numbers.

**D3. Profile schema scope**
- A. Core 7 blocks (identity, topics, format/cadence, measured audience, inferred needs, engagement, sponsor history). **Recommended.**
- B. Full 14-block schema.
- C. Stats-only kit.
- *Decide for me:* **A**, adding blocks 8–14 after the calibration study.

**D4. First automated output**
- A. Living verified media kit / Audience Card page. **Recommended.**
- B. Offer recommendations.
- C. Content ideas.
- *Decide for me:* **A.** It is visible, reused by the sales layer, and exercises the measured/inferred split. Offer recommendations ship second, since the 401-offer index already exists.

**D5. Advertiser sales motion**
- A. Inbound first: public card + gated agent sponsor desk + marketplace listing. **Recommended.**
- B. Publisher-approved outbound drafts from the publisher's mailbox.
- C. Ancaster-run outbound on the publisher's behalf.
- *Decide for me:* **A now, B at day 60, never C.** C makes Ancaster the CASL sender without a clean consent basis.

**D6. Portability format**
- A. Signed JSON at `/.well-known/audience-card.json` (Ed25519/JWS). **Recommended.**
- B. Full W3C VC 2.0 from day one.
- C. No portability; hosted page only.
- *Decide for me:* **A**, with the schema designed to wrap cleanly as VC 2.0 in phase 2.

### 30/90-day plan

**Days 1–30**
- URL-paste discovery crawler (rel=me, RSS, YouTube channel, GitHub).
- Extraction + question clustering on Workers AI/Vectorize.
- Profile schema v0 (core 7 blocks) in D1 with provenance fields.
- YouTube Analytics + beehiiv OAuth "verify".
- Living media kit page on the publisher's domain.
- Apply for YouTube's derived-metrics amendment (Analytics & Reporting use case).\[2\]
- Run Experiment 1 with 10–20 recruited publishers across at least 4 publisher types.

**Days 31–90**
- Signed Audience Card v0 + public verifier.
- Gated agent sponsor desk (Q&A only, publisher-approved commitments).
- Offer ranking with need-fit + rules gate + holdout.
- Publisher-approved outbound drafts with a CASL proof trail (from day 60).
- Kit/Ghost/Plausible connectors.
- Demand Ledger pilot.
- Publish the Audience Card v0 spec.

### Experiments that validate profile quality and advertiser value

1. **Profile precision (week 2–4):** each publisher rates every inferred claim true/false/partly. Target ≥80% "true" on topics and needs before showing needs to advertisers.
2. **Inference calibration:** for publishers who connect OAuth, compare pre-connection inferred geography, stage and role signals with measured data. Publish only confidence bands that hold.
3. **Advertiser A/B (days 45–90):** send matched buyers either the verified Audience Card or a conventional PDF kit for the same publisher. Measure reply rate, time-to-book and price accepted.
4. **Offer-match holdout:** profile-ranked vs popularity-ranked offers in randomized slots for at least 8 weeks. Measure EPC and reversal-adjusted revenue. This produces the evidence the affiliate market lacks.
5. **Pricing guidance accuracy:** suggested range vs closed price across the first 30 deals.
6. **Demand Ledger response:** publish 5 open needs and pitch 50 brands that published their partnership contacts themselves. Measure response and fill rate.
7. **Card adoption:** check whether at least 3 agencies or brand agents ingest Audience Cards via the verifier in a pilot. If not, keep the card as an Ancaster-internal format.

## Caveats

- Several platform facts (Kit, Ghost, Substack, LinkedIn, Twitch, GitHub, Plausible/GA4, Transistor, AT Protocol, the FTC fake-indicators rule) come from prior knowledge and were not re-fetched this pass. They are marked for re-verification before build.
- X's monthly read cap is reported as both 2M and 3M.\[95\]\[96\] Check the developer console.
- Instagram's rate limit now comes from Meta's Graph API "Rate Limits" docs (Business Use Case limit of "4800 * Number of Impressions" per rolling 24 hours per app–user pair), but some vendor prices (CreatorIQ, Magellan AI, vidIQ) are secondary or third-party.
- Vendor accuracy claims (HypeAuditor's fraud detection, Podscribe's match rates, Passionfroot's graph) are unvalidated. The only independent accuracy test found is The Podcast Host's small 14-show Rephonic study.\[58\]
- The CARI field result comes from one platform with product commerce; transfer to affiliate SaaS offers is untested.
- The cost estimate is a modelled figure, not a measurement. Transcription volume could dominate it.
- All "big swing" ideas, the Audience Card format and the privacy-preserving learning design are Ancaster inventions without direct market evidence. Each has a named experiment above.

## Sources

1. [YouTube API Services Terms of Service - Revision History | Google for Developers](https://developers.google.com/youtube/terms/revision-history)
2. [Additional policies for derived metrics and data storage | YouTube | Google for Developers](https://developers.google.com/youtube/terms/derived-metrics-policy)
3. [Reputation Burning: Analyzing the Impact of Brand Sponsorship on Social Influencers](https://www.researchgate.net/publication/385060267_Reputation_Burning_Analyzing_the_Impact_of_Brand_Sponsorship_on_Social_Influencers)
4. [Connect Paved to Your ESP | Paved Knowledge Base](https://www.paved.com/help/articles/9346921-connect-paved-to-your-esp)
5. [CreatorIQ Deepens Partnership with YouTube With Integration Unlocking Audience Insights for Smarter Creator Campaigns](https://www.businesswire.com/news/home/20260326318071/en/CreatorIQ-Deepens-Partnership-with-YouTube-With-Integration-Unlocking-Audience-Insights-for-Smarter-Creator-Campaigns)
6. [CreatorIQ Deepens Partnership with YouTube with Integration Unlocking Audience Insights for Smarter Creator Campaigns](https://www.creatoriq.com/press/releases/creatoriq-deepens-partnership-with-youtube-with-integration-unlocking-audience-insights-for-smarter-creator-campaigns)
7. [Ad Network for Publishers - Features - beehiiv](https://www.beehiiv.com/features/ad-network/publishers)
8. [Doing Business in Canada: CASL | Gowling WLG](https://gowlingwlg.com/en/insights-resources/guides/2023/doing-business-in-canada-casl)
9. [Sample API Requests | YouTube Analytics and Reporting APIs | Google for Developers](https://developers.google.com/youtube/analytics/sample-requests)
10. [Dimensions | YouTube Analytics and Reporting APIs | Google for Developers](https://developers.google.com/youtube/analytics/dimensions)
11. [YouTube API Services - Developer Policies | Google for Developers](https://developers.google.com/youtube/terms/developer-policies)
12. [Spotify for Creators Review 2026: Hosting, Video & Monetization - The Podcast Consultant](https://thepodcastconsultant.com/blog/spotify-for-creators)
13. [Downloading your show's analytics data - Spotify](https://support.spotify.com/us/creators/article/downloading-your-shows-analytics-data/)
14. [API to fetch Podcast Stats - The Spotify Community](https://community.spotify.com/t5/Spotify-for-Developers/API-to-fetch-Podcast-Stats/td-p/5611023)
15. [List subscriptions OAuth Scope: subscriptions:read | beehiiv | Developer Documentation](https://developers.beehiiv.com/api-reference/subscriptions/index)
16. [Integrate beehiiv's API using Konfig's TypeScript SDK | Konfig](https://konfigthis.com/sdk/beehiiv/typescript/)
17. [Understanding your Posts Report | beehiiv Help](https://www.beehiiv.com/support/article/12404046405015-understanding-your-posts-report)
18. [Instagram Audience Demographics API: Access Creator Data at Scale (2026) | Phyllo](https://www.getphyllo.com/post/instagram-audience-demographics-for-influencer-marketing-platforms)
19. [How to Use the Instagram Graph API for Audience Insights in 2025](https://www.getphyllo.com/post/how-to-use-the-instagram-graph-api-for-audience-insight-iv)
20. [Instagram Insights API: Features and Use Cases](https://www.upgrow.com/blog/instagram-insights-api-features-use-cases)
21. [TikTok User Info API Documentation](https://developers.tiktok.com/doc/research-api-specs-query-user-info?enter_method=left_navigation)
22. [Overview | TikTok for Developers](https://developers.tiktok.com/docs/en/display-api-overview?enter_method=left_navigation)
23. [How to Fetch TikTok User Data & Video Metrics via API 2026](https://www.keyapi.ai/blog/how-to-fetch-tiktok-user-data-video-metrics-api/)
24. [Frequently Asked Questions | TikTok for Developers](https://developers.tiktok.com/docs/en/research-api-faq?enter_method=left_navigation)
25. [X API Pricing in 2026: What Each Tier Really Costs](https://xautodm.com/blog/x-api-pricing-explained-2026-cheaper-alternatives)
26. [Twitter API Pricing 2026: Pay-Per-Use Costs & Alternatives | Xpoz Blog](https://www.xpoz.ai/blog/guides/understanding-twitter-api-pricing-tiers-and-alternatives/)
27. [How Much Does the X (Twitter) API Cost in 2026?](https://twitterapi.io/blog/x-api-cost-breakdown-2026)
28. [X (Twitter) API Pricing in 2026: All Tiers | Postproxy](https://postproxy.dev/blog/x-api-pricing-2026/)
29. [Modash Pricing & Review 2026: Features, Costs & Verdict](https://www.creator-hero.com/blog/modash-pricing-and-review)
30. [Influencer Discovery Platform: Find Influencers](https://www.modash.io/features/influencer-discovery)
31. [Our Data | Modash](https://www.modash.io/data)
32. [What is Modash?](https://pangea.app/glossary/modash)
33. [Modash Review (2026): Pricing, Features & Honest Verdict - MakerStack](https://makerstack.co/reviews/modash-review/)
34. [In-Depth Influencer Analytics Platform | HypeAuditor](https://hypeauditor.com/reports/)
35. [How HypeAuditor Collects and Analyzes Influencer Data: Methods, Sources, Accuracy](https://hypeauditor.com/collect-analyze-influencer-data/)
36. <https://blog.hypeauditor.com/how-much-does-hypeauditor-cost-/>
37. [What to know about the latest must-have data: Viewership insights](https://www.creatoriq.com/strategies-best-practices/viewership-insights)
38. [CreatorIQ Pricing: How Much Does It Cost in 2026?](https://archive.com/blog/creatoriq-pricing)
39. [CreatorIQ Pricing 2026: Costs and Value Explained | Flinque](https://www.flinque.com/creatoriq-pricing/)
40. [Passionfroot - The AI Agent for Creator-led GTM](https://www.passionfroot.me/)
41. [Passionfroot Raises \$15M Series A to Bring Its B2B Creator Marketplace to the US | 01](https://vocal.media/01/passionfroot-raises-15m-series-a-to-bring-its-b2b-creator-marketplace-to-the-us)
42. [Discover and Book the right Creators to Your Campaign | Passionfroot Help Center](https://help.passionfroot.me/en/articles/11563360-discover-and-book-the-right-creators-to-your-campaign)
43. [Passionfroot Review (2026): Sponsorship Management Pricing, Features & Honest Take | CreatorStackClub](https://www.creatorstackclub.com/software/passionfroot)
44. [Passionfroot Raises \$15M Series A to Expand B2B Creator Marketplace as AI Reshapes Marketing](https://theaiinsider.tech/2026/07/31/passionfroot-raises-15m-series-a-to-expand-b2b-creator-marketplace-as-ai-reshapes-marketing/)
45. [Search results: subscriber data | Paved Knowledge Base](https://www.paved.com/help/?q=subscriber+data)
46. [Paved's Pricing for Publishers | Paved Knowledge Base](https://www.paved.com/help/articles/8124389-paved-s-pricing-for-publishers)
47. [Beehiiv Ad Network Earnings 2026 | AI Stack Picks](https://aistackpicks.com/reviews/beehiiv-ad-network-earnings-2026/)
48. [Newsletter Ad Network - Monetize Your Newsletter - beehiiv](https://www.beehiiv.com/ad-network)
49. [Beehiiv doubles ad sales team as newsletter monetization heats up](https://www.emarketer.com/content/beehiiv-doubles-ad-sales-team-newsletter-monetization-heats-up)
50. [Source Profile Magellan AI | EMARKETER](https://www.emarketer.com/data-providers/magellan-ai/)
51. [Magellan AI](https://podnews.net/directory/company/magellan-ai)
52. [Build stronger plans with reach and demographic data | Magellan AI — Podcast advertising analytics](https://www.magellan.ai/news-insights/build-stronger-plans-with-reach-and-demographic-data)
53. [Magellan AI — Podcast Tool Review | Slice](https://tryslicemedia.com/podcast-tools/magellan-ai)
54. [Solutions — Podscribe](https://podscribe.com/solutions)
55. [Podcast & Audio Attribution That Proves ROI | Podscribe — Podscribe](https://podscribe.com/audio-attribution)
56. [Rephonic Podcast API: Listener Estimates, Transcripts & Contacts](https://rephonic.com/developers)
57. [What is Rephonic? Everything You Need to Know](https://rephonic.com/blog/what-is-rephonic/)
58. [We Compared Real Podcast Downloads to Rephonic’s Estimates – Here’s What We Found](https://www.thepodcasthost.com/business-of-podcasting/podcast-download-rephonics/)
59. [SparkToro V2 is Finally Here. It Can Do Incredible Things for SEO, Content Marketing, PR, and Ad Targeting. - SparkToro](https://sparktoro.com/blog/sparktoro-v2-is-finally-here-it-can-do-incredible-things-for-seo-content-marketing-pr-and-ad-targeting/)
60. [SparkToro Help Hub | SparkToro](https://sparktoro.com/support)
61. [How accurate is SparkToro's data, and how should I think about bias? | SparkToro Help Center](https://sparktoro.com/support/how-tool-works-accuracy-bias/)
62. [SparkToro Pricing](https://sparktoro.com/pricing)
63. [GWI Core: Research & methodology](<https://insight.gwi.com/hubfs/GWI%20Core%20-%20Research%20and%20methodology%202024%20(1).pdf>)
64. [Understanding GWI Core Plus | GWI Help Center](https://help.globalwebindex.com/en/articles/5880943-understanding-gwi-core-plus)
65. [Plans and Pricing | GWI](https://www.gwi.com/pricing)
66. [FAQ - Social Blade](https://socialblade.com/help/how-are-estimated-earnings-calculated)
67. [Personal Premium Subscription - Social Blade](https://socialblade.com/products/subscription/personal)
68. [vidIQ Review 2026: Pricing, Flaws, Verdict | 1of10](https://1of10.com/blog/vidiq-review/)
69. [VidIQ Pricing 2026: Every Plan, Real Costs & Is It Worth It? | OutlierKit Resources](https://outlierkit.com/resources/vidiq-pricing/)
70. [Cloudflare Workers RAG Architecture: Edge Vector Search | Markaicode](https://markaicode.com/architecture/cloudflare-workers-rag-architecture/)
71. [InfluMatch: Frontier-Quality KOL Search at 4B-Model Cost](https://arxiv.org/pdf/2607.05968)
72. [Workers AI Models and Pricing | zudo-cloudflare-wisdom](https://zudo-cloudflare-wisdom.takazudomodular.com/docs/ai/workers-ai-models-pricing/)
73. [Cloudflare Workers AI: Models, Pricing and Examples](https://mecanik.dev/en/posts/cloudflare-workers-ai-run-ai-models-at-the-edge-in-2026/)
74. [Instagram influencer marketing: what it costs in 2026](https://collabstr.com/blog/instagram-influencer-marketing)
75. [2026 Influencer Marketing Report: Trends and Statistics for ...](https://collabstr.com/2026-influencer-marketing-report)
76. [Influencer Price Calculator for Instagram, TikTok, YouTube](https://collabstr.com/influencer-price-calculator)
77. [How Much Do Newsletter Ads Cost? The Complete Breakdown | beehiiv Blog](https://www.beehiiv.com/blog/newsletter-sponsorship-cost)
78. [How much do newsletter ads cost? | Paved Knowledge Base](https://www.paved.com/help/articles/8120741-how-much-do-newsletter-ads-cost)
79. [Podcast Advertising Rates & Costs (2026) | Rephonic](https://rephonic.com/blog/podcast-ad-rates/)
80. [AI Content and Google Policy — Scaled Content Abuse](https://wiszniewsky.pl/en/blog/ai-content-google-policy-scaled-content-abuse)
81. [Google SpamBrain AI Update 2025: Best Practices for SEO Compliance](https://geneo.app/blog/google-spambrain-ai-update-2025-seo-compliance-best-practices/)
82. [Veritonic vs. Podscribe Comparison (2026) — Podscribe](https://podscribe.com/blog/veritonic-vs-podscribe)
83. [Track competitive spend across programmatic, RON, and host-read podcast ads | Magellan AI — Podcast advertising analytics](https://www.magellan.ai/news-insights/track-competitive-spend-across-programmatic-ron-and-host-read-podcast-ads)
84. [Meta Ad Library API: Access, Limits and Example Requests (2026) - Swipekit](https://swipekit.app/articles/meta-ad-library-api)
85. [Meta Ad Library API Limitations: 7 Walls in 2026](https://adlibrary.com/posts/meta-ad-library-api-limitations)
86. [Ad Transparency Data 2026: 7 Platform Libraries Compared](https://adlibrary.com/posts/ad-transparency-data-landscape)
87. [From Canada’s Anti-Spam Legislation (CASL) Guidance on Implied Consent | CRTC](https://crtc.gc.ca/eng/com500/guide.htm)
88. [CASL Consent Requirements for Small Businesses | 2727 Coworking](https://2727coworking.com/articles/casl-consent-email-sms-linkedin)
89. [FCA confirms CASL is constitutional, but limits business communications exemption | Insights | Torys LLP](https://www.torys.com/en/our-latest-thinking/publications/2020/06/fca-confirms-casl-is-constitutional-but-limits-business-communications-exemption)
90. [CASL: Canadian Anti-Spam Law Complete Guide | Mailflow Authority](https://mailflowauthority.com/email-deliverability/casl-compliance-guide)
91. [The Verifiable Credentials 2.0 family of specifications is now a W3C Recommendation | 2025 | News | W3C](https://www.w3.org/news/2025/the-verifiable-credentials-2-0-family-of-specifications-is-now-a-w3c-recommendation/)
92. [Verifiable Credentials Overview v1.0](https://www.w3.org/TR/vc-overview/)
93. [The State of Paid Newsletters 2026 | beehiiv Blog](https://www.beehiiv.com/blog/the-state-of-paid-newsletters-2026)
94. [Account dashboard overview | beehiiv Help](https://www.beehiiv.com/support/article/18794008882839)
95. [X API pay-per-usage pricing and credits - X](https://docs.x.com/x-api/getting-started/pricing)
96. [X (Twitter) API in 2026: Credit Pricing + 3 Cheaper Routes | SocialCrawl](https://www.socialcrawl.dev/blog/x-twitter-api-2026)
