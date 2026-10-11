---
id: diagnosing-the-feed-why-scrolling-works-why-x-feels-like-a-town-square
title: "Diagnosing the Feed: Why Scrolling Works, Why X Feels Like a Town Square, Where Content Turns Into Advertising, and How CANOPTICON Can Use All Three"
kind: "Research"
topic: "ADHD & attention"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/archive-3/diagnosing-the-feed.md"
---

# Diagnosing the Feed: Why Scrolling Works, Why X Feels Like a Town Square, Where Content Turns Into Advertising, and How CANOPTICON Can Use All Three

The best-supported reason people keep scrolling isn't a "dopamine slot machine." It's three things together: a feed with no stopping cue, habits that run faster than intention, and, in doomscrolling specifically, a threat-monitoring urge to reduce uncertainty. The most useful finding for you is that feeds optimized for engagement give people content they say they don't want. That gap between revealed and stated preference is the design opening for an idea-feed that is compelling, finite and receipted.

## TL;DR

- **Why people scroll:** The strongest causal evidence points to habit and self-control failures. Allcott, Gentzkow and Song estimate that 31% of social media use comes from self-control problems. Missing stopping cues and uncertainty-driven threat monitoring add to that. The slot-machine and dopamine story has real support for posting and likes, but it is weak and overstated as an explanation for passive scrolling.
- **Why X feels like a town square, and what it actually does:** X is a real-time status and attention market where news breaks and elites perform. But its engagement ranker amplifies anger and out-group hostility that users say they don't want. The audience has also fragmented: Threads has more daily mobile users than X, and Bluesky is shrinking. For an idea-dense creator, the durable "square" is now owned channels such as email, RSS and your own feed, plus cross-posting.
- **What to build:** A *finite daily "Collision Deck" with open loops*. That means a bounded set of receipted cards with a real ending, plus a public ledger of predictions and contradictions that resolve later. It borrows the scroll's pull (curiosity gaps, the urge to resume unfinished things, novelty) but ends on purpose. Sponsor slots are themselves receipted claims, and you measure success by stated value and return-by-choice, not time spent.

## Key Findings (the non-obvious ones first)

1. **People's engagement contradicts what they say they want, and that has been measured.** In a preregistered experiment run February 11–27, 2023, Smitha Milli, Micah Carroll, Anca Dragan and colleagues found that Twitter's engagement-based ranking, compared with reverse-chronological, amplified "emotionally charged, out-group hostile content that users say makes them feel worse about their political out-group." They also found that "users do not prefer the political tweets selected by the algorithm." Ranking by stated preference cut angry, partisan content but "may reinforce echo chambers." This is the most important sentence in this report for your feed design.
2. **Chronological feeds are not a cure-all.** In the Meta-partnered 2020 US election study (Guess et al., *Science* 381:398–404, 28 July 2023; 23,391 Facebook and 21,373 Instagram participants), switching to a chronological feed "substantially decreased the time they spent on the platforms." Participants on the algorithmic feed spent 73% more time than average US monthly users; those on the chronological feed spent 37% more. The chronological feed cut uncivil content on Facebook by 43%. But it raised content from untrustworthy sources by 68.8% on Facebook, and it did not measurably change polarization or political knowledge over three months. Ranking changes what you see and how long you stay far more than what you believe.
3. **The "slot machine" is real for posting, fuzzy for scrolling.** Lindström et al. (*Nature Communications*, 2021) analyzed more than a million posts from over 4,000 people and showed that posting behavior "conforms qualitatively and quantitatively to the principles of reward learning." People space their posts to maximize the rate of likes. A 2026 *Nature Communications* follow-up on 2,696 Twitter/X users, with a preregistered replication, found posting is a *hybrid* of reinforcement learning and habit. Younger users and women were more reward-driven; older users and men were more habitual. Neither paper shows that passively scrolling a feed works like a variable-ratio slot schedule. That extension is mostly analogy.
4. **Nobody has run the key experiment on infinite scroll.** I found no randomized trial that compares infinite scroll with pagination on time spent or wellbeing, and one review of the evidence explicitly reports failing to find one. Even who invented it is disputed: Microsoft filed a patent on 14 February 2006 (Hugh Williams, Julie Farago, Nick Craswell), while Aza Raskin also claims it. The mechanism, a removed decision point, is well documented. Its effect size is not.
5. **The famous Zeigarnik effect mostly doesn't replicate, but its sibling does.** Ghibellini and Meier's 2025 meta-analysis found "no memory advantage for unfinished tasks but found a general tendency to resume tasks" (the Ovsiankina effect). People don't *remember* open loops better, but they do feel pulled to *close* them. That is exactly the mechanic a prediction card that resolves later can use honestly.
6. **Doomscrolling is reliably correlated with distress, but the causal case is thin.** A September 2026 meta-analysis in *Frontiers in Psychology* (44 studies) found doomscrolling associated with anxiety (r = 0.35), depression (r = 0.35), psychological distress (r = 0.51) and lower wellbeing (r = −0.29). The authors rate certainty "very low" for every outcome, and "the evidence does not establish causality."
7. **Most people can't tell native ads from content.** In Wojdynski and Evans's experiments, only 7% of viewers (17 of 242) identified a sponsored article as advertising. Labels saying "advertising" or "sponsored" made recognition seven times more likely than labels like "presented by." When readers *did* recognize a native ad, their opinion of the publisher dropped. That is the core tension in "content as advertisement."
8. **Regulators have started treating infinite scroll as a legal design problem.** On 6 February 2026, the European Commission preliminarily found TikTok in breach of the Digital Services Act over "addictive design." It named infinite scroll, autoplay, push notifications and the recommender system, and suggested "disabling key addictive features such as 'infinite scroll' over time." TikTok called the findings "categorically false and entirely meritless." A European Parliament Think Tank brief adds that in March 2026, a US jury found Meta and YouTube liable for addictive design.

