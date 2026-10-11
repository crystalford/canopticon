---
id: ancaster-fifth-pass-seven-open-questions-on-journeys-codes-portability
title: "Ancaster, Fifth Pass: Seven Open Questions on Journeys, Codes, Portability, Merchant Demand, Program Permissions, Interactive Demos and Shopify Order Data"
kind: "Research pass"
topic: "Attribution & credit"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-42409cba-6148-5081-95ef-2e2507d075d8_text_markdown.md"
---

# Ancaster, Fifth Pass: Seven Open Questions on Journeys, Codes, Portability, Merchant Demand, Program Permissions, Interactive Demos and Shopify Order Data

The measured evidence says a creator's recommendation mostly does not travel click → page → buy: in podcast and host-read audio, promo codes and vanity URLs capture only about 15–30% of the conversions that pixel-based household matching finds, and most of the rest arrives later through search, direct visits or another device. So Ancaster should rebuild around a code the creator owns, with the page as the place that code gets explained, applied and proven, not as the main attribution asset.

## TL;DR

- **The funnel is mostly mention → delay → search/direct → buy, with codes as the only durable cross-format thread.** Podscribe's Q1 2026 benchmark (97,000+ campaigns, 30B+ impressions), as summarized by Ad Results Media on March 12, 2026, finds pixel attribution captures roughly 4.7× more conversions than promo codes or vanity URLs and about 6× more than post-purchase surveys, and that "as much as 80%" of ad-driven engagement can be missed without pixels. No public study measures creator-referred interactive pages specifically, so Ancaster's own logs and A/B test will be the first evidence.
- **Make the code the center of gravity, the page second, and the permissions block the moat.** Networks already credit codes without clicks (Impact's "Always Credit" policy), Shopify auto-applies codes via `/discount/CODE` links and records landing page, referrer, UTM and `ref` values on orders, and program terms like ElevenLabs' (June 10, 2026) now restrict marks even in schema aimed at AI. Onboarding should ask for the code first, the program/link second, and content last.
- **Merchant demand for "proof of who made the sale" is real but mostly expressed as fraud, incrementality and activation pain, not as a line item anyone buys today.** The portable Endorsement Ledger is a trust feature and a merchant-facing proof artifact, not something creators will pay for on its own. Make it exportable, and keep retention in the live services around it: reconciliation, permissions sweeps and code monitoring.

## Key Findings

1. **Measured journeys are delayed, multi-device and mostly clickless.** Podscribe's modeling uses a device graph that resolves only about 40% of off-network conversions to the listening household. Its lag reporting runs 24 hours to 30 days, with configurable windows up to 60 days.\[1\]\[2\] Survey-based tools exist precisely because "people rarely click an ad, so standard tracking tends to give the credit to a later Google search instead" (PPC Land on Fairing, September 15, 2026).\[3\]
2. **Codes undercount, but they are the one signal that survives format changes, and they leak.** Uniqodo's blog post "Unique Single-Use Codes Are the Future of Affiliate Tracking" reports that in one campaign it studied, 30% of tracked sales on a generic influencer code came from users with no interaction with the influencer; that is one campaign, not a cross-merchant rate. Single-use or per-creator codes plus monitoring are the standard countermeasure.
3. **Shopify natively supports the designed flow.** A creator page can send buyers to `store.com/discount/CODE?redirect=/products/x&ref=sam&utm_source=ancaster`. The code auto-applies at checkout, and the order carries `discountCodes` plus `customerJourneySummary` visit data (landing page, referrer URL, UTM parameters, `ref`/`source`/`r` referral code). Shopify's own Collabs product uses the same `/discount` route.\[4\]
4. **Program terms are converging on tighter rules about paid placement, marks, redirects and AI-facing metadata.** Of the 17 SaaS programs checked, 8 publish terms we could read in whole or in part. The rest keep terms inside Impact/PartnerStack, run credit-only referral schemes, or were not found.
5. **No evidence exists for interactive pages on creator-referred traffic.** The famous "94% higher conversion with AR/3D" figure comes from Shopify itself (first published in a September 2020 Shopify tweet and a May 11, 2022 Shopify Changelog entry), neither of which gives a methodology, and it is confounded by self-selection.

---

## 1. What actually happens between a creator's recommendation and the purchase?

### Verified measurements (third-party or large-sample)

| Measurement | Finding | Source / date | Evidence quality |
|---|---|---|---|
| Codes vs pixel, podcast/audio | Pixel attribution captures ~6× more conversions than post-purchase surveys and ~4.7× more than promo codes or vanity URLs; "as much as 80%" of ad-driven engagement missed without pixel + incrementality | Podscribe Q1 2026 Benchmark (97,000+ campaigns, 30B+ impressions), summarized by Ad Results Media, March 12, 2026\[5\] | Large sample, but measurement vendor's own benchmark; pixel "conversions" include modeled fractions |\[5\]
| Codes' share of conversions | Promo codes ≈21% of total podcast ad conversions (66,000 campaigns, 500 advertisers) | Podscribe Q3 2025, as cited by gowildcast | Secondary citation |\[6\]
| Codes' share, earlier | Pixel data produced 85% of tracked conversions, with promo codes making up the rest (about 15%); pixel ≈5× codes | Podscribe Q4 2024 PPB Report, via ADOPTER Media and Inside Radio, March 2025 | Trade press / agency blog |
| Codes vs pixel vs surveys, Q2 2025 | Pixel 2.3× surveys, 4.6× promo codes | Podscribe Q2 2025 release, Podnews | Vendor press release |\[7\]
| Survey and code participation | Survey response ~33%; promo code usage "often under 50%" | ADOPTER Media citing Podscribe Q2 2025 | Agency blog |\[8\]
| Cross-device | Tapad device graph resolves the purchaser's home IP ~40% of the time; the rest is modeled | Podscribe Measurement FAQ\[1\] | Vendor documentation |
| Lag | Lag Report breaks conversions into windows from 24 hours to 30 days; attribution windows configurable 0–60 days | Podscribe Help Center\[1\]\[2\] | Vendor documentation (distribution not public) |
| Incrementality | Podcast ads drive incremental lift up to 45% for brands under 1M monthly site visitors | Podscribe Q1 2026 via Ad Results Media\[5\] | Vendor benchmark, "up to" figure |
| Software vertical | Software advertisers see a strong 0.45% visitor rate but "struggle to convert that engagement into purchases" | Podscribe Q1 2026 via Ad Results Media\[5\] | Directly relevant to Ancaster's SaaS beachhead |
| Self-reported action | 76% of weekly podcast consumers have taken some action after hearing a podcast ad (visit site, get info, recommend, purchase) | Edison Research, The Podcast Consumer (2026 edition, via Inside Radio)\[9\] | Survey, self-reported |
| Self-reported purchase | 46% of weekly podcast listeners have purchased as a result of a podcast ad | Edison Research, The Podcast Consumer 2024\[10\] | Survey, self-reported |
| Brand lift | HelloFresh podcast ads: +164% unaided awareness, +44% aided, +51% favorability, +16% intent to act | Signal Hill Insights via Inside Radio (2020) | Exposed/control survey; old |\[11\]

**Conflict to note:** Podscribe's own figures for surveys vs pixel move a lot between quarters: 2.3× in Q2 2025, "nearly 7×" in ADOPTER's reading of the same quarter, and ~6× in Q1 2026.\[5\]\[7\]\[8\] The code multiple is steadier at ~4.6–5×. Treat the code figure (codes capture roughly one conversion in five) as the stable finding and the survey multiple as unstable.

### What was not found (stated plainly)

- **Branded search lift share.** Every vendor says podcast and creator exposure drives later brand search. Fairing, Podscribe and the PPC Land coverage all describe the "search for the brand days later" path.\[3\] But this pass found **no published percentage of listeners who searched the brand instead of clicking or using a code**. Spotify, Magellan, Veritonic, Nielsen and Google branded-search-lift figures were not located in accessible form.
- **Dark social share for creator recommendations.** The widely cited "90% gap between software attribution and self-reported data" (Refine Labs hybrid study) reached us only third-hand, via a Recast summary quoted on a blog.\[12\] Treat it as anecdotal.
- **Code-without-click rate.** No public benchmark exists. The closest proxy is Impact's documentation that "Always Credit" codes stop tracking clicks for that partner, which means the platform expects code-only conversions as a normal case.\[13\]
- **Post-purchase survey vs click reconciliation at creator level.** Fairing's Advanced Attribution beta (launched September 10, 2026; GA January 2027) adds a follow-up asking which creator/show/AI prompt. It claims "up to 50% more usable attribution signal", but PPC Land notes the figure "comes from the company itself and has not been independently checked".\[3\]

### What this means for Ancaster

The funnel for a spoken or video mention has three routes, in rough order of volume. First, **mention → delay → brand search or direct type-in → buy**, which is the largest and least attributable. Second, **mention → code at checkout without a click**. Third, **mention → click → page → buy**, which is the smallest and the only one Ancaster's page directly sees. The SaaS-specific Podscribe finding (high visits, weak conversion) suggests the page's job for developer-tool offers is to convert curious visitors, which is a legitimate place for an interactive page. But the page cannot be the sole proof of who made the sale.

### Instrumentation spec (no cross-site identifiers)

**Log per link resolve (Workers, first-party only):**
- `resolve_ts`, `offer_id`, `creator_id`, `link_variant` (A/B arm)
- `referrer_class`: youtube / podcast app / newsletter provider / social in-app browser / messaging app / search / none. Derive it from the `Referer` header and user-agent in-app browser signatures, then discard the raw UA after classification.
- `device_class` (mobile/desktop/tablet), coarse country; no IP stored beyond rate-limit windows
- `entry_type`: typed/vanity path vs clicked (a proxy is `Referer` absent + short path + mobile; label it probabilistic)
- `page_events`: time-on-page bucket, component interactions (hear-it played, calculator used), code revealed/copied, outbound CTA clicked
- `outbound_ts` and destination (network link vs merchant `/discount/` link)

**Log per conversion (from networks, merchant plugin or creator uploads):**
- `code_used`, `click_matched` (yes/no/unknown), `conversion_ts`, `time_from_resolve` (when matched), `network_credit_policy` (e.g., Impact Always Credit / If Involved / If Winner)
- Shopify orders: `discountCodes`, `customerJourneySummary.firstVisit.landingPage`, `referrerUrl`, `utmParameters`, `referralCode`, `momentsCount`

**Derived metrics:**
- **Code-without-click rate** = code conversions with no matched Ancaster resolve ÷ all code conversions
- **Clicks-per-code-conversion** and **resolve-to-conversion lag distribution** (median, p75, p90)
- **Leak rate** = code redemptions outside the creator's audience windows or after first appearance on aggregator sites (via a weekly aggregator scan)
- **Branded-search proxy**: spikes in direct/organic Shopify `firstVisit.source` on merchant stores in the 7 days after a creator publishes, compared with the prior 28-day baseline. This needs the Shopify plugin and should be labeled correlational.
- **Survey reconciliation**: one post-purchase question on plugin stores ("How did you hear about us?" → if creator/podcast/YouTube, "Which creator?" with an auto-suggest list of Ancaster creators). Report the survey-to-code multiplier per creator, the method ADOPTER Media uses with Fairing.\[12\]

**Comparisons and sample sizes:**
- **Page vs direct link A/B**: randomize at click level within creator. To detect a 20% relative lift in conversions per click at 80% power, α=0.05: ~42,600 clicks per arm at a 1% baseline, ~21,100 per arm at 2%, ~8,100 per arm at 5%. With few creators, add a design effect for creator clustering (1 + (m−1)·ICC). Budget for 1.5–2× these numbers if creators dominate traffic.
- **Code-without-click rate**: ~385 code conversions give ±5 percentage points at 95% confidence.
- **Lag distribution**: ~200 matched conversions per format (video, podcast, newsletter) are enough for stable medians.

**Results that would change the product shape:**
- If code-without-click exceeds ~50% for audio/video creators, the page is a secondary surface. Lead with code management, leak monitoring and reconciliation.
- If the page arm does not reach +20% conversions per click, drop generated pages to a simple "code + proof + disclosure" card and invest in codes and permissions.
- If the median lag exceeds 7 days, ask for longer network cookie windows or code-based crediting where programs allow it, and tell creators so.
- If the survey-to-code multiplier is consistently above 3×, sell the survey reconciliation as the merchant-facing proof product.

---

## 2. Is the durable asset the page or the code?

### Evidence

- **Codes undercount but persist across formats.** Codes capture roughly 15–30% of measured podcast conversions (Podscribe, 2025–2026).\[14\] They are also the only signal that survives a spoken mention, a screenshot, a forwarded message, a device switch and, per the fourth pass, an agent-mediated purchase where no "referred by" field exists.
- **Leakage is real and measurable, but mostly measured by vendors selling fixes.** Uniqodo reports that in one campaign "30% of tracked sales using a generic influencer code came from users who had no interaction with the influencer."\[15\] LoudCrowd, Marcode and Tapfiliate all describe scraping by Honey-style extensions and aggregator sites.\[16\]\[17\] None of these publish a neutral cross-merchant leakage rate. After the January 2026 Honey removals (fourth pass), extension-driven leakage should be falling for Impact/Rakuten programs, but aggregator sites and AI assistants remain.
- **AI assistants actively hunt codes.** Consumer guides from June 2026 show ChatGPT being used to find codes and, in agent mode, to open a browser and "test each of those codes one at a time" at checkout (Maverick AI guide; ConsumerAffairs, June 3, 2026).\[18\]\[19\] A public vanity code is therefore effectively public to agents.\[20\] A creator's code will be surfaced, or substituted by a better public code, whenever an agent shops. No evidence was found that ChatGPT, Perplexity or Gemini shopping surfaces preserve a specific creator's code on purpose.
- **Networks credit codes without clicks, but under configurable precedence.** Impact's Tracking Promo Codes offer three policies. "Always Credit" means the code always gets credit and that partner's clicks stop being tracked. "Credit If Involved" credits only if the partner drove any click. "Credit If Winner" credits only if the partner drove the winning click.\[21\] Impact warns that "credit groups take precedence over Promo Code Tracking attribution", so a Standard partner's Always-Credit code loses to a Preferred partner's last click.\[22\]
- **Shopify Collabs credits "every purchase that's made using your affiliate link or discount code".**\[23\] Its personalized links (e.g., `mystore.com/sammy`) auto-apply codes through the `/discount` route.\[4\] Collabs was **not accepting new creator signups** at the time of this pass, which limits it as a channel for Ancaster's creators.\[23\]
- **Unique vs vanity vs single-use:** single-use codes stop mass leakage but cannot be spoken aloud. Vanity codes (SAM10) are sayable but leak. The workable pattern is a sayable vanity code for audio/video plus single-use or link-embedded codes behind the page. Several vendors describe this; none publish controlled outcome data.

### Recommendation

**Options:**
- **A. Page-first (status quo):** the page is the product, and codes are a field on it. This is weak against the evidence that most conversions never touch the page.
- **B. Code-first with a page behind it (recommended):** the creator's sayable code is the primary asset. The page explains the code, demonstrates the product, auto-applies the code (Shopify `/discount` or program-provided deep link), and records the disclosure. Ancaster monitors the code for leaks and reconciles code, click and network reports.
- **C. Code-only ledger:** no pages, just code management and reconciliation. This is cheaper, but it gives up the conversion lever and the endorsement surface.

**Onboarding order implied by B:** (1) **code** ("What do you say out loud? Paste your code(s)"). If the creator has none, detect whether the program issues codes and prompt them to request one. (2) **program + tracked link** (to map the code to a network and credit policy). (3) **disclosure basis** (used/tested/sponsored) for the first ledger entry. (4) **content feed** last, as optional enrichment.

---

## 3. Should creators own their recommendation data as an exportable, machine-readable record?

### Evidence

- **Demand for ownership is well documented in general, not for recommendation records specifically.** Circle's 2026 creator survey reports 32% of creators cite unreliable or declining social reach as a major concern.\[24\] A 2025 creator-monetization survey (cited secondhand by Theodyx) says 56.8% "fully own their audience" via email.\[25\] Beehiiv, Substack and Kit market subscriber export as a core promise. This pass found **no survey asking creators whether they want a portable record of their endorsements**, and **no product that sells portability as a paid add-on**. Portability is sold as a trust signal and a switching-cost reducer, bundled into the base product.
- **Standards precedents exist and are mature enough to borrow.** W3C Verifiable Credentials (Data Model 2.0 became a W3C Recommendation in 2025), Open Badges 3.0 (built on VCs), AT Protocol account portability, ActivityPub and schema.org `Review`/`Recommendation` types all provide shapes for a signed, portable claim. None is used today for affiliate endorsements.
- **Merchant interest is indirect but real.** Merchants need disclosure assurance and fraud-resistant attribution (section 4). A signed ledger entry ("creator X approved line Y on date Z, basis: used, disclosure rendered: W") is a proof artifact a merchant or network could verify. The caveat: ElevenLabs' June 10, 2026 terms forbid its marks "in any meta tag, alt text, schema markup, hidden text… intended or reasonably likely to influence the ranking, indexing, or surfacing of results by any search engine, app store, or AI system."\[26\] A public machine-readable endorsement feed that names a brand may itself breach some programs' terms. The export must be permission-aware.

### Assessment

- **Creators will not pay for portability itself.** They will pay for what the ledger *does*: compliance cover, proof of past performance when negotiating rates, and faster onboarding into new programs.
- **Merchants and networks may value verification**, i.e., a signed, checkable ledger entry. That is a possible B2B revenue line later, not in the 90-day window.
- **Retention risk from full portability is low if Ancaster's value is in live services** (code monitoring, reconciliation, permissions sweeps, page hosting) rather than in data hoarding. It is high only if the ledger is the sole product. Make the export complete (JSON + signed VC-style entries + CSV), and let the live services be the reason to stay.

---

## 4. What do merchants actually want from affiliates that they can't get today?

### Evidence

- **Activation, not recruitment, is the dominant pain.** The Performance Marketing Association's 2024 U.S. Performance Marketing Brand Survey (300+ brands) found 75.0% of brands had 100 or fewer sale-active publishers in the prior 12 months, and 45.2% had 50 or fewer. Modash's 2026 survey ("Affiliate Marketing Survey 2026: Why Hands-On Programs Outperform the Rest"): 70% of marketers say affiliates are critical, 60% say keeping affiliates "active" is their biggest challenge, and over a third have less than 20% active affiliates.
- **Fraud and brand consistency rank near the top.** Avangate Network's 2026 trends piece, citing Fintel Connect, says over 60% of marketers put relationship management, brand consistency and fraud among their top three challenges. Trackier cites 63% naming fraud, but without a named source.\[27\] Treat both as directional.
- **Incrementality is now the budget conversation.** Agencies (New Engen, among others) sell "publisher-level incrementality scoring".\[28\] Awin's 2026 trends piece reports continuity in member priorities, with AI prominent.\[29\] A widely circulated figure that "18–24% of attributed conversions would have occurred anyway" appears on an aggregator page (Digital Applied) that attributes numbers to Forrester and Impact without links.\[30\] It could not be verified and should not be quoted.
- **Content/experience quality:** Awin's Forrester update (2025) found 52% of senior marketers cite personalization and 50% cite improving customer experience as objectives affiliates could support.\[31\]
- **What merchants pay for adjacent solutions:** this pass found no published price benchmarks for incrementality testing, fraud tools or brand-compliance crawlers. The only price points found were a $49 one-time AI terms generator against a "$300 to $1,000" lawyer quote for writing a brand-bidding clause (Matt McWilliams),\[32\] which shows how cheaply merchants treat the policy side.

### Assessment

"Proof of who made the sale" is a real purchase driver, but merchants buy it as **fraud prevention, code-leak control and incrementality**. They do not buy it as "creator proof". "Compliance-verified endorsements" is a secondary driver for most merchants and a primary one only in regulated or high-scrutiny categories. The strongest merchant pitch Ancaster can make: *we activate your dormant creators with ready pages and give you a reconciled, leak-checked record of code and click conversions with the disclosure attached.* That addresses the activation and fraud pains the data shows.

---

## 5. Which affiliate programs' terms permit what?

### Rubric (values: Allowed / Forbidden / Conditional / Not stated / Not verified)

Fields: paid search (non-brand), brand/trademark bidding, paid social/native, coupon/deal sites, incentivized/cashback, intermediary landing pages, redirects/link wrapping/shorteners, marks in domains/handles, marks in headers/schema/meta/AI-facing, AI-generated content, email/newsletter, self-referral.

### Application (verified in this pass; blank-equivalent marked)

| Program (terms URL; date) | Brand bidding | Paid ads generally | Coupon / cashback / incentivized | Redirects / cloaking / intermediary | Marks in domains | Marks in meta/schema/AI | Email | Self-referral |
|---|---|---|---|---|---|---|---|---|
| **ElevenLabs** (elevenlabs.io/affiliates-terms; last updated June 10, 2026) | Forbidden | Forbidden: no paid placement directing users "directly or indirectly" to ElevenLabs | Forbidden: false coupon/cashback promises, browser extensions, bots | Not stated as a rule; cookie stuffing forbidden; placement details on request | Forbidden (domains, subdomains, handles) | Forbidden: meta, alt, schema, hidden text aimed at search or "AI system" | Not stated | Forbidden |\[26\]
| **Shopify Affiliate** (shopify.com/affiliates/terms + Growth Center compliance guide; date not shown) | Forbidden incl. misspellings; must add negative keyword | Conditional (no ad mimicry) | Conditional: extensions need written approval, can't promote codes, must stand down | Forbidden: no intermediary servers "to hide or obscure your referral traffic source", no automatic redirects | Forbidden | Forbidden: misleading titles/descriptions, "unlawful use of meta tags" | Not stated | Not stated |\[33\]
| **Hostinger** (hostinger.com/legal/affiliate-program-agreement; date not shown) | Forbidden | Forbidden (PPC/impression advertising) | Conditional: coupon-keyword metadata banned; personal codes on request at 5+ sales/month | Conditional: cloaking banned when used to promote on undeclared sites; iframes banned | Not verified | Conditional (coupon keywords in metadata) | Forbidden (spam) | Forbidden |\[34\]\[35\]
| **Kinsta** (kinsta.com/legal/affiliate-terms; date not shown) | Forbidden | Forbidden (PPC, pop-ups) | Forbidden (rewards, discounts, cashback) | Conditional: cloaking banned for undeclared sites; iframes banned | Forbidden | Not stated | Not verified | Forbidden |\[36\]
| **Framer** (framer.com/legal/affiliates; date not shown; runs on Dub) | Forbidden | Forbidden (no links on search ad platforms) | Not verified | Not verified | Not verified | Not verified | Conditional: brand not allowed in "From" line | Not verified |\[37\]\[38\]
| **Webflow** (webflow.com/legal/affiliate-terms + trademark policy; date not shown) | Forbidden | Not verified | Not verified | Not verified | Forbidden | Not verified | Conditional (CAN-SPAM; must not imply sent by Webflow) | Forbidden (incl. client referrals) |\[39\]\[40\]
| **HubSpot** (legal.hubspot.com/affiliate-program-agreement; date not shown) | Forbidden | Conditional: no ads competing with HubSpot's own | Not verified | Not verified | Conditional (trademark guidelines) | Not verified | Not verified | Not verified |\[41\]
| **Descript** (descript.com/affiliate-terms; help center) | Forbidden | Forbidden ("you can not run Google ads as an affiliate") | Not verified | Not verified | Not verified | Not verified | Not verified | Not verified |\[42\]
| **Amazon Associates** (Operating Agreement + Program Policies; current) | Conditional (paid search permitted only within stated limits) | Conditional | Not verified | Forbidden: cloaking/obscuring, and shorteners that make it "unclear that you are linking to an Amazon site" | Forbidden (marks only as permitted) | Not verified | Conditional: solicited email/SMS/DM only; offline forbidden | Forbidden |\[43\]\[44\]
| **Lovable** (Impact; terms not public) | Reported forbidden (third-party summary) | Reported generally forbidden | Not public | Not public | Not public | Not public | Email templates provided | Not public |\[45\]
| **Semrush, Riverside, Canva** (Impact; not public; Canva's program closed to applications) | Semrush: reported forbidden (third-party); Canva: forbidden per older terms (unverified) | Not public | Semrush: reported forbidden | Not public | Canva: forbidden (unverified) | Not public | Not public | Semrush: reported forbidden |\[46\]\[47\]\[48\]
| **Notion** (PartnerStack; not accepting new affiliates) | Not verified | Not verified | Not verified | Not verified | Not verified | Not verified | Not verified | Not verified |\[49\]
| **Cursor, Replit** (credit referral programs, no cash affiliate terms found; Replit page modified August 27, 2026) | Not stated | Not stated | Not stated | Not stated | Not stated | Not stated | Not stated | Not stated |\[50\]\[51\]
| **Vercel, Jasper** | Terms not found this pass | | | | | | | |
| **PartnerStack baseline** (Partner ToS) | Set per vendor | Set per vendor | Set per vendor | Platform bans framing/mirroring the platform itself; link rules set per vendor | Set per vendor | Set per vendor | Set per vendor | Set per vendor |\[52\]
| **Impact baseline** | Set per brand contract | Set per brand | Set per brand | Set per brand | Set per brand | Set per brand | Set per brand | Set per brand |
| **CJ, Awin/ShareASale, Rakuten, Partnerize, FlexOffers, ClickBank** | Not verified this pass | | | | | | | |

**The pattern that matters for Ancaster:** programs that address redirects mostly ban them when they *hide* the traffic source or promote on undeclared sites (Shopify, Hostinger, Kinsta, Amazon).\[43\] A transparent, declared creator page on `ancaster.link` is likely conditional-permitted for most programs, but only if Ancaster's domain is declared in the creator's affiliate profile and the final link is visibly the merchant's. No program checked explicitly addresses AI-generated content about the product. ElevenLabs is the only program found that explicitly names AI systems in its metadata rule.\[26\]

### Permissions block spec (per program)

```json
{
  "program_id": "elevenlabs",
  "network": "partnerstack",
  "terms_url": "https://elevenlabs.io/affiliates-terms",
  "terms_last_updated": "2026-06-10",
  "terms_hash": "sha256:…",
  "last_verified": "2026-09-24",
  "verified_by": "sweep|human",
  "rules": {
    "brand_bidding":        {"value": "forbidden",   "quote": "You may not (a) bid on…", "section": "…"},
    "paid_ads_any":         {"value": "forbidden",   "quote": "…use any paid placement to direct users…"},
    "coupon_sites":         {"value": "forbidden",   "quote": "…"},
    "incentivized":         {"value": "forbidden"},
    "intermediary_page":    {"value": "unknown"},
    "redirect_wrapping":    {"value": "unknown"},
    "marks_in_domain":      {"value": "forbidden"},
    "marks_in_meta_schema": {"value": "forbidden", "scope": ["search","app_store","ai_system"]},
    "look_and_feel":        {"value": "forbidden"},
    "ai_generated_content": {"value": "not_stated"},
    "email":                {"value": "not_stated"},
    "self_referral":        {"value": "forbidden"}
  },
  "ancaster_compat": "conditional",
  "ancaster_actions": ["no brand in page <meta>/JSON-LD", "distinct visual style", "declare ancaster.link in partner profile"]
}
```

Values: `allowed | forbidden | conditional | not_stated | unknown` (unknown = terms not accessible). Every non-unknown value requires a verbatim quote and URL.

### Sweep method for ~401 programs

1. **Locate terms:** crawl the program's landing page for links matching `/affiliate(s)?-?terms`, `/legal/affiliate`, `/partner-terms`, `/referral-terms`. Also check network listing pages (PartnerStack marketplace, Impact campaign info), footer "Legal" pages and the help center. Flag "terms behind network login" as `unknown` and ask the creator to paste them during Onboarding. Their accepted terms are the authoritative version anyway.
2. **Extract:** fetch HTML/PDF and store a hash and the raw text in R2. Split into clauses and classify each clause against the rubric with an LLM plus keyword pre-filter (bid, keyword, PPC, coupon, cashback, redirect, cloak, iframe, domain, meta, schema, AI, self-referral, email, CAN-SPAM). Require a verbatim quote for every classification. Route low-confidence results to human review.
3. **Re-verify:** weekly hash check (cheap). On a hash change, re-classify and notify affected creators. Do a full human review quarterly for the top 50 programs by Ancaster traffic. Stamp `last_verified` on every block.
4. **Directory claim check:** the claim that "no existing affiliate directory provides this filter" is **not confirmed and should be softened**. openaffiliate.dev (a community directory) lists per-program restrictions such as "No brand bidding" and "No coupon or cashback sites".\[53\] An Apify actor scrapes "restrictions" for AI dev tools,\[54\] and CPA directories have long displayed allowed traffic types per offer. What we found no one offering is a **dated, quote-backed, per-rule permissions block that is re-verified on a schedule and applied to the creator's own pages**. That narrower claim is defensible.

---

## 6. Is there conversion data for interactive demos on warm traffic?

### Evidence

- **AR/3D:** "Products with AR/3D content see 94% higher conversion" traces to Shopify itself: a September 2020 Shopify tweet ("Interactions with products having 3D/AR content showed a 94% higher conversion rate than for products without AR/3D") and a May 11, 2022 Shopify Changelog entry ("Merchants who add 3D content to their stores see a 94% conversion lift, on average"). BrandXR, Single Grain, Banuba and others repeat it. Neither Shopify source gives a methodology, and the tweet's wording compares shoppers who *chose* to interact against those who did not, which is textbook self-selection. Brand case figures (IKEA Place +189%, Sephora +112%, Wayfair +92%, Warby Parker +85%) circulate on agency blogs without primary sources.\[55\] 3DLOOK's own figure is 13–16% average lift (vendor).\[56\] One critique notes most such studies come from furniture and accessories, not categories where fit is complex.\[57\]
- **Quizzes, configurators, calculators, playable ads, shoppable video:** this pass found no neutral, controlled studies. Available figures are vendor case studies.
- **Warm vs cold:** no study found separates referred/high-intent traffic from cold traffic for interactive pages. The closest relevant datapoint is Podscribe's observation that software advertisers get strong visit rates from podcast listeners but weak purchase conversion.\[5\] That means warm audio traffic arrives, then fails to convert on SaaS sites, which is the gap an interactive "try it" page is meant to close. It is a rationale, not evidence.
- **Academic work:** not reached in this pass. There is no basis to cite a specific marketing-science result.

**Plain statement:** there is **no published evidence** on creator-referred traffic landing on an interactive offer page. Ancaster's test would be the first public datapoint.

### How to make Ancaster's A/B test credible

- **Pre-register** (OSF or a public GitHub commit with a timestamp): hypothesis, primary metric (network-reported conversions per unique click within the program's attribution window), secondary metrics (code copies, time-to-conversion, refund/chargeback rate), stopping rule and analysis plan.
- **Randomize at click level within creator and offer**, with a 50/50 split in the Worker. Keep the destination and code identical across arms, so only the page differs.
- **Sample size:** use the section 1 table (e.g., ~21,000 clicks per arm at a 2% baseline to detect +20%). Do not peek, or use a sequential design declared in advance.
- **Confounds to control:** creator-level variance (analyze with creator fixed effects or a mixed model and report per-creator results); code leakage (exclude or separately report code conversions with no click); network crediting rules (record the policy per program); novelty (run ≥4 weeks); bot traffic (filter by known bot UA and zero-dwell clicks).
- **Publish** the pre-registration, the anonymized aggregate data, the null result if it fails, and the kill decision. A published null result from a pre-registered test earns more trust than a vendor-style "up to X%" figure.

---

## 7. What can a store's order data legitimately tell us about attribution without a cookie?

### What Shopify exposes

- **Order-level (GraphQL Admin API):** `discountCodes`, `landingPageUrl`, `referrerUrl`, `sourceName`, custom/note attributes, and `customerJourneySummary`. The summary includes `firstVisit` and `lastVisit` (`CustomerVisit`: `landingPage`, `referrerUrl`, `source`, `sourceType`, `sourceDescription`, `utmParameters` {source, medium, campaign, term, content}, `referralCode`, `marketingEvent`, `occurredAt`), `moments`, and `momentsCount`. Shopify documents that `referralCode` is populated from URL attributes `ref`, `source` or `r` (e.g., `?ref=j2tj1tn2`).\[58\]
- **Reliability caveats:** developer forum threads report `referralCode` "no longer consistently populating" and UTM data "not always populated", and journey data is only available after an order exists.\[59\]\[60\]\[61\] Design reconciliation to tolerate missing journey data, with the discount code as the primary key.
- **REST retirement:** REST Admin is legacy as of October 1, 2024, and new public apps must use GraphQL exclusively as of April 1, 2025.\[62\] The old `landing_site` field maps to `landingPage`.\[63\]
- **Shareable discount links:** Shopify's Help Center documents `/discount/CODE?redirect=/new-path` to apply a code and land on a chosen page. With multiple discounts on one product, "the most recent discount applies to your shareable discount links". Native links carry one code only.\[64\]\[65\]
- **Collabs:** uses the `/discount` route for personalized affiliate links and "the same tracking data as the Shopify admin".\[4\] It credits link or code purchases, and it was not accepting new creator signups at the time of this pass.\[23\]
- **Web Pixels / privacy:** web pixel events fire for non-PII analytics. Customer email, name, phone and address fields are returned as null unless the app is approved for the corresponding protected customer data scopes (Shopify changelog on web pixel PII enforcement).\[66\]
- **Protected customer data:** apps using name, address, phone or email must meet Level 1 and Level 2 requirements, including processing "only the minimum personal data required" and informing merchants what is processed and why.\[67\]
- **App Store rules relevant to Ancaster:** 1.1.2 use Shopify checkout (no bypass); 1.1.9 no auto-added charges without explicit consent; 3.2.1 `read_all_orders` only if necessary;\[62\] 5.1.5 return collected customer data to the merchant's admin; category rules for checkout extensions (merchant control of promotional content).\[62\] Built for Shopify adds: "Your app must not create draft orders to give custom discounts."\[68\] Post-purchase survey UIs are permitted via checkout/thank-you page extensions; this is how Fairing and KnoCommerce operate on the order confirmation page.\[3\]

### Privacy law constraints (summary, not legal advice)

Under GDPR, PIPEDA and CCPA/CPRA, Ancaster's plugin should act as the merchant's **processor/service provider**. Order data is used only to compute attribution for that merchant and its creators, and it is not combined across merchants into profiles. Store no customer PII (the attribution key is code + landing page + timestamp, and none of that needs email or name). Honor Shopify's customer privacy consent signals for any pixel-side collection, and support Shopify's mandatory data-erasure webhooks. Keeping to no-PII scopes avoids Level 2 review entirely.

### What the plugin can and cannot do

**Can (legitimately):**
- Read orders with `read_orders` (60-day window) and match `discountCodes` + `landingPage`/`utmParameters`/`referralCode` to Ancaster creator offers
- Create or sync creator discount codes via the discounts API and generate `/discount/CODE?redirect=…&ref=…&utm_source=ancaster` links for creator pages
- Run a one-question post-purchase survey via a thank-you page extension, and write results back to the merchant admin
- Report code-without-click rates, leak signals and lag per creator

**Cannot (or should not):**
- Bypass Shopify checkout, create draft orders to deliver custom discounts, or silently add charges
- Access customer PII without approved protected-data scopes, or join buyers across stores
- Guarantee journey fields are populated. Treat them as enrichment, not proof.
- Auto-apply a creator's code when the buyer arrived by another creator's link (the most recent code wins natively, which creates attribution conflicts). The plugin should log conflicts, not override buyer-visible pricing.

**Does Shopify permit the designed flow?** Yes. Creator link (`ancaster.link/sam/offer`) → creator page → CTA to `store.com/discount/SAM10?redirect=/products/x&ref=sam&utm_source=ancaster&utm_campaign=offer` → code pre-applied at Shopify checkout → order carries `discountCodes: [SAM10]`, `firstVisit.landingPage` containing `ref=sam`, and `referrerUrl` from `ancaster.link`. Every step uses documented Shopify features, and Collabs itself uses the same route.\[4\] The remaining risk is program-level, not platform-level: if the merchant also runs an affiliate network, that network's crediting rules decide who is paid.

---

## Synthesis: What changes

**Product shape.** Ancaster becomes a **code-first attribution and compliance layer with pages as the conversion surface**. There are three pillars: (1) creator code management, covering sayable codes, single-use codes behind the page, and leak monitoring; (2) reconciliation of code, click, network and Shopify order data with the survey multiplier; (3) the permissions block and Endorsement Ledger as the compliance surface, with a permission-aware export. The agent-readable endpoint stays later, and its output must pass each program's permissions block (e.g., no ElevenLabs marks in schema).

**Onboarding order.**
- **A. Program → link → content (current):** familiar, but it starts with the weakest asset.
- **B. Code → program/link → disclosure basis → content (recommended):** starts with the asset that survives every format, and immediately produces the first ledger entry and permissions check.
- **C. Content feed first (auto-detect offers from videos/newsletters):** impressive, but slow and error-prone, and it delays the first useful output.

**90-day plan.**
- **A. Keep the page-vs-link A/B test as the single headline experiment:** risky, because at realistic traffic it may not reach ~20,000+ clicks per arm in 90 days.
- **B. Instrument first, then test (recommended):**
  - Weeks 1–3: ship the logging spec, the code-without-click metric and the permissions sweep for the top 50 programs.
  - Weeks 3–6: pre-register and launch the A/B test on the highest-traffic creators.
  - Weeks 6–10: ship the Shopify plugin MVP (codes + discount links + order matching + one-question survey, no PII scopes).
  - Weeks 10–13: publish the first creator-journey report (code-without-click rate, lag, survey multiplier) and the A/B result or interim power statement.
  - Kill rules: if the page arm fails +20% at full sample, simplify pages to code cards. If code-without-click exceeds 50%, prioritize reconciliation and leak monitoring over page generation.
- **C. Drop pages, build codes and reconciliation only:** cheapest, but it abandons the one lever that could lift SaaS conversion on warm traffic before it has been tested.

## Caveats

- Podcast conversion figures come mainly from Podscribe, a measurement vendor whose pixel methodology includes modeled conversions. Its survey multiples vary substantially between quarters.
- Several merchant-survey statistics (fraud 63%, 18–24% non-incremental) come from vendor or aggregator pages without traceable primary sources and are directional at best.
- Terms for many SaaS programs sit inside Impact or PartnerStack and are not public. Cells marked "not verified" or "not public" should be filled from the terms each creator actually accepted. Amazon's paid-search clause and the major networks' baselines (CJ, Awin, Rakuten, Partnerize, FlexOffers, ClickBank) were not re-read in full in this pass.
- No branded-search-lift percentage, dark-social share or code-without-click benchmark for creator traffic was found. These remain open until Ancaster measures them.

## Sources

1. [Measurement FAQ – Podscribe | Help Center](https://help.podscribe.com/faq/pwCgkb2r3NPdJp2Dt8Kknp/measurement-faq-/jHz7oHZGuVuQMaHFHTVHLQ)
2. [Lag Report – Podscribe | Help Center](https://help.podscribe.com/measurement-/2ZBnvGeWNLNMWii3CPyVig/lag-report/3P4pnsa2UCKDfiCuQdbVxE)
3. [Fairing beta users gain up to 50% more attribution data from same orders](https://ppc.land/fairing-beta-users-gain-up-to-50-more-attribution-data-from-same-orders/)
4. [Shopify Help Center | Setting up personalized affiliate links for custom storefronts in the Collabs app](https://help.shopify.com/en/manual/promoting-marketing/collabs/merchants/custom-storefronts)
5. [What 97,000 Campaigns Reveal About the Future of Audio Advertising - Ad Results Media](https://www.adresultsmedia.com/news-insights/podcast-advertising-benchmarks-2026/)
6. [How to Measure Podcast Ad ROI in 2026 | Lets Go Wildcast](https://www.gowildcast.com/measure-podcast-ad-roi/)
7. [Podscribe Releases Q2 2025 Performance Benchmark Report, Featuring First-Ever Global Audio Ad Metrics](https://podnews.net/press-release/podscribe-ppb-q225)
8. [Pixel Tracking: A Game Changer for Podcast Advertising - ADOPTER Media](https://adopter.media/podcast-advertising-pixel-tracking/)
9. [Video Reshapes Podcasting As Audience Hits New High, Study Finds. | Story | insideradio.com](https://www.insideradio.com/free/video-reshapes-podcasting-as-audience-hits-new-high-study-finds/article_7bcc18a5-45a6-4a2a-98ba-0e137d7a62cb.html)
10. [The Podcast Consumer 2024 - SSRS](https://www.edisonresearch.com/the-podcast-consumer-2024-by-edison-research/)
11. [Brand Lift Studies Are Helping Make The Case For Podcast Advertising. | Story | insideradio.com](https://www.insideradio.com/free/brand-lift-studies-are-helping-make-the-case-for-podcast-advertising/article_511462d4-e695-11ea-b284-977b7b1d4136.html)
12. [Post‑Purchase Survey Strategy for DTC: Fairing and Enquire Setup, Attribution Models, and Decision Loops That Improve ROAS](https://byteandbuy.com/blog/dtc-postpurchase-surveys-fairing-attribution-roas)
13. [Promo Codes FAQ | I'm a Brand | impact.com Help Center](https://help.impact.com/brand/what-would-you-like-to-learn-about/platform-features/promo-codes/promo-codes-faq)
14. [Podcast & Audio Attribution That Proves ROI | Podscribe — Podscribe](https://podscribe.com/audio-attribution)
15. [Unique Single-Use Codes Are the Future of Affiliate Tracking | Uniqodo](https://www.uniqodo.com/post/the-future-of-affiliate-tracking)
16. [How to Track Coupon Codes: The 2026 Guide to Attribution & ROI - Tapfiliate](https://tapfiliate.com/blog/coupon-usage-statistics/)
17. [Coupon Fraud: How to Prevent Leaked Affiliate & Referral Codes — LoudCrowd](https://loudcrowd.com/blog/coupon-fraud/)
18. [How smart shoppers use ChatGPT to find coupons and other hidden discounts](https://www.consumeraffairs.com/news/how-smart-shoppers-use-chatgpt-to-find-coupons-and-other-hidden-discounts-060326.html)
19. [ChatGPT Can Find You Discount Codes For Anything You're About To Buy | Maverick AI](https://mavgpt.ai/resources/chatgpt-discount-code-finder-2026)
20. [AI Shopping Coupons and Discount Discoverability in 2026 | AdsX](https://www.adsx.com/blog/ai-shopping-coupons-discoverability-2026)
21. [Create a Promo Code | I'm a Brand | impact.com Help Center](https://help.impact.com/brand/what-would-you-like-to-learn-about/platform-features/promo-codes/create-a-promo-code)
22. [Credit Groups Explained | I'm a Brand | impact.com Help Center](https://help.impact.com/brand/what-would-you-like-to-learn-about/platform-features/actions-and-payouts/credit-groups-explained)
23. [Shopify Help Center | Getting paid for commissions on Shopify Collabs](https://help.shopify.com/en/manual/promoting-marketing/collabs/creators/payments)
24. [Creator Economy Statistics for 2026 | Circle Blog](https://circle.so/blog/creator-economy-statistics)
25. [Own Your Audience: The Migration to First-Party Channels | Theodyx](https://www.theodyx.com/our-thinking/own-your-audience-first-party-channels)
26. [ElevenLabs — ElevenLabs Creator Affiliate Program - Terms](https://elevenlabs.io/affiliates-terms)
27. [Affiliate Program Management 2026: A Simple Guide for Brands](https://trackier.com/affiliate-program-management/)
28. [Best Affiliate Program Management Agencies 2026](https://newengen.com/insights/best-affiliate-program-management-agencies/)
29. [Affiliate Marketing Trends 2026: Key Insights | Awin](https://www.awin.com/us/sector-insights/affiliate-marketing-trends-2026)
30. [Affiliate Marketing Statistics 2026: 130+ Data Points](https://www.digitalapplied.com/blog/affiliate-marketing-statistics-2026-data-points)
31. [Affiliate Program Management: 2026 Playbook + Examples](https://www.hamstergarage.com/article/affiliate-program-management-guide-examples)
32. [Should Affiliates be Allowed to Bid on Your Brand Keywords? - The Affiliate Guy Matt McWilliams - Advice for Affiliate Program Managers](https://www.mattmcwilliams.com/should-affiliates-be-allowed-to-bid-on-your-brand-keywords/)
33. [Shopify Affiliate Program Compliance Guidelines](https://growthcenter.shopify.com/blogs/getting-started/shopify-affiliate-program-compliance-guidelines)
34. [Affiliate program agreement](https://www.hostinger.com/legal/affiliate-program-agreement)
35. [10 best affiliate marketing programs to make profit in 2026](https://www.hostinger.com/tutorials/affiliate-marketing-programs/)
36. [Kinsta Inc. Affiliate Program Terms and Conditions](https://kinsta.com/legal/affiliate-terms/)
37. [Framer: Affiliate Terms](https://www.framer.com/legal/affiliates)
38. [Framer Affiliate Program: 50% of year 1 | Reditus](https://getreditus.com/affiliate-programs/framer)
39. [Webflow's affiliate program overview – Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961372613011-Webflow-s-affiliate-program-overview)
40. [Trademark Usage Policy | Webflow](https://webflow.com/legal/trademark-usage-policy)
41. [HubSpot Affiliate Program Policies](https://www.hubspot.com/partners/affiliates/program-policies)
42. [The Descript affiliate program - Descript Help Center](https://help.descript.com/connect-with-us/affiliates)
43. [The Creator’s Guide to Amazon Affiliate Policies: Do’s and Dont’s in 2024 | URLgenius Blog](https://app.urlgeni.us/blog/amazon-affiliate-polices-2024)
44. [Associates Program Policies](https://affiliate-program.amazon.com/help/operating/policies)
45. [Affiliate partners | Lovable](https://lovable.dev/affiliates)
46. [Canva Affiliate Program - Nice Product Tough Affiliate Program](https://prosociate.com/canva-affiliate-program/)
47. [Become a Canva affiliate through the Canvassador Program - Canva Help Center](https://www.canva.com/help/canva-affiliate-marketing-program/)
48. [Semrush Affiliate Program — \$200 Per Sale, 120-Day Cookie](https://marketplace.referly.so/affiliate-programs/semrush)
49. [Join Notion's Affiliate Program](https://www.notion.com/affiliates)
50. [Cursor Referral Program - #19 by kevinn - Discussions - Cursor - Community Forum](https://forum.cursor.com/t/cursor-referral-program/40555/19)
51. [Referral Program | Replit](https://replit.com/refer)
52. [Partner Terms of Service](https://partnerstack.com/legal/partner)
53. [Notion Affiliate Program — \$50 + 20% recurring | OpenAffiliate](https://openaffiliate.dev/programs/notion)
54. [AI Tool Affiliate & Referral Program Tracker · Apify](https://apify.com/ianymu/ai-tool-affiliate-tracker)
55. [AR Experiences That Boosted Conversion Rates by 189% - Single Grain](https://www.singlegrain.com/digital-marketing/ar-experiences-that-boosted-conversion-rates-by-189/)
56. [Virtual Try-On for Fashion Ecommerce | 2026 Guide](https://glance.com/us/blogs/glanceai/shopping/virtual-try-on-fashion-ecommerce)
57. [Virtual Try-Ons in Fashion: Can AR Truly Replace In-Store Shopping? — Grace](https://www.oyingrace.com/blog/the-ar-fashion-experiment-what-were-not-saying-about-virtual-try-ons)
58. [CustomerMoment - GraphQL Admin](https://shopify.dev/docs/api/admin-graphql/latest/interfaces/CustomerMoment)
59. [CustomerJourneySummary referralCode no longer consistently populating](https://community.shopify.com/t/customerjourneysummary-referralcode-no-longer-consistently-populating/290849)
60. [Subject: Accessing UTM Parameters on Thank You and Order Status Pages for Targeting - GraphQL Admin API Troubleshooting - Shopify Developer Community Forums](https://community.shopify.dev/t/subject-accessing-utm-parameters-on-thank-you-and-order-status-pages-for-targeting/23861)
61. [How to get UTM parameters and referrer of user session](https://community.shopify.com/t/how-to-get-utm-parameters-and-referrer-of-user-session/174291)
62. [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
63. [Capturing UTM Parameters in the landing\_site field Shopify with order webhook (Updated 2025) - MarTech, Marketing Automation & Web Tracking Consulting Services, Berlin](https://trackfunnels.com/capture-utm-parameters-shopify-order-webhook/)
64. [Shopify Help Center | Managing and editing your discounts](https://help.shopify.com/en/manual/discounts/managing-discounts)
65. [How to Create a Shopify Link with Discount Code: Easy Guide – MBC Bundles](https://mbc-bundles.com/blogs/shopify-tips/how-to-create-a-shopify-link-with-discount-code)
66. [Protected customer data scopes required for web pixel PII access starting on December 10th - Shopify developer changelog](https://shopify.dev/changelog/protected-customer-data-scopes-required)
67. [Work with protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)
68. [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements)
