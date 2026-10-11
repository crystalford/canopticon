---
id: the-state-of-algorithmic-quality-ai-content-assessment-and-discovery-a
title: "The State of Algorithmic Quality, AI Content Assessment, and Discovery Alternatives (June 2026)"
kind: "Research"
topic: "Attention & feeds"
date: "2026-06-01"
shelf: ""
listed_in_library: true
source_file: "uploads/archive-5/algorithmic-quality-ai-content-assessment.md"
---

# The State of Algorithmic Quality, AI Content Assessment, and Discovery Alternatives (June 2026)

## TL;DR
- Major platforms have shifted decisively from raw watch time toward **satisfaction and originality signals** — YouTube weights surveys/session contribution, Instagram weights DM "sends" and penalizes aggregators, TikTok weights saves/shares/completion — and there is now **hard primary-source evidence that AI content-understanding models (including Gemini and multimodal models) are running inside production recommendation systems**, not just moderation or search.
- The clearest white space is the **"anti-formula" / loyalty economy**: Substack rebuilt its Notes algorithm to optimize for subscriptions (not time-spent), Flipboard launched Surf for human-curated cross-platform discovery, and the consensus among strategists is that gaming the algorithm is a depreciating asset while audience ownership (email, memberships, community) is the durable one.
- Long-form, detail-heavy and forensic/investigative content performs well *where audiences self-select* (YouTube long-form, podcasts, subscription true-crime products), and the gig-creator niche (rideshare/delivery) is a real, monetized vertical led by The Rideshare Guy and tools like Gridwise — but it monetizes through audience trust and software, not viral algorithmic reach.

## Key Findings

### 1. How platforms measure quality beyond engagement today
**YouTube** has publicly reframed its system around "satisfaction" rather than watch time. Todd Beaupré, YouTube's Director of Growth and Discovery, said in 2025 the platform weights watch time by satisfaction signals like surveys, returns, and session continuation, not just raw minutes. YouTube uses post-watch satisfaction surveys, "not interested"/"don't recommend" signals, and "session contribution" (whether your video extends the broader viewing session). It runs separate ranking models for Home, Suggested, Search, Shorts, and Notifications, and in 2025 decoupled the Shorts engine from long-form.

**TikTok** weights completion rate, rewatches/loops, and especially saves and shares above likes; comment *quality* (length/substance) now matters more than comment count. TikTok's own documentation frames recommendation around user interactions, content information (captions, sounds, hashtags, on-screen text), and user information. Per multiple 2026 algorithm guides, the completion-rate threshold for virality "has jumped from 50% to 70%" (up from ~50% in 2024), with watch time/completion cited as roughly 40–50% of TikTok's ranking weight — though these remain marketing-blog estimates, not TikTok primary documentation.

**Instagram** abandoned the singular "algorithm" framing. In a Jan. 22, 2025 video series (reported by Social Media Today), Adam Mosseri said: "The top three signals that matter most for ranking are watch time, likes and sends. So when looking at your insights, pay close attention to average watch time, likes per reach, and sends per reach" — adding that "likes are slightly more important for connected content, and sends are slightly more important for unconnected content." In December 2025 Instagram launched "Your Algorithm" (user topic controls) and intensified an **originality / aggregator penalty** — reposted content is labeled and downranked, with the original creator's version surfaced instead.

A consistent cross-platform theme: **originality and authenticity are now explicit ranking and monetization criteria**, and all platforms use metadata/transcripts/captions plus on-screen text as semantic signals.

### 2. AI-assisted quality evaluation in algorithms — concrete implementations
This is the area with the most genuinely new, citable evidence — and it confirms platforms are moving from metadata signals toward true content understanding:

- **YouTube (Google) is using Gemini to assess nuanced video content as part of recommendations.** A peer-reviewed RecSys 2025 paper by Google/YouTube engineers, "LLM-Powered Nuanced Video Attribute Annotation for Enhanced Recommendations" (arXiv 2510.06657), deploys LLMs to achieve "nuanced content understanding (e.g., discerning content 'vibe') at scale within an industrial short-form video recommendation system." Gemini 2.5 Pro scored an F1 of 81.33% on a nuanced content attribute versus 63.21% for crowd-sourced human raters, and online A/B tests yielded measurable lifts (+0.49% user participation in content creation, +0.21% satisfied consumption).
- **YouTube's "Large Recommender Models" (LRM)** adapt Gemini for recommendations using "semantic IDs" to tokenize videos; per a YouTube engineer's conference talk ("Teaching Gemini to Speak YouTube," Devansh Tandon) it is in production for retrieval and being tested for ranking. (Documented via a conference talk, not a peer-reviewed paper — flagged accordingly.)
- **Google's TIGER ("Recommender Systems with Generative Retrieval," NeurIPS 2023, arXiv 2305.05065)** established the semantic-ID generative-retrieval approach that derives item tokens from content embeddings.
- **Meta** has deployed a video-understanding model in Reels' recommendation system. Meta's "Learning from videos to understand the world" (ai.meta.com) states: "Within six months of developing a state-of-the-art, self-supervised framework for video understanding, we've built and deployed an AI model in Instagram Reels' recommendation system." A June 2023 Meta AI engineering blog further confirms multimodal content-understanding models (FLAVA, Omnivore, MViT, XLM-R) "understand semantic meanings of content holistically across different modalities" and feed Reels/feed recommendations — e.g., distinguishing road biking from mountain biking when the caption doesn't say — and Meta credited AI advances with a 15% increase in Reels watch time. Its 2025 "Generative Ads Model (GEM)" is LLM-scale but currently ads-focused, with multimodal organic ranking described as future work.
- **TikTok is the gap**: the documented ByteDance recommender (Monolith, RecSys 2022, arXiv 2209.07663) is about real-time ID embeddings, not multimodal content understanding; TikTok's documented multimodal embedding work (arXiv 2507.01066) is for content *moderation*. Claims that TikTok "reads" video via multimodal models in ranking appear mainly in marketing blogs, not primary sources.
- **Academic LLM-as-quality-judge** is now established: a 2025 Nature Scientific Reports study (s41598-025-94208-6) used LLMs to score the reliability/quality of medical YouTube videos from transcripts and proposed re-ranking search results by LLM quality score.