## Details

### 1. Doomscrolling and infinite scroll: what the evidence actually says

**Strong evidence**

- **Habit and self-control.** Allcott, Gentzkow and Song's "Digital Addiction" (*American Economic Review*, 2022) is the best causal study. It is a randomized experiment in which "temporary incentives to reduce social media use have persistent effects, suggesting social media are habit forming," and "allowing people to set limits on their future screen time substantially reduces use." Their model attributes 31% of use (about 48 minutes a day) to self-control problems. The effect is very uneven: for 22% of participants the excess was under 10 minutes a day. People are also "inattentive to habit formation," meaning they underestimate how much today's scrolling shapes tomorrow's. The authors are unpaid members of Meta's 2020 election research project, and Gentzkow has consulted for Facebook in litigation. That is worth noting, though it cuts against any pro-platform bias in this result.
- **Reward learning in posting.** Covered in Key Finding 3 above. It is robust across platforms and was replicated in 2026.
- **Engagement ranking amplifies emotional and hostile content.** Milli et al. (*PNAS Nexus*, 2025) and Huszár et al. (*PNAS*, 2022) both support this. Huszár's team used Twitter's own long-running holdout group, which had seen a chronological timeline since 2016. They found "in six out of seven countries studied, the mainstream political right enjoys higher algorithmic amplification than the mainstream political left," and some parties were amplified by more than 200%.

**Moderate evidence (correlational, but consistent)**

- **Threat monitoring and intolerance of uncertainty.** Across several cross-sectional studies, people who find uncertainty intolerable doomscroll more. In "Beyond the Scroll" (ScienceDirect, 2024; 443 participants, 79.9% female, mean age 23.49), intolerance of uncertainty was "positively associated with doomscrolling (β = 0.29, p < .001)," and Kaya and Griffiths (*Behaviour & Information Technology* 44(10), 2025; N = 432) found intolerance of uncertainty had a direct effect on doomscrolling of β = 0.315 and an indirect effect on wellbeing through doomscrolling of β = −0.081. The best interpretation is that under threat, negative news *feels* like useful surveillance, and the scroll becomes a checking ritual that briefly relieves anxiety and then brings it back. This is the most useful frame for your "diagnosis": **doomscrolling is information-seeking that never reaches closure.**
- **Why scrolling stops.** Rixen et al.'s field study (N = 46; 6,605 app sessions) found that "most reasons to break SM sessions were not related to the app but the user's general context." People leave because the real world interrupts, not because the feed lets them go. The authors describe an "inner (intra-session) loop" and an "outer (habitual) loop," a distinction you can design around.

**Weak or overstated**

