---
id: ancaster-fourth-pass-pressure-testing-the-link-is-the-ad-and-choosing-
title: "Ancaster, Fourth Pass: Pressure-Testing \"The Link Is the Ad\" and Choosing One Direction"
kind: "Research pass"
topic: "Attribution & credit"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-205acba9-3a4e-5467-97f3-f367d25e7e19_text_markdown.md"
---

# Ancaster, Fourth Pass: Pressure-Testing "The Link Is the Ad" and Choosing One Direction

Ancaster's defensible white space is not the link-in-bio page, which Linktree, Beacons, Stan and Dub already own. It is the sales layer that sits between a creator's spoken or written endorsement and the merchant's checkout. That layer is a per-offer page on the creator's own surface that demonstrates the product, carries the creator's code and disclosure, and proves who made the sale. The strongest first market is developer and AI-tools creators promoting recurring-commission SaaS programs.

## TL;DR

- **The combined concept is partially taken, not open.** Link-in-bio plus affiliate shops (Linktree Shops, Beacons' affiliate catalog), sponsored placements (Linktree Sponsored Links, launched April 2025), and short links plus partner attribution (Dub Partners) are all live. What nobody ships is a *per-offer, generated, interactive sales page in the creator's voice* that works on top of any affiliate link, including programs the creator joined elsewhere. Lead with that. Treat the link page as a free surface, not the wedge.
- **The rules allow the core mechanics but constrain the "bespoke brand landing" idea.** Redirects and short links are fine if the destination and the creator's site stay identifiable (Amazon policy clauses v and w; Awin Rules 9–10). The real constraint is merchant trademark terms. ElevenLabs' June 10, 2026 affiliate terms ban sites that "mimic… the look and feel" of ElevenLabs, ban marks in headers and domains, and ban marks in "schema markup… intended… to influence the ranking… by any… AI system." Landings must therefore be creator-branded and visibly distinct, and the creator must approve every AI-drafted endorsement (FTC 2023 Guides; 16 CFR 465).
- **Agentic commerce makes the creator's code and first-party page more valuable, not less, but the "agent-readable recommendations" market is option value, not a business yet.** OpenAI retired Instant Checkout in March 2026. The public agent protocols describe no standard "referred by creator X" field (Siren, April 2026). Cloudflare's x402 Monetization Gateway can charge "any caller for any resource… an MCP tool call," which gives a Cloudflare-native builder an unusually cheap place to experiment. Build it as a v2 experiment, not the core.

## Key Findings

1. **Linktree is the default, is moving into Ancaster's lane, and still struggles with monetization per user.** It passed 50M users in May 2024 (TechCrunch, May 22, 2024, which also cited Linktree's estimate that creators drive "upwards of $6 billion in annual [GMV]" through their Linktrees) and reported 70M+ by April 2025. Its pricing is $8/$15/$35 per month. It takes a 12% cut of digital-product sales on Free, 9% on Starter/Pro and 0% on Premium.\[1\]\[2\] It runs Shops (affiliate storefronts across 150+ brands, US-only) and, since April 2025, Sponsored Links: brands pay creators for a labeled slot, such as a Hulu subscription.\[3\] CEO Alex Zaccaria said they "will roll that into cost per click and cost per impression."\[4\]\[5\] Revenue estimates conflict: Sacra estimates 2024 revenue at $55.5M ("up 50% year-over-year from $37M in 2023"), a third-party blog citing Sacra puts it at $64M, and Getlatka lists $61.6M for 2025. None of these is audited. Either way, that is under $1 per user per year.\[6\]
2. **Stan is the best evidence that flat SaaS beats take rate for a lean team.** One $29 plan (plus $99 Pro) and 0% transaction fees reached $40M ARR by April 2026, up from $35M at the end of 2025, with 80,000+ active creators, average revenue per customer of ~$437 (down from $491), and ~40% EBITDA margin (Sacra estimates). Sacra puts the slowdown down to "a single pricing tier with no expansion lever," and Whop passed Stan with $142M annualized revenue in October 2025.
3. **ShopMy and LTK own fashion and beauty affiliate commerce, and they monetize the brand side.** ShopMy raised $70M at a $1.5B valuation in an Avenir-led Series C (October 2025, with Bain Capital Ventures, Bessemer and Menlo). Its release lists "Over $1B in annual platform sales," "185,000+ vetted tastemakers" (Sacra says ~200,000 creators), "1,200+ premium brand partners," and "sustained profitability since 2024." Sacra estimates ~$80M revenue in 2025, and ShopMy charges brands $399+/month plus 2.9–3.9% of GMV. LTK says its creators "drive more than $6 billion in annual retail sales," with 8,000+ retailers and 44M+ monthly users. Reported creator counts vary (Tubefilter reported 300,000 creator partners in September 2024). Retailers such as Sephora (My Sephora Storefront, October 2025, 15% commissions) are disintermediating networks. Do not enter this vertical.
4. **Dub is the closest technical twin and the most dangerous competitor for the developer segment.** It says it powers "10M+ links, 150M+ tracked events, and $3M+ in affiliate revenue monthly" for Framer, Perplexity, Superhuman, Twilio and Vercel.\[7\] Dub Partners charges merchants $90–$300/month plus 3–5% payout fees (8%/6% if funded by card), with monthly payout ceilings.\[8\] Dub serves the *merchant*. It does not build sales pages for the *affiliate*.
5. **Partner enablement today means onboarding journeys, resource centers and banners, not per-affiliate sales assets.** PartnerStack now sells itself as an "AI-native PRM" with an MCP connector, an AI Recruit Agent and "custom onboarding journeys and enablement."\[9\]\[10\] ElevenLabs gives affiliates "a comprehensive resource center."\[11\] All of the AI effort points at the *program manager*. The affiliate still gets "a link, a couple of creatives, rules," exactly as Chris described.
6. **AI companies with no creator program are a real gap, but a narrow one.** OpenAI publishes no ChatGPT affiliate program (as of March 2026), and Anthropic's Claude Partner Network is enterprise-focused.\[12\] Meanwhile ElevenLabs (22% for 12 months via PartnerStack), Cursor and Lovable (reported at 20% recurring for 12 months, community-maintained data), and Replit (a Creator Program) all run programs.\[13\]\[14\]\[15\]\[16\] Tapfiliate (August 2026) notes that "surprisingly few AI coding assistants actually offer public affiliate programs."\[13\]
7. **Affiliate fraud enforcement is at a cyclical high, which rewards clean attribution.** Rakuten removed PayPal Honey on January 12, 2026, and Impact.com suspended it on January 16, 2026, over stand-down violations and concealment from testers.\[17\]\[18\]\[19\] Chrome's March 2025 policy requires affiliate injection to follow "related user action."\[20\] Any Ancaster feature that looks like code injection or cookie-setting without a deliberate click is existential risk.
8. **Agentic checkout stalled; agentic discovery did not.** OpenAI launched Instant Checkout on September 29, 2025. The Information (via PYMNTS, January 2026, citing a Shopify spokesperson) reported that "Shopify merchants will pay OpenAI a 4% fee on sales made through the ChatGPT checkout," on top of Shopify's own fees. OpenAI retired Instant Checkout in March 2026 and moved checkout to merchant apps and sites. Google's Universal Commerce Protocol (January 2026) and Perplexity's Instant Buy continue.\[21\]\[22\] The public docs cover feeds, carts, identity and checkout, but no creator-attribution field.\[23\]
9. **Cloudflare has turned publisher-side AI monetization into platform primitives.** It launched Pay Per Crawl (2025). On July 1, 2026 it announced that from September 15, 2026 Training and Agent crawlers are blocked by default on ad-supported pages, plus Pay Per Use pilots with Ceramic.ai and You.com.\[24\]\[25\]\[26\] It also announced a Monetization Gateway built on x402.\[27\] AI crawlers made up 52% of crawler requests in June 2026, up from 22% in spring 2025, with crawl-to-referral ratios of 118:1 to nearly 50,000:1.\[28\]
10. **Interactive demos lift engagement, but the evidence is vendor-generated and B2B.** Navattic analyzed 40,000+ demos. Top-1% demos hit a 71% CTR, multi-flow demos complete 48% more often, and 66% of top demos are ungated.\[29\]\[30\] An independent-ish PreSales Pulse aggregation (38 companies, Q1 2026) found interactive demos "lose on per-buyer conversion" but win per seller-hour.\[31\] That second finding is exactly the economics Ancaster wants: a generated demo costs almost nothing per additional viewer.