### 3. Emerging creator platforms and discovery alternatives
- **Substack** explicitly rebuilt its Notes recommendation system to optimize for subscriptions and paid conversions rather than time-spent. Head of ML/Data Mike Cohen explained the new architecture uses **sequential modeling** (rebuilt from static "two-tower" models), and the system amplifies community behaviors — restacks, replies, and explicit "go subscribe to this writer" recommendations. Per Substack's official "Demystifying the feed" post: "In the past three months, the Substack app has driven nearly half a million paid subscriptions and more than 32 million free subscriptions to writers and creators. Most of these connections come from the feed." Co-founder Hamish McKenzie frames this against ad-driven "endless scroll" models.
- **Flipboard's Surf** (launched 2025) is a fediverse-powered "social browser" / feed reader that unifies Bluesky, Mastodon, RSS, podcasts, and YouTube into **human-curated** feeds rather than algorithmic timelines, explicitly positioned for users "exhausted by algorithmic timelines."
- **Subscription/ownership-first stack**: Patreon, Ghost, Mighty Networks, Beehiiv, Kajabi, Circle, Gumroad, Ko-fi. The recurring competitive angle is **audience ownership** — these platforms tell creators that growth platforms "rent" attention while owned platforms (email, memberships) survive algorithm changes.
- **"Anti-algorithm" / human curation** is a documented countermovement ("algorithm fatigue," "peak algorithm"), with curated newsletters (Dense Discovery, etc.) and platforms like NTS and Criterion Channel cited as healthy human/algorithm hybrids.

### 4. Creator strategy: gaming the algorithm vs. loyalty, and the "formula trap"
- The **leaked MrBeast memo** ("How to Succeed in MrBeast Production") is the canonical formula playbook: obsessive second-by-second retention analysis, CTR/thumbnail/title focus, "crazy progression," and escalating-stakes formats. But MrBeast's own teaching warns against reusing formats back-to-back to prevent boredom.
- The notable **counter-trend**: MrBeast in 2025–2026 publicly pivoted toward emotional storytelling and narrative, saying audiences have become "numb" to spectacle. His former retention director publicly criticized retention-maximizing algorithms as "poisonous."
- A real **YouTube strategist economy** has formed (Paddy Galloway, ex-MrBeast staff like Mario Joos and Gabriel Leblanc-Picard), charging from ~$250 calls to thousands; their consensus is "the algorithm will reward what people want to watch" — i.e., knowledge of platform mechanics, not tricks.
- **AI ideation tools** are emerging: a former MrBeast strategist (Neo, of "Creaky") launched **Palo**, an AI tool for creator ideation/analytics that tries to *avoid* formulaic sameness while using LLMs to model a creator's taste.
- Consensus on the formula trap: formulas raise the floor but commoditize; durable advantage is audience loyalty, community, and "wow factor" no one else can replicate.

### 5. Forensic / investigative and long-form content performance
- **Long-form is thriving** where audiences self-select: video essays (ContraPoints, Folding Ideas, hbomberguy), commentary creators (Drew Gooden, Kurtis Conner), and documentary-style content. YouTube long-form (15–60 min) gets better algorithmic visibility and monetization through multiple ad placements.
- **True crime / forensic** is a mature, well-monetized niche: documentary-style true crime earns 30–50% higher CPMs than casual commentary, and the genre is shifting from sensationalism toward "forensic-first," ethical, advocacy-oriented content (MrBallen, JCS – Criminal Psychology, Coffeehouse Crime). True-crime podcasts hit 80–85% completion rates.
- **Subscription-first investigative products** are launching: USA TODAY's WITNESS ($4.99/mo) and the Daily Mail's Crime Desk (members-only podcast/documentary hub, £3.99/mo). The strategy: paywall niche depth rather than chase algorithmic reach.
- Key insight: detail-heavy content underperforms in pure algorithmic swipe feeds but **overperforms in search, subscriptions, and self-selected long-form** — favoring YouTube long-form, podcasts, and newsletter/subscription platforms over Reels/Shorts/FYP.

