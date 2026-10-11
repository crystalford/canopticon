---
id: what-makes-an-attribution-paradigm-shift-and-whether-one-is-available-
title: "What Makes an Attribution Paradigm Shift — and Whether One Is Available to Ancaster in 2026"
kind: "Research"
topic: "Attention & feeds"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/archive-3/attribution-paradigm-shift-ancaster-2026.md"
---

# What Makes an Attribution Paradigm Shift — and Whether One Is Available to Ancaster in 2026

No shift on the scale of CPM→CPC→CPA is available for Ancaster to *cause* today. One is visibly forming, though: the billable unit is moving from "a human clicked or converted" to "an agent selected this, informed by these sources." The one missing piece is that no major agent platform yet emits verifiable, third-party-readable proof of what influenced its decision. Until that piece exists, signed receipts, VCs and server-side tracking make the old unit harder to tamper with. They do not create a new unit.

## TL;DR

- **What made the three historical shifts real:** each one billed on a new event closer to the buyer's actual goal (displayed → clicked → converted). Each also moved the counting of that event to a new party, which moved non-performance risk from buyer to seller. And each ran on infrastructure already deployed for other reasons (ad-server logs, redirects, cookies). New metrics that don't change the event being counted, or who counts it, are features.
- **What's actually new in 2026:** AI agents are becoming the party being persuaded, and the moment of persuasion now happens inside the agent's context window. That is a genuinely new unobserved event, which is the precondition for a real shift. Signed records (W3C VCs, AP2 mandates, Apple-signed SKAdNetwork postbacks) are real and deployed. But they only harden claims about events the old system could already see.
- **Verdict:** "not yet." The shift worth naming is **CPA → cost-per-attested-influence**: paying for a provable role in an agent's selection. It needs the agent platform to sign its own decision provenance. Standards for this exist on paper: ACP's `affiliate_attribution` extension (December 2025) and SPUR/OpenAttribution Content Telemetry v1.0 (September 2026). No agent platform has publicly confirmed using either. Ancaster's assets are well-placed receivers and verifiers for that event, but they cannot produce it.

## Key Findings

- **Every real shift answered a new question the buyer could never answer before.** CPM answered "was it served?", CPC "did anyone act on it?", CPA "did it make me money?" Each answer came from a newly positioned counter (an "oracle," meaning the party whose record of the event everyone accepts): the publisher's ad server, then the auction platform's click redirect, then the advertiser's own confirmation page.
- **Every real shift produced its own signature fraud.** Click fraud was CPC's; commission shaving and cookie stuffing were CPA's. The appearance of a new, characteristic fraud is a reliable sign that a new unit of value is real.
- **RTB was a different category.** It changed who prices an impression and when (per-impression auction instead of pre-negotiated rates). It did not change what gets verified. It is a market-mechanism shift, not a verification shift.
- **The post-cookie era produced patches, not a paradigm.** Chrome kept third-party cookies, and Google retired ten Privacy Sandbox APIs on October 17, 2025, including Attribution Reporting. What the industry runs today is the CPA model moved server-side (Meta CAPI, Enhanced Conversions) plus platform-signed, aggregated attribution on iOS (SKAdNetwork/AdAttributionKit).
- **Cryptographic signing is not new in attribution.** Apple has signed SKAdNetwork install postbacks since 2018, yet the measurement firm Singular warns that "a fraudulent media partner could just replay legitimate SKAdNetwork postbacks repeatedly." It also notes that conversion values are not covered by the signature. Signing tells you *who* made a claim, not *whether* it is true.
- **The agent-commerce protocols sign the transaction but not the decision.** AP2 mandates are W3C Verifiable Credentials that bind user intent to cart and payment. No deployed mandate records which sources persuaded the agent. Researchers Yedidel Louck, Amit Dvir and Ariel Stulman (arXiv 2609.11757) have shown that "ordinary product-description text can steer a shopping agent into forming a cart that passes every protocol check but no longer matches the user's request." Their three attacks succeeded 90%, 56% and 73.3% of the time against the Gemini Flash-Lite models that AP2's sample agents use by default.

