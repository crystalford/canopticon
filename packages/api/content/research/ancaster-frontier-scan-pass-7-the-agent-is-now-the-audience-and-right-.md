---
id: ancaster-frontier-scan-pass-7-the-agent-is-now-the-audience-and-right-
title: "Ancaster Frontier Scan (Pass 7): The Agent Is Now the Audience, and Right Now It Reads Merchant Feeds, Not Creators"
kind: "Research pass"
topic: "Attention & feeds"
date: "2026-07-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-3e04da06-419c-5566-a2d9-d0601f793029_text_markdown.md"
---

# Ancaster Frontier Scan (Pass 7): The Agent Is Now the Audience, and Right Now It Reads Merchant Feeds, Not Creators

**Agents are not routing around creators yet. They are routing around the open web.** Since July 2026, ChatGPT's product picks have come mostly from merchant feeds.\[1\] Creators still get in through the citation layer: YouTube and Reddit are the most-cited sources in AI shopping answers.\[2\] Ancaster's move is to make each creator's endorsement a signed, machine-readable object on the creator's own domain, one that agents can fetch, cite and eventually pay for, instead of relying only on OpenAI's or Google's attribution fields.

## TL;DR

- **Frontier #1 (agents) matters most, and it changes the pass-six plan.** Profound's tracking found feed-sourced ChatGPT picks jumping from 8.26% to 61.54% on 10 July 2026.\[1\] OpenAI retired in-chat Instant Checkout in March 2026. At Morgan Stanley's TMT conference on 4 March 2026, Walmart EVP Daniel Danker said in-chat purchases "converted at one-third the rate of click-out transactions" (reported by Wired and Search Engine Land). Put together: agents choose from feeds, but buyers still finish on merchant sites. Codes and landing pages survive. Being *chosen* by an agent now needs a machine-readable trust signal that feeds don't carry.
- **The "inversion" is now real infrastructure.** Cloudflare's Monetization Gateway (x402, waitlist) can charge "any caller for any resource… from an API to data to an MCP tool call."\[3\] Perplexity's Comet Plus already pays publishers for "agent actions."\[4\]\[5\] So "a creator's picks, paid per agent query" is buildable on Chris's own stack today. Treat it as a *complement* to commission. No evidence yet shows the revenue could replace it.
- **Synthetic reads, privacy measurement and provenance rails are secondary.** EU AI Act Article 50 applied from 2 August 2026.\[6\] New York's synthetic-performer law took effect 9 June 2026. W3C Attribution and IETF DAP are still drafts.\[7\]\[8\] C2PA is spreading in cameras and video but has no sponsorship assertion. The 30-day experiment: ship a signed, agent-readable "Receipt + Picks" endpoint (well-known keys, JSON-LD, remote MCP tool, optional x402 tier) on Workers, and measure which agents fetch it, quote it, and convert through it.

## Key Findings

1. **Selection has moved to feeds; citation still favours creators.** Profound tracked 1,757,723 ChatGPT Shopping prompt runs. Profound's report "ChatGPT 5.6 has transformed Shopping mode" (Allen Wu, 3 September 2026) put feed retrieval at "roughly 65%" of recommendations, from 97,725 prompt runs sampled at 10%. It ties the 10 July jump to GPT-5.6's release on 9 July. Merchant concentration rose: the top-10 stores' share went from 22.5% to 41.8%, and unique merchants fell from 13,524 to 10,607. OpenAI has not confirmed the change. Separately, LLM Pulse analysed 391,073 citations in US shopping answers (12 April to 11 July 2026). Reddit and YouTube together out-cite every big-box retailer combined, and all retailers combined account for just 2.9% of citations.\[9\]
2. **The beachhead is partly insulated.** Dev/AI-tools SaaS has no merchant feed in ChatGPT Shopping. B2B software recommendations lean on G2, Capterra and TrustRadius, on Reddit, and on editorial mentions.\[10\] Creators' YouTube and blog content stays in the evidence pool for SaaS far longer than for physical goods.
3. **Checkout is returning to the merchant.** OpenAI moved Instant Checkout "to Apps" on 24 March 2026.\[11\]\[12\] On 4 March 2026, Walmart EVP Daniel Danker said in-chat purchases across about 200,000 listed products "converted at one-third the rate of click-out transactions." He called the experience "unsatisfying." Google (UCP), Microsoft (Copilot Checkout) and Anthropic (Claude for Commerce) all keep the merchant as merchant of record.\[13\]\[14\] For Ancaster, that means the landing page and the code still matter at the moment of purchase.
4. **No agent honours a user-held creator code or receipt today.** I found no product doing it. The only hooks are protocol-level: ACP's affiliate attribution and UCP's attribution map (from pass six). Meta is the one platform that says its shopping AI draws on "creator content and brand storytelling… that users follow."
5. **Paying for agent access is live, but early.** Cloudflare pay-per-crawl moves to pay-per-use. A 15 September 2026 default blocks training and agent bots on ad-supported pages for new domains.\[15\]\[16\] x402 now runs at the edge on both Cloudflare and AWS.\[17\] Comet Plus splits 80/20 in publishers' favour from a $42.5M pool.\[18\]\[19\]\[20\]
6. **Synthetic host-reads are consent-gated, not yet proven.** iHeart advertises "No synthetic voices. No AI hosts."\[21\] ElevenLabs sells consent-based voice licences.\[22\] I found no rigorous public evidence that synthetic host-reads perform as well as human reads.
7. **Privacy-preserving measurement exists as drafts and one production service.** Google retired the Attribution Reporting API on 17 October 2025.\[23\]\[24\] DAP is at draft-19 (6 July 2026), not yet an RFC.\[7\]\[25\] ISRG's Divvi Up runs DAP in production.\[26\] Cloudflare's Daphne is open source but "not intended for general use," and is reportedly archived.\[27\]\[28\]

## Details

### Frontier 1 — The agent as the audience (highest priority)

**How each agent chooses, as of September 2026**

| Agent | Selection inputs (verified vs claimed) | Commerce status | Creator/receipt hook |
|---|---|---|---|
| **ChatGPT** | Shopping research runs on a GPT-5 mini variant. OpenAI claims 52% product accuracy vs 37% for standard search (OpenAI benchmark, via HubSpot).\[10\] Since July 2026, mostly merchant feeds (Profound, observational, unconfirmed by OpenAI), plus reviews and web authority.\[1\] | Instant Checkout retired 24 March 2026. ACP discovery with Target, Sephora, Nordstrom, Lowe's, Best Buy, Home Depot and Wayfair; retailer apps (e.g., Walmart's Sparky).\[11\] | ACP AffiliateAttribution (pass six). No user-held code handling. |
| **ChatGPT Ads** | Test announced January 2026; pilot from 9 February 2026 for logged-in adult Free and Go users in the US.\[29\]\[30\] Ads sit below the answer, labelled "Sponsored," under OpenAI's "Answer Independence" principle.\[31\]\[32\] Reported $60 CPM and $200k minimums (trade press, not OpenAI).\[29\] Pixel and Conversions API reported from 5 May 2026 (secondary).\[31\] | Live, US-only pilot. | Ads reportedly don't change organic answers.\[33\] But the paid slot sits next to exactly the "recommendation" moment creators sell. |
| **Google AI Mode / Gemini** | Shopping Graph plus Merchant Center, with "dozens of new data attributes" for conversational discovery.\[34\] | UCP launched 11 January 2026. Universal Cart announced at I/O 2026. UCP checkout expanding "to Canada and Australia in the coming months," and UCP coming to YouTube in the US.\[14\]\[35\] | UCP attribution map (pass six). AP2 mandates for payments.\[35\] |
| **Perplexity / Comet** | Citation-heavy; one 1,000-run study found Reddit in 44.7% of sourced shopping answers.\[36\] | Comet browser acts as shopper; PayPal partnership.\[19\] | Comet Plus pays for human visits, citations and **agent actions**.\[4\]\[5\] The closest existing model to "paid per agent query." |
| **Claude** | No consumer shopping product found. Claude for Commerce (2 September 2026): Apache-2.0 reference shopper and merchant agents on the Claude API, Bedrock, Foundry and Vertex.\[37\]\[38\] Anthropic "does not want to own catalogs, ads, or the last mile of payment."\[13\] Its 35% basket and 60% completion figures are vendor claims.\[38\] | Shopify is building a reference storefront "through Catalog, UCP and Shop Sign-in."\[39\] | Open code: Ancaster can fork the shopper agent to *read receipts*. |
| **Amazon** | Rufus (300M+ customers in 2025) became Alexa for Shopping on 13 May 2026. Mainly Amazon listings, reviews and Q&A, plus Sponsored Prompts.\[40\]\[41\] | Buy for Me buys from non-Amazon retailers on the user's behalf.\[42\] | Closed; no creator signal. |
| **Microsoft Copilot** | Merchant Program catalog ingestion (2025).\[43\] | Copilot Checkout from 8 January 2026 (PayPal, Shopify, Stripe; Shopify merchants auto-enrolled).\[44\]\[45\] Later UCP support via Merchant Center (secondary).\[43\] US only.\[46\] | None found. |
| **Meta AI** | Muse Spark shopping "pulls from creator content… users follow" (Retail Brew, April 2026).\[47\] | Shopping assistant announced at Shoptalk, 25 March 2026. One-tap checkout with PayPal and Stripe.\[48\]\[49\] | Only major agent that names creators as an input, but inside Meta's walled garden. |

**What the citation studies say.** Peec AI (30M sources) and Semrush both rank Reddit, YouTube and LinkedIn at or near the top of citations across engines.\[50\]\[51\] Citation shares are volatile. Semrush's 13-week study of 230,000+ prompts found ChatGPT citing Reddit in "close to 60% of prompt responses in early August" 2025, "collapsing to around 10% by mid-September." Semrush reported a further Reddit drop in August 2026, from 3.8% to 0.5% of ChatGPT citations. cloro found YouTube (19%), Reddit (19%) and RTINGS (16%) leading product-answer citations, with brand-owned domains barely registering.\[2\] LLM Pulse found 64.7% of generic shopping citations pointing at brand/manufacturer sites.\[9\] **The studies disagree on brand sites, but they agree that UGC and video beat retailers.** Every one of them is a vendor corpus of tracked prompts, not real sessions.

**Is there evidence creators measurably change what agents surface?** Only indirectly. YouTube is a top-three cited domain, and Meta names creator content as an input. I found no controlled study isolating a creator's recommendation as the cause of an agent recommendation. That gap is worth filling (see the experiment below).

**Bring-your-own sources.** Agents support memory, custom instructions and MCP connectors (Claude, ChatGPT apps). In principle, a buyer could connect a "my trusted creators" MCP tool. I found no agent that treats a user-held code or signed receipt as a ranking or attribution input. Honouring one today would mean the merchant's checkout accepting a code the agent passes along, which ACP and UCP attribution fields could carry.