### 6. Gig-creator space
- A real creator vertical exists around gig work. **The Rideshare Guy (Harry Campbell)** built a blog + YouTube channel + book serving 200,000+ monthly visitors, monetizing via affiliates, ads, and products. Other channels: Gig Nation, The Rideshare Professor, Chuck Driver, The Passive Driver.
- **Gridwise** is the standout tool: a mileage/earnings tracker for rideshare/delivery drivers that *also* runs a content arm (blog, YouTube, podcast) and offers an event/airport/weather data layer plus a perks marketplace.
- Monetization is through trust, software, affiliates, and "multi-apping" advice — not viral algorithmic content. The addressable base is large: MBO Partners' 15th annual State of Independence report found "the total number of independents in the U.S. saw a slight increase, from 72.7 million in 2024 to 72.9 million in 2025" (37.4M occasional, 27.6M full-time).

## Details

**The originality arms race.** The single biggest cross-platform shift in 2025 is the elevation of originality from a soft value to a hard, enforced signal. YouTube's July 15, 2025 policy renamed "repetitious content" to "inauthentic content," explicitly demonetizing mass-produced/templated videos at the channel level — a direct response to "AI slop." On Instagram, per Net Influencer (Feb. 2026, cited in downstream creator guides), "aggregator accounts saw 60–80% reach drops after this change, while original creators saw 40–60% reach increases," with accounts posting 10+ reposts in 30 days "excluded from recommendations entirely." This matters strategically: the platforms are using policy + ranking + (increasingly) AI content understanding to privilege content that is identifiably human, original, and substantive — which structurally favors the forensic/long-form/loyalty creators over formula-farmers.

**Why the AI-understanding finding is the big one.** For years, "the algorithm can't watch your video" was true — ranking relied on engagement plus text metadata/transcripts. The 2023–2025 evidence shows that is now changing in production: Meta has deployed a video-understanding model in Reels' recommendation system; YouTube/Google is using Gemini to annotate "vibe" and nuanced attributes that feed retrieval, outperforming human raters. The implication for creators is profound: as models get better at assessing depth, accuracy, and nuance, the gap between "optimized-but-hollow" and "genuinely substantive" content should narrow in the algorithm's eyes. But TikTok remains a documented gap — its public systems are about behavioral signals and ID embeddings, not content understanding.

**Substack as the anti-engagement model.** Substack is the clearest structural alternative: because it monetizes subscriptions, not ads, its rebuilt Notes algorithm optimizes for "what's best for you… and eventually subscribe and pay for," per Mike Cohen. The growth tactic creators report is generosity/reciprocity (restacks and explicit subscribe-recommendations), which the algorithm massively amplifies — though some creators note the amplified Notes drive subscriptions to *others*, making reciprocal partnerships the workaround.

## Recommendations

**For a creator/strategist deciding where to invest (staged):**
1. **Now (0–3 months):** Treat owned audience as the priority asset. Build an email/newsletter base (Substack/beehiiv/Ghost) alongside any algorithmic platform. Benchmark: aim for a measurable conversion from algorithmic reach to owned subscribers; if <1–2% of viewers convert, your funnel, not your content, is the problem.
2. **Near term (3–9 months):** Lean into originality and depth, because both policy and AI content-understanding now reward it. For detail-heavy/forensic content, anchor on YouTube long-form + podcast + a paid tier; use Shorts/Reels only as top-of-funnel trailers. Benchmark: track retention/satisfaction (returning viewers, session contribution) over raw views.
3. **Strategic (9+ months):** If you're in a niche with high trust value (gig work, forensic/investigative, education), build a software or community layer (à la Gridwise, Patreon, Circle) — the durable moat is utility + loyalty, not reach.

**Signals that would change this guidance:**
- If TikTok publishes evidence of multimodal content-quality understanding in ranking, short-form depth becomes more viable.
- If Substack/Flipboard-style curation platforms stall on discovery (their known weakness), revert weight to algorithmic platforms for top-of-funnel.
- If YouTube's LRM/Gemini ranking rolls out broadly and demonstrably rewards substance, double down on depth even in short form.

## Caveats
- Much of the platform-mechanics detail comes from SEO/marketing blogs (Hootsuite, Buffer, vidIQ, SocialBee, etc.), which are directionally reliable and often quote official figures (Mosseri, Beaupré) but are not primary sources; specific weightings (e.g., "70% completion," "40–60% reach increase") should be treated as estimates.
- The strongest AI-in-ranking evidence is real and peer-reviewed for Google/YouTube and official for Meta, but YouTube's LRM specifics rest on a conference talk, and TikTok's use of content-understanding in ranking is unconfirmed by primary sources.
- "Satisfaction," "session contribution," and similar terms are platform-defined and not fully transparent; creators cannot directly measure them.
- Some forward-looking items (Meta GEM organic ranking) are explicitly future-tense and should not be read as live.