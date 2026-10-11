---
id: ancaster-pass-18-the-engagement-layer-evidence-mechanics-and-the-exper
title: "Ancaster Pass 18: The Engagement Layer — Evidence, Mechanics, and the Experiment That Would Prove It"
kind: "Research pass"
topic: "Attribution & credit"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-89cf2b8b-1904-544e-a996-0d93ceebe8e9_text_markdown.md"
---

# Ancaster Pass 18: The Engagement Layer — Evidence, Mechanics, and the Experiment That Would Prove It

The engagement layer is worth building and testing. The evidence that real purchases are delayed is strong. The evidence that "remembered intent" can be brought back is good for retargeting and wishlists, which are its paid and merchant-owned versions. The affiliate rules that decide whether a delayed purchase gets credited mostly allow a publisher-owned keep-it layer, provided that the second moment produces a fresh, consented click through the publisher's own link. Nobody has published a test of the specific claim, that offering "keep it" at the click raises credited revenue over 60–90 days. That makes it the right experiment for Ancaster to run first.

## TL;DR

- **Decisions are delayed, and credit is lost in the gap.** Baymard finds 43% of US cart abandoners were "just browsing / not ready to buy." Swym's vendor data puts the average visit-to-purchase journey at 41 days. Impact.com's 2025 benchmark shows content-review partners drive 18% of affiliate clicks but only 9% of transactions, while loyalty/rewards partners drive 15% of clicks and 50% of transactions.\[1\] Content creates the intent, and the final click collects the money.
- **The mechanics favour a re-click, not a longer cookie.** Amazon credits only a 24-hour session, or cart items bought within 89 days of that click.\[2\] PartnerStack's default is 90-day last-click, and a new click restarts the window. Amazon allows Special Links in email to opted-in recipients who have an easy opt-out. So a reminder that brings the reader back through the publisher's own link is the legitimate way to get delayed credit. Retargeting research (Sahni et al., JMR 2019) shows the value of a reminder decays fast: 33% of week-one effect lands on day one.
- **Run a three-arm, click-level randomized test with arm-coded sub-IDs, measured on credited conversions by click date at 30/60/90 days.** Start with B (straight through + post-click keep-it on the publisher's surface) against A (straight through). C (keep-it before continuing, never gating) comes second, because it risks lowering immediate conversion. Detecting a 20% relative lift on a 3% base rate needs roughly 14,000 clicks per arm, so pool across publishers from day one.

## Key Findings

1. **Delay is the norm, and it varies a lot by category.** Low-ticket physical goods mostly convert quickly. SaaS, travel and high-consideration goods convert over weeks. No affiliate network publishes a network-wide click-to-sale lag distribution, and that gap is itself a finding: Ancaster can produce this dataset.
2. **Intent decays fast, but not to zero.** The strongest independent evidence (a randomized field experiment on retargeting) says reminders work, work best early, and build on each other.\[3\] Save-for-later and wishlists give readers a reason and a place to come back.\[4\] Vendor data says savers convert far better than average visitors, but that is selection, not proof of cause.\[5\]
3. **Credit survives delay only through the publisher's link.** Amazon, PartnerStack and Impact are all last-click at their core.\[2\] A reminder that produces a genuine new click is legitimate. Anything that sets or refreshes cookies without a click is cookie stuffing.\[6\] The Honey litigation and Chrome Web Store policy changes show where that line is enforced.\[7\]
4. **Someone already keeps the recommender's credit at the "later" moment.** ShopMy says saved wishlist items "remain commissionable for creators indefinitely."\[8\] It does this inside its own closed marketplace. No one appears to offer a publisher-owned, cross-program version on the publisher's own domain.
5. **Onboarding from the back catalog is technically feasible when the publisher authenticates.** YouTube caption downloads need edit permission on the video, which the publisher has.\[9\] Podcast transcripts are in RSS via `podcast:transcript`.\[10\] Sitemaps and newsletter archives are easy. Instagram and TikTok are the most limited. Google's scaled-content and thin-affiliation enforcement (renewed in the August 2026 spam update) means drafts must be approved and edited by the publisher, never mass-published.\[11\]\[12\]

## 1. How Delayed Are Real Decisions?

### Evidence by product type

| Category | Evidence | Source type | What it means |
|---|---|---|---|
| E-commerce broadly | 43% of US shoppers who abandoned a cart were "just browsing / not ready to buy"; average cart abandonment 70.22% (Baymard, 2025)\[13\] | Independent research firm | A large share of clicks are from people deciding later, not people who were lost |
| E-commerce broadly | "The average shopper takes exactly 41 days to move from their initial site visit to a final purchase," with 6–8 touchpoints (Swym, study of 49K merchant accounts)\[14\] | Vendor (wishlist app) | Directionally supports a slow funnel; the "exactly" framing is marketing |
| Affiliate retail (North America) | 2025: clicks +2% YoY, transactions −5%, conversion −6%; November clicks +45% YoY with the year's lowest conversion; "Shoppers used November to build carts and compare options, then waited" (Impact.com, Feb 2026, 2,368 brands)\[1\] | Vendor (network), large sample | Aggregate evidence that affiliate clicks come before later purchases |
| Affiliate partner roles | Content Review: 18% of clicks, 9% of transactions, 24% of spend; Loyalty & Rewards: 15% of clicks, 50% of transactions (Impact.com 2025 benchmark)\[1\] | Vendor | Content creates the intent; last-touch partners take the transaction |
| SaaS | Across 200 B2B products, median free-to-paid 8%; 14 days is the most common trial (62%); card-required trials convert ~30%; per 1,000 visitors, standard trials gave 45 signups/3.6 paying vs card-required 35/10.5 (ChartMogul/Growth Unhinged/ProductLed, 2026)\[15\]\[16\] | Vendor-adjacent benchmark | The signup often comes weeks before revenue; programs paying on paid conversion carry a built-in 14–30+ day lag |
| Higher-ACV SaaS | Products with ACVs of $1K–$5K had the highest free-to-paid rates (10% median), and higher-ACV products take longer (ProductLed via Userpilot)\[17\] | Vendor | Lag grows with price and number of approvers |
| Travel | "The average path to purchase… is 71 days" (Expedia Group Media Solutions, 2023 survey)\[18\]\[19\] | Vendor survey | Long-lag category; sits outside most 30-day cookies |
| Courses, prosumer tools | No credible published lag data found | — | **Untested.** The experiment should produce it |

**What's missing:** the subagent searched for network-wide click-to-sale lag distributions from Impact, Awin, CJ, Rakuten, Skimlinks, Sovrn, LTK, ShopMy, PartnerStack and Amazon, and found **none published**. The networks have this data internally. Awin's reporting includes click-to-sale lag and journey-path views,\[20\]\[21\] and Impact's Actions API returns both `ReferringDate` and `EventDate`.\[22\] Figures that circulate online, such as "average 10 days click to sale" or "93–98% within 30 days," trace back to unsourced roundups or tracking-software vendors.\[23\]\[24\] **Do not cite them.** No credible source tells us what share of conversions falls outside typical cookie windows. Ancaster can measure it per publisher from Impact's timestamps.

### Need triggers and the messy middle

Google and The Behavioural Architects' 2020 "Decoding Decisions: Making Sense of the Messy Middle" models buying as a **trigger**, then a looping **exploration (expansive) / evaluation (reductive)** phase, then purchase. It found cognitive biases (category heuristics, social proof, authority, scarcity, power of now, power of free) drive choice.\[25\]\[26\] In its simulated experiments, a fictional cereal brand "supercharged" with benefits took 28% preference from an established favourite, and a fictional car insurer took 87%.\[26\] Critics note the tests used simulated ad environments.\[27\] The 2023 follow-up ("Marketing in the messy middle") found Australian shoppers loyal to *product* over *retailer*: "almost 1 in 2" would switch to their second-choice retailer, versus "1 in 4" who would switch product brand.\[28\]

**What this means for Ancaster (interpretation):** people remember *what* they decided to buy longer than *where* they heard about it. A delayed buyer who remembers "the tool the publisher uses" but not the link will search the brand, buy direct or through a loyalty portal, and the publisher gets nothing. That matches prior-pass findings: delayed purchases arrive via brand search or direct, and codes capture about one in five pixel-measured conversions. The keep-it layer is a way to keep *where* attached to *what*.

**Trigger taxonomy (invention, grounded in the messy-middle model, to be validated by the qualitative probe):**
- **Project start:** "I'm finally setting up the home lab."
- **Price or plan change:** a free tier shrinks, a sale starts.
- **Breakage or outgrowing:** the current tool fails, or a limit is hit.
- **Re-exposure:** the publisher mentions it again.
- **Social proof:** a peer adopts it.
- **Calendar:** payday, fiscal year-end, holidays.

Only three of these can be *observed* by Ancaster: price/plan change (via the watchdog), re-exposure (via the publisher's new content), and reader-declared timing ("remind me in March"). Those are the only honest reminder triggers.

## 2. What Brings People Back at the Second Moment?

| Mechanism | Best available evidence | Credits original recommender? | Consent posture |
|---|---|---|---|
| **Retargeting (paid analogue)** | Randomized field experiment with a home-improvement retailer: retargeting caused **14.6% more users to return within four weeks**; **33% of the first week's effect occurred on day one**; week-2 ads worked better when week-1 ads ran (Sahni, Narayanan & Kalyanam, *JMR* 2019)\[3\] | No: credits the advertiser's paid channel | Tracking-based; weak consent |
| **Merchant wishlists / save-for-later** | Swym: wishlist engagers "convert at 31% over the full consideration window" vs 2–3% average; illustrative case of wishlist-to-purchase time falling from 45 to 18 days with price-drop emails (KISSmetrics glossary example)\[5\]\[29\] | No: credits the merchant | Account or email opt-in |
| **Creator storefront favourites** | ShopMy: saved wishlist items "remain commissionable for creators indefinitely… even if it's weeks or months after the original click" (July 2025).\[8\]\[30\] LTK offers "Save for later" lists; no conversion data found\[31\] | **Yes, inside the platform** | Platform account |
| **Price/back-in-stock alerts** (Keepa, CamelCamelCamel, Honey, Capital One Shopping) | No independent return-rate data found this pass | Generally no; shopping extensions historically claim last click themselves (see Honey below)\[32\] | Extension install / account |
| **Trial-expiry & re-engagement email** | Industry practice; no independent effect sizes found this pass | Only if the link is the affiliate's | CASL/CAN-SPAM regulated |
| **Web push** | No independent data found this pass | Only if the link is the affiliate's | Explicit browser permission |
| **Read-later / bookmarks** (Pocket, Raindrop) | No data on purchase outcomes | Only if the saved URL is the affiliate link; Mozilla shut Pocket down on July 8, 2025, and deleted user data and the Pocket API on October 8, 2025 (TechCrunch, May 22, 2025) | User-controlled |

**Interpretation:**
- **Decay is steep.** The retargeting result is the only independent causal evidence found. It says a reminder is worth most within about 24 hours and loses value over weeks.\[33\] That argues for **arm B (post-click keep-it)**, with the first touch (e.g., "your setup notes") sent the same day, not a week later.
- **Returners convert better, but vendor claims of "3–5x" are mostly selection.** Returners were already more interested.\[34\] Only a randomized design can separate the effect of the layer from the type of person who chooses to save.
- **The credit question is the product's reason to exist.** Every existing "later" mechanism outside creator marketplaces credits the merchant, the ad network or the extension, and none credit the publisher. ShopMy proves that recommender-credited saved items are commercially viable. Ancaster's version would be publisher-owned and cross-program.

### Consent and law for reminders sent on a publisher's behalf

*(These are standing legal requirements summarised from the statutes; primary regulator pages were not re-fetched this pass. Confirm with counsel before launch.)*
- **CASL (Canada, applies to Ancaster and to Canadian recipients):**
  - Any commercial electronic message needs consent, sender identification and a working unsubscribe honoured within 10 business days.
  - A reader clicking "tell me when the free tier changes" is **express consent for that stated purpose**, if the request names the publisher (and Ancaster as sender on their behalf) and the purpose.
  - Implied consent from an inquiry lasts only 6 months.
  - Express consent lasts until withdrawn. Record it with a timestamp, the wording shown, and the publisher.
  - Ancaster should never widen a "notify me about X" consent into a general newsletter subscription unless the reader separately opts in.
- **CAN-SPAM (US):** opt-out model. It requires accurate headers, a physical postal address, a clear opt-out and honouring it within 10 business days. Less strict than CASL, so designing to CASL covers it.
- **GDPR/ePrivacy (EU/UK):** marketing email to individuals generally needs consent. The "soft opt-in" exception covers a sender's *own similar products* after a sale, which does not fit a publisher recommending third-party offers. Use express consent. Ancaster is processor, the publisher is controller, and a DPA is required.
- **Amazon specifically:** "Special Links can only be used via emails, SMS messages, or social media posts to send to recipients who have opted-in to receive such communications from you and are given an easy way to opt out" (Amazon Associates help).\[35\] Printed material, ebooks (PDFs), mailings and oral solicitation remain prohibited.\[36\]

## 3. Affiliate Rules and Attribution Mechanics for the Slow Funnel

**Amazon Associates (Program Policies updated April 14, 2026):**
- A Qualifying Purchase requires a click through a Special Link, followed within a single **Session** by a purchase.\[36\]
- The Session ends at the first of three events: **24 hours elapse**, an order is placed, or "the customer clicks through a Special Link to an Amazon Site that is not your Special Link."\[2\]\[36\]
- A product added to cart during the Session qualifies if the order is completed "no later than 89 days after their initial click-through."\[2\]\[36\]\[37\]

Implications:
- A keep-it save does nothing for Amazon credit by itself. **Only a fresh click weeks later starts a new 24-hour Session.** The slow funnel works on Amazon *only* through re-clicks.
- A reader's later click through someone else's Amazon link ends your Session.\[2\]\[36\]
- The policies disqualify purchases referred via a **"Redirecting Link"**, meaning a link that "sends users indirectly to an Amazon Site via an intermediate site, without requiring the customer to click on a link or take some other affirmative action."\[36\] Arm C's interstitial is compliant *only because* the reader must click to continue. Never auto-forward on a timer.
- The participation requirements bar Special Links in pop-ups or "transitional page ads" around sites that are not yours.\[38\] The keep-it layer must live on the publisher's own domain.
- Amazon also warns against "manipulating or combining attribution links" to claim commissions from Associates and another program on the same traffic.\[36\] Don't stack a network link in front of an Amazon link.

**PartnerStack (SaaS):**
- Default is **90-day, last-click** attribution. "If the potential customer clicks on the referral link again, the 90 days will restart."\[39\]\[40\]
- Tracking requires the same browser and device.\[41\]
- Legacy JavaScript-set first-party cookies are capped at 7 days by Safari ITP if the user doesn't return.\[42\]
- A reminder re-click therefore **extends** credit and reattaches it to the device the reader is using *now*. That solves part of the cross-device problem.

**Impact.com:**
- Last-click at its core.
- The Partner Actions API returns `ReferringDate` (click), `EventDate` (conversion), `LockingDate` and `ReferringType` (e.g., `CLICK_COOKIE`) per action, plus sub-IDs.\[22\]\[43\]
- **Click-to-conversion lag is directly measurable per action.** This is the best measurement surface for the experiment.

**Dub:**
- Records click → lead → sale, with the click ID stored in a `dub_id` cookie.\[44\]
- The lead event becomes "the source of truth for the customer's identity," and later sales attach to it.\[45\] A free-tier signup captured early locks in credit for later upgrades.
- Conversion endpoints require Dub's Business plan (vendor-side).\[46\]
- For Ancaster, this makes free-tier SaaS the *best* category for the slow funnel: the signup is the durable anchor.

**Awin/CJ/Rakuten:** last-click by default with program-set windows. Awin describes 30 days as the "industry standard."\[47\]\[48\] Reports expose click and transaction dates. Per-action lag export was not verified this pass.

**Offers in Ancaster's 401-offer index:** the per-rule permissions table should add three fields per offer:
- email/reminder links allowed (Y/N/conditional)
- re-click resets window (Y/N/unknown)
- API exposes click date (Y/N)

This pass verified Amazon, PartnerStack, Impact and Dub only.

**Incentives, stuffing, reminders:**
- **Cookie stuffing** means setting affiliate cookies without a genuine click. It is universally prohibited.\[6\]
- In the Honey litigation, creators alleged PayPal's extension overwrote their attribution at checkout:\[49\]\[50\]
  - The court dismissed the first complaint in November 2025 for failing to show the plaintiffs were entitled to the commissions under last-click contracts.\[51\]
  - Plaintiffs' counsel reports the court denied PayPal's motion to dismiss the amended complaint on June 22, 2026.\[52\] The case is active, and the allegations are unproven.\[7\]
  - Google's Chrome Web Store Affiliate Ads policy (effective June 10, 2025, first reported by 9to5Google in March 2025) says affiliate links, codes or cookies "must only be included when the extension provides a direct and transparent user benefit related to the extension's core functionality," and that "related user action is required before the inclusion of each affiliate code, link, or cookie."
- **The lesson:** Ancaster's reminders must only ever *present* a link that the reader chooses to click. Don't pre-fetch, don't open hidden tabs, and don't refresh cookies in the background.
- **Incentivised clicks:** don't reward readers for clicking (points, raffles). Amazon's Participation Requirements forbid offering "any consideration or incentive (including any money, rebate, discount, points, donation to charity or other organization, or other benefit) for using Special Links," and many other programs restrict incentives too. Verify per program in the index.

## 4. Publisher Content Marketing Flywheels

**What the evidence supports:**
- Impact's data shows content-review partners are **upstream**: they take a large share of spend relative to transactions because their influence converts later, and brands pay for that.\[1\]
- The durable formats are the ones that get re-found when the need arrives: stack/"what I use" pages, comparison posts and evergreen tutorials. Readers return to them at the trigger moment.
- Recurring "tools I'm using" newsletter segments act as scheduled **re-exposure** triggers.
- No independent multi-year study of which format earns most was found this pass. Creator income reports are anecdotal and survivorship-biased. **Untested; Ancaster can measure revenue by format from its own ledger.**

**Automated content from the back catalog (state of the art, not verified in detail this pass):**
- Descript, Riverside, Castmagic, Opus Clip and Snipd transcribe, draft show notes and clip highlights.
- None of them match mentions to a checked, permissioned offer index or keep a dated ledger of what was recommended. That combination is Ancaster's gap to fill.

**Policy risk:**
- Google's Search Central Blog (March 2024) defines scaled content abuse as "when many pages are generated for the primary purpose of manipulating Search rankings and not helping users," applying "no matter whether content is produced through automation, human efforts, or some combination of human and automated processes."
- The November 2024 site-reputation-abuse update, and Glenn Gabe's case studies of the **August 2026 spam update**, show enforcement against scaled AI content, programmatic pages and "thin affiliation."\[11\]\[53\]
- **Design implication:** Ancaster drafts one stack page and a small number of pieces grounded in what the publisher actually said, with quotes and timestamps. Nothing publishes without the publisher's edit and approval. FTC disclosure (and Canada's Competition Bureau equivalent) must be built into every template.

**Onboarding feasibility:**

| Step | Feasibility | Constraint |
|---|---|---|
| YouTube descriptions | High: Data API with the publisher's OAuth | Quota budget |
| YouTube transcripts | High for the owner: `captions.download` "requires the user to have permission to edit the video," costs 200 quota units per call; `captions.list` costs 50\[9\]\[54\] | Won't work for others' videos; scraping public captions from cloud IPs gets blocked. Owner OAuth only\[55\] |
| Podcast transcripts | High where present: `podcast:transcript` (VTT/SRT/JSON) in RSS; Apple has displayed transcripts since iOS 17.4 (March 2024) and ingests the creator's own via the tag\[56\]\[57\]\[58\] | Apple's auto-transcripts aren't exported to third parties (inference); fall back to Workers AI speech-to-text on the audio enclosure |
| Newsletter archives | High: public archive pages/RSS, or export from the ESP | Paywalled posts need publisher export |
| Website | High: sitemap crawl of the publisher's own domain | Respect robots |
| Instagram | Medium: Graph API reads a professional account's own media captions | No personal accounts; limited history |
| TikTok | Low–medium: API returns the user's own video metadata | Descriptions only; transcripts would need audio processing |

## 5. Adjacent Products Already Living in "Later"

- **ShopMy** is the closest analogue: the saved item keeps creator credit indefinitely.\[8\]\[30\] Its limit is the closed marketplace, where credit lasts only while buying stays inside ShopMy.
- **Swym and merchant wishlists** show the reader behaviour: saving signals intent and gives a reason to come back.\[4\] They credit the merchant.
- **Price trackers and shopping extensions** (Keepa, CamelCamelCamel, Honey, Capital One Shopping) live at the second moment, but historically *take* last-click credit rather than pass it back.\[32\] The Honey case is the cautionary tale.\[59\]
- **AI shopping memory** (ChatGPT, Perplexity and Google shopping lists and price tracking) is the emerging competitor for "later." It remembers the product but not the recommender. Features were not verified in detail this pass.
- **Is anyone building a publisher-owned "remember this for me" layer that keeps the publisher's credit across programs?** None found. Treat this as "not found in this pass," not "doesn't exist."
- **Trust versus rejection of reminders:** no independent study was found this pass. The design principles below are reasoned rather than proven:
  - **Only remind on the reader's chosen trigger.** Unrequested follow-ups turn a service into spam.
  - **Send one reminder per trigger.**
  - **Say why:** "you asked to hear when the free tier changes."
  - **One-click stop.**

## 6. Experiment Design

**Hypotheses (pre-register before launch):**
- **H1 (primary):** Arm B produces more credited conversions per 1,000 clicks than Arm A at 90 days, attributed by click date.
- **H2:** Arm C ≥ Arm A at 90 days, and Arm C's day-0 credited conversions are no more than 5% (relative) below Arm A's. This is the non-inferiority guardrail on immediate conversion.
- **H3:** The share of credited conversions with lag over 24 hours / 7 days / 30 days is higher in B and C than in A.

**Arms:**
- **A:** straight through (control).
- **B:** straight through, plus a post-click keep-it offer on the publisher's own surface. The offer appears when the reader returns to the tab, and in the publisher's "saved" page and newsletter.
- **C:** a keep-it choice shown before continuing. The "continue" button is always primary. Never gate, never auto-forward.

**Randomization without tracking readers:**
- Assign the arm at the redirect Worker by hashing the per-click ID, with no reader identifier.
- Encode the arm in the sub-ID or tracking ID: Impact SubId, a separate Amazon tracking ID per arm, a PartnerStack/Dub link per arm.
- **Every downstream link for an item saved in arm B/C carries the originating arm's code** (intention-to-treat). Later reminder clicks then credit the arm that created them.
- Contamination (the same person seeing different arms across clicks) biases results toward zero, so it makes the test conservative.
- Alternative for low-traffic publishers: daily switchback (all clicks on a given day get one arm), analysed with day-level clustering.

**Outcomes:**
- **Primary:** credited signups/sales per 1,000 clicks at 30/60/90 days, by click date. Use Impact `ReferringDate`/`EventDate`, PartnerStack/Dub event timestamps, and Amazon per-tracking-ID reports. Amazon reports by order date, so compare monthly totals per arm-ID.
- **Secondary:**
  - keep-it rate
  - return clicks per saved item
  - reminder click-through
  - new consented subscribers
  - unsubscribe and complaint rates
  - revenue per 1,000 clicks

**Power (two-sided α = 0.05, 80% power, clicks per arm):**

| Base credited rate | Relative lift | Clicks per arm |
|---|---|---|
| 8% (e.g., Amazon basket) | +15% | ~8,600 |
| 3% (SaaS signup) | +20% | ~13,900 |
| 3% | +10% | ~53,000 |
| 1% (paid SaaS) | +20% | ~42,600 |

These are standard two-proportion calculations. The base rates are **assumptions**; measure them in weeks 1–2. Most single publishers cannot power this alone, so pooling is required.

**Delayed, partial, aggregate data:**
- Analyse by *click cohort* (week of click), not report date.
- Freeze each cohort's read-out at 30, 60 and 90 days after its last click.
- Treat reversals (Impact `LockingDate`, Amazon returns) by re-pulling at lock.
- Where only aggregates exist (Amazon), use per-arm tracking IDs and compare totals with a Poisson or negative-binomial model per publisher-week.

**Pooling across publisher types:**
- Stratify randomization by publisher.
- Analyse with a mixed-effects model (publisher random intercept; product type and publisher type as fixed effects).
- Pre-specify subgroups: free-tier SaaS, paid SaaS, physical goods, courses.

**Guardrails and kill criteria:**
- Stop C if day-0 credited conversions fall more than 10% below A over 2,000+ clicks.
- Pause any publisher whose reminder complaint rate exceeds 0.1% or unsubscribes exceed 2% per send.
- Stop everything on any program-compliance notice.
- Kill the thesis (for that category) if B shows no lift at 90 days with the pre-registered sample. Otherwise, extend.

**Qualitative probe (runs in parallel):**
- Recruit 20–30 real audience members through participating publishers' newsletters (consented, compensated, not tied to any purchase).
- Run a 6–8 week diary: log every creator recommendation you noticed, what you did, and when and why you later bought or didn't.
- Close with 30-minute interviews reconstructing the last purchase that started from a creator mention.
- Code the results against the trigger taxonomy.
- The output is the list of real triggers that should drive reminders.

## 7. Synthesis: The Engagement Layer, Specified

**Purpose sentence:** *Ancaster keeps a publisher's recommendation within reach until the reader actually needs it, so the purchase that happens later is still credited to the person who earned it.*

**Reader experience:**
- **Now:** continue straight through, or "keep it." Keeping it means saving to the publisher's page, getting the setup notes, asking a question, or choosing a trigger.
- **Later:** one message on the chosen trigger. The saved item on the publisher's domain opens with a fresh click through the publisher's link.

**Publisher experience:**
1. Connect site, channel and feed.
2. Ancaster finds mentions and matches them to checked offers.
3. Ancaster drafts the stack page and supporting pieces.
4. The publisher edits and approves.
5. The publisher watches credited earnings by cohort over 90 days in the Recommendation Ledger.

**Build vs integrate:**
- **Build:** redirect and arm assignment, the keep-it surface, consent records, the trigger engine (watchdog + new-content + reader date), mention matching and drafting, cohort analytics.
- **Integrate:** partner APIs, the publisher's own ESP key (BYOK), Workers AI for transcription and matching, YouTube/RSS/sitemaps.

**Claims vs tests:**
- **Claim now:** "your links stay yours; saved items reopen through your link; every reminder is one the reader asked for."
- **Test, don't claim:** "keep-it raises your earnings."

**Fit with the Recommendation Ledger:** each keep-it save and each triggered re-click is a dated ledger entry tied to a signed Referral Receipt. The ledger becomes the evidence of delayed influence.

### Decisions (recommended option marked ★)

**Where keep-it lives**
1. ★ **Post-click, on the publisher's domain (the saved page plus a same-day "your notes" email for opted-in readers).** It doesn't slow the click and it matches the decay evidence.
2. A pre-continue interstitial (arm C). Higher keep-it rate, but risk to immediate conversion.
3. Inline next to every link in content. Most visible, but heavy engineering per surface.
*Decide for me: 1.*

**What triggers a reminder**
1. ★ **Reader-chosen triggers only: watchdog-detected price/plan change, publisher re-covers it, or a date the reader picks.**
2. Add a single "still interested?" nudge at day 14.
3. Behavioural re-engagement sequences. Not recommended: this is spam risk and needs consent Ancaster doesn't have.
*Decide for me: 1.*

**Which channel carries it**
1. ★ **Email via the publisher's own ESP key.** CASL-compliant express consent, and Amazon-permitted.
2. Web push. Needs a second permission, has weaker reach on iOS and less evidence.
3. Comment-to-DM follow-up. Needs platform policy review first.
*Decide for me: 1.*

**How onboarding drafts content**
1. ★ **One stack page plus up to 5 drafts, each quoting the publisher's own mention with a timestamp, published only on approval.**
2. Auto-draft a full roundup per category. Higher output, higher scaled-content risk.
3. Match only, no drafting. Safest, but less value.
*Decide for me: 1.*

**Which arm to run first**
1. ★ **A vs B.** Lowest risk and the cleanest answer to "does remembering help?"
2. A vs B vs C together. Needs 1.5x the traffic.
3. A vs C. Tests the bolder design first.
*Decide for me: 1, adding C once B has 30-day data.*

### 30/90-day plan

**Days 1–30:**
- Build arm assignment in the redirect Worker and arm-coded sub-IDs for Impact, PartnerStack/Dub and Amazon.
- Build the keep-it saved page and consent records (D1), plus the watchdog-driven trigger.
- Add reminder/email permissions and API click-date fields to the offer index.
- Pre-register H1–H3.
- Recruit 3–5 publishers of different types.
- Measure base rates for two weeks. Start the diary study.

**Days 31–90:**
- Run A vs B across pooled publishers.
- Pull cohort data weekly and publish the first 30-day read at day ~60.
- Ship onboarding (YouTube/RSS/sitemap mention matching → stack page draft) to the same publishers.
- Add arm C if guardrails hold.
- By day 90, report the first published click-to-credit lag distributions by category. This is a dataset no network publishes, useful whatever the result.

## Caveats

- Most quantitative "later" figures come from vendors: Swym, Impact, ChartMogul and Expedia. The only independent causal evidence on reminders is retargeting (Sahni et al.), from a single field experiment with an online seller of home-improvement products.
- No evidence exists yet that a publisher-owned keep-it layer lifts credited revenue. That is the experiment.
- The legal summaries (CASL, CAN-SPAM, GDPR) are from standing law, not freshly fetched regulator pages. Verify before launch.
- Automated-content tools, AI shopping memory features and Instagram/TikTok API limits were not re-verified in detail this pass.
- The Honey litigation is ongoing, and its allegations are unproven.

## Sources

1. [Affiliate Benchmark 2025: Fewer Buys, Higher Order Value](https://impact.com/affiliate/affiliate-marketing-benchmark/)
2. [Amazon Affiliate: The Definitive Guide](https://geniuslink.com/amazon-affiliate-guide)
3. [An Experimental Investigation of the Effects of Retargeted Advertising: The Role of Frequency and Timing - Navdeep S. Sahni, Sridhar Narayanan, Kirthi Kalyanam, 2019](https://journals.sagepub.com/doi/10.1177/0022243718813987)
4. [Capture Shopping Data & Shopper Insights | Swym Platform](https://www.getswym.com/platform/capture-shopping-data)
5. [How to Measure Purchase Intent in Your Online Store](https://www.getswym.com/blog/measure-purchase-intent)
6. [Clicks definition](https://www.lawinsider.com/dictionary/clicks)
7. [Honey Lawsuit: PayPal, Affiliate Theft, and What’s Next - LegalClarity](https://legalclarity.org/honey-lawsuit-paypal-affiliate-theft-and-whats-next/)
8. [ShopMy Launches Shopping Platform: A Personalized Destination Built by the Creators You Trust](https://www.prnewswire.com/news-releases/shopmy-launches-shopping-platform-a-personalized-destination-built-by-the-creators-you-trust-302516804.html)
9. [Captions: download | YouTube Data API | Google for Developers](https://developers.google.com/youtube/v3/docs/captions/download)
10. [Add Transcripts to Your Podcast](https://podcasting2.org/docs/guides/how-to-add-transcripts-to-your-podcast)
11. [Google's August 2026 Spam Update – Scaled Content Abuse, AI Content, Programmatic Content, Thin Affiliates, And More \[Case Studies\]](https://www.gsqi.com/marketing-blog/august-2026-google-spam-update-case-studies/)
12. [Google Search Central Spam Policies: Scaled Content ...](https://bulkbase.ai/seo/understanding-googles-scaled-content-abuse-policy)
13. [WooCommerce Browse Abandonment: How To Win Back Shoppers](https://savetowishlist.com/woocommerce-browse-abandonment/)
14. [You Won't Believe How Long Your Shoppers Take to Buy](https://www.getswym.com/statistics/ecommerce-average-purchase-window)
15. [The SaaS Conversion Report: A new look at free-to-paid conversion | ChartMogul](https://chartmogul.com/reports/saas-conversion-report/)
16. [Free Trial Conversion Statistics 2026: SaaS Benchmarks by Industry | Konabayev](https://konabayev.com/blog/free-trial-conversion-2026/)
17. [Free Trial Length in SaaS Doesn’t Matter As Much as You Think in 2026](https://userpilot.com/blog/free-trial-length-saas/)
18. [Travelers’ booking journeys and why it matters for advertisers](https://advertising.expedia.com/?p=17097)
19. [Expedia Group Path2Purchase 2023](https://go2.advertising.expedia.com/rs/185-EIA-216/images/Expedia_Group-Path2Purchase-2023.pdf)
20. [AWIN Affiliate Network: 8 Things Advertisers Should Know](https://www.datafeedwatch.com/blog/the-guide-to-increasing-sales-with-awin)
21. [Journey Path report](https://help.awin.com/docs/journey-path-report)
22. [List all actions](https://integrations.impact.com/impact-publisher/reference/list-actions-1)
23. [+120 Affiliate Program Performance Statistics: Revenue, Trends & More - wecantrack 🚀](https://wecantrack.com/insights/affiliate-program-performance-statistics/)
24. [What is the Recommended Cookie Lifetime for Affiliate Programs? 2025 Guide | Post Affiliate Pro](https://www.postaffiliatepro.com/faq/recommended-cookie-lifetime-affiliate-programs/)
25. [Inside Google research into the 'messy middle' of purchase ...](https://www.warc.com/newsandopinion/news/inside-google-research-into-the-messy-middle-of-purchase-behaviour/en-gb/43917)
26. [The “messy middle” of the purchase journey - Articles of Interest](https://articles.data.blog/2020/07/19/the-messy-middle-of-the-purchase-journey/)
27. [Google's Messy Middle: The Sequel](https://www.linkedin.com/pulse/googles-messy-middle-sequel-andrew-holland-)
28. [Buyer Behaviour in the Messy Middle - Think with Google AUNZ](https://business.google.com/aunz/think/consumer-insights/messy-middle-2023/)
29. [Wishlist Conversion - What It Is, How to Calculate & Track It | KISSmetrics](https://kissmetrics.io/glossary/wishlist-conversion)
30. [FAQs – ShopMy | Creator Guide](https://guide.shopmy.us/summer-2025-updates/5jLY2jskGAENwEWJEf147B/faqs/5kdVRoGw9nmmppW3uMKyRZ)
31. [LTK: Shop Trusted Recs App - App Store](https://apps.apple.com/us/app/ltk-follow-shop-creators/id1154027990)
32. [What is session hijacking and how to fix it 🔨](https://trentturner.substack.com/p/session-hijacking)
33. [An Experimental Investigation of the Effects of Retargeted Advertising: The Role of Frequency and Timing](https://www.scu.edu/business/marketing/research/selected-publications/an-experimental-investigation-of-the-effects-of-retargeted-advertising-the-role-of-frequency-and-timing.html)
34. [First-Time vs Returning Visitor Conversion Rates Explained](https://www.growthsuite.net/questions/what-percentage-of-first-time-visitors-convert-vs-returning-visitors)
35. [Offline Use of Associates Links and Ads](https://affiliate-program.amazon.com/help/node/topic/GQ5CMSPVXBXSFDFV)
36. [Amazon.com Associates Central](https://affiliate-program.amazon.com/help/operating/policies)
37. [How Long Does Amazon Affiliate Cookie Last?](https://keyword.com/blog/how-long-does-amazon-affiliate-cookie-last/)
38. [Amazon.com Associates Central - Associates Program Participation Requirements](https://affiliate-program.amazon.com/help/operating/participation/)
39. [Step 1: Getting Click ID](https://docs.partnerstack.com/docs/getting-integrated-with-s2s)
40. [Cookie windows and attribution logic](https://support.partnerstack.com/hc/en-us/articles/360009312753-How-are-partner-referral-links-tracked)
41. [Cookie windows and attribution logic – PartnerStack](https://support.partnerstack.com/hc/en-us/articles/360009312753-Cookie-windows-and-attribution-logic)
42. [Google Privacy, Apple ITP 2.3, and your PartnerStack program – PartnerStack](https://support.partnerstack.com/hc/en-us/articles/360011902273-Tracking-Cookies-and-ITP-2-0)
43. [Enable & View Data Feeds | I'm a Brand | impact.com Help Center](https://help.impact.com/brand/what-would-you-like-to-learn-about/account-administration/account-settings/enable-and-view-data-feeds)
44. [How attribution works - Dub](https://dub.co/docs/concepts/attribution)
45. [Conversion tracking - Dub](https://dub.co/help/article/dub-conversions)
46. [Track a sale conversion event with the Dub API](https://dub.co/docs/api-reference/endpoint/track-sale)
47. [Understanding cookies in affiliate marketing](https://advertiser-success.awin.com/s/article/What-is-cookie-duration)
48. [What is a cookie period? - Advertiser Success Center - Awin](https://advertiser-success.awin.com/s/article/What-is-a-cookie-period?language=en_US)
49. [PayPal Wins Dismissal of Influencer Lawsuit Over Honey’s Alleged “Cookie Stuffing”](https://hellopartner.com/2025/11/25/paypal-wins-dismissal-of-influencer-lawsuit-over-honeys-alleged-cookie-stuffing/)
50. [The PayPal Honey Lawsuit: What Is Commission Hijacking?](https://www.makeinfluence.com/en/academy/the-paypal-honey-lawsuit-what-commission-hijacking-means-for-affiliate-creators)
51. [PayPal’s Honey Sheds Influencers’ Affiliate Link Hijacking Suit](https://news.bloomberglaw.com/litigation/paypals-honey-sheds-influencers-affiliate-link-hijacking-suit)
52. [In Re PayPal Honey Browser Extension Litigation - Cohen Milstein](https://www.cohenmilstein.com/case-study/in-re-paypal-honey-browser-extension-litigation/)
53. [Updating our site reputation abuse policy | Google Search Central Blog | Google for Developers](https://developers.google.com/search/blog/2024/11/site-reputation-abuse)
54. [Captions: list | YouTube Data API | Google for Developers](https://developers.google.com/youtube/v3/docs/captions/list)
55. [YouTube Data API Transcripts: Why captions.download Fails](https://youtube2text.org/blog/youtube-data-api-transcripts)
56. [Apple Podcasts Embraces Chapters: Another Victory for Podcasting 2.0](https://blog.castopod.org/apple-podcasts-embraces-chapters-another-victory-for-podcasting-2-0/)
57. [Transcripts on Apple Podcasts - Apple Podcasts for Creators](https://podcasters.apple.com/support/5316-transcripts-on-apple-podcasts)
58. [Podcast RSS with Transcripts: The Spec, Apple Podcasts Support, and How to Add Them | ConvertAudioToText](https://convertaudiototext.com/blog/podcast-rss-with-transcripts)
59. [1 Class Action Complaint 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21](https://www.cpmlegal.com/assets/htmldocuments/GamersNexus%20v.%20Paypal.pdf)