**The inversion: selling picks to agents.**
- Cloudflare's Monetization Gateway charges "any caller for any resource… from an API to data to an MCP tool call." It is waitlist-only, with no pricing published.\[3\]\[17\]
- AWS CloudFront's x402 integration is generally available (InfoQ, July 2026).\[17\]
- In May 2026 Coinbase reported "over 169 million payments across 590,000 buyers and over 100,000 sellers" on x402. Caveat: Chainalysis attributes much of the late-2025 surge to PING meme-coin activity, and Artemis classed about half of observed transactions as self-dealing or wash trading.
- Cloudflare says AI-training crawls reached 52% of crawler requests in June 2026, and it is piloting pay-per-use with Ceramic.ai and You.com (trade press).\[15\]
- Perplexity's Comet Plus pays publishers by visits, citations and agent actions.\[4\]\[5\]
- Payouts reported so far are small: analysts estimate roughly $8–15 per 1,000 citations (secondary, unverified).\[52\]

**Judgement:** at creator scale, per-query revenue will be pocket change next to recurring SaaS commissions. It is still strategically valuable as a *signal*. A paid, signed tool call is proof that an agent consulted a named human, and that proof can be written into the Receipt.

**Agent-to-agent commerce.** AP2 mandates, Visa Intelligent Commerce and Mastercard Agent Pay issue scoped, tokenised credentials.\[13\]\[37\] They cover payment authority, not recommendation provenance. Creator provenance fits as an *input* the buyer's agent attaches to its intent: "the user asked for X because creator Y recommended it, receipt attached." That is exactly what the ACP and UCP attribution fields could carry.

**Conclusion:** the most likely path for the next 12–24 months is that agents turn creators into **cited, and sometimes paid, data sources**, while feed concentration routes around the long tail. Amplification happens only where the creator's claim is machine-readable and trustworthy. The Referral Receipt should therefore serve two audiences: the checkout (attribution) and the agent's evidence layer (citation/selection).

### Frontier 2 — Synthetic host-reads and AI voice ads

- **Who's doing it:**
  - Spotify's host-voice ad plans date from 2023 (Bill Simmons: "you have to obviously give the approval for the voice").\[53\] Claims of a 2026 "Voice Native Ads" product come from low-quality sources and are unverified.\[54\]
  - Acast publishes an "AI-driven ad production" page.\[55\]
  - iHeart markets the opposite: "No synthetic voices. No AI hosts."\[21\]
  - ElevenLabs' Iconic Marketplace (launched 11 November 2025) lists 28 consent-licensed voices, including Michael Caine. Matthew McConaughey uses his voice clone for Spanish editions of his newsletter.\[22\]\[56\]\[57\]
  - Supply is flooding in: Podcast Index data cited by Ashley Carman in Bloomberg's Soundbite (30 April 2026) found 4,243 of 10,871 new feeds (39%) over nine days showed signs of AI generation.
- **Performance and trust:** I found no independent, peer-reviewed comparison of synthetic vs human host-reads. Claims that AI audio ads match human voiceovers come from vendor-adjacent sources.\[58\] Ad Results Media warns of the "uncanny valley" eroding trust.\[59\] **Treat performance parity as unproven.**
- **Rules now in force:**
  - **EU AI Act Art. 50:** applies from 2 August 2026,\[6\] untouched by the Digital Omnibus (political agreement 7 May 2026; Parliament 16 June; Council 29 June). The Art. 50(2) machine-readable marking grace period runs to 2 December 2026 for systems already on the market. The Commission adopted final Art. 50 guidelines on 20 July 2026. Penalties are up to €15M or 3% of turnover.\[60\]\[61\]\[62\]\[63\]
  - **New York GBL §396-b:** effective 9 June 2026; $1,000 for a first violation, $5,000 after. It *excludes* digital replicas of identifiable people, and one law firm reads it as exempting audio-only ads. A cloned creator voice therefore falls mainly under right-of-publicity law, such as NY Civil Rights Law §50-f for deceased performers, not this disclosure law.\[64\]\[65\]\[66\]\[67\]
  - **California SB 942:** operative 2 August 2026 via AB 853. It covers generative-AI providers with more than 1M monthly users (detection tools and latent disclosures), with platform duties from 1 January 2027.\[68\]\[69\]\[70\]
  - **Tennessee ELVIS Act:** in force since 1 July 2024.
  - **Not re-verified this pass:** the NO FAKES Act's federal status, and any new FTC guidance specific to AI endorsements. The FTC's Endorsement Guides and its 2024 rule against fake reviews (which reaches AI-generated testimonials) still apply.
  - **Canada:** Ad Standards' October 2025 influencer guidelines ask for disclosure of AI-generated or significantly altered content (#MadeWithAI). The Competition Bureau's 2026–27 plan lists AI alongside deceptive marketing (secondary).\[71\]\[72\]
- **Could the Endorsement Ledger be the consent record?** Yes, and it is a natural fit. Every regime above turns on consent (ELVIS, right of publicity, the ElevenLabs licence model), disclosure (Art. 50, NY, Ad Standards) and truthfulness of the endorsement (FTC, Competition Act). The Ledger already stores approval, basis and the rendered disclosure. Add three fields: `voice: synthetic|human`, the voice-licence reference, and the Art. 50 marking method. I found nobody building "approved synthetic endorsement" provenance that ties the endorsement text, the creator's approval and the synthetic-voice licence into one record. The niche is open, but so is the question of demand.

### Frontier 3 — Measurement without tracking

- **Standards status:**
  - W3C Attribution Level 1 (formerly PPA, from Mozilla and Meta, with Google editors joining) is a Working Draft: local matching, aggregation service, differential-privacy noise.\[73\]\[74\]\[75\]\[76\]
  - Google retired the Attribution Reporting API, Topics and Protected Audience on 17 October 2025, and says it will work on the W3C Attribution standard instead.\[24\]\[77\]
  - Apple's AdAttributionKit keeps expanding (configurable windows and cooldowns, per WWDC25; vendor sources).\[78\]\[79\]
  - IETF DAP: draft-19 (6 July 2026), blocked on VDAF (draft-19, 14 April 2026).\[25\]\[80\]
  - Divvi Up is live, with a July 2026 post titled "Production Multi-Party Computation Is Here." Firefox uses it for telemetry.\[81\]
  - Cloudflare Daphne's README says the server and worker crates "are not intended for general use." It was reportedly archived on 3 June 2026 (not confirmed).\[27\]\[28\]
- **Can a small company use DAP?** Technically yes: Ancaster as one aggregator (Janus, Rust) and Divvi Up as the non-colluding second.\[28\]\[82\] But DAP pays off when many *clients* report sensitive per-user facts. Ancaster's save → redeem → purchase funnel mostly produces *merchant-side* events Ancaster already sees in aggregate (codes, network reports, Shopify orders).
- **Cloudflare architecture, for when it makes sense:**
  1. The buyer's page or wallet pass runs libprio (WASM) and splits a one-hot "saved-from-creator-X" vector into two shares.
  2. A Worker (the leader, using Queues and D1 for batches) forwards one share to Divvi Up (the helper).
  3. The collector gets only DP-noised per-creator totals once a minimum batch is reached.
- **Cheaper frontier now:** add differential-privacy noise and minimum-count thresholds to the reports Ancaster already generates. Pair that with **geo-lift / synthetic-control** tests at creator scale (e.g., promote a code only in certain episodes or regions and compare brand-search and direct-traffic lift). This measures the 70–85% of conversions codes miss without identifying anyone. Haus's 2026 Marketing Decision Confidence Index (500 US senior decision-makers, surveyed January 2026, via eMarketer) found 60% trust independent incrementality testing most, against 40% for MMM and 37% for in-platform reporting.

### Frontier 4 — Rails the Receipt could ride on

| Rail | Adoption (2025–26) | Solo-dev effort | Strategic value without OpenAI/Google permission |
|---|---|---|---|
| **Own domain: JWS + /.well-known + schema.org JSON-LD** | Universal; agents crawl it | Days | **High.** Agents and citation engines read it; no gatekeeper. |
| **C2PA / CAWG** | Pixel 10 signs every photo (Assurance Level 2, September 2025).\[83\]\[84\] YouTube shows "Captured with a camera" for C2PA v2.1+.\[85\] TikTok reports 3B+ videos labelled and joined the C2PA Steering Committee (July 2026).\[86\]\[87\] LinkedIn shows a "CR" icon; Meta reads C2PA for AI labels (secondary).\[88\]\[89\] Nikon's Z6III signing was suspended in September 2025 after an exploit.\[90\]\[91\] | Weeks (c2pa-rs) | **Medium-low for sponsorship.** No standard sponsorship assertion exists; CAWG's "Endorsement Assertion" means something else.\[92\] A custom assertion carrying the receipt hash is possible, but no platform would display it.\[93\] |
| **Podcasting 2.0** | `podcast:txt`, `funding`, `value`, `socialInteract` are adopted tags; 23 apps list funding support.\[94\]\[95\] | Days | **Medium.** `podcast:txt` (purpose-tagged) can carry a receipt URL or hash per episode *today*, no proposal needed.\[96\] A formal `podcast:recommendation` tag would take the GitHub proposal process. |
| **AT Protocol** | Custom lexicons work in production (WhiteWind `com.whtwnd.blog`, Smoke Signal, Frontpage `fyi.unravel.frontpage`).\[97\]\[98\] Bluesky doesn't render foreign lexicons.\[99\] | Days–weeks | **Medium-high.** A `com.ancaster.receipt` record in the creator's PDS is signed by the creator's DID repo, portable, and firehose-indexable. Good as a mirror, not a primary. |
| **W3C VC 2.0 / DIDs** | Recommendation 15 May 2025 (seven specs, including JOSE/COSE securing)\[100\] | Days (JOSE) | **High for form.** Model the Receipt as a VC secured with JOSE so it is standards-shaped, with `did:web` = the creator's domain. It also defends against AI clones: only the domain key signs. |

## Recommendations

**Which frontier matters most:** #1, by a wide margin. It decides whether creator recommendations are *seen* at the moment of choice. #2 is a feature (Ledger fields), #3 is a later credibility upgrade, and #4 is the means of carrying the Receipt.

**What changes the pass-six plan:**
- *Threat:* feed-first selection and merchant concentration. A receipt that lives only inside ACP/UCP checkout attribution arrives *after* the agent has already chosen from feeds.
- *Opportunity:* checkout is back on merchant sites (codes survive), and agents now pay for tool calls. Make the Receipt a **public, fetchable, citable evidence object** as well as an attribution payload.

**McLuhan tetrad: the AI agent as the new audience for recommendations**
- **Enhances:** the explicit, structured claim ("used for 6 months; sponsored"); comparison at machine scale; the *basis* of a recommendation.
- **Obsolesces:** the SEO listicle, the tracked click as proof, the affiliate cookie, and the ten-link results page.
- **Retrieves:** the letter of introduction; the shopkeeper's word of mouth; the named, commissioned salesman whose reputation travels with the sale; the credentialed critic.
- **Reverses into (when pushed to the limit):** a sealed shelf. Feed concentration (top-10 stores 22.5% → 41.8%), sponsored slots and "podslop" synthetic word of mouth make every recommendation suspect. The signed human voice then becomes scarce and valuable again: "Trust, carried."

**The 30-day experiment: "Receipts that agents can read" on Workers**
1. For 3–5 beachhead creators, publish `/.well-known/referral-keys` (JWKS) and serve each offer page with schema.org `Product` + `Review` JSON-LD. Include the endorsement text, basis, disclosure, and the Receipt as a VC-shaped compact JWS.
2. Expose a remote MCP server on Workers/Durable Objects: `get_creator_picks(topic)` and `verify_receipt(code)`. Put a paid tier behind x402 via the Agents SDK. Join the Monetization Gateway waitlist.
3. Mirror each receipt hash into `podcast:txt` on the creator's feed and into a `com.ancaster.receipt` AT Protocol record.
4. Measure over 30 days:
   - which bots and agents fetch it (Web Bot Auth signatures, user agents)
   - whether ChatGPT, Perplexity, Gemini and Claude *quote the basis or disclosure* for 50 tracked prompts, before vs after
   - code redemptions arriving with AI referrers
   - any paid tool calls

   Success = at least one engine quotes a receipt field, or measurable citation lift. Failure is also informative: it tells Chris to push through ACP/UCP instead.

**Decisions (options, one recommended, plus a default)**

1. **Where to put the next quarter's build time**
   - A) Agent-readable Receipts + MCP/x402 picks. **← Recommended**
   - B) Synthetic host-read consent product.
   - C) DAP measurement pilot.
   - *Decide for me:* A.
2. **Primary Receipt carrier**
   - A) Creator-domain VC/JWS + JSON-LD, mirrored to AT Protocol and `podcast:txt`. **← Recommended**
   - B) AT Protocol-first.
   - C) C2PA custom assertion.
   - *Decide for me:* A. Add C2PA only if a platform ever displays sponsorship assertions.
3. **Synthetic reads**
   - A) Extend the Ledger into a consent-and-disclosure record (voice type, licence reference, Art. 50/NY marking) but don't generate voices. **← Recommended**
   - B) Partner with a voice vendor to generate reads.
   - C) Ignore.
   - *Decide for me:* A. It is two weeks of schema work, and it positions the Ledger as the compliance artefact regardless of who synthesises.
4. **Measurement**
   - A) DP-noised, thresholded aggregate reports plus creator-scale geo/episode holdouts now. **← Recommended**
   - B) Divvi Up DAP pilot.
   - C) Wait for W3C Attribution.
   - *Decide for me:* A. Revisit B when DAP becomes an RFC.
5. **Agent-query revenue**
   - A) Pilot paid picks as a complement and write paid calls into Receipts. **← Recommended**
   - B) Pitch it as a commission replacement.
   - C) Skip.
   - *Decide for me:* A, priced at cents, framed as provenance rather than income.

## Caveats

- **Vendor data:** agent-selection evidence comes from vendor prompt-tracking corpora (Profound, LLM Pulse, cloro, Semrush, Peec AI), not real shopper sessions. OpenAI has not confirmed the July 2026 feed shift.\[1\]
- **Secondary-only claims:** ChatGPT Ads pricing and pixel details, Perplexity's reported ad retreat, Copilot's UCP support, Spotify "Voice Native Ads," the AI-podcast-feed share, and the Daphne archive date.
- **Vendor-claimed results:** Anthropic's 35% basket and 60% completion figures.\[38\]
- **Not verified this pass:** NO FAKES Act status, any new FTC AI-endorsement guidance, and per-tag app support in Podcasting 2.0.
- **No evidence found** that any agent honours user-held creator codes, or that synthetic host-reads match human performance. Both remain open questions, not negatives.

## Sources

1. [ChatGPT shopping now leans on product feeds](https://www.relevantaudience.com/ecommerce-marketing/chatgpt-shopping-product-feeds-profound-research/)
2. [AI Shopping: What ChatGPT Recommends (Data Study) | cloro](https://cloro.dev/blog/ai-shopping-chatgpt-recommends/)
3. [Announcing the Monetization Gateway: charge for any resource behind Cloudflare via x402 | Cloudflare Blog](https://blog.cloudflare.com/monetization-gateway/)
4. [Perplexity's \$200M Raise and Comet Plus 80/20 Split: The First Real Agent-Economy Payout Model for Lead-Gen Publishers](https://www.leadgen-economy.com/blog/perplexity-comet-200m-comet-plus-publisher-revenue-share/)
5. [Perplexity Launches Comet Plus, Shares Revenue With Publishers](https://www.searchenginejournal.com/perplexity-launches-comet-plus-shares-revenue-with-publishers/554596/)
6. [C2PA Content Credentials: What They Are and How to Remove Them | MetaClean](https://metaclean.app/blog/c2pa-content-credentials-explained)
7. [draft-ietf-ppm-dap-19](https://datatracker.ietf.org/doc/html/draft-ietf-ppm-dap)
8. [draft-thomson-ppm-dap-attribution-01 - Datatracker](https://datatracker.ietf.org/doc/html/draft-thomson-ppm-dap-attribution-01)
9. [Where AI Actually Sends Shoppers: Amazon Barely Exists in ChatGPT - LLM Pulse](https://llmpulse.ai/blog/where-ai-sends-shoppers/)
10. [ChatGPT Product Recommendations: How to Make Sure You Are One in 2026](https://blog.hubspot.com/marketing/chatgpt-product-recommendations)
11. [Why ChatGPT Instant Checkout Failed — Lessons from Walmart's 3x Lower Conversion Rate | Stellagent](https://stellagent.ai/insights/chatgpt-instant-checkout-failure-lessons)
12. [Why AI Checkout Stalled: Discover in AI, Buy on Site](https://www.digitalapplied.com/blog/ai-agentic-commerce-discover-in-ai-buy-on-site-2026)
13. [Anthropic Unveils Claude Commerce Agents, Partners With Visa And Mastercard | Crowdfund Insider](https://www.crowdfundinsider.com/2026/09/306341-anthropic-unveils-claude-commerce-agents-partners-with-visa-and-mastercard/)
14. [Under the Hood: Universal Commerce Protocol (UCP) - Google Developers Blog](https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/)
15. [Cloudflare to Charge AI Crawlers | SaaS News](https://www.saasrise.com/news/cloudflare-to-charge-ai-crawlers-ending-free-webdata-access-f2d61c36-b503-46cc-b0b3-65a1afe80e6e)
16. [What is Cloudflare pay per crawl, and what does it mean for publishers? — Blankspace](https://blankspace.so/blog/what-is-cloudflare-pay-per-crawl-publishers/)
17. [Cloudflare and AWS Embed x402 Agent Payments at the Edge - InfoQ](https://www.infoq.com/news/2026/07/cloudflare-aws-x402-micropayment/)
18. [Perplexity's 2026 Publisher Program: What It Means for Content Creators | Digital Strategy Force](https://digitalstrategyforce.com/journal/perplexitys-2026-publisher-program-what-it-means-for-content-creators/)
19. [PayPal Uses Access to Perplexity’s Comet Browser to Boost Subscriptions | PYMNTS.com](https://www.pymnts.com/artificial-intelligence-2/2025/paypal-offers-early-access-to-perplexitys-comet-browser/)
20. [How Perplexity’s new revenue model works, according to its head of publisher partnerships](https://digiday.com/media/how-perplexity-new-revenue-model-works-according-to-its-head-of-publisher-partnerships/)
21. [The State of Podcasting 2026: What Advertisers Need to Know](https://www.iheartmedia.com/advertise/insights/articles/the-state-of-podcasting)
22. [ElevenLabs Launches AI Voice Licensing Marketplace - Radio World](https://www.radioworld.com/columns-and-views/guest-commentaries/elevenlabs-launches-ai-voice-licensing-marketplace)
23. [Google Killed Privacy Sandbox: What Actually Changes for Cookie Consent in 2026 | Secure Privacy Blog](https://secureprivacy.ai/blog/google-killed-privacy-sandbox-what-changes-for-cookie-consent-in-2026)
24. [Update on Plans for Privacy Sandbox Technologies - Google](https://privacysandbox.google.com/blog/update-on-plans-for-privacy-sandbox-technologies)
25. [History for draft-ietf-ppm-dap -19](https://datatracker.ietf.org/doc/draft-ietf-ppm-dap/history)
26. [Production Multi-Party Computation via the Distributed Aggregation Protocol | USENIX](https://www.usenix.org/conference/pepr26/presentation/geoghegan)
27. [GitHub - cloudflare/daphne: Implementation of DAP · GitHub](https://github.com/cloudflare/daphne)
28. [GitHub - Deln0r/dap-go: Pure-Go implementation of the IETF Distributed Aggregation Protocol (DAP, drafts 18 and 19) for privacy-preserving measurement. Helper interoperates with Janus (Prio3Count smoke). · GitHub](https://github.com/Deln0r/dap-go)
29. [ChatGPT With Ads in 2026: End of Neutral Advisor | Deep Marketing](https://www.deepmarketing.it/en/blog/chatgpt-ads-end-of-impartial-ai-advisor-2026)
30. [The Answer Engine Battles: Navigating the ChatGPT Ad Rollout](https://www.monks.com/articles/answer-engine-battles-navigating-chatgpt-ad-rollout)
31. [ChatGPT ads are live: A complete breakdown - Launchcodex](https://launchcodex.com/blog/performance-marketing/chatgpt-ads-breakdown/)
32. [ChatGPT Ads 2026: Complete Setup Guide & Creative Strategies](https://www.get-ryze.ai/blog/chat-gpt-ads)
33. [ChatGPT Ads 2026: Complete Guide to OpenAI’s Sponsored Recommendations – Marketing Agent Blog](https://marketingagent.blog/2026/03/30/chatgpt-ads-2026-complete-guide-to-openais-sponsored-recommendations/)
34. [New tech and tools for retailers to succeed in an agentic shopping era](https://blog.google/products/ads-commerce/agentic-commerce-ai-tools-protocol-retailers-platforms/)
35. [Google Shopping introduces Universal Cart, agentic shopping](https://blog.google/products-and-platforms/products/shopping/google-shopping-cart/)
36. [How Often Does ChatGPT Cite Reddit? 2026 Data | Readyt](https://www.readyt.ai/blog/how-often-does-chatgpt-cite-reddit/)
37. [Anthropic Gave Claude a Shopping Brain. It Deliberately Left Out the Wallet. – Forkast](https://forkast.news/anthropic-gave-claude-a-shopping-brain-it-deliberately-left-out-the-wallet/)
38. [Anthropic launches Claude commerce blueprint for retailers](https://e-commerce.news/story/anthropic-launches-claude-commerce-blueprint-for-retailers)
39. [Building Commerce Agents with Claude | Claude by Anthropic](https://claude.com/blog/claude-for-commerce-agents)
40. [Amazon pushes Alexa deeper into AI shopping with Rufus integration](https://www.axios.com/2026/05/13/amazon-alexa-ai-shopping-assistant)
41. [Alexa for Shopping (formerly Amazon Rufus) 2026: How Amazon's AI Assistant Recommends Products](https://www.amalytix.com/en/knowledge/ai/amazon-rufus-guide-2026/)
42. [Amazon replaced Rufus with Alexa for Shopping | Prime Team Agency](https://www.primeteam.agency/blog/amazon-replaced-rufus-with-alexa-for-shopping)
43. [Microsoft Copilot Shopping Update: UCP, Mobile Checkout & Loyalty](https://windowsforum.com/news/microsoft-copilot-shopping-update-adds-ucp-mobile-checkout-loyalty-and-woocommerce.414597/)
44. [Microsoft and PayPal Launch Copilot Checkout for In-Chat Purchases - gHacks Tech News](https://www.ghacks.net/2026/01/09/microsoft-and-paypal-launch-copilot-checkout-for-in-chat-purchases/)
45. [Microsoft Announces Copilot Checkout at NRF 2026, Enabling In-AI Purchases with Stripe, PayPal, and Shopify | Stellagent](https://stellagent.ai/insights/microsoft-copilot-checkout-nrf-2026)
46. [Microsoft Copilot Checkout Launches | Visby Blog](https://visby.ai/blogs/microsoft-copilot-checkout-launches)
47. [Meta introduces new shopping upgrades under AI model Muse Spark](https://www.retailbrew.com/stories/2026/04/16/meta-introduces-new-shopping-upgrades-under-ai-model-muse-spark)
48. [Meta bets on AI and creators to drive social commerce](https://www.contentgrip.com/meta-ai-shopping-creators/)
49. [Meta Brings AI Shopping to Instagram and Facebook](https://sqmagazine.co.uk/meta-ai-shopping-instagram-facebook/)
50. [AI search engines cite Reddit, YouTube, and LinkedIn most: Study](https://searchengineland.com/ai-search-engines-cite-reddit-youtube-and-linkedin-most-study-473138)
51. [The Most-Cited Domains in AI: A 3-Month Study](https://www.semrush.com/blog/most-cited-domains-ai/)
52. [Perplexity Publisher Program - Tech Jacks Solutions](https://techjacksolutions.com/ai-tools/perplexity/perplexity-publisher-program/)
53. [techcrunch.com](https://techcrunch.com/?p=2547837)
54. [How AI-Powered Audio Ads on Spotify Are Changing the Podcast Advertising Game](https://www.imarkinfotech.com/how-ai-powered-audio-ads-on-spotify-are-changing-the-podcast-advertising-game/)
55. [Introducing AI-driven ad production](https://advertise.acast.com/news-and-insights/ai-ad-production)
56. [ElevenLabs Launches Iconic Voice Marketplace | Camphouse](https://camphouse.io/news/elevenlabs-iconic-voice-marketplace-launch)
57. [ElevenLabs Iconic Voice Marketplace Launches](https://www.genmedialab.com/news/elevenlabs-iconic-voice-marketplace/)
58. [AIs Talk About Podcasting | iHeart](https://www.iheart.com/podcast/53-ais-talk-about-podcasting-277287924)
59. [From Automation to Augmentation: How AI is Enhancing, Not Replacing Host-Read Podcast Ads - Ad Results Media From Automation to Augmentation in Host-Read Advertising](https://www.adresultsmedia.com/news-insights/ai-and-host-read-audio-advertising/)
60. [EU AI Act Deal: Digital Omnibus Now in Force](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/)
61. [EU AI Act News: Digital Omnibus on AI, New Guidance on Risk Classification, GPAI, and Transparency Obligations | Insights | Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2026/07/eu-ai-act-news-digital-omnibus-on-ai-new-guidance-on-risk-classification-gpai-and-transparency-obligations)
62. [The EU AI Act’s Transparency Rules: A Practical Guide to Article 50 | EU Artificial Intelligence Act](https://artificialintelligenceact.eu/transparency-rules-article-50/)
63. [EU AI Act Digital Omnibus Delay Explained: What Moved to 2027, What's In Force Now, and the Enterprise Strategy](https://www.theaienterprise.io/p/eu-ai-act-omnibus-reprieve-strategy)
64. [New York Enacts 'Synthetic Performer' Disclosure Law for ...](https://www.cooley.com/news/insight/2026/2026-01-29-new-york-enacts-synthetic-performer-disclosure-law-for-advertisements-including-those-using-generative-ai)
65. [New York State Legislature’s Preliminary Response to AI: Disclosure of “Synthetic Performers” in Advertising and Expanded Prohibitions on “Digital Replicas” of Deceased Performers](https://www.msk.com/newsroom-alerts-3114)
66. [Fake performer, real penalty: What advertisers need to know before June 9 | ReedSmith](https://www.reedsmith.com/our-insights/blogs/viewpoints/102n129/fake-performer-real-penalty-what-advertisers-need-to-know-before-june-9/)
67. [New York Now Requires Ads to Disclose AI-Generated Performers | Sigma Law Group | Sigma Law Group](https://sigmalawgroup.com/blog/2026-07-01-ny-synthetic-performer-disclosure/)
68. [SB 942 Now in Effect: Not Jan. 1, 2026 — CASRAI](https://casrai.org/news/california-sb-942-ai-transparency-act-effective-august-2026)
69. [California SB 942: The AI Transparency Act and Why It Matters for SNFs — Clearpol](https://clearpol.com/sb-942)
70. [California AI Transparency Act (SB 942): Effective Aug. 2, 2026 | AI Compliance Atlas](https://aicomplianceatlas.com/law/california-sb-942)
71. [Canadian Code of Advertising Standards for Influencer Marketing: Key Clauses and Application to AI-Generated Content and Influencers | Bennett Jones](https://www.bennettjones.com/Insights/Blogs/Canadian-Code-of-Advertising-Standards-for-Influencer-Marketing)
72. [AI Advertising Laws Around the World: What Brands Need to Know in 2026](https://billo.app/blog/ai-advertising-laws/)
73. [Inside the Debate Over the W3C Attribution API](https://news.marketecture.tv/p/inside-the-debate-over-the-w3c-attribution-api)
74. [Privacy-Preserving Attribution: Level 1](https://www.w3.org/TR/2025/WD-privacy-preserving-attribution-20250616)
75. [Privacy-Preserving Attribution: Level 1](https://www.w3.org/TR/2025/WD-privacy-preserving-attribution-20250422)
76. [Google Pulls The Plug On Topics, PAAPI And Other Major Privacy Sandbox APIs (As The CMA Says ‘Cheerio’) | AdExchanger](https://www.adexchanger.com/privacy/google-pulls-the-plug-on-topics-paapi-and-other-major-privacy-sandbox-apis-as-the-cma-says-cheerio/)
77. [Google is retiring Privacy Sandbox - BetaNews](https://betanews.com/2025/10/20/google-is-retiring-privacy-sandbox/)
78. [WWDC 2025: 5 great updates for Apple’s AdAttributionKit, but there’s a catch](https://www.singular.net/blog/wwdc-2025-aak/)
79. [WWDC 2025 AdAttributionKit Update: 6 Major Improvements](https://segwise.ai/blog/wwdc-2025-adattributionkit-update-6-improvements-catch)
80. [draft-irtf-cfrg-vdaf-19 - Verifiable Distributed Aggregation Functions](https://datatracker.ietf.org/doc/draft-irtf-cfrg-vdaf/)
81. [Blog](https://divviup.org/blog/)
82. [Divvi Up (ISRG) · GitHub](https://github.com/divviup)
83. [How Pixel and Android are bringing a new level of trust to your images with C2PA Content Credentials](https://blog.google/security/pixel-android-trusted-images-c2pa-content-credentials/)
84. [Google Pixel 10 C2PA Content Credentials: What It Means for Photo Authenticity | C2PA Viewer](https://c2paviewer.com/articles/google-c2pa-pixel-10)
85. ['Captured with a camera' disclosure - YouTube Help](https://support.google.com/youtube/answer/15446725?hl=en)
86. [Helping people spot and understand AI-generated content on TikTok - Newsroom | TikTok](https://newsroom.tiktok.com/helping-people-spot-and-understand-ai-generated-content-on-tiktok?lang=en-GB)
87. [C2PA Welcomes TikTok to Steering Committee, Advancing the Adoption of Content Credentials at a Global Scale](https://www.prnewswire.com/news-releases/c2pa-welcomes-tiktok-to-steering-committee-advancing-the-adoption-of-content-credentials-at-a-global-scale-302836730.html)
88. [AI Watermarking vs Metadata vs Fingerprinting: C2PA & Content Credentials Explained (2026)](https://aibuzz.blog/ai-watermarking-vs-metadata-vs-fingerprinting/)
89. [Content Credentials (C2PA): AI Labeling on Platforms](https://www.makeinfluence.com/en/academy/content-credentials-c2pa-how-platforms-label-ai-assisted-content)
90. [Nikon Suspends C2PA Functionality on the Z6 III Due to Authentication Issue | PetaPixel](https://petapixel.com/2025/09/05/nikon-suspends-c2pa-functionality-on-the-z6-iii-due-to-authentication-issue/)
91. [Nikon Cameras C2PA Support: The Z6 III Vulnerability and Service Suspension | C2PA Viewer](https://c2paviewer.com/articles/nikon-cameras-c2pa)
92. [Endorsement Assertion :: Creator Assertions Working Group](https://cawg.io/endorsement/1.0-draft/)
93. [C2PA User Experience Guidance for Implementers :: C2PA Specifications](https://spec.c2pa.org/specifications/specifications/2.2/ux/UX_Recommendations.html)
94. [podcast-namespace/docs/1.0.md at main · Podcastindex-org/podcast-namespace](https://podcastindex.org/namespace/1.0)
95. [Funding - Podcast Namespace - Podcasting 2.0](https://podcasting2.org/docs/podcast-namespace/tags/funding)
96. [Podcasting 2.0 Explained - Everything podcasters need to know! | Captivate](https://www.captivate.fm/podcast-industry-news/podcasting-2-0-explained-rss-enhancements-independent-podcaster)
97. [GitHub - lexicon-community/awesome-lexicons: A collection of awesome lexicons · GitHub](https://github.com/lexicon-community/awesome-lexicons)
98. [AT Protocol - HandWiki](https://handwiki.org/wiki/AT_Protocol)
99. [Possibility of WhiteWind lexicon support? · bluesky-social/atproto · Discussion #2501](https://github.com/bluesky-social/atproto/discussions/2501)
100. [The Verifiable Credentials 2.0 family of specifications is now a W3C Recommendation | 2025 | News | W3C](https://www.w3.org/news/2025/the-verifiable-credentials-2-0-family-of-specifications-is-now-a-w3c-recommendation/)