- **"Dopamine slot machine."** Dopamine does signal reward prediction and anticipation. But most viral "your brain on TikTok" content (neurotransmitter urine panels, "dopamine detox") is pop neuroscience with no data behind it. The honest version: variable reward is one plausible ingredient, well shown for posting and likes, and the passive-scroll analogy is intuitive but largely untested.
- **Infinite scroll causes addiction or shorter attention spans.** There is no RCT for either. Raskin's widely repeated "200,000 human lifetimes wasted daily" figure is a back-of-envelope estimate, and secondary sources misquote it as "200,000 hours." Treat it as rhetoric, not data.
- **The "bottomless soup bowl" analogy for stopping cues** comes from Brian Wansink's lab; Wansink has had 18 papers retracted (Retraction Watch database, May 2022), and Cornell found in September 2018 that he "committed academic misconduct… including misreporting of research data," after which he resigned. The *idea* of stopping cues is sound, but don't lean on that study.

**What actually reduces compulsive scrolling (with effect sizes)**

| Intervention | Study | Effect | Caveat |
|---|---|---|---|
| Friction before opening an app (breathing pause) | Grüning, Riedel & Lorenz-Spreen, *PNAS* 2023 ("one sec") | 36% of opening attempts abandoned; attempts down 37% by week 6; actual openings down 57% after six weeks | ~280 opt-in users, no field control group; co-author is the app's founder (disclosed) |
| Newsfeed "diets" | Purohit et al., CHI 2023 (N = 138) | Time on Facebook −64% (strict), −39% (self-regulated) | Only the self-regulated diet preserved sense of control |
| Removing the newsfeed / goal reminders | Lyngs et al., CHI 2020 (N = 58) | Both kept users on task; reminders cut daily time; newsfeed removal shortened visits | Reminders "often annoying"; newsfeed removal triggered FOMO |
| Commitment devices (self-set limits) | Allcott, Gentzkow & Song, AER 2022 | "Substantially reduces use" | Effects concentrated among a subset of users |
| In-feed stopping prompts after 15 min | CHI 2025 "Scrolling in the Deep" (316 participants); 2026 preprint "Can't Stop" (N = 104) | Users took an average of 3 min 31 s to stop after an intervention; context mattered little; explicit pop-ups beat gradual friction for low-self-control users | Preprint not yet peer-reviewed |
| "You're All Caught Up" marker | Instagram, 2 July 2018 | Appears "when you've seen every post from the last two days" | Instagram has **never published usage data** |

The pattern: **friction and finite containers work; polite reminders mostly annoy.** The biggest effects come from changing the *container* (no feed, a bounded feed, a delay before entry), not from asking people to behave better inside an infinite one. No peer-reviewed study I found directly tests a daily digest. That is a gap, and an opportunity for you to publish your own data.

### 2. Why X (and its peers) feels like a town square, and where that metaphor breaks

**What people get from it.** Twitter/X combines four things no other feed did as well: (1) real-time news-breaking, (2) unusually concentrated journalists, politicians and experts, (3) a public status market where replies and quote-posts let anyone perform in front of elites, and (4) ambient surveillance of the zeitgeist, knowing "what everyone is talking about." Alice Marwick and danah boyd's concept of *context collapse* explains both the thrill and the danger: every post plays to every audience at once. That is why it feels like a square (everyone is here), and also why it feels like a pillory (anyone can arrive). Quote-posts are the key primitive. They turn someone else's content into your stage, which is also why they drive pile-ons.

**Where the metaphor fails.** A square is neutral ground; a ranked feed isn't. The evidence (Milli, Huszár, Guess) shows the ranker decides who gets heard. It rewards emotional, out-group-hostile content and treats time spent as proof of value, even when users' stated preferences disagree. McLuhan would say the "square" is the *figure*, and the *ground* is an engagement-optimizing recommender that turns conversation into ad inventory.

**The landscape now (verified September 2026)**

- **X is still big but shrinking on mobile.** According to Similarweb data reported by TechCrunch (August 2026), X's mobile daily active users fell 7% year over year to 123.7 million in July 2026. The app had about 302 million monthly users in June 2026, while web visits *rose* 5.3% to 4.7 billion.
- **Threads now leads X on daily mobile use:** 147 million daily active users in July 2026, up 21.3% year over year. James Ball's analysis had already put Threads ahead in January 2026 (141 million versus X's 125 million on mobile).
- **Bluesky is small and shrinking, but loyal.** Mobile monthly users were 10.4 million in June 2026, down 27.2% year over year and about 52% below the late-2024 peak. Daily users are about 3 million. Its stickiness (daily ÷ monthly users) is about 29%, similar to Threads, and it reports about 46 million registered accounts.
- **News has become platform-mediated.** The Reuters Institute *Digital News Report 2026* found that 54% of people now get online news through social and video networks, versus 51% through news organizations' own sites and apps. That is the first time platform-mediated news access has come out ahead. Weekly use of AI chatbots for news rose from 7% to 10%, and only 3% rely solely on creators. In the 2025 report, X news use in the US had *risen* to 23%, while Threads, Bluesky and Mastodon each reached 2% or less of people for news globally. Publishers told the Institute (January 2026) they plan to put fewer resources into X (net −52), Facebook (−23) and Bluesky (−11), and more into LinkedIn (+40).
- **What this means for idea-dense audiences.** The idea audience has scattered. Depending on niche, it sits on Threads for scale, Bluesky for a committed minority, X for politics, tech and finance, LinkedIn for professionals, and YouTube, TikTok and Instagram for explainers. Email and RSS are the only channels you actually own. **Don't build for one square; build a publishing engine that turns one set of atoms into many native formats and routes everyone back to a feed and inbox you control.**

### 3. Content as advertisement, advertisement as content

**McLuhan's position, stated accurately.** The widely quoted lines are "Ads are the cave art of the twentieth century" and "Advertising is the greatest art form of the twentieth century." The latter is attributed to *Advertising Age*, 3 September 1976. Another is "The cave art of Madison Avenue has been by far the most innovative and educative art form of the twentieth century." I could not verify the exact wording "most fascinating and effective," so quote the attested versions. The deeper McLuhan point for you is "All advertising advertises advertising." In *Understanding Media* (1964) he treats ads as a *ground* that trains perception itself. In a feed, that becomes literal: the ranker is an ad system, and every post competes on the same attention auction as the ads beside it. **Recommendation is advertising for content.**

**How feeds blur the line.**

- Native ads copy the look of posts.
- Creators fold sponsorships into their voice.
- Brand accounts post "organic" content that is really marketing.
- Every creator's content is also an ad for the creator.

Wojdynski and Evans found that only 7% (study 1) and 17% (study 2) of viewers recognized sponsored articles as ads. A disclosure placed mid-article was seen by 90% of viewers, versus 40% for one at the top. Amazeen and Wojdynski (N = 800) found "fewer than 1 in 10" recognized native ads, and recognition lowered opinions of the publisher. Detailed disclosures that explain *who paid and why* have pushed recognition as high as 75% (Krouwer et al.).

**What makes an ad work in a feed versus content.** Content earns attention by paying off curiosity. An ad borrows attention and has to give something back to be tolerated. The ads people welcome share four traits:

- They are **contextual**, matching what the reader is already doing.
- They are **singular**, one per unit.
- They are **clearly labeled**.
- They are **useful on their own terms.**

Developer networks are proof:

- **EthicalAds** serves "over 35 million developer impressions each month." It uses contextual machine-learning targeting with no tracking, pays publishers "around $2.50 per 1,000 pageviews," has a $1,000 minimum buy, uses no conversion pixels, and is on the Acceptable Ads list.
- **Carbon** (BuySellAds, founded 2010) is invite-only and exclusive, shows "only one ad per page in a non-intrusive format," and pays publishers a "typical range" of $1.20–$2.30 CPM.

Newsletter sponsorships sell attention that is far scarcer and more deliberate, so they command much higher prices:

- Inbox Collective says "most newsletters tend to command a $20-$40 CPM."
- Newsletter Operator puts "the industry standard" at $40–$50.
- beehiiv cites $10–$75.

Paved suggests a starting flat fee of "2.5–5% of your subscriber count," with secondary slots at about 50–65% of the primary rate. Automated networks pay much less; beehiiv's Ad Network uses a "$5 CPM" per unique open as its example. Most of these figures come from vendors, so treat them as ranges, not facts. Morning Brew's often-cited "$50,000+" placements are unverified, and Morning Brew publishes no rate card. On acceptance, the best available data is old: Nielsen (2013) found 56% trust consented email versus 42% for banner ads.