## Details

### 1. Pressure-test: who already does what

| Player | What it actually does (2025–2026) | Pricing / take | Per-offer link | Owned landing w/ code | AI sales help | Cross-format attribution | Curated offers library |
|---|---|---|---|---|---|---|---|
| **Linktree** | Link-in-bio; Shops (affiliate storefronts, deep-links into Amazon app); Sponsored Links marketplace; digital products; Kajabi courses; absorbed Koji, Bento; Fingertip sunset May 1, 2026 into Linktree | $0/$8/$15/$35; 12%/9%/9%/0% on digital sales; Premium keeps 100% affiliate commission | Partial (links, collections) | No (redirects to retailer) | No | Clicks only | Yes (Shops catalog, 150+ brands; Sponsored offers) |
| **Beacons** | Link-in-bio + store + email + media kit; "AI Brand Outreach"; "Beam" AI teammate for brand-deal strategy; affiliate links from "12k brand partners" | $0/$10/$30/$90; 9% seller fee on Free and Creator Pro, 0% on Store Pro | Partial | No | AI for *outreach to brands*, not selling to audience | Clicks | Yes (12k brands) |
| **Stan** | Storefront for digital products/coaching; AutoDM | $29 / $99, 0% fees | No | Own-product checkout only | Minimal | Own sales | No |
| **ShopMy / LTK** | Curated product storefronts, commissionable links, gifting, brand campaigns; fashion/beauty | Brand-paid: ShopMy $399+/mo + 2.9–3.9% GMV | Per-product links | No (retailer checkout) | No | Sales via network | Yes (brand network) |
| **Amazon storefronts / YouTube Shopping** | Native storefronts and product tagging; checkout on retailer | Commission only | Product tags | No | No | Platform-internal | Platform catalog |
| **Dub / Dub Partners** | Short links, conversion tracking, merchant-run affiliate programs, payouts | Merchant pays $90–$300/mo + 3–5% payout fee | Yes | No | No | Click → lead → sale (Stripe) | Partner network, merchant-side |
| **Geniuslink, Bitly, Later/Linkin.bio, Snipfeed, Komi** | Link routing/localization (Geniuslink), generic shortening (Bitly), Instagram grid link pages (Later), creator storefronts (Snipfeed, Komi) | Not re-verified in this pass | Varies | No evidence found | No evidence found | Clicks | No evidence found |

**Verdict: partially taken.** Every *component* exists somewhere. The link page, affiliate catalog and sponsored slot are commodity features inside Linktree and Beacons. Link attribution is commodity inside Dub. What I found no one doing is: (a) a sayable per-offer URL that resolves to (b) a *generated, product-specific demonstration page* on the creator's surface that carries (c) the creator's approved endorsement, code and disclosure, and that (d) works by wrapping *any* affiliate link the creator already holds, while (e) reconciling clicks, code redemptions and network reports in one place. The last two matter most: Linktree and Beacons monetize *their* catalogs, and Dub monetizes *merchants*. Nobody is the affiliate's own sales team.

**Where the thesis is weak:** "Compete with Linktree on shops and do shops better" is the least defensible part of the plan. Linktree has 70M+ users, a US retailer catalog, and in-app deep linking into Amazon.\[3\]\[32\] A solo builder cannot win on catalog breadth. "Better shops" only matters if "better" means *each item sells itself*, and that is the sales-layer thesis, not a shop thesis.

### 2. The "sales process for affiliates" white space

**What networks give affiliates today.** PartnerStack's AI (Recruit Agent, Partner Skills Marketplace, MCP connector) serves program managers. Affiliates get onboarding journeys and resource centers. ElevenLabs' program offers a "resource center… regular updates and early access to new tools" and a dashboard.\[11\] Impact's contract model lets brands define "Special Terms" on paid search, SEO, trademark use and approvals.\[33\] Dub gives partners real-time dashboards.\[34\] None of them generate per-affiliate demos, landing pages or pitch copy. That remains the gap Chris identified, and the research confirms it is still open as of September 2026. Refersion, Levanta, Everflow, CJ, Awin, Rewardful, FirstPromoter and Tolt were not individually re-verified in this pass. Nothing surfaced suggesting any of them does affiliate-side generated sales assets.

**AI/SaaS programs relevant to creators (verified where noted):**

| Company | Program status (2026) | Terms | Platform |
|---|---|---|---|
| ElevenLabs | Yes, "Creator Affiliate Program" | 22% of payments for 12 months (Starter–Scale), 11% Business, 0% Enterprise; 90-day cookie; $5 minimum; commission releases 90 days after first payment | PartnerStack |
| Cursor | Reported yes | 20% recurring, 12 months, 60-day cookie (community-maintained listing, April 2026; verify) | In-house |
| Lovable | Reported yes | 20% recurring, 12 months, manual review (same source; verify) | In-house |
| Replit | Creator Program for tutorial / build-in-public creators | Not verified | — |
| Framer, Perplexity, Vercel | Run programs on Dub (Dub's customer list) | Not verified | Dub |
| OpenAI (ChatGPT) | No public affiliate program (checked March 2026) | — | — |
| Anthropic | No creator/individual program; Claude Partner Network is enterprise/consultancy (prior pass) | — | — |
| Notion, Descript, Riverside, Canva, Webflow, Stripe, Shopify | Not re-verified in this pass | — | — |

**Is there a "creator program layer" opportunity for AI companies without one?** Yes, but approach it as brokered deals, not a platform. The companies that conspicuously lack programs (OpenAI, Anthropic) are large enough that they don't *need* one. They are more likely to be persuaded by a small, provable pilot ("20 developer creators, tracked codes, $X in attributable signups") than by software. The larger near-term opportunity is the long tail of AI startups that *do* have programs but whose affiliates underperform because they only received "the keys." That is where the generated sales page earns its keep, with no brand contract needed.

### 3. The rules: what's fine, what's risky, what's forbidden

**Clearly fine (with configuration):**
- **Short links and redirects through ancaster.link.** Amazon's policy forbids using "a link shortening service… in a manner that makes it unclear that you are linking to an Amazon Site." It also forbids obscuring "the URL of your Site… (including by use of Redirecting Links)… such that we cannot reasonably determine the site."\[35\] The prohibition is on *obscuring*, not on redirecting. Practical rule: label Amazon-bound links as Amazon, and have creators register their Ancaster page URL as a Site in Associates Central. Awin Rule 9 similarly requires "HTTP Referrers that denote the actual content page," so the landing page must be the referrer of record.\[36\]
- **Wrapping a publisher's own PartnerStack/Impact link.** PartnerStack's Partner Agreement (April 29, 2026) is silent on redirects. It defers to each merchant's "Channel Program Agreement."\[37\] Rakuten requires every transaction to originate from a "click.linksynergy" tracking link, which a wrapper preserves if it redirects *through* the original link rather than rewriting it.\[38\]
- **Pre-applying the creator's own assigned code** on a click the visitor deliberately made. Impact assigns a promo code "to a single partner."\[39\] Awin Rule 10 allows tracking only "if the user voluntarily and intentionally interacted with the Ad Media or Tracking link."\[36\] A code attached to the creator's own link, after a click, fits both.

**Risky; design around it:**
- **Bespoke landings that use the brand's name and imagery.** ElevenLabs' June 10, 2026 terms are the new template. They require "Visual Distinctness." They ban sites that create "the impression that such site is an official ElevenLabs website" and ban marks "in the header, masthead, site-wide navigation." They ban domains or handles "confusingly similar to any ElevenLabs Mark," and any paid placement that directs users to ElevenLabs. They also ban marks in "meta tag, alt text, schema markup… intended… to influence the ranking… by any search engine, app store, or AI system."\[40\] Implication: every Ancaster landing must be *the creator's page about the product*, never a clone of the product's page. Keep the creator's branding on top, the product name in body copy only, a required attribution line, and no brand-mark structured data. The subagent could not verify whether ElevenLabs' *API* terms permit an affiliate to build a public demo on its tech; check before shipping that example.
- **Paid acquisition to affiliate landings.** ElevenLabs bans "any paid placement to direct users, whether directly or indirectly, to any ElevenLabs website."\[40\] Ancaster's own ad experiments must never point at a creator's affiliate landing for such programs.
- **CJ** historically prohibited traffic via "hidden frames, JavaScript popup windows and redirects."\[41\] Those quotes come from pre-2012 SEC-filed copies, so check the live Publisher Service Agreement. Avoid iframing merchant pages.
- **YouTube Shopping** links are generated by YouTube through product tagging. There is nothing to wrap, and the program's terms aren't publicly posted.\[42\] Treat YouTube Shopping as a data source (a "creator also promotes X"), not a link Ancaster controls.

**Forbidden, never build:**
- Anything resembling Honey: setting cookies or codes without a deliberate click, overriding another partner's attribution, or scraping and publishing codes not assigned to the creator. Awin Rule 4 requires coupon tools to "only trigger affiliate links when a valid coupon is applied," and Rakuten treats "coupon or cashback stacking that manipulates transaction attribution" as invalid.\[36\]\[38\]

**Endorsement law, applied to AI copy "in the creator's voice":**
- The FTC's 2023 Endorsement Guides define the endorser as "the party whose opinions, beliefs, findings, or experience the message appears to reflect," which explicitly can include AI-powered virtual influencers.\[38\] Endorsements "must reflect the honest opinions… or experiences" of the endorser and must not be "reworded in a way that distorts" them.\[43\] An AI draft becomes lawful copy only when the creator actually holds the opinion and approves it. It must never assert experience the creator didn't have ("I use this daily").
- The Consumer Reviews and Testimonials Rule (16 CFR 465, final August 2024) covers AI-generated testimonials. It prohibits testimonials that misrepresent that the testimonialist "used or otherwise had experience with the product," with civil penalties cited at $51,744 per violation in 2024.\[44\]\[45\]
- **Canada:** Competition Bureau guidance (summarized by Aird & Berlis) says "linking to brands, posting discount codes, or using affiliate links may not suffice as disclosures."\[46\] Since June 20, 2025 (Bill C-59), private parties can seek leave to bring deceptive-marketing cases directly to the Competition Tribunal.\[47\] A Niagara Falls-based company is squarely exposed.
- **Rotating/evergreen links are the sharpest legal edge.** If a creator says "my gear link" on a podcast and the destination later rotates to an offer they never evaluated, the audience's trust now attaches to an unendorsed product. Rule: rotation only among offers the creator has explicitly approved, and every landing carries its own disclosure.

**How to structure it:** make the guardrail the product. Build an **Endorsement Ledger**: every AI-drafted line is stored with the creator's approval, timestamp, their "basis" (used it / tested it / sponsored), and the disclosure rendered. This is how Ancaster avoids FTC and Competition Bureau problems. It is also evidence a merchant or network can audit, which almost no competitor offers.

### 4. When AI agents do the shopping

**State of play (September 2026):**
- **OpenAI:** ACP with Stripe; Instant Checkout launched September 29, 2025 and retired March 2026.\[21\] The Information reported that "only about 12 of Shopify's million-plus eligible merchants had actually integrated with native checkout" (as quoted by Waniwani, March 2026), and one analyst adds that sales tax collection was never built. OpenAI's statement: "Instant Checkout is moving to Apps."\[48\] Discovery stays in ChatGPT, and checkout returns to merchants.\[49\]
- **Google:** Universal Commerce Protocol (announced January 2026), expanding into AI Mode and Gemini.\[22\] AP2, Visa Intelligent Commerce, Mastercard Agent Pay, Shopify Catalog and Perplexity shopping were not individually re-verified in this pass.
- **Attribution:** Siren's April 2026 review found public docs "do not yet describe a standard affiliate field that says 'referred by creator X.'"\[23\] The durable pattern is to attach identity to something the buyer *consumed*: codes, dedicated landing pages, product variants. On that analysis, newsletter clicks still convert normally ("the channel belongs to the creator"), coupon codes "travel through agentic paths cleanly," and click-dependent SEO/listicle affiliates are most exposed.\[23\]
- **Demand side:** eMarketer (citing Sensor Tower) reports shopping queries grew faster than any other ChatGPT query type from December 2024 to June 2025. It also notes that when answers happen in-chat, "the tracked link that triggers an affiliate commission never occurs."\[50\] Impact.com now pitches affiliate content as the main input to GEO, while conceding that payout "remains pinned to the bottom funnel."\[51\]

**What this means for the link.** The creator's code and first-party page are the most agent-durable attribution assets that exist. That is good news for Ancaster: an ancaster.link page that an assistant *can read* and a code an assistant *can apply* survive the transition, while cookie-only links don't. The link is the ad for humans. For agents, the *code* is the ad.

**Publisher-side AI monetization (relevant to Chris's stack):**
- Cloudflare Pay Per Crawl (2025) is evolving into **Pay Per Use**, charging when content "creates value" (appears in an answer), piloted with Ceramic.ai and You.com. There is no general-availability date.\[24\]\[25\]
- **September 15, 2026 defaults:** Training and Agent crawlers are blocked by default on pages that display ads. Reports conflict on whether this applies only to new domains or also to existing free-plan sites.\[25\]\[28\]
- **Monetization Gateway (x402):** "charge any caller for any resource, from an API to data to an MCP tool call." The x402 Foundation (Linux Foundation, April 2026) includes AWS, Cloudflare, Anthropic and Circle. Coinbase reports 169 million transactions in year one. Cloudflare hasn't disclosed pricing or launch timing.\[27\]\[52\]
- A working experiment (Suganthan, September 15, 2026) charged agents one cent per page via x402 and had Claude Code pay. The author concedes "ordinary search crawlers aren't currently arriving with wallets."\[53\]
- TollBit, ProRata/Gist and Perplexity Comet Plus were not re-verified in this pass.

**White space: "trust-mediated recommendations."** Picture a creator's approved recommendations (product, their stance, their code, their disclosure, date approved) exposed as structured data plus an MCP server. An assistant could then cite the creator's endorsement and apply their code. That is real white space: no protocol carries creator attribution, and Ancaster's Endorsement Ledger is precisely that dataset. **But two cautions.** First, ElevenLabs' terms already ban marks in "schema markup… intended… to influence… any AI system," so merchants may treat AI-targeted structured data as brand abuse.\[40\] The data must describe the *creator's* opinion and stay out of merchant-mimicking territory. Second, there is no buyer yet. Build it as a cheap v2 experiment on Workers + x402 (an "ask Sam what mic to buy" MCP tool that returns Sam's approved picks and codes). Treat the return as option value.

**Cloudflare-specific openings:** (1) Workers + Durable Objects make per-link MCP endpoints nearly free to host. (2) The Monetization Gateway could meter MCP tool calls without Chris building payments. (3) The September 15 crawler defaults mean creators on Cloudflare-fronted sites will increasingly *choose* which agents may read them. An Ancaster page that explicitly allows "Search" and "Agent" reads of creator-approved recommendations is a differentiated stance.

### 5. Creative frontier: generated, interactive, per-offer landings

- **Evidence on interactive demos** is abundant but vendor-sourced and B2B. Navattic: 40,000+ demos, 53–56% engagement across the top quartile, 29%→71% CTR from top-10% to top-1%, 48% higher completion for multi-flow demos, 66% of top demos ungated, and a 6.6x MQL lift from persona-segmented demos on Navattic's own site.\[29\]\[30\] Walnut claims a 32% average conversion increase (vendor).\[54\] PreSales Pulse (38 companies) found interactive demos lose on per-buyer conversion versus live demos but win per seller-hour.\[31\]
- **Personalized landing tools** (Mutiny, Coframe, Fibr AI, Replo, Unbounce Smart Traffic, Instapage AI, Webflow Optimize) were not re-verified in this pass. Prior knowledge suggests they target merchant-owned sites and paid-traffic audiences, not affiliates' pages. No evidence surfaced of anyone applying generated landings to creator affiliate links.
- **Implication:** the creator case differs from B2B. The visitor already trusts the creator and arrives warm, so the landing's job is to remove the last doubt ("does this voice tool sound good on *my* script?"), not to educate. The format should be short, one interaction, ungated, and code visible. Never gate a creator's audience.
- **Cost:** a generated landing is one offline LLM run plus hosting on the think path. At Workers/R2 costs, the marginal cost per page is cents, and the serve path never calls an LLM. The expensive part is *interactive* demos that call the product's API per visitor (e.g., live TTS). Those need rate limits, cached samples, or merchant-provided sandbox keys, plus the API-terms check above.

### 6. Business model and wedge economics

- **Why creators don't switch link tools:** the link is printed everywhere (bios, old videos, printed show notes), switching breaks it, and the free tier is "good enough." The evidence here is structural rather than survey-based. Linktree's scale, and Beacons' and Stan's success in *segments* rather than head-on, suggest switching happens only when a tool makes visible money. Beehiiv's and Linktree's "made with" loop performance was not quantified in available sources. Don't plan around viral-loop numbers you can't verify.
- **Take-rate reality:** on BYO affiliate programs, the network pays the creator directly, so Ancaster *cannot* take a cut without custody. That is a feature: no payouts, no 1099/W-8 tax collection, no money transmission. Dub's 3–8% payout fees and $2.5K/$15K monthly ceilings show what running payouts costs even a funded company.\[8\]
- **Recommended model:**
  - **Free:** link page, short links, click analytics, 1 generated offer page.
  - **Creator Pro, ~$15–29/month:** unlimited generated offer pages, code reconciliation, Endorsement Ledger export, custom domain. Stan proves creators pay a flat fee when it visibly makes money.
  - **Brokered deals (later):** 10–20% of flat-fee sponsorships Ancaster sources.
  - **Program-side "enablement" (later):** AI/SaaS companies pay Ancaster to equip *their* affiliates with generated pages, the ShopMy lesson that brands pay more than creators.
- **Traps:** (1) competing on free against a 70M-user incumbent; (2) custody and payouts; (3) fraud: click fraud, code leakage, and any Honey-like behavior; (4) getting a creator banned from Amazon or ElevenLabs by a non-compliant page, which is catastrophic for trust and word of mouth; (5) generation costs for live interactive demos; (6) Linktree shipping "AI offer pages" into Sponsored Links. That last one is plausible within 12–18 months, so speed and the developer niche matter.

### 7. Beachhead

| Segment | $/follower & offers | Willingness to switch | Competition | Chris's credibility | Verdict |
|---|---|---|---|---|---|
| **Developer / AI-tools creators** | High: recurring 20–22% for 12 months (ElevenLabs, Cursor, Lovable); products are demo-able ("a five-minute video showing how an idea becomes a working application," Tapfiliate on Lovable) | High: technical, already use Dub/custom links, early adopters | Dub (merchant-side), no affiliate-side sales tool | Strongest: he is an AI-native builder shipping with Claude Code | **Recommended** |
| Independent newsletter writers | Medium; sponsorships dominate; clicks remain agent-proof | Medium (Beehiiv lock-in) | Beehiiv, Paved, Passionfroot (prior passes) | Moderate (journalism) | Second wave |
| YouTube tech/productivity reviewers | High affiliate volume, codes spoken on camera | Medium | Geniuslink, Amazon, YouTube Shopping | Moderate | Third, via codes |
| Small podcasters (show-notes links) | Low per listener at small scale | Low | Podscribe etc. (prior passes) | Moderate (broadcasting) | Defer |
| Gig / side-hustle creators | Medium-high referral bonuses (driver/courier sign-ups) but programs are volatile and heavily policed | Medium | Little tooling | Authentic (gig driving) | Content angle, not market |
| Fashion/beauty/hobby | Commerce-rich | Low | LTK, ShopMy, Linktree Shops, retailers | Weak | Avoid |

The developer/AI segment wins on every axis that matters for v1: high-value recurring offers, products that *can be demonstrated in-page*, users who tolerate a young tool, and a founder who is one of them. Its weakness is size: fewer creators than lifestyle. That is acceptable for a solo founder who needs 200 paying creators, not 2 million.

## Recommendations

### Positioning (one sentence)

**Ancaster is the sales team behind a creator's recommendation: one sayable link per offer that lands on the creator's own page, shows the product working, applies their code, and proves who made the sale.**

### Product vision (one paragraph)

A creator says "ancaster.link/sam/eleven" in a video. The link resolves in under 50ms to Sam's page for that offer. It is branded as Sam's, shows Sam's approved one-line take and disclosure, and presents a single interaction (hear your own sentence in three voices, run your own numbers, see the before/after). Sam's code is visible and pre-applied, and the checkout button runs through Sam's own PartnerStack link. Offline, Ancaster reads Sam's feeds, notices which tools Sam actually talks about, drafts the page and the pitch lines, and waits for Sam's yes. Every yes goes into Sam's Endorsement Ledger, which renders disclosures, keeps rotations honest, and, in time, is published as machine-readable recommendations that AI assistants can cite and pay for. The link page is simply the index of these offer pages. Everything else (Passport, DAI, banner tags) is deferred. **Do not split the company.** Link, landing, ledger and agent feed are one object seen from four angles.

### McLuhan tetrad: "the link is the ad"

- **Enhances:** the creator's voice and the moment of trust. The endorsement stops at the click no longer; it follows the visitor to the point of purchase. *White space:* the landing as a continuation of the creator's voice, where no one else operates.
- **Obsolesces:** the merchant's generic landing page, the banner kit in the affiliate "resource center," and the anonymous CPM slot. *White space:* affiliate-side creative, which networks have abandoned to templates.
- **Retrieves:** the host-read radio spot and the shopkeeper's personal recommendation ("tell them Sam sent you"), meaning the spoken code as identity. *White space:* codes as the primary attribution primitive, the one that survives agents (Siren).
- **Reverses into (pushed to the extreme):** endorsement spam. Every sentence becomes a link, generated pitches exceed the creator's genuine opinions, and rotation silently attaches trust to products the creator never used. That is the fake-testimonial territory of 16 CFR 465, and at machine scale it becomes agents gaming creator endorsements. *White space:* provenance. The ledger that proves an endorsement is real becomes more valuable than the link itself.

### Novel bets, ranked by leverage for a solo AI-native builder

1. **Generated offer pages for any affiliate link (the "affiliate's sales team").** *Evidence:* no network or tool builds affiliate-side assets; demo engagement data (Navattic) is strong; marginal cost is near zero on Cloudflare. *Kill signal:* after 90 days, generated pages show no measurable lift over direct links in A/B splits (target: ≥20% more conversions per click), or merchants start banning intermediary pages outright.
2. **Endorsement Ledger as a compliance product.** *Evidence:* FTC 2023 Guides, 16 CFR 465, Canada's post-C-59 private access, and merchant terms that are growing more detailed (ElevenLabs, June 2026). *Kill signal:* creators refuse the approval step as friction. Mitigate with a one-tap approve.
3. **Code-first, cross-format attribution.** Reconcile spoken or printed codes, clicks and network CSVs or postbacks per offer. *Evidence:* codes are the agent-durable primitive; creators in audio and video lack reconciliation. *Kill signal:* networks don't expose code-level redemption data to affiliates, forcing manual uploads nobody does.
4. **Agent-readable recommendations via MCP + x402 on Cloudflare.** *Evidence:* no creator-attribution field in agent protocols; Monetization Gateway supports MCP tool calls; Anthropic sits in the x402 Foundation. *Kill signal:* no assistant ever calls the endpoint, or merchants classify it as the "AI system" mark use their terms prohibit.
5. **Brokered creator programs for AI companies without one.** *Evidence:* OpenAI and Anthropic have no creator programs; many AI tools lack public ones (Tapfiliate). *Kill signal:* no response from 20 targeted companies within 60 days. It is high-effort sales work, which is why it ranks last.

### Cut or defer

- **Cut:** head-on "better shops than Linktree." Keep a minimal index page only.
- **Defer to v3+:** Ancaster Passport; podcast DAI; Carbon-style tier-1 script tag; LLM-driven *automatic* rotation (keep manual rotation among approved offers only); the proprietary recommendation property.
- **Shrink:** the monthly ad-experiment report. Keep it as content, but never run paid traffic to affiliate landings (ElevenLabs forbids it), and cap spend.
- **Keep:** the serve/think split, "feed is the integration," a click schema with no cross-site identifier, and system-proposes/creator-approves.

### Strategic decisions

**A. Wedge**
- Option 1: Link-in-bio wedge (free Linktree alternative). Crowded, and monetizes at <$1/user at the incumbent.
- **Option 2 (RECOMMENDED): Affiliate sales-layer wedge.** Generated offer pages on top of links creators already have. It is the only piece with no incumbent, it doesn't require merchant contracts, and it monetizes via a flat Pro plan.
- Option 3: Agent-era recommendations wedge. Strategically interesting, with no demand yet.

**B. Marketplace model**
- Option 1: Self-serve two-sided marketplace. Cold-start problem on both sides.
- **Option 2 (RECOMMENDED): BYO first, brokered second.** Creators bring links (no custody, no merchant sales). Chris personally brokers 3–5 deals with AI companies once 50+ developer creators are active, using the ledger data as proof.
- Option 3: Merchant-side affiliate platform (Dub's model). Head-to-head with Dub and PartnerStack.

**C. Beachhead**
- **Option 1 (RECOMMENDED): Developer/AI-tools creators**, on the evidence above.
- Option 2: Independent newsletter writers. Good second wave; the click survives agents here.
- Option 3: Gig/side-hustle creators. Authentic for Chris, but programs are volatile; use it for content, not the market.

**D. Landings**
- Option 1: Templates. Cheap, and indistinguishable from Linktree.
- **Option 2 (RECOMMENDED): Generated per offer from a constrained component kit** (hear-it, try-it, calculator, before/after, first-chapter) with a compliance linter (creator branding on top, no brand marks in header/meta/schema, disclosure present). This is "bespoke" that stays safe under terms like ElevenLabs'.
- Option 3: Fully free-form generation. Maximum novelty, highest ToS risk.

### 90-day plan for v1

**Days 1–30: Prove one page sells.**
- Ship ancaster.link/{creator}/{offer} resolve + 302 through the creator's original affiliate link, click logging in D1, and labeled destinations (Amazon-clear).
- Hand-build five offer pages for Chris's own programs (ElevenLabs first, after checking API terms for demos), using the component kit. Add the disclosure block and the Endorsement Ledger (approve, basis, timestamp).
- Run A/B: 50% direct affiliate link vs 50% offer page, on Chris's own posts and newsletter.
- Write the compliance linter from the ElevenLabs, Amazon and Awin rules above.

**Days 31–60: Ten developer creators.**
- Recruit 10 AI/dev creators personally (build-in-public community, X, YouTube). Onboard each by pasting their existing PartnerStack/Impact/Dub links.
- Add code reconciliation (CSV upload from PartnerStack/Impact, plus manual code logs) and a per-offer dashboard: clicks, code uses and network conversions in one row.
- Think path v0: ingest each creator's RSS/YouTube feed, detect tools they mention, and draft offer pages for approval. Whisper transcription only for creators who ask.
- Publish the first monthly "what actually converted" report with real numbers.

**Days 61–90: Charge and test the frontier.**
- Launch Creator Pro (~$19/month; test $15 vs $29). Target 25 paying creators and a documented conversion lift on ≥3 offers.
- Ship an experimental MCP endpoint per creator ("recommendations," approved picks + codes + disclosure) behind Cloudflare. Log any agent calls. Don't charge yet.
- Draft the brokered-pilot deck for 20 AI companies without creator programs, built on ledger data.
- Decision gate at day 90: if generated pages don't beat direct links by ≥20% per click across ≥3 creators, pivot the product to reconciliation + ledger (bets 2–3) and drop generation.

## Caveats

- **Revenue and traction figures for Linktree, Stan and ShopMy are third-party estimates** (Sacra, Getlatka) and conflict in places. LTK's "$6B" and Dub's usage figures are self-reported.
- **Interactive-demo lift data is vendor-produced and B2B.** No study measures generated landings on creator affiliate traffic. Ancaster's own A/B test is the evidence that matters.
- **Terms change.** ElevenLabs' terms say amendments take effect immediately.\[40\] CJ quotes come from pre-2012 copies. Impact's full partner agreement and YouTube Shopping's affiliate ToS were not accessible. Re-check before launch, and get a Canadian advertising lawyer to review the ledger and disclosure design once.
- **Not re-verified in this pass:** Geniuslink, Bitly, Later, Snipfeed, Komi, Mutiny/Coframe-class tools, AP2/Visa/Mastercard agent programs, TollBit, ProRata, Comet Plus, and several SaaS programs (Notion, Canva, Descript, Riverside, Webflow, Stripe, Shopify). Absence from this report is not evidence of absence.
- **Agentic-commerce claims are moving monthly.** The OpenAI Instant Checkout retirement is reported by several secondary sources and an OpenAI spokesperson quote, and Cloudflare's September 15 default scope is reported inconsistently.

## Sources

1. [Linktree revenue, valuation & funding | Sacra](https://sacra.com/c/linktree/)
2. [Linktree Pricing 2026 Explained + Cheaper Alternative | QR-Verse](https://qr-verse.com/en/blog/linktree-pricing-2026)
3. [How to promote affiliate links with Linktree | Linktree Help Center](https://help.linktr.ee/en/articles/8619620-how-to-promote-affiliate-links-with-linktree)
4. [Linktree rolls out a suite of monetization features for creators](https://finance.yahoo.com/news/linktree-rolls-suite-monetization-features-130000327.html)
5. [The Definitive Guide to Linktree in 2025 - Slidde](https://slidde.co/blogs/linktree-definitive-guide)
6. [Report: Linktree Business Breakdown & Founding Story | Contrary Research](https://research.contrary.com/company/linktree)
7. [Dub Affiliate Program | Dub](https://partners.dub.co/dub)
8. [Dub Partners Alternatives: 7 Affiliate Platforms for 2026 · Rekomi](https://rekomi.com/blog/dub-partners-alternatives)
9. [Partner Ecosystem Platform | Rated #1 | PartnerStack](https://partnerstack.com/)
10. [Smarter partnerships start with PartnerStack AI](https://partnerstack.com/platform/ai)
11. [Affiliate program](https://elevenlabs.io/affiliates)
12. [Does ChatGPT Have An Affiliate Program? | CustomGPT.ai](https://customgpt.ai/does-chatgpt-affiliate-program/)
13. [Best AI Coding Assistant Partner Programs in 2026: What's Really Available - Tapfiliate](https://tapfiliate.com/blog/best-ai-coding-assistant-partner-programs-gp/)
14. [Cursor Affiliate Program — 20% recurring | OpenAffiliate](https://openaffiliate.dev/programs/cursor)
15. [Lovable Affiliate Program — 20% recurring | OpenAffiliate](https://openaffiliate.dev/programs/lovable)
16. [ElevenLabs Affiliate Program: 22% for 12 months | Reditus](https://getreditus.com/affiliate-programs/elevenlabs)
17. [Impact.com just kicked Honey off its network for hiding cookie theft](https://ppc.land/impact-com-just-kicked-honey-off-its-network-for-hiding-cookie-theft/)
18. [PayPal Honey](https://en.wikipedia.org/wiki/PayPal_Honey)
19. [Impact.com Removes Honey Paypal, from Platform Following Attribution Investigation - Affiverse](https://www.affiversemedia.com/impact-com-removes-honey-from-platform-following-attribution-manipulation-investigation/)
20. [Google Chrome policy update restricts shady affiliate extensions, like Honey](https://9to5google.com/2025/03/11/google-chrome-affiliate-extension-policy-honey/)
21. [ChatGPT Instant Checkout: What Happened to It in 2026](https://www.hypotenuse.ai/blog/chatgpts-instant-checkout-the-next-phase-of-agentic-commerce)
22. [AI Shopping Assistant Guide 2026: Agentic Commerce Protocols - Opascope](https://opascope.com/insights/ai-shopping-assistant-guide-2026-agentic-commerce-protocols/)
23. [Affiliate Attribution in the Age of AI Agents | Siren](https://www.sirenaffiliates.com/blog/affiliate-attribution-ai-agents)
24. [Cloudflare's new policy pushes AI companies to pay for publishers' content | TechCrunch](https://techcrunch.com/2026/07/01/cloudflares-new-policy-pushes-ai-companies-to-pay-for-publishers-content/)
25. [Cloudflare changes its AI-crawler defaults on 15 September, and its own dashboard makes the problem look worse than it is – Remote Work Europe News](https://remoteworkeurope.eu/news/2026/cloudflare-sep-15-ai-default-flip-pay-per-use/)
26. [techcrunch.com](https://techcrunch.com/?p=3023625)
27. [Announcing the Monetization Gateway: charge for any resource behind Cloudflare via x402 | Cloudflare Blog](https://blog.cloudflare.com/monetization-gateway/)
28. [Cloudflare to Charge AI Crawlers | SaaS News](https://www.saasrise.com/news/cloudflare-to-charge-ai-crawlers-ending-free-webdata-access-f2d61c36-b503-46cc-b0b3-65a1afe80e6e)
29. [Interactive Product Demos in 2026: What Actually Converts](https://userpilot.com/blog/interactive-product-demo/)
30. [Best Practices for Building Interactive Demos in 2026](https://www.navattic.com/blog/best-practices-building-interactive-demos)
31. [Interactive Demo Platforms vs Live Demos: 2026 Benchmarks](https://presalespulse.com/insights/interactive-demo-vs-live-demo/)
32. [Linktree Shops: FAQs | Linktree Help Center](https://help.linktr.ee/en/articles/9342172-linktree-shops-faqs)
33. <https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/working-with-brands/contracts/create-and-edit-special-terms>
34. [Pricing | Dub](https://dub.co/pricing/partners)
35. [Amazon.com Associates Central](https://affiliate-program.amazon.com/help/operating/policies)
36. [Home - Publisher Code of Conduct - EN-GB](https://awin.foleon.com/code-of-conduct-publisher/en-gb/)
37. [Partner Agreement](https://partnerstack.com/legal/partner-agreement)
38. [Affiliate Network Policies and Guidelines | Rakuten Advertising](https://rakutenadvertising.com/legal-notices/affiliate-network-policies/)
39. [Promo Codes FAQ | I'm a Brand | impact.com Help Center](https://help.impact.com/brand/what-would-you-like-to-learn-about/platform-features/promo-codes/promo-codes-faq)
40. [ElevenLabs — ElevenLabs Creator Affiliate Program - Terms](https://elevenlabs.io/affiliates-terms)
41. [Ex 10.2 Agreement with Commission Junction](https://www.sec.gov/Archives/edgar/data/1142889/000110801701500395/irex102.htm)
42. [YouTube Shopping affiliate program overview & eligibility - Computer - YouTube Help](https://support.google.com/youtube/answer/13376398)
43. [Advertising Update: The FTC's New Guidelines for Endorsements and Testimonials | Thought Leadership | December 2023 | Baker Botts](https://www.bakerbotts.com/thought-leadership/publications/2023/december/ftc-new-guidelines-for-endorsements-and-testimonials)
44. [1 BILLING CODE: 6750-01-P FEDERAL TRADE COMMISSION 16 CFR Part 465](https://www.ftc.gov/system/files/ftc_gov/pdf/r311003consumerreviewstestimonialsfinalrulefrn.pdf)
45. [FTC Crackdowns on Influencer and AI-Generated Content Brent Johnson](https://www.acc.com/sites/default/files/program-materials/upload/FTC-Crackdown-on-Influencers-Holland-and-Hart_0.pdf)
46. [Influencer Marketing: Legal Implications for Canadian Content Creators and Advertisers](https://www.airdberlis.com/insights/blogs/thespotlight/post/ts-item/influencer-marketing-legal-implications-for-canadian-content-creators-and-advertisers)
47. [False advertising and greenwashing: Bill C-59 changes to Competition Act | BLG](https://www.blg.com/en/insights/2024/07/false-advertising-and-greenwashing-bill-c-59-changes-to-competition-act)
48. [OpenAI Scales Back ChatGPT Checkout: Why Agentic Commerce Needs Universal Checkout Infrastructure](https://rye.com/blog/openai-chatgpt-checkout-agentic-commerce)
49. [OpenAI’s agentic commerce shift: What it means for merchants | Checkout.com](https://www.checkout.com/blog/openai-agentic-commerce-shift)
50. [FAQ on affiliate marketing: How AI and creators are reshaping the channel in 2026](https://www.emarketer.com/content/faq-on-affiliate-marketing--how-ai-creators-reshaping-channel-2026)
51. [Affiliate programs are your biggest GEO asset in AI search](https://impact.com/affiliate/generative-engine-optimization-affiliate-strategy/)
52. [Cloudflare and AWS Embed x402 Agent Payments at the Edge - InfoQ](https://www.infoq.com/news/2026/07/cloudflare-aws-x402-micropayment/)
53. [I made my website charge AI agents a penny per page. Then I watched Claude pay it. — Suganthan](https://suganthan.com/blog/x402-pay-per-crawl/)
54. [Interactive Demos & B2B Conversion Rates - Walnut.io](https://www.walnut.io/blog/product-demos/interactive-demos-conversion-rates-b2b-2026-data/)
