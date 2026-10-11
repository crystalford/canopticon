---
id: ancaster-pass-six-the-carried-recommendation-pressure-tested
title: "Ancaster, Pass Six: The Carried Recommendation, Pressure-Tested"
kind: "Research pass"
topic: "Attribution & credit"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-1f06e344-c8df-5e9d-b805-53452ef80ae0_text_markdown.md"
---

# Ancaster, Pass Six: The Carried Recommendation, Pressure-Tested

The "carried recommendation" thesis holds up, but only in a narrower and stronger form than the hypothesis states. Ancaster's revolutionary idea is not a wallet pass or a consumer "pocket." It is a **signed referral receipt**: a small, portable object that records who recommended what, with which code, which approved endorsement and which disclosure. The buyer can keep it and any checkout can read it, whether a human or an AI agent is buying. The timing is better than prior passes assumed. The agentic-commerce protocols now have empty slots for exactly this data. OpenAI/Stripe's Agentic Commerce Protocol (ACP) documents an `AffiliateAttribution` object,\[1\] and Google's Universal Commerce Protocol (UCP) merged a free-form `attribution` field on May 5, 2026.\[2\] Neither defines what a trustworthy creator referral looks like. Ancaster can define it.

## TL;DR

- **Lead with the open "Referral Receipt" spec plus creator pages that hand buyers something to keep; defer the consumer Passport.** The "no referred-by-creator field" finding from April 2026 is out of date. ACP's checkout reference now has a write-only `AffiliateAttribution` object (provider, token, publisher_id, touchpoint first/last, source URL). UCP added an optional `attribution` key-value map to catalog, cart, checkout and order (PR #391, merged May 5, 2026). The standard play has changed from "add a field" to "define the signed payload that fills those fields."
- **"Carry it with you" is plausible but unproven.** No published evidence exists on wallet-pass or save-for-later conversion for creator affiliate codes, and I found no one issuing wallet passes for creator codes. Wallet redemption figures come from pass vendors. Google Wallet does not support developer-authored push notifications. Ancaster should run this as its own measured experiment and publish the result.
- **Brand: "Say the word." for creators, "Trust, carried." for the standard, and a forensic "receipts" voice for marketing, but not the standalone name "The Receipts."** That name belongs to an established UK podcast distributed by Acast, the independent podcast company whose name also sits uncomfortably close to "Ancaster." Get a formal CIPO/USPTO clearance before investing in either mark.

## Key Findings

1. **The attribution slot now exists in both big agentic protocols.**
   - **ACP:** Its checkout reference defines `AffiliateAttribution` as "Optional affiliate attribution data for crediting third-party publishers. Write-only: not returned in responses." It has a `provider` ("affiliate network namespace (e.g., 'impact.com')"), an opaque `token` "for fraud-resistant validation," a `publisher_id`, campaign/creative/sub IDs, `issued_at`/`expires_at`, a `source` URL for the content that referred the buyer, and a `touchpoint` of `first` or `last`.\[1\]
   - **UCP:** Merged PR #391 (Ilya Grigorik, Shopify) on May 5, 2026, after Meta's James Andersen withdrew his structured `event_context` proposal in its favour.\[2\] It then shipped in UCP release v2026-08-25.\[3\]
   - **What's missing in both:** Neither says anything about endorsement text, disclosure, consent or creator identity beyond a network publisher ID.
2. **A provenance vocabulary is forming in UCP without council members.**
   - Discussion #724 proposes a `CommercialIntervention` record whose `basis` includes `referral_compensation`.\[4\]
   - Issue #788 (filed August 30, 2026) proposes an invariant: provenance "MUST NOT … acquire a stronger authority claim merely by crossing a resource boundary."\[5\]
   - Discussion #706, "Standardize referral compensation for agentic commerce," is open.\[4\] I could not read its contents directly.
   - UCP Checker notes this work "is being driven by contributors who do not hold council seats."\[4\] A solo founder with a working reference implementation can get a hearing there.