**Attention versus intent.** A feed produces *attention*, and search produces *intent*. Newsletters sit in between: the reader chose this sender, today. That is why a sponsored slot in a trusted, finite digest is worth roughly 10–20× a developer display CPM. For your ad network, the lesson is that **the price of an impression tracks how voluntary and bounded the attention is**, not how much of it there is. A "cost per attention" or "cost per verified read" model (charging only for a card that is fully read, saved or clicked through) fits this better than raw impressions.

**The rules (Canada first, since you're in Ontario).**

- **Competition Act.** The Competition Bureau says its deceptive-marketing rules apply "to anyone who is promoting a product, service, or any business interest." You must disclose any "material connection" that could affect how people judge your independence. Disclosures must be visible "on all devices without having to click or tap a button," must not be buried in hashtags or bios, and must be repeated on each platform.
- **Private access.** Since 20 June 2025 (Bill C-59), private parties can seek leave to challenge deceptive marketing before the Competition Tribunal. A competitor could now take you there, not just the Bureau.
- **Ad Standards.** The industry body updated its Influencer Marketing Disclosure Guidelines in October 2025 to cover AI, affiliate marketing and child audiences.
- **US.** If you reach US audiences, the FTC's Endorsement Guides, revised in 2023, set a similar "clear and conspicuous" standard.
- **Practical rule for CANOPTICON.** Any card that promotes your own projects (the ad network, the gig app) *is* a material connection. Label it, for example "From Chris's other project," right on the card.

### 4. Pulling people in without manipulating them

**Mechanics and how solid they are**

- **Curiosity gaps.** Loewenstein's 1994 information-gap theory holds that curiosity is "a form of cognitively induced deprivation that arises from the perception of a gap in knowledge or understanding." It is solid and well cited. The ethical test: *does the payoff close the gap with something true?* Clickbait opens gaps it never closes.
- **Open loops.** The Zeigarnik memory claim is mostly dead (Ghibellini & Meier, 2025). The Ovsiankina resumption tendency is real; a Glasp summary of the meta-analysis reports resumption of 66.79% of interrupted tasks across 20 studies against a 50% neutral baseline, versus a recall ratio of just 0.99 across 37 post-Zeigarnik studies. Use serial structure to invite people back to *resolve* something, not to nag them.
- **Variable reward.** Supported for social feedback. For an idea-feed, the honest version is *variable novelty inside a fixed container*: every deck ends, but you never know which card will change your mind.
- **Social proof and identity.** Powerful, and the easiest to corrupt. Showing "412 people saved this" is fine. Streaks and loss-framed "don't break your chain" prompts cross into dark-pattern territory.
- **Stopping cues.** These are the missing ingredient in most feeds. Make the ending a *reward*: a satisfying close, a single thought to carry, a clear "done."

**Respectful attention versus dark patterns.** Monge Roffarello and De Russis classify infinite scroll, autoplay, pull-to-refresh and similar features as "attention-capture dark patterns" that "exploit users' psychological vulnerabilities to maximize time spent and daily visits." The dividing line is simple: *would the user endorse this mechanic if they could see it?* The Milli study effectively operationalizes that line, because stated preference is the endorsement test.

**Formats that have made idea-density compelling**

- **Serialized newsletters and bounded digests.** They end, they arrive on a schedule, and the sender has earned the reader's choice.
- **Resurfacing tools (Readwise-style daily review).** Spaced, small and finite, working on your own highlights.
- **Curated channels (Are.na).** Slow, non-ranked and collage-like; low engagement but high regard.
- **Threads, carousels and "one weird fact" explainers.** A hook up front, a clear payoff, and a natural last slide. The carousel is a finite feed in miniature.
- **Quote accounts.** High virality, low trust, because receipts are usually missing. That is precisely CANOPTICON's opening: *quote accounts with receipts.*

## Creative Proposal: Turning the Scroll Toward Insight

### Options

**Option A — The Finite Scroll (daily bounded deck).** Each day, publish 9–15 cards: a hook card, collisions, receipts and a real **End card** ("That's today. One thing to carry: …"). No infinite load; yesterday's deck is an archive, not a feed. It is simple and directly supported by the finite-container evidence, but on its own it lacks a reason to come back beyond habit.

**Option B — Open Loops Ledger.** A public ledger of *unresolved* items: prediction cards with resolution dates, contradiction pairs awaiting evidence, and questions the Collision Desk couldn't answer. Each loop has a status (open, resolved, killed) and closes on a set date. Its pull is Ovsiankina-style ("come back to see if I was right"), and it builds credibility over time through calibration. On its own it is slow to start.

**Option C — Receipt Exchange (the ad network as content).** An independent ad network where the *ad unit is a receipted claim card*. The sponsor gets one card per deck, labeled "Sponsored." It must make a single verifiable claim with a source link, and it is priced per *verified read* (card fully viewed or opened) rather than per impression. It feeds your ad-network venture directly, but it needs an audience first.

**Option D — The Argument Square.** A town-square-style feed where the only allowed post is a claim with a receipt, and the only reply is a counter-claim with a receipt. It is ranked by stated preference ("did this change or sharpen your view?") and never by engagement. It is the most ambitious and the most exposed to moderation cost and cold-start problems.

### ★ Recommended: A + B combined, the "Daily Collision Deck with Open Loops," with C as a single slot from day one

**Why:** The evidence says finite containers and friction are what actually change behavior. Open loops that resolve are an honest, replicated pull (Ovsiankina), and stated preference beats engagement as a quality signal. A daily deck with an ending, plus a ledger that makes readers want to come back to see what resolved, gives you scroll-grade pull without infinite scroll. One labeled sponsor card per deck starts testing the Receipt Exchange ad model on your own inventory. Your first sponsor can be your own projects, clearly disclosed, which makes the content-as-ad thesis literal and legal.

**Deck anatomy (12 cards, about 4 minutes):**

1. **Hook:** the day's strongest collision.
2–4. **Collision cards:** two atoms from distant domains plus a question (the curiosity gap).
5. **Receipt card:** the answer to card 1's gap, with a verbatim quote and source.
6. **Figure/ground pair.**
7. **Kill-log card:** a belief the system killed today, with its receipt.
8. **Sponsor card:** one receipted claim, labeled.
9. **Contradiction pair.**
10. **Prediction card:** new or resolving.
11. **Loop update:** "3 loops closed this week."
12. **End card:** one sentence to carry, and "You're done. Next deck at 7:00."

### Minimum viable version on a Cloudflare stack (solo developer plus AI agents)

- **D1:** tables `atoms` (claim, quote, source_url, doi, retrieved_at, hash), `cards` (type, atom_ids, copy, status), `decks` (date, card_ids), `loops` (card_id, opened_at, resolve_by, outcome, evidence_atom_id), `sponsors` (claim, receipt_url, disclosure_text, cap), and `events` (reader_hash, card_id, action: viewed_full / saved / changed_mind / worth_it).
- **Vectorize:** embed atoms. Choose collision pairs from a *mid-distance band*, far enough apart to surprise but sharing an entity or mechanism so they connect. Store the pairing rationale as its own atom.
- **Cron Triggers:** at 05:00 build the deck; hourly, check for loops past `resolve_by` and queue them for resolution.
- **Queues:** rendering (card to PNG in R2 through a Worker using Satori/resvg), cross-posting jobs (Threads, Bluesky, X, LinkedIn), and loop-resolution research jobs for your agents.
- **R2:** rendered card images, deck archives and source snapshots, so receipts survive link rot.
- **Durable Objects:** one per reader session. It tracks position in today's deck, enforces the end-state (no "load more" after the End card), and records whether they finished.
- **Workers:** the feed page (server-rendered, 12 cards, paginated swipe), RSS/JSON feed, and email handoff to a transactional sender such as Postmark or Resend (Cloudflare doesn't send bulk email natively).
- **Build order (four weekends):** (1) D1 schema, atom ingest and a manual deck; (2) Vectorize collisions and card rendering; (3) DO session, End card and events; (4) loops ledger, Cron resolution, and the sponsor slot with disclosure baked into the template.

### How to measure without optimizing for engagement

- **North star: "worth it" rate.** A one-tap question on the End card: "Was today worth 4 minutes?" This is Milli's stated-preference signal made operational.
- **"Changed my mind" taps per deck.** Your real product is mind-changes.
- **Completion as success, then leaving.** Finishing the deck and leaving counts as a win. Track *re-open within an hour* as a possible compulsion signal, not a win.
- **Return-by-choice.** Measure 7-day return *without* push notifications. Never send "you're missing out" prompts.
- **Loop calibration.** Brier score on prediction cards, published openly.
- **Sponsor health.** Verified-read rate on the sponsor card relative to the deck average. If it falls far below, the ad is resented; if it matches, it is welcome.
- **Never target:** time on site, session count or scroll depth.

### Example cards you could publish this week

- **Collision card.** "A chronological feed cut Facebook time spent substantially and uncivil content by 43%. It also raised untrustworthy sources by 68.8% (Guess et al., *Science* 2023). Twitter's engagement ranker amplified anger users said they didn't want (Milli et al., *PNAS Nexus* 2025). **Which is worse: a feed that picks badly, or a feed that doesn't pick?**"
- **Kill-log card.** "KILLED: 'Unfinished tasks stick in memory' (Zeigarnik, 1927). A 2025 meta-analysis found 'no memory advantage for unfinished tasks.' SURVIVED: the urge to *resume* them (Ovsiankina). Receipt: Ghibellini & Meier, *Humanities and Social Sciences Communications* 12:962."
- **Claim + receipt card.** "Only 17 of 242 people (7%) recognized a sponsored article as an ad. Label it 'Sponsored' and recognition rises about 7×. Receipt: Wojdynski & Evans, *Journal of Advertising* 2016."
- **Quote-with-receipt card.** "'Ads are the cave art of the twentieth century.' — Marshall McLuhan. Receipt: widely attributed; the variant 'Advertising is the greatest art form of the twentieth century' is cited to *Advertising Age*, 3 Sept 1976. Status: attributed, primary text not yet verified." Publishing the verification status *is* the brand.
- **Figure/ground card.** "Figure: the post you're reading. Ground: the stopping cue that isn't there. Infinite scroll's inventorship is disputed, and no randomized trial has measured what removing the page break did."
- **Prediction card (your call, clearly labeled).** "By 29 Sept 2027, the European Commission will issue a final DSA decision requiring TikTok to change infinite scroll for EU users. Chris's confidence: 55%. Resolves: 2027-09-29."
- **Sponsor card (self-promotion, disclosed).** "SPONSORED — from Chris's ad network project: Carbon pays publishers $1.20–$2.30 CPM for one ad per page. Newsletters command $20–$50. The price of attention tracks how voluntary it is. [link]"

## Caveats, Open Questions and Risks

- **Evidence quality.** Doomscrolling research is mostly cross-sectional and geographically concentrated; the 2026 meta-analysis rates certainty "very low." Friction studies are small, short (about six weeks) and sometimes run by the app's makers. No study directly tests daily digests. Platform user numbers are third-party estimates from Similarweb, not company disclosures. Newsletter CPMs come mostly from vendors.
- **Contested findings.** Bagchi, Menczer and colleagues (Science eLetter, September 2024) argue that Guess et al. "did not account for a series of temporary emergency changes to Facebook's news feed algorithm" — reportedly 63 "break glass" measures introduced around the November 2020 election — which complicates reading the misinformation result; Guess et al. replied that the experiment remains internally valid. The EU's TikTok findings are preliminary and disputed. The "self-control causes 31%" figure is model-based and varies widely between individuals.
- **Ethical line.** Your own open loops can become nagging. Keep resolution dates honest, never manufacture suspense, and never push-notify an unresolved loop. If "re-open within an hour" climbs, treat it as a bug.
- **Disclosure.** Every self-promotional or sponsored card needs on-card labeling ("Sponsored," or "From Chris's project"), not a bio link. This is required under the Competition Act and, since June 2025, can be challenged privately.
- **Copyright of quotes.** Canada's fair dealing (Copyright Act s. 29–29.2) covers research, criticism, review and news reporting, the latter three with attribution. Short verbatim quotes with a named source and a link fit best. Screenshots of paywalled pages, long excerpts and images of figures are riskier. Store receipts as a text excerpt plus a link, not republished full text.
- **Open questions worth testing yourself:** Does a finite deck keep readers better than an infinite CANOPTICON feed over 90 days? Do receipted sponsor cards get verified-read rates close to editorial cards? Does collision distance, measured in Vectorize, predict "changed my mind" taps? Publishing those results would itself be a contribution: the first open data on finite idea-feeds.