## Part A — The Historical Diagnostic

### 1. CPM: the served impression becomes countable

**Timeline and enablers.** HotWired ran the first sold banner (AT&T) on October 27, 1994. AT&T paid $30,000 for a three-month placement, a flat fee rather than a per-impression price. The ad reportedly drew a 44% click-through rate. DoubleClick was founded in February 1996. Its DART line ("Dynamic Advertising, Reporting, and Targeting") made centrally served, logged impressions the standard. Industry histories credit ad-server tooling with the move from flat-fee sponsorships to CPM pricing.

**Before → after.** Before, a buyer paid for time on a page, borrowed from print and broadcast, and trusted circulation claims. After, the buyer paid per logged ad call.

**What became verifiable.** That the creative was actually served, and how many times, per a server log rather than an audited circulation estimate. Notably, not whether anyone saw it, and not whether anyone cared. The old complaint (commonly attributed to John Wanamaker) that half of ad spend is wasted but nobody knows which half survived CPM intact. CPM made waste countable, not identifiable.

**Risk.** It sat almost entirely with the advertiser. The publisher was paid for delivery regardless of outcome.

**Substrate.** HTTP servers with request logs and centralized third-party ad serving. Both existed for reasons unrelated to advertising economics.

### 2. CPC: the seller starts eating non-performance risk

**Timeline and enablers.** Jeffrey Brewer presented GoTo.com's pay-per-click, bid-for-placement model at TED in February 1998. By July 1998, advertisers were paying up to a dollar per click. Bill Gross framed it this way: "The whole point of Internet advertising, I thought, was accountability." Google launched AdWords on a CPM basis in October 2000. It switched to cost-per-click with AdWords Select in February 2002, under a generalized second-price auction, and began weighting bids by expected click-through rate later that year. That weighting meant the auction priced the probability of the verifiable event, not just the bid. GoTo was renamed Overture and sold to Yahoo in 2003. Google settled Overture's pay-per-click patent claims before its 2004 IPO; reported figures vary between about $260–290 million (Search Engine Watch's estimate) and about $360 million (later retellings).

**Before → after.** The buyer stopped paying for exposure and started paying for a user's affirmative act.

**What became verifiable.** That a human-seeming agent took an action in response to the ad. This is the first behavioural signal of interest, and it was captured by a redirect the platform controlled.

**Risk.** It flipped. An ad nobody clicked now cost the advertiser nothing, and the platform or publisher absorbed the cost of unengaging inventory.

**The new trust problem this created.** The *seller* now counted the billable event, which built a conflict of interest into the system. Click fraud was the result. Lane's Gifts & Collectibles sued in February 2005. In March 2006 Google agreed to a settlement capped at $90 million: up to $60 million in advertising credits and up to $30 million in fees. It covered invalid-click claims back to February 2002, and critics argued real click fraud ran into the billions. The dispute was never truly settled on the merits. It was absorbed by platform-run invalid-click filtering.

**Resistance.** Part of the TED audience hissed at the 1998 GoTo unveiling. Google's founders had earlier criticized ad-funded search as "inherently biased towards the advertisers." What overcame the resistance was measurable ROI for advertisers.

**Substrate.** Server-side redirects and query logs, plus a search box that expressed intent. The intent signal is what made clicks valuable enough to price.

### 3. Cookie/pixel conversion tracking and CPA: the advertiser becomes the oracle

**Timeline and enablers.** Performance referral predates the web banner. William Tobin's PC Flowers & Gifts paid referral commissions on Prodigy from 1989; Tobin filed a tracking patent in January 1996, and U.S. Patent 7,505,913 issued in 2009. CDNow's BuyWeb followed, then Amazon Associates in July 1996. Standard Amazon Associate links still use a 24-hour cookie window. Ad servers added conversion "activity" tags: DoubleClick's Floodlight counts conversions by last click, or by last impression when there was no click. Google tested its own CPA ad product and discontinued it in October 2008 in favour of DoubleClick's offering.

**Before → after.** The buyer stopped paying for a click and started paying for a completed sale, lead or signup.

**What became verifiable.** That money actually changed hands (or a qualified lead arrived), linked back to a specific referrer. This was the first time payment was tied to the buyer's own business outcome.

**Risk.** It moved almost entirely to the publisher or affiliate. The publisher now does the persuading and gets paid only if the merchant's checkout converts, and the merchant's own pixel or postback reports it.

**The new trust problem.** The mirror image of click fraud. Under CPC, the buyer had to trust the seller's count. Under CPA, the seller has to trust the buyer's count (shaving and unreported conversions), and everyone has to trust a cookie linking two moments. That produced the permanent disputes: attribution windows, last-click versus multi-touch, and cross-device gaps. Cookie stuffing became CPA's signature fraud.

**Substrate.** Browser cookies (a Netscape-era state mechanism built for sessions and carts, not ads), 1×1 image requests, and later server-to-server postback URLs. None were built for attribution; all were repurposed.

**How it eroded.** Safari and Firefox block third-party cookies by default. Apple made the App Tracking Transparency prompt mandatory with iOS 14.5 on April 26, 2021. In May 2021, Flurry Analytics (Verizon Media) found that only 4% of U.S. users allowed tracking, based on 2.5 million daily active iOS 14.5 users; the worldwide figure was 12%, from 5.3 million users. The cookie-plus-pixel substrate degraded on the platforms that matter most for conversion.

### 4. Real-time bidding: a market shift, not a verification shift

Right Media's exchange launched in 2005. Yahoo bought Right Media, Google bought DoubleClick, and Microsoft bought AdECN, all in 2007. OpenRTB began in November 2010 as a pilot among three demand-side and three sell-side platforms. It became an IAB standard with version 2.1 in January 2012, and major exchanges moved to first-price auctions in 2017–2019. An arXiv paper on first- and second-price display auctions (2312.00243) states that "in 2022, more than 90% of all digital display ad spend were transacted via real-time bidding," citing Yuen (2022) rather than measuring it.

RTB changed **who decides value and when**: each impression is priced individually, in milliseconds, by the buyer's algorithm using the buyer's data. It did **not** change what is verified. The billable unit was still the impression (or click, or conversion), measured by the same servers, pixels and cookies. The fair classification is a *market-mechanism* innovation, equal in economic scale to the three pricing shifts but a different kind of thing. It made existing verification units more liquid, and created supply-path opacity problems of its own: domain spoofing, which led to ads.txt, sellers.json and ads.cert.

### 5. Other candidates, assessed honestly

- **Multi-touch attribution (MTA):** a *modeling* layer over the same cookie-joined events. It changed how credit is divided, not what is verifiable. Not a shift.
- **Server-side conversion APIs:** Meta's Conversions API was introduced in 2020 and became Meta's recommended setup after ATT; Google Enhanced Conversions is the equivalent. These move the CPA postback from browser to server. Same event, same oracle (the advertiser), better survival rate. A patch.
- **Marketing-mix modeling's resurgence and incrementality testing:** a *retreat* from per-event verification to statistical inference. It is a principled answer to signal loss, but it gives up exactly what CPA delivered: a payable, per-event record.
- **Platform-signed attribution (SKAdNetwork, 2018 → AdAttributionKit):** Apple signs the ad and the install postback, and the network verifies with Apple's public key. It is the most important precedent for Ancaster, because it is a deployed, cryptographically attested attribution record at massive scale. Yet it did not create a new unit. It is a privacy-degraded CPA (delayed, coarse, crowd-anonymized), and Singular warns that "a fraudulent media partner could just replay legitimate SKAdNetwork postbacks repeatedly," and that the signature does not cover conversion values. Lesson: a signature from the oracle raises integrity but does not change what is observed.
- **Blockchain ad verification:** MetaX unveiled adChain in March 2017. IAB Tech Lab ran a blockchain pilot with Lucidity, MetaX, Kochava and FusionSeven in July 2018. By 2020 the trade press summary (AdMonsters) was that blockchain "was first hyped as a kind of 'cure-all' solution for digital advertising's problems. But that was never realistic." None became an industry substrate. They recorded the same events on a shared ledger, which changes who holds the log, not what the log can know. This research pass did not gather reliable current adoption data for Brave/BAT; the absence of BAT from any major 2025–2026 measurement discussion is itself informative, but it is not proof.
- **ads.cert:** IAB Tech Lab's signed-bid-request beta (November 2018) "never was released as a standard." ads.cert 2.0 (September 2021) re-scoped the effort to authenticated server-to-server connections. It is a good example of cryptographic integrity work that is technically sound and adopted slowly, because it hardens an existing unit rather than creating a new payable one.

### The diagnostic: paradigm shift vs. feature

In this domain, an innovation is a paradigm shift only if **all six** conditions hold:

1. **New billable event.** Payment attaches to an event closer to the buyer's real objective, one that previously could not be observed at all.
2. **New oracle.** A party newly positioned to observe that event becomes the accepted counter, and the old counter loses that role.
3. **Risk transfer.** Non-performance risk visibly moves along the chain, usually from buyer toward the party doing the persuading.
4. **Substrate that already exists.** The enabling infrastructure is already deployed for other reasons. Shifts ride existing rails; they don't wait for new ones.
5. **Pricing mechanism follows.** A market mechanism emerges to price the new unit (GoTo/GSP auctions for clicks, commission schedules for actions).
6. **Signature fraud.** A new, characteristic fraud and dispute class appears around the new unit.

**Quick test.** Ask: *"After this, what can the payer know that no one could know before, and who is now trusted to report it?"* If the answer is "the same event, more reliably, securely or privately," it is a feature or a patch, however sophisticated. CAPI, SKAdNetwork, MTA, blockchain ledgers, ads.cert and VC-signed receipts all fall in this category.

## Part B — The 2026 Substrate Check

### 1. Verifiable credentials and signed receipts

What a signed, third-party-verifiable record adds is real:

- **Non-repudiation:** the issuer cannot later deny the claim.
- **Portability:** any party can verify it without querying, or trusting, the issuer's database.
- **Tamper-evidence** in transit.
- **Auditability after the fact** by parties who weren't present.

These properties matter for dispute resolution, and they are exactly what AP2 builds on.

What it does **not** add is a new observable. A VC receipt for a conversion is still the merchant (or a processor) attesting to the merchant's own sale, the same oracle as a CPA postback. It makes shaving *provable after the fact*, which raises the cost of lying. It does not let anyone see what they previously couldn't. SKAdNetwork is the proof case: Apple-signed postbacks have existed since 2018, and they became a degraded CPA, not a new paradigm. **Verdict: a meaningful integrity upgrade to the CPA unit. By itself, not a shift.** The exception, developed below, is when the *signer* is the party that controls a previously unobservable event.

### 2. AI agents transacting on behalf of humans

**Verified current state (September 2026):**

- **ACP (OpenAI + Stripe).** Launched with ChatGPT Instant Checkout in late September 2025. Its changelog records an "Affiliate Attribution extension" in release 2025-12-12. The spec defines an optional, write-only `affiliate_attribution` object "for crediting third-party publishers," with `provider`, `publisher_id`, `token`, a `source.url` ("Canonical content URL"), and `touchpoint: first|last` to "enable multi-touch attribution models." On March 24, 2026, OpenAI said "the initial version of Instant Checkout did not offer the level of flexibility that we aspire to provide," and began letting merchants use their own checkouts while ChatGPT focuses on discovery. Its merchant page now says purchases "are completed on merchant-owned websites or apps." This research found **no OpenAI statement that ChatGPT populates `affiliate_attribution`**.
- **UCP (Google + Shopify and partners).** Announced January 11, 2026 at NRF. Cart and catalog capabilities followed in March, and Universal Cart was announced May 20, 2026 at Google Marketing Live. A core `attribution` field, merged May 5, 2026, carries UTM/click-ID-style context ("source," "medium," "campaign," "click_id"). According to a third-party analysis of the merged change, UCP "does not prescribe attribution windows, models, or assignment logic." There is **no dedicated publisher-credit field**.
- **AP2 (Google, announced September 16, 2025, 60+ partners).** Intent, Cart and Payment Mandates expressed as W3C Verifiable Credentials, signed with ECDSA P-256. AP2 is explicitly about "verifiable intent, not inferred action": proving the *user authorized* the purchase. A September 2026 arXiv paper by Louck, Dvir and Stulman, titled "Signing the Transaction but Not the Decision," shows that "ordinary product-description text can steer a shopping agent into forming a cart that passes every protocol check but no longer matches the user's request." The attacks succeeded 90%, 56% and 73.3% of the time on AP2's default Gemini Flash-Lite sample agents. Put differently, the selection step is unsigned and manipulable.
- **Microsoft Copilot Checkout (on UCP).** Microsoft states that "Microsoft does not take a commission or affiliate fee." **Amazon** uses neither ACP nor UCP.
- **IAB Tech Lab AAMP.** Roadmap January 6, 2026; named February 26, 2026; AAMP 3.0 with OpenProposal announced September 22, 2026 (public comment through October 22, 2026). AAMP standardizes agents *buying media*, not crediting the sources that influenced a consumer agent's purchase.
- **SPUR Coalition / OpenAttribution Content Telemetry.** SPUR was founded by the BBC, FT, Guardian, Sky News and Telegraph. Content Telemetry defines five events: retrieved, grounded, cited, presented, engaged. Draft v0.1 opened for comment June 12, 2026, and OpenAttribution lists v1.0 as published September 2, 2026. Its own documentation is candid: retrieval events "flow today, with no cooperation from the AI agent," while grounding, citation, presentation and engagement "needs the agent to report it." Click-token lookup "returns 404 unless the agent that issued the token has enabled" sharing, and both opt-ins default to false. **No AI agent platform has publicly adopted it.** TollBit, Redpine and MonetizationOS have said they plan to implement, which is intent, not adoption.
- **Closed publisher-pay programs exist inside single platforms.** Perplexity's Comet Plus (announced August 25, 2025) gives publishers 80% of revenue from an initial $42.5 million pool, split by visits, citations and agent actions. ProRata's Gist pays 50% by contribution share. Neither is a cross-platform standard.
- **The measured gap.** Partnerize's 2026 Zero-Click Commerce Index, published July 14, 2026 from April 2026 data across six U.S. consumer categories, puts publisher influence in Google AI Overviews at an average 3.84× what click-based affiliate tracking captures. Category scores range from 1.54× (Consumer Audio) to 10.94× (Luxury Fashion). Partnerize concludes that last-click attribution "is capturing less than 30% of the publisher-influenced purchase activity." That is a proprietary metric, and as trade coverage notes, it does not mean 3.84× more revenue.

**Interpretation.** This is the first time since 2002 that the *persuaded party* has changed. The decisive event — which sources the agent grounded on and cited, and why it chose product A over B — happens inside a model context that neither the publisher nor the merchant can observe. That meets diagnostic condition 1 (a new, previously unobservable event close to the buyer's objective). It fails condition 2: the only possible oracle is the agent platform, and no platform has publicly committed to reporting that event to third parties. It also fails condition 5, since there is no pricing mechanism for influence, and condition 6 is appearing early, in the form of the "whisper attacks" in the AP2 paper and GEO manipulation. **The attribution problem for agent-mediated purchases is not solved as of September 2026.** The schemas exist; verified live use does not.

### 3. The post-cookie, first-party environment

Chrome dropped cookie deprecation in July 2024 and dropped the standalone choice prompt on April 22, 2025. On October 17, 2025, it retired ten Privacy Sandbox technologies, including Attribution Reporting, Topics and Protected Audience, citing low adoption. The UK CMA then released Google from its commitments. Meanwhile Safari and Firefox block third-party cookies by default, and ATT constrains iOS apps. The W3C Private Advertising Technology Working Group's *Privacy-Preserving Attribution: Level 1* reached First Public Working Draft on April 22, 2025, and Firefox 128 had shipped a prototype in July 2024. Its model is on-device matching, noise, and aggregate-only reports.

**Verdict:** the substrate did not collapse cleanly. It fractured by platform. What replaced it is either the CPA model re-plumbed server-side (CAPI and similar), or platform-attested aggregate measurement (SKAN, PCM, PPA drafts). Neither changes the billable unit. The one conceptually new idea, attribution without per-user linkage, is still a standards draft on the open web.

### 4. Zero-knowledge proofs and cryptographic attestation

This pass found **no production ZK-based attribution system in adtech or martech**. What exists: patents (for example, U.S. 11,455,651 on "zero knowledge blockchain" attribution), academic proposals, and zkML surveys that rate proofs of model inference as "Requires R&D" because proof generation at frontier-model scale is "orders of magnitude beyond commercial viability." Privacy-preserving attribution that actually ships uses on-device joins, differential privacy, aggregation and multi-party computation, not ZK proofs. **Verdict: theoretical for this use case.** Even if ZK attribution shipped, it would prove the *old* conversion event more privately. That is a large privacy gain, but not a new unit.

### 5. LLMs as the persuading intermediary

Is an AI recommender just "another ranking algorithm"? Structurally, no, for one reason. Search ranking produced a *click* the publisher could observe and bill. An answer engine *consumes* the publisher's persuasion and presents a conclusion, so the publisher's contribution becomes an input to someone else's output. That is why the observable event disappears (zero-click) and why the credit question moves from "who referred the human?" to "whose content shaped the machine's judgement?" This is a genuinely new unit of trust: **attested influence on an agent's selection**. But a unit of trust only becomes a unit of payment when someone can count it credibly. Today only the model operator can.

## Part C — Synthesis: Is There a Real Shift Here?

**The honest answer: not yet available, but for the first time in two decades the conditions for one are forming.** Its name, in the same register as the historical three:

> **CPA → CPAI (cost per attested influence):** payment for a provable role in an agent's selection, rather than for a human click or a cookie-linked conversion.

**What would newly become verifiable.** Not "did a human click?" or "did a sale occur?" but "which sources did the agent ground on and cite in the session that produced this purchase?" That would be signed by the agent platform itself and checkable by the publisher, merchant and network without trusting one another's databases.

**Whose risk position would change.** Today the agent platform captures the persuasion value of publisher content with no obligation to report it. The publisher bears all the non-attribution risk (the 3.84× "unseen" gap is a rough measure of it). Under CPAI, the platform becomes the oracle and takes on reporting liability. Merchants pay for demonstrated influence. Publishers stop subsidizing agents' judgement for free. This is the same kind of risk re-allocation CPC and CPA delivered.

**Exactly what is missing (the substrate gap).**
1. **An agent-signed decision-provenance record.** At least one major agent platform must emit, per session, a signed record of grounded and cited sources linked to the resulting checkout, and make it available to third parties. The schemas are ready: ACP's `affiliate_attribution.source.url`, UCP's `attribution` map, and Content Telemetry's `content_cited` plus ctx tokens. Platform commitment is missing. OpenAI's March 2026 retreat from native checkout reduces its direct incentive to link citations to transactions, and Microsoft explicitly takes no affiliate fee.
2. **A payable contract norm.** Merchants and networks must accept agent-emitted provenance as billable evidence. The IAB's Measurement Services Addendum (released September 2026 for comment) is the kind of contractual rail this would ride on. It does not yet cover it.
3. **Defenses against provenance gaming.** Once citations pay, sources will be engineered to be cited, just as clicks were engineered once clicks paid. The "whisper attack" research shows the selection step is already manipulable.

**How far away (speculation, labelled as such).** Condition 1 is a business decision by roughly four companies, not a research problem. It could flip within 12–36 months if one of three things happens: publisher-licensing pressure (SPUR's members), a regulator, or competition among agent platforms for merchant loyalty makes provenance valuable to share. It could also never happen, if platforms judge that keeping the influence signal private is worth more than the ecosystem it would fund. Search is the precedent for that outcome: Google has never shared organic-ranking "influence" with publishers as a payable unit. The balance of evidence today (proprietary publisher-pay programs, default-off sharing flags, no confirmed use of the ACP field) points to *closed, per-platform* influence payment arriving before any *open, portable* one.

**Where Ancaster's assets sit relative to the shift.**
- **Signed offer object:** structurally the issuer side of what ACP's `affiliate_attribution.token` expects ("opaque provider-issued token for fraud-resistant validation"). That is early infrastructure for the receiving end of CPAI.
- **Referral Receipts as W3C VCs:** the same credential format AP2 uses for mandates. This is the right format for a portable, non-repudiable record. Today, though, it attests to the CPA-era event (a conversion the merchant or processor saw), not to influence.
- **Recommendation Ledger:** conceptually the closest asset to a decision-provenance record. It becomes paradigm-level only if an agent's signed provenance is written into it. A ledger of Ancaster's own claims about influence is a feature.
- **Processor-only/no-custody positioning and The Instrument's Revenue Path Trace:** these fit the neutral-verifier role, which in every prior shift became valuable *after* the new oracle emerged, not before it.

What Ancaster cannot do is supply the missing oracle. Only the agent operator can observe its own context window.

**The clearest statement of where things stand.** The three shifts Chris lived through each happened because a new event became *observable by someone the market would accept as the counter*. In 2026 the new event is real: an agent's choice, shaped by sources. So is the new counter: the agent platform. The pipes are drafted: ACP's affiliate extension, UCP's attribution field, AP2's VC mandates and Content Telemetry v1.0. What does not yet exist is the counter's willingness to count for anyone but itself. Until that changes, everything built downstream, Ancaster included, is making the CPA unit more trustworthy, which is valuable but not a paradigm shift. The signal to watch is specific and binary: **the first major agent platform that publicly populates signed, third-party-verifiable citation or grounding provenance on real purchases.** That event, not any new module, would mark the start of the shift.

## Caveats

- ACP's affiliate-attribution RFC text itself could not be retrieved. The field definitions above come from the rendered spec reference. Whether any live platform populates it is unverified, not confirmed absent.
- The number of Shopify merchants live on Instant Checkout before the March 2026 change is reported inconsistently (about 12 versus about 30).
- Brave/BAT adoption was not independently measured in this pass.
- The Overture patent settlement figure varies by source ($260–290 million versus about $360 million).
- The ATT figure (Flurry's 4% U.S. opt-in, i.e., ~96% not opted in) is an early-2021 analytics snapshot. Later opt-in rates reported by industry sources are materially higher and vary widely.
- The Partnerize 3.84× HaloIndex is a vendor's proprietary metric with commercial interest in the conclusion.
- The Wanamaker quote's attribution is traditional, not documented.
- All timing estimates in Part C are speculation, grounded in the incentive analysis above, not in any announced roadmap.