3. **Evidence for "carry it with you" is thin and mostly from vendors.**
   - Apple Wallet has a first-class coupon pass type. Google Wallet has offer and generic pass types.\[6\]\[7\]
   - Google's FAQ says "developer-authored push notifications … are not currently supported."\[6\] That weakens Wallet as a reminder channel on Android.
   - Bloomberg (via AppleInsider, May 2026) reported that iOS 27 lets users build their own passes from any QR code.\[8\] That is a buyer-side "keep it" behaviour Ancaster can design for.
   - LTK has had favorites with price-drop alerts for years and relaunched Lists.\[9\]\[10\]\[11\] LTK publishes no save-to-purchase conversion data.
4. **Honey is the precedent a buyer-held pocket will be judged against.**
   - On June 22, 2026, US District Judge Beth Labson Freeman (N.D. Cal., In re PayPal Honey Browser Extension Litigation) ruled "the Court DENIES PayPal's motion to dismiss the SAC," after oral argument on June 4, 2026. Discovery has begun, the class has not been certified, and no liability has been established.
   - Rakuten Advertising terminated Honey on January 12, 2026, and impact.com suspended it on January 16, 2026. Awin suspended payments and blocked Honey from new advertiser programs without removing it from the network, saying its investigation "has since confirmed breaches of our publisher policies."
   - Any extension or agent that inserts codes at checkout will be read through this lens. Ancaster's pocket must never insert a code the buyer did not personally save from a creator, and must never overwrite existing attribution.
5. **Consumers are split on letting agents buy for them.**
   - Accenture's Consumer Pulse Research ("Talk to My AI Agent," published June 3, 2026; 25,590 consumers in 16 countries surveyed January 7–22, 2026) found "Nine percent would let an agent act independently, initiating and completing purchases on its own." Another 32% would let an agent decide within set limits.
   - Quad/Harris (April 2026): 39% of Americans trust AI agents with everyday purchases, and 75% would lose trust in AI shopping if results were sponsored.\[12\]
   - Croud (August 2026): 69% are open to AI purchases without approving each transaction.\[13\]
   - How the question is framed drives the answer. The durable signal is that disclosed, consented influence is what people will accept, which is Ancaster's design principle.
6. **Standards won when an acute, money-losing pain met a trivially simple format and one party big enough to enforce it.**
   - ads.txt adoption among the top 1,000 programmatic sites went "up from 16 percent on September 1 to 57 percent by February 1" (2017–2018, Pixalate data via PubMatic). Buyers like Digitas publicly refused to buy from publishers without it.\[14\]
   - UTM parameters outlived Urchin because Google kept the format verbatim after buying the company in 2005.\[15\]\[16\]

## Details

### 1. Does "carry it with you" work?

**What is verified:**
- Apple documents a coupon pass style for "discounts and special offers."\[7\]
- Google Wallet supports offers and a flexible generic pass.\[17\]
- Google's Wallet API terms put third-party content rights on the issuer: "Aggregators are responsible for ensuring authorization and rights for any third-party content submitted through the API."\[18\] If Ancaster issues passes carrying ElevenLabs' or Cursor's marks, it needs mark permission. The per-program permissions block should gain a "wallet pass / brand mark on pass" row.
- Google does not allow developer-authored push notifications.\[19\] Apple passes can update and use relevance/location triggers.
- iOS 27's user-built passes (reported, May 2026) mean even a plain QR code on a creator page can become a buyer-saved pass.\[8\]

**What is vendor claim:**
- Coupon and wallet redemption rates circulate from pass vendors and coupon sites. Examples: "QR-based mobile offers achieve redemption rates of 7-10%" (DontPayFull) and "500 million" US wallet coupon loads in 2023.\[20\]
- None of these figures is independently audited, and none concerns creator affiliate codes. Treat them as directional at best.

**What doesn't exist:**
- I found no published study of save-for-later, send-to-device or reminder flows for creator-referred traffic.
- I found no one issuing wallet passes for creator affiliate codes. Search turned up only generic pass builders (PassKit, Passcreator, WalletThat, AddToWallet).\[21\]\[22\]\[23\]\[24\]
- LTK's favorites and price-drop alerts ("Followers will be reminded to shop a Favorited (hearted) item the moment it goes on sale") are the closest precedent for creators.\[10\]\[25\] LTK does not publish save-to-purchase data.
- I did not gather verified conversion benchmarks for opt-in reminder emails in this pass. Do not quote any in marketing until Ancaster measures its own.

**Verdict:** The mechanic is cheap to build, fits how people actually buy (mention, then a delay, then the purchase), and is currently unowned. Ancaster should ship it as a measured experiment. The unit of measure is saves per page view, and then redemptions of the saved code, matched by code on Shopify orders.

### 2. The buyer's pocket (Passport reframed)

**Precedents and lessons:**
- **Coupon/cashback extensions (Honey, Capital One Shopping, Rakuten):** They proved that consumers install a tool that "saves me money at checkout." They also proved that the incentive to take last-click credit corrupts the tool. A separate class action against Capital One Shopping was filed January 23, 2025.\[26\]
- **Browser store policy:** Google changed Chrome Web Store policy in March 2025. Extensions may carry affiliate links only when they provide a direct user benefit and disclose the affiliation before install.\[27\]
- **Brave/BAT:** Brave reports 122.6M monthly active users (July 2026).\[28\] Its users have "contributed more than 36 million BAT" to creators.\[29\] That is a real but modest creator flow after a decade, and it needed a whole browser to deliver it. Lesson: user-held value works when it comes bundled with something people already want (a fast, ad-blocking browser). A standalone wallet of good intentions does not.
- **Card-linked offers, Solid pods and W3C Verifiable Credentials:** I did not research these in depth this pass. The pattern is well known: technically elegant user-held data stores have struggled for consumer adoption without a platform distributing them.

**Would consumers keep a pocket, and would they let an agent read it?**
- A standalone "recommendation wallet" app is a hard sell. The survey spread above (9% to 69%) shows trust is conditional.
- The likelier path is that the pocket lives where buyers already are: Apple/Google Wallet, email, and an MCP tool the buyer's assistant can call ("check my saved creator codes before buying").

**Crediting rules:**
- A buyer-held code is still a code. Most programs already credit coupon codes to the assigned affiliate, and code-first crediting is what Ancaster reconciles today.
- The risk is that affiliate terms banning "coupon sites," "browser extensions" or "toolbar/loyalty software" get applied to a pocket or MCP tool.
- **Design rules to stay clear of Honey:**
  1. Hold only codes the buyer personally saved from a named creator's page.
  2. Never search for or insert other codes.
  3. Never overwrite existing attribution; honour stand-down.
  4. Show the buyer the creator and the disclosure at the moment of use.
  5. Log consent in the Endorsement Ledger.
- **Recommendation:** Keep "Passport" deferred as a consumer brand. Ship the pocket as a feature (Wallet pass + email + MCP read tool), not a product.

### 3. How small players get a standard adopted

| Standard | Origin | Why it won |
|---|---|---|
| UTM | Urchin, a small San Diego analytics firm (early 2000s) | Plain URL text; Google kept it verbatim after the March 2005 acquisition. Changing it "would have broken everything."\[15\]\[16\] |
| ads.txt | IAB Tech Lab, public comment May 17, 2017\[30\] | A text file at the domain root, an acute fraud pain, and buyers refusing unlisted inventory. Top-1,000 adoption went 16% → 57% in five months.\[30\]\[31\] |
| RSS, oEmbed, OpenGraph, robots.txt, llms.txt | Individuals or single companies | Trivial to implement, immediately useful to the implementer, and one big consumer (Facebook for OpenGraph, search engines for robots.txt) |
| MCP | Anthropic, later moved to the Linux Foundation\[32\] | Reference SDKs plus one large client, then neutral governance |

**The pattern:** a format a developer can implement in an afternoon, a pain that costs someone money today, a free reference implementation, and one enforcer or major consumer. Neutral governance comes afterwards, never first.

**Where the protocols stand:**
- **ACP:**
  - Has `AffiliateAttribution` (per an "RFC: Affiliate Attribution").\[1\]
  - Has an extensions framework using reverse-domain names (e.g., `com.merchant.loyalty-program`) and JSONPath `extends`.\[33\]
  - Changes go through SEPs, and "SEPs require unanimous approval from Founding Maintainers" (OpenAI and Stripe).\[34\] A solo founder should not try to change ACP core. Build on the existing object instead: put the signed receipt in `token`, the network in `provider`, and the creator page in `source.url`.
- **UCP:**
  - The `attribution` map is flat, optional, and has no capability negotiation. Google's Amit Handa listed "referral tracking" among data suited to flat key-value pairs.\[2\]
  - Governance runs through GitHub Discussions, PRs and a Tech Council, now expanded to 16 seats.\[35\]\[36\]
  - UCP Checker reports the Payments Tech Council treats "active technical contribution" as a primary criterion for its four open seats.\[4\]
- **AP2 and MCP:** I found no referral or attribution proposals in limited searching. MCP matters as a transport: UCP binds to it,\[37\] and a buyer's assistant can read a pocket through it.

**Minimal spec shape: "Referral Receipt" v0.1 (JSON, signed as a compact JWS):**
- `v`, `id`
- `issuer`: creator handle plus a domain whose key is published at `/.well-known/referral-keys`, the ads.txt pattern
- `merchant`, `offer`
- `code`
- `network`: provider + publisher_id
- `endorsement`: text, basis = used | tested | sponsored | gifted, approved_at
- `disclosure`: text, jurisdiction
- `issued_at`, `expires_at`
- `holder`: optional; saved_at and channel, for consent
- `sig`

Also publish mappings:
- to ACP `AffiliateAttribution`
- to UCP `attribution` keys (`ref_receipt`, `ref_creator`, `ref_code`)
- to Shopify `/discount/CODE` links

Borrow #724's discipline: a receipt asserts only what its signer can attest ("creator X recommended this and discloses Y"). It never claims "caused the sale."\[4\]

**Adoption strategy for a solo founder:**
1. Publish the spec, test vectors, a validator and a Cloudflare Worker reference implementation (issue, verify, and the well-known key endpoint).
2. Make every Ancaster page emit receipts by default, so adoption exists from day one.
3. Post a concrete, test-vector-backed proposal to UCP #706/#724 showing receipts riding in `attribution`.
4. Pitch one network (Impact is the example provider in ACP's own docs)\[1\] or one Shopify app to verify receipts.
5. Consider a foundation or IAB Tech Lab only after two independent implementers exist.

### 4. What made past ad innovations stick

- **Affiliate link (CDNow/Amazon Associates, mid-1990s):** Pay only on outcome, and let anyone with a page become a salesperson. It stuck because the merchant's risk was near zero.
- **AdWords (auction plus quality score):** Relevance was priced into the auction, so better ads were cheaper. The incentives of user, advertiser and platform lined up.
- **The Deck / Carbon:** One tasteful ad per page and no tracking. The Deck still shut down in 2017. Jim Coudal: "display advertisers started concentrating on large, walled, social networks… Invasive user tracking (which we refused to do)… became pervasive."\[38\] Principle without scale or measurement loses to scale plus measurement.
- **Host-read podcast ads and promo codes:** The creator's voice became the creative, and the code was the only measurement that survived audio. It stuck despite undercounting because it was the only receipt available.
- **Honey (cautionary tale):** Real consumer value, but it took credit at the last click. Once creators investigated, networks cut it off and courts let the claims proceed.\[39\]\[40\]
- **Brave/BAT (partial success):** The browser succeeded. The token economy stayed marginal for creators.
- **Linktree:** Turned one link in a bio into a page, a new ad surface created by a platform constraint.

**The pattern:** Innovations that reshaped advertising (1) lined up incentives so the honest move was also the profitable one, (2) came with their own measurement, and (3) rode an existing distribution constraint or giant. Clever ones that failed had principles but no measurement advantage, or had value but took credit they did not earn. **For Ancaster:** the receipt must make the honest path (disclosed, consented, code-verified) *more* measurable than tracking, not just nicer.

### 5. McLuhan: tetrad and figure/ground

**Tetrad for the carried recommendation:**
- **Enhances:** the creator's spoken word and the buyer's own memory and agency. The recommendation becomes a possession, not a trail.
- **Obsolesces:** the third-party cookie and pixel as proof of influence, last-click crediting, and coupon-aggregator sites (a saved, creator-bound code crowds out the scraped one).
- **Retrieves:** the calling card and letter of introduction ("tell them Sam sent you"), the clipped coupon, the stamped receipt.
- **Reverses into (pushed to extremes):** a coupon wallet, and eventually Honey. A pocket full of codes turns into a discount-hunting machine that trains buyers to value the code over the creator. Alternatively the pocket becomes a profile, which is surveillance by consent-form.

**Figure/ground:** The click is the figure the whole industry measures. The delay is the ground where purchases actually happen: memory, conversation, brand search, the other device, the assistant. Podscribe's own figures put code capture at "about 15% of the attribution" (Q4 2024 Podcast Performance Benchmark, via Inside Radio) or "20–30% of listeners who actually convert" (Podscribe's site). The two sources disagree on the exact range, but either way the gap measures how much of the ground is invisible.

**White space:** instruments that operate *in the ground*. Something the buyer keeps, something the agent reads, something the merchant can verify.

**Risks:** the reversal into coupon culture, and platform capture (Apple, Google or OpenAI absorbing "saved recommendations" natively).

### 6. Branding

**Precedents:**
- DuckDuckGo, Proton, Basecamp/HEY, Plausible and Brave built outsized brands by naming an enemy (tracking, surveillance, bloat) and publishing principles they visibly paid a price to keep.
- *Play Bigger*-style category design says: name the category and its problem before the product.
- These are well-established patterns and were not newly researched this pass.

**The name "Ancaster":**
- **Assets:** "caster" (broadcaster, podcaster) and the lineage/ancestry echo, which fits the Ledger.
- **Risks:**
  1. It is a real place (Ancaster, Hamilton, Ontario), and many local agencies use it descriptively ("Digital Marketing Agency in Ancaster").\[41\]\[42\] Geographic names can face descriptiveness objections, so get counsel before filing.
  2. **Acast**, a major podcast ad company,\[43\] sits one syllable away in the exact vertical where "the Cast" lives.
- A formal trademark search is required. This pass is not one.

**Taglines:**
- **"Say the word."** Best for creators: spoken, active, and it names the one thing that survives audio.
- **"Trust, carried."** Best for the standard and manifesto.
- **"Ads you keep, not ads that follow you."** Reject. It keeps the word "ads" and invites the coupon-wallet reading. I found no obvious software conflict for "Say the word" in a light search, which is not clearance.

**"The Receipts":**
- *The Receipts Podcast* (Tolani Shoneye and Audrey Indome) has run since 2016, reaches "100k+" weekly and is distributed by Acast.\[43\]
- **Use "Ancaster Receipts" or "Receipts, by Ancaster" as a series name instead.**

**Brand directions:**
- **A. Forensic / "Show your receipts" (recommended).**
  - Voice: plainspoken, evidentiary, dated, first-person, "here's what we found and how."
  - Visual: receipt-paper off-white, monospace figures, one signal colour, timestamps and signatures as design elements, a lineage-line motif for the Ledger.
- **B. On-air / "The Cast."** Warm broadcast language (on-air light, call signs), strong for creators, weaker for merchants and standards bodies.
- **C. Protocol / infrastructure.** Developer-tool minimalism, credible to spec people, cold for creators.

**Manifesto draft (Direction A):**
> Advertising decided the only way to know who sent you was to follow you. It watched, it guessed, and it still got the answer wrong, because people don't buy at the click. They hear a voice they trust, they wait, they remember, and they buy later, somewhere else. We build for the later. When a creator says the word, we hand you something to keep: their recommendation, their code, their disclosure, signed. You carry it. You decide when it's used. Your assistant reads it only if you let it. The creator gets credit because you chose to give it, not because we tracked you. No cross-site tracking. No recommendation algorithms deciding what you see. No code you didn't save. Every claim dated, every endorsement approved, every receipt published. Say the word. We'll keep the receipt.

### 7. Marketing: research as the engine

**Precedents:**
- Adalytics shows both the power and the trap. Its reports drew Senate letters and forced Google to allow search-partner opt-outs.\[44\]\[45\] DoubleVerify attacks its work as "Customer-funded tests… promotional efforts, not credible research."\[46\]
- Check My Ads operates as a nonprofit watchdog.
- Baymard, Stratechery, 404 Media and Platformer (not re-researched this pass) earned trust through methodology, consistency and business models aligned with readers.
- **Lesson:** a vendor's research is credible only if its methods and data are public, it discloses its own interest, and it publishes findings that sometimes cut against its own product.

**Structure for "Ancaster Receipts":**
- **Formats:** a monthly long-form investigation with open data and methods; a weekly one-chart "receipt"; a public corrections log.
- **Independence rules:**
  1. Put a disclosure box of Ancaster's commercial interest atop every piece.
  2. Publish methodology and raw data.
  3. Give every named company 72 hours' right of reply.
  4. Get outside review before publishing on any direct competitor.
  5. Commit publicly to publish results that hurt Ancaster, starting with its own wallet-pass numbers.
  6. Keep the editorial calendar separate from sales.
- **Cadence:** weekly short pieces, monthly investigations.

**First five stories:**
1. **"The field exists. Who can fill it?"** ACP's `AffiliateAttribution` and UCP's `attribution`: what they credit, and why creators without a network publisher ID are invisible.
2. **The code-leak economy.** Trace 50 creator codes from AI-tool programs to coupon sites and AI answers, with dates and screenshots.
3. **After Honey.** What changed after the January 2026 network removals and the June 22, 2026 dismissal denial, and which extensions still behave the same way.
4. **Ask the robot for a coupon.** Test ChatGPT, Gemini, Claude and Perplexity on code-hunting across the 401-program directory's permissions blocks.
5. **Where podcast attribution breaks.** The 15-30% code-capture gap explained, with Ancaster's own save-and-redeem data as the counterpoint.

## Recommendations (decisions)

**Lead concept**
- A. Carried recommendations (consumer pocket) as the lead
- B. Creator sales pages as the lead (status quo)
- **C. Recommended: an open Referral Receipt standard, delivered through creator pages that hand buyers something to keep.** The pages are the distribution; the receipt is the idea.
- *Decide-for-me default: C.*

**Brand direction**
- **A. Forensic / "Show your receipts" (recommended)**
- B. On-air / the Cast
- C. Protocol
- *Default: A, with "the Cast" kept as the community name.*

**Tagline**
- **"Say the word." (recommended, creator-facing)**
- "Trust, carried." (use for the spec and manifesto)
- "Ads you keep…" (drop)
- *Default: "Say the word."*

**Marketing engine**
- **A. "Ancaster Receipts" investigative series (recommended)**
- B. "The lab" product experiments
- C. Standard-evangelism only
- *Default: A, with lab results published as Receipts.*

## First three things in the next 30 days

1. **Ship "Keep this" on every creator page.** Code plus Apple/Google Wallet pass, email-it-to-me, and send-to-my-other-device, instrumented for saves and code-matched redemptions. Add a "wallet pass / mark usage" row to the permissions block.
2. **Publish Referral Receipt v0.1.** Spec, test vectors, a Cloudflare Worker reference implementation (issue, verify, `/.well-known/referral-keys`) and an MCP tool, `get_saved_recommendations`. Then post a concrete mapping proposal to UCP Discussion #706/#724 and document the ACP `AffiliateAttribution` mapping.
3. **Publish the manifesto and Receipts #1, "The field exists. Who can fill it?"** Announce the spec in the same piece. It plants the flag with news only Ancaster is reporting.

## Caveats

- I could not read UCP Discussion #706 directly. Its author, schema and status come from secondary reporting (UCP Checker, September 4, 2026).\[4\]
- ACP's `AffiliateAttribution` is documented on agenticcommerce.dev,\[1\] but I did not confirm which spec version or SEP introduced it.
- Wallet and coupon redemption figures are vendor claims. No evidence exists on save-to-convert for creator codes.
- Consumer AI-trust surveys conflict sharply depending on how questions are framed.
- The trademark observations come from web searches, not clearance searches.
- The Honey litigation is unresolved; no liability has been established.\[40\]
- Brand precedents (DuckDuckGo, Proton and others) and the history of AdWords and Amazon Associates come from general knowledge, not new sourcing.

## Sources

1. [Checkout | Agentic Commerce Protocol](https://www.agenticcommerce.dev/docs/reference/checkout)
2. [Attribution Lands in UCP Core: Inside the May 5 TC Merge (PR #391) — UCP Checker Blog](https://ucpchecker.com/blog/ucp-tc-ships-attribution-into-core)
3. [Universal-Commerce-Protocol/ucp v2026-08-25 on GitHub](https://newreleases.io/project/github/Universal-Commerce-Protocol/ucp/release/v2026-08-25)
4. [UCP Commercial Provenance: Who Influenced the Cart? — UCP Checker Blog](https://ucpchecker.com/blog/ucp-commercial-provenance-cart)
5. [Lifecycle contract: cross-capability extension state projection across resource transitions (Cart → Checkout)](https://github.com/Universal-Commerce-Protocol/ucp/issues/788)
6. [Google Wallet API FAQ | Offers | Google for Developers](https://developers.google.com/wallet/retail/offers/resources/faq)
7. [Creating a coupon pass | Apple Developer Documentation](https://developer.apple.com/documentation/walletpasses/creating-a-coupon-pass)
8. [Apple Wallet will let you make your own passes in iOS 27](https://appleinsider.com/articles/26/05/04/apple-wallet-will-let-you-make-your-own-passes-in-ios-27)
9. [LTK | LinkedIn](https://www.linkedin.com/company/shopltk)
10. [Learn LTK best practices + app features](https://onbrand.shopltk.com/en-au/ltk-best-practices-app-updates)
11. [LTK: Shop Trusted Recs - App Store - Apple](https://apps.apple.com/us/app/ltk-shop-trusted-recs/id1154027990)
12. [75% of Americans say they would lose trust in AI shopping if results were sponsored](https://www.quad.com/newsroom/americans-say-they-would-lose-trust-in-ai-shopping-if-results-were-sponsored)
13. [Survey shows most Americans would trust AI to shop for them](https://www.consumeraffairs.com/news/survey-shows-most-americans-would-trust-ai-to-shop-for-them-081326.html)
14. [State of Ads.txt Adoption | Ad Ops Insider](https://www.adopsinsider.com/ad-exchanges/ads-txt-adoption/)
15. [The Secret History of UTM: Why It's Called Urchin Tracking Module](https://utmbuildertool.com/blog/history-of-utm-urchin)
16. [The history of Google Analytics: from Urchin to GA4, twenty years of free web measurement | Primo Interactive Blog](https://www.primointeractive.com/blog/history-of-google-analytics)
17. [Create passes on Web using the Google Wallet API | Google Codelabs](https://codelabs.developers.google.com/add-to-wallet-web)
18. [Google Wallet API Terms of Service | Generic pass | Google for Developers](https://developers.google.com/wallet/generic/resources/terms-of-service)
19. [Google Wallet API FAQ | Generic pass | Google for Developers](https://developers.google.com/wallet/generic/resources/faq)
20. [Mobile Coupon Statistics 2026: Usage, Redemption Rates, and App Trends | DontPayFull](https://www.dontpayfull.com/explore/mobile-coupon-statistics)
21. [Create passes for Apple Wallet - Passcreator](https://www.passcreator.com/en/apple-wallet-passes)
22. [Mobile Wallet Pass Creator for Google and Apple Wallet. - AddToWallet.co](https://addtowallet.co/)
23. [The Wallet Engagement Platform | PassKit](https://passkit.com/)
24. [WalletThat: Create, Share and Manage Mobile Wallet Passes](https://www.walletthat.com/)
25. [My Favorite Products (Web) – LTK Help Center](https://help.liketoknow.it/hc/en-us/articles/34357692062491-My-Favorite-Products-Web)
26. [Honey Lawsuit: PayPal, Affiliate Theft, and What’s Next - LegalClarity](https://legalclarity.org/honey-lawsuit-paypal-affiliate-theft-and-whats-next/)
27. [Honey Investigation Deepens: Revealing New Browser Extension Risks for Affiliate Programs - Affiverse](https://www.affiversemedia.com/honey-investigation-deepens-what-part-two-of-megalag-reveals-about-browser-extension-risks-for-affiliate-programs/)
28. [Brave Browser Statistics (2026) Users, Revenue, & Market Share](https://bloggervoice.com/brave-browser-statistics/)
29. [Important Changes to Brave Rewards | Brave](https://brave.com/blog/rewards-changes/)
30. [ads.txt — Grokipedia](https://grokipedia.com/page/Ads.txt)
31. [Ads.txt | The Rise of Ads.txt in Ad Tech | PubMatic](https://pubmatic.com/blog/ads-txt-rise-ad-tech/)
32. [UCP vs ACP: Which Agentic Commerce Protocol Should Retail...](https://www.paz.ai/blog/ucp-vs-acp-which-agentic-commerce-protocol-should-retailers-choose)
33. [Extensions | Agentic Commerce Protocol](https://www.agenticcommerce.dev/docs/concepts/extensions)
34. [\[SEP\] Product Feeds · Issue #189 · agentic-commerce-protocol/agentic-commerce-protocol](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/189)
35. [Announcing new Tech Council members · Universal-Commerce-Protocol/ucp · Discussion #379](https://github.com/Universal-Commerce-Protocol/ucp/discussions/379)
36. [Under the Hood: Universal Commerce Protocol (UCP) - Google Developers Blog](https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/)
37. [GitHub - Universal-Commerce-Protocol/ucp: Specification and documentation for the Universal Commerce Protocol (UCP) · GitHub](https://github.com/universal-commerce-protocol/ucp)
38. [The Deck ad network is shutting down | TechCrunch](https://techcrunch.com/2017/03/29/r-i-p-the-deck/)
39. [The PayPal Honey Lawsuit: What Is Commission Hijacking?](https://www.makeinfluence.com/en/academy/the-paypal-honey-lawsuit-what-commission-hijacking-means-for-affiliate-creators)
40. [Honey Lost 7 Million Users After a YouTuber Exposed Its Alleged Affiliate Theft - Gadget Review](https://www.gadgetreview.com/honey-lost-7-million-users-after-a-youtuber-exposed-its-alleged-affiliate-theft)
41. [Digital Marketing Agency in Ancaster - Freelance Designer & Developer | Josh Leist](https://joshleist.com/locations/digital-marketing-agency-ancaster)
42. [Digital Marketing Agency in Ancaster | Beyond Limits Marketing](https://beyond-limits.ca/locations/ancaster-digital-marketing)
43. [Tolani Shoneye and Audrey Indome's The Receipts Podcast Joins Acast](https://podnews.net/press-release/the-receipts-acast)
44. [Thanks, Google: We’re still seeing major brands funding toxic sites weeks after Adalytics’ exposé - Check My Ads](https://checkmyads.org/thanks-google-were-still-seeing-major-brands-funding-toxic-sites-weeks-after-adalytics-expose/)
45. [Legislators ask DoubleVerify, IAS for answers after new report finds ads next to explicit content](https://www.marketingbrew.com/stories/2025/02/10/legislators-ask-doubleverify-ias-for-answers-after-new-report-finds-ads-next-to-explicit-content)
46. [Setting the Record Straight: Addressing Adalytics’ Continued Misleading Claims](https://doubleverify.com/blog/web/verify/setting-the-record-straight-addressing-adalytics-continued-misleading-claims)
