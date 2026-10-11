---
id: project-ancaster-what-influencer-advertising-systems-teach-an-indie-ad
title: "Project Ancaster: What Influencer Advertising Systems Teach an Indie Ad Network — Strategy Memo (September 2026)"
kind: "Build brief"
topic: "Attention & feeds"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/archive-3/ancaster-influencer-systems-memo.md"
---

# Project Ancaster: What Influencer Advertising Systems Teach an Indie Ad Network — Strategy Memo (September 2026)

Ancaster's best move into the creator economy is not a new influencer marketplace. It is to turn what it already has — short links, profile pages, newsletter placements — into a trusted booking-and-proof rail for small creators and small advertisers: a creator storefront that works as a rate card, escrowed payment with fast payout, disclosure built in by default, and verified click and conversion reporting that the creator owns. Influencer platforms have shown that the money follows three things: easy transactions, trust around payment, and believable measurement. Ancaster's link-tracking assets map directly onto the third, which is the weakest.

## TL;DR

- **The market is big, and the tooling for small players is weak.** Influencer marketing reached $32.55B in 2025 (Influencer Marketing Hub). Yet creators still wait 30–90 days to get paid, and brands still can't prove creator ROI. Enterprise tools like CreatorIQ and Grin serve big brands. Newsletter networks like beehiiv, Kit and Substack serve their own subscribers. Small creators who work across formats (newsletter + link-in-bio + short video), and the small advertisers who want them, are left out.
- **Copy the proven mechanics.** Creator storefronts with published rates (Passionfroot). Escrow that releases on approval (Collabstr). CPM/CPC paid on *verified* opens and clicks (beehiiv). Turning organic creator posts into paid ads (Spark Ads, Partnership Ads, YouTube Open Call). Disclosure built into the product (FTC 2023 Guides, Ad Standards' 2025 Canadian guidelines).
- **Recommended bet ("decide for me" pick): the Ancaster Booking Rail.** Every profile page becomes a bookable, cross-format media kit. Payment goes into escrow and pays out fast via Stripe Connect. Every placement ships with an Ancaster short link, a code and a one-question survey, so reports are defensible. Aim it at independent journalists and niche creators, with an ethics and disclosure promise. Build it on Workers/D1/R2/Durable Objects in four phases over roughly six months.

## Key Findings

### 1. Market structure: growth is real, and it's moving toward smaller creators and owned channels

- **Market size.** Influencer Marketing Hub puts influencer marketing at $32.55B in 2025. Mordor Intelligence estimates about $40.51B for 2026. The figures vary by what each source counts, so treat them as order-of-magnitude.
- **Budget intent is strong, but survey wording differs:**
  - Influencer Marketing Hub's 2026 Benchmark: 87.49% of brands expect influencer budgets to increase.
  - Aspire's 2026 report: 74% of marketers plan to increase budgets.
  - Linqia: 62% are increasing.
- **Brands are moving toward smaller creators.** Industry roundups say about 73% of brands now favor smaller creators, though no original source for that figure could be traced. Aspire reports that 86% of creators will still work for free product, a reminder that gifting is still how much of the long tail gets activated.
- **Newsletters and owned channels have become ad inventory:**
  - beehiiv runs a non-exclusive ad network built by the team that built Morning Brew's internal ad tools.
  - Kit (formerly ConvertKit) runs a Sponsor Network.
  - Substack, long "ad-free," started a native sponsorships pilot in December 2025, taking no cut during the beta. In June 2026 it launched a formal program; CEO Chris Best said brands such as Yahoo Scout, Whatnot, Granola, Balenciaga, T-Mobile, Polymarket and Uber will be "investing millions of dollars in the creators who choose to participate."
- **Link-in-bio became a monetization surface:**
  - In April 2025 Linktree (70M+ users) launched Sponsored Links: commission-based brand offers from launch partners like Hulu, Sam's Club and Harry's, shown with a "Sponsored" label, with all earnings flowing into one creator wallet. It is US-only.
  - Sacra estimates Linktree's 2023 revenue at $37M.
  - The category has also consolidated brutally. Linktree bought Koji in December 2023 and shut it down on January 31, 2024. Koji had raised roughly $36–40M, served a reported 700,000 creators, and offered a "Billboard" mini-app for selling ad slots on a creator's landing page. That is almost exactly the "profile page as ad inventory" idea, already tried inside a larger product that didn't survive on its own.

**What it means for Ancaster:** The opportunity is real, but the incumbents are platform-bound. beehiiv's network only serves beehiiv senders, Kit's only Kit users, Substack's only Substack writers (and, per Paved, only "Best Sellers" with 100+ paid subscribers), and Linktree's Sponsored Links are US-only. A **platform-neutral, cross-format, Canada-friendly** rail is real whitespace. Koji is the warning: a link page with ad slots is a feature, not a company, unless it comes with demand and measurement.

### 2. Marketplace mechanics: how buying and selling actually works

The platforms fall into five models.

| Model | Examples | How brands and creators meet | Take rate / pricing |
|---|---|---|---|
| Creator-side storefront + CRM | Passionfroot | Creator publishes productized slots (newsletter ad, LinkedIn post, YouTube integration); brands book | 5% on bookings through your own storefront; 15% (incl. payment fees) on Partner Network matches; 2% transaction fee paid by the brand |
| Self-serve brand marketplace with escrow | Collabstr, Insense, JoinBrands | Brand searches or posts a brief; creators apply with prices; funds held until delivery and approval | Collabstr: 10% brand hiring fee (5% on Premium), plus a separate 15% creator-side fee on payout |
| Platform-owned newsletter ad networks | beehiiv Ad Network, Kit Sponsor Network, Substack Sponsorships | Network sources advertisers and serves offers to eligible publishers | beehiiv: CPM on unique opens or CPC on verified clicks. Kit (at launch): 20% + 3.5% processing, with exclusivity strongly recommended. Substack: 0% cut during pilot |
| Enterprise SaaS for brand teams | CreatorIQ, Grin, Aspire, Upfluence | Discovery databases, CRM, briefs, contracts, product seeding, payments, reporting | Annual SaaS contracts (not verified for this memo) |
| Native platform marketplaces | TikTok One, Meta Creator Marketplace / Partnership Ads Hub, YouTube Creator Partnerships (formerly BrandConnect) | In-platform discovery, briefs, and one-click conversion of organic posts into paid ads | Monetized through the ad spend that follows |

**Details worth copying:**

- **Passionfroot's split fee is smart.** It charges low fees on demand the creator brings (5%) and high fees on demand Passionfroot supplies (15%). That makes it cheap to adopt as a tool and profitable as a network. It has also moved toward an AI agent ("Zest") and a "compliant wallet": the brand onboards once and can pay any creator without going through vendor approval for each one. That solves a real procurement pain.
- **Independent reviewers note a warning:** Passionfroot "is plumbing, not demand": "most creators bring their own sponsors, so it won't fill an empty pipeline."
- **beehiiv's operational rules keep quality high:**
  - Publishers can hold up to 5 claimed ads and must publish each within 5 days.
  - Clicks are tracked for 72 hours, and a report is generated within 24 hours after that.
  - CPC pays only on "payable" clicks that pass bot, fraud and uniqueness filters.
  - CPM pays on unique human opens.
  - Payouts need a Stripe Express account, so some countries are excluded.
- **Native platforms are turning organic creator content into paid ads:**
  - **TikTok.** TikTok One absorbed the old Creator Marketplace in 2024. Its Content Suite (announced June 2025, in global beta via allowlist as of October 2025) surfaces organic creator videos that mention a brand, ranks them by predicted ad performance, and allows one-click Spark Ads authorization. Creators can opt into a "Spark Opportunity Program" that lets any brand they mention boost their posts. TikTok One is available in Canada.
  - **Meta.** Launched an Instagram creator marketplace API (general availability October 1, 2025) and a Facebook creator discovery API (October 6, 2025). The Partnership Ads Hub gained branded/UGC content surfacing in December 2025. At IAB's Global Creator Week in 2026, Meta announced content-level permissions with expiry dates and Instagram Live partnership ads.
  - **YouTube.** Open Call (Cannes 2025) lets brands post a brief. Creators in the YouTube Partner Program submit finished videos, and the brand promotes the winners as partnership ads in Google Ads.

**What it means for Ancaster:** Discovery databases are commoditized, and Meta and TikTok now hand them out through APIs. The defensible layers are the **transaction** (escrow, contracts, usage rights, payout) and the **proof** (verified delivery and outcomes). Ancaster should not build a follower-scraping discovery engine. It should build the booking, rights and reporting objects that sit around a deal.

### 3. Pay models and payments: cash flow is the creator's biggest pain

**Pay models seen in market:**
- **Flat fee per deliverable.** The default for sponsorships and UGC.
- **CPM.** beehiiv pays on unique opens; its own example is "$5 for every 1,000 unique opens." Kit's network has been reported at roughly €3 per 1,000 opens for smaller European senders.
- **CPC.** beehiiv's example is $2 per verified click.
- **CPA/affiliate.** Linktree Sponsored Links, YouTube Shopping affiliate, Amazon Influencer/Associates tie-ins.
- **Hybrid.** Flat fee plus CPA bonus. MediaPact advertises "hybrid flat-fee + CPA deals are native."
- **Gifting.** Still used; see the Aspire stat above.
- **Retainers and ambassador deals.** Usually paid on milestone schedules.
- **Usage-rights add-ons.** Aspire's State of Influencer Marketing 2026 (a survey of nearly 900 marketers and creators) found that "77% of brands actively repurpose creator content in their paid ads" and 67% build usage rights into the creator's initial contract or rate. Creators who price usage separately commonly charge 15–35% of base rate per 30 days.

**The payment-trust problem is quantified:**
- In a May 2024 survey of 500+ influencers by creator-payments company Lumanu, 48% said they'd been paid late for work completed that year, and 38.5% of those were paid more than a month late.
- Digiday (Kimeko McCoy, February 2024) cited a Tipalti survey in which 56% of creators said they had faced late payments, and quoted a creator saying that while net 30 is the ideal, "more commonly, I'm presented with net 60."
- Creators Agency says that across 3,700 campaigns it managed, 65% of deals paid Net 30, 25% Net 60, and 10% tried for Net 90 or longer.
- A 2022 Wakefield Research survey of 750 creators found 70% said admin work like invoicing and payment keeps them from creating.
- A common complaint: agencies pass "pay-when-paid" terms down to creators.

**How platforms solve it:**
- Escrow, where the brand prepays and funds release on approval (Collabstr).
- Platform wallets (beehiiv wallet, Linktree wallet, Passionfroot wallet).
- Merchant-of-record or compliant-payer models, where the brand onboards once.
- Fast pay on approval (Popular Pay-style "get paid when you post" positioning).

**Payments infrastructure costs (verified, for a Canadian platform):**

| Item | Stripe Connect (platform-managed pricing) |
|---|---|
| Monthly active account | CA$2 per account in any month it receives a payout (US: $2) |
| Payout fee | 0.25% + CA$0.25 per payout |
| Instant Payouts | 1% of payout volume |
| Cross-border payouts (US/CA/UK/EEA/CH) | Starting at 0.25% of payout volume |
| Payout in a non-default currency | ~1% |
| Card processing | Starts at 2.9% + CA$0.30 |
| US 1099 e-filing | $2.99 per form (IRS), $1.49 per form (state), $2.99 per form mailed; covers 1099-NEC/-K/-MISC |

**Tax and cross-border notes:**
- **US 1099s.** Stripe's current 1099-NEC guide cites a $2,000 threshold; older pages say $600. Check the current IRS rule.
- **Stripe 1099 product for a Canadian platform.** Not confirmed that a Canadian-domiciled platform can use it; ask Stripe.
- **Canadian reporting (CRA Part XX).** Canada's digital platform operator reporting rules took effect January 1, 2024, with the first filing due January 31, 2025. Platforms that facilitate "personal services" must collect, verify and annually report seller information. A creator marketplace that books content work may qualify; pure listing/advertising platforms may be excluded. Get a tax adviser's opinion.
- **Stripe's Part XX tool.** Stripe offers Canadian XML report generation for this, but only as a preview product.
- **T4A slips.** No evidence Stripe files them.

**Alternatives:**
- **Tipalti.** Starts around $99–$199/month plus per-transaction fees. Includes W-9/W-8 collection and TIN validation, and pays to 200+ countries. Overkill at launch.
- **Payoneer.** Quote-based mass payouts to 190+ countries; recipients pay up to 2% on cross-currency withdrawals.

**What it means for Ancaster:** Stripe Connect Express is the right rail. On a CA$1,000 sponsorship paid out once, the platform's payout cost is about CA$2 + CA$2.75 ≈ CA$4.75 (under 0.5%), or about CA$12.75 with Instant Payout. That makes **"paid within 48 hours of verified delivery" a cheap, powerful selling point**. Ancaster can charge the brand a small fast-pay fee or absorb it as marketing.

### 4. UGC: creator content as ad creative is a separate, cheaper product

- **UGC is priced by deliverable, not audience.** Averages cluster near $200 per short video:
  - ppc.io: $212 average.
  - Superscale, as cited by Sovran: $198 per deliverable in 2025, down 44% year over year as supply rose and AI-generated UGC competed.
  - Billo: from about $99/video (volume bundles reported lower).
  - JoinBrands: per-deliverable fees starting around $25–29.
  - Insense: managed campaigns from about $500/month.
  These platform prices come from third-party roundups and change often.
- **Brands buy UGC to feed paid social,** not for the creator's reach. Billo markets its data on "326k+ video ads." A customer testimonial claims CAC fell "from above $220 to consistently under $75." That is vendor marketing, not independent evidence.
- **Whitelisting and partnership ads are the bridge from UGC to paid.**
  - Meta says partnership ads delivered 19% lower CPA and 13% higher CTR when added to campaigns.
  - TikTok's internal analysis says TikTok One creator content boosted as Spark Ads drove 159% higher engagement than non-creator content at the same CPM.
  - These are platform-reported figures, so treat them as directional.
- **Rights are the product.** TikTok One can "hold a use term" but does not bundle asset, audience and ad rights into one purchase. Meta's 2026 hub adds expiry dates for content permissions.

**What it means for Ancaster:** A UGC-to-placement pipeline is attractive because it fits a small network. A creator produces an asset once. Ancaster stores it in R2 with a machine-readable license (scope, channels, duration, expiry). The advertiser can then run it on Ancaster placements (newsletter, profile page, short-link interstitial-free landing page) *and* export it with rights attached for Meta/TikTok partnership ads. Rights-expiry tracking is a small feature with outsized value.

### 5. Sponsorship formats: native, host-read and trusted beats banners

- **Podcasts.**
  - Nielsen's analysis (260+ surveys, 240 brands) found host-read podcast ads averaged 71% brand recall vs. 62% for non-host-read ads, and outperformed on familiarity, affinity and purchase intent.
  - Sounds Profitable (2022) reported a 74% recall lift for host-read vs. 49% for dynamically inserted ads.
  - SiriusXM Media reports video host-reads reaching 77% unaided recall vs. 67% for audio-only in one case study.
- **Newsletters.** Newsletter sponsorships behave like host-reads when written in the author's voice. Substack explicitly positions its program as "not arbitrarily inserted ads." Paid rates:
  - beehiiv's own example: $5 CPM on unique opens.
  - Third-party calculators put beehiiv CPMs at roughly $3–$20 by niche, with business, finance and tech at the top.
- **Link-in-bio.** Link-in-bio placements are proven as *performance* inventory (Linktree Sponsored Links are commission-based), not as CPM inventory.
- **Short-form video.** Short-form's organic reach decays fast, reportedly 48–72 hours on TikTok, which is why paid amplification via Spark/Partnership Ads exists.
- **Long-term ambassador deals.** Better for trust and creative quality. Creators with multiple active deals can tolerate Net-30; nano creators can't.

**What it means for Ancaster:** Sell **creator-voiced placements, never banners**. The best package pairs trust formats with measurable formats: a newsletter host-read (trust and recall), a pinned profile-page slot plus short link (measurable clicks), and optionally a short video whose rights let the advertiser amplify it. Price the trust formats flat or on CPM, and the link and profile slots on CPC or CPA or as a bonus.

### 6. Measurement and efficacy: Ancaster's strongest advantage

- **Attribution is unsolved industry-wide.** A widely repeated claim that only 23% of marketers can confidently tie creator spend to revenue could not be traced to an original eMarketer source and should be treated as unverified, but the underlying problem is well documented.
- **Best practice is triangulation:**
  - Per-creator links and UTMs.
  - Unique, ideally single-use or short-lived, promo codes.
  - A one-question post-purchase survey ("how did you hear about us?") tied to order IDs.
  - Periodic geo-holdout or incrementality tests.
- **Known failure modes:**
  - Promo codes leak to coupon sites and browser extensions within days. Codes redeemed in sessions that arrived via paid search are "almost always coupon extension leakage."
  - Last-click undercounts creators because buyers convert days later through search or direct visits.
- **Fraud is endemic.**
  - HypeAuditor's 2025 report (as reported by Mi3) found 42.7% of influencers were affected by fraud in 2024.
  - Many circulating "2026 HypeAuditor" figures cannot be traced to HypeAuditor.
  - beehiiv's answer — paying only on verified, unique, non-bot clicks and human opens — is the right design pattern.

**A realistic indie measurement stack Ancaster can build:**
1. **Verified short links.** Bot filtering, dedupe by IP/UA/time window, a "payable click" definition published openly.
2. **Code issuance.** Per-creator, per-campaign codes with expiry, plus a leakage flag (redemptions with zero clicks).
3. **Post-purchase survey snippet.** A single-question JS widget or Shopify-friendly embed for the advertiser's checkout, keyed to the campaign.
4. **Conversion postback.** A server-to-server pixel or webhook from the advertiser for CPA deals.
5. **Blended report.** Floor = code + link conversions; ceiling = survey-attributed revenue. Include a simple pre/post branded-search or direct-traffic lift note.
6. **Creator quality score.** Built from *observed* Ancaster data (verified CTR, repeat-booking rate, delivery on time, disclosure compliance), not scraped follower counts.

### 7. Trust, disclosure and regulation (US and Canada)

- **FTC (US).** The June 2023 revised Endorsement Guides:
  - Added a definition of "clear and conspicuous."
  - Warned that a platform's built-in disclosure tool "might not be an adequate disclosure."
  - Clarified that tags can be endorsements and that virtual influencers are covered.
  - Spelled out liability for advertisers *and intermediaries*.
- **FTC Consumer Reviews and Testimonials Rule.** In force since October 21, 2024. It bans buying or selling fake indicators of social influence (fake followers or views) and fake reviews, with civil penalties up to $51,744 per violation, adjusted for inflation.
- **Canada.** Ad Standards updated its Influencer Marketing Disclosure Guidelines in October 2025:
  - #Ad on its own is the "gold standard."
  - New guidance covers AI-generated influencers, affiliate marketing and child audiences.
  - Disclosure must be in the language of the content, "upfront," and "when in doubt, spell it out."
  - Under Competition Bureau guidance, failing to disclose a "material connection" can be false or misleading advertising under the Competition Act. Both advertiser and influencer are accountable.
- **Platform tooling.** Meta's Content Publishing API now lets third-party tools apply the paid-partnership label at publish time. TikTok requires the brand-partner tag.

**What it means for Ancaster:** As an intermediary, Ancaster has direct exposure. Turn that into a feature:
- Auto-insert "#Ad / Sponsored by X" into every booked newsletter block and profile slot, in the content's language (EN/FR for Canada).
- Keep a disclosure audit log per placement.
- Refuse fake-engagement sellers.
- Publish an ethics policy: no editorial approval rights for advertisers over journalism, category exclusions.

For a journalist-run network, this is both brand and moat.

## Details: Synthesis for Ancaster

### What to copy
- Productized creator storefront/rate card with booking (Passionfroot), including the split fee: low on demand the creator brings, higher on demand Ancaster brings.
- Escrow with approval-triggered release (Collabstr).
- Verified-click / human-open payout definitions and short reporting windows (beehiiv).
- Non-exclusivity (beehiiv), not Kit's early exclusivity model. Creators hate lock-in.
- Rights with expiry dates (Meta 2026) and "open call" briefs where creators submit finished work (YouTube).
- A single creator wallet across income types (Linktree).

### What to avoid
- **Building a discovery database of scraped social profiles.** It's commoditized, legally fraught, and Meta/TikTok give it away via API.
- **Link-page ad slots without demand.** Koji's Billboard is the cautionary tale.
- **Net-60 terms or pay-when-paid.** They are the #1 creator complaint, and Ancaster can cheaply beat them.
- **Opaque or bundled fees.** Reviewers criticize Collabstr's double-sided fee (10% brand + 15% creator) and hidden margins.
- **Enterprise SaaS ambitions** (CreatorIQ/Grin territory). Long sales cycles, wrong customer for a solo developer.

### Where the whitespace is
1. **Cross-format packages for small creators.** Newsletter + profile + link + short video, sold as one SKU, is not offered by platform-bound networks.
2. **Canada and bilingual.** Linktree Sponsored Links is US-only, and beehiiv requires Stripe Express. A Canada-first, EN/FR-disclosure-aware network has a natural home market.
3. **Independent media and journalists.** Substack's program starts at 100+ paid subscribers, and Passionfroot targets B2B. Nobody explicitly serves newsletter journalists, local news creators and niche experts with an ethics-forward, advertiser-vetted network.
4. **Proof for small advertisers.** Small brands can't afford measurement vendors; verified links + codes + survey in one report is an unmet need.

## Recommendations: Strategic Options

**Option A: Attribution-as-a-Service ("Ancaster Proof").** Sell the measurement layer on its own: verified short links, code issuance and leakage detection, a post-purchase survey widget, and blended creator reports. Charge advertisers or agencies per campaign or per month, and give it free to creators, which also recruits them. *Strength:* builds on existing link strength and doesn't need two-sided liquidity. *Weakness:* a tool, not a network; lower ceiling.

**Option B — RECOMMENDED: The Ancaster Booking Rail.** Every Ancaster profile page becomes a **bookable, cross-format media kit**: audience stats verified by Ancaster link data, published packages (e.g., "Newsletter host-read + 30-day pinned profile slot + tracked link, CA$X"), availability calendar, and disclosure baked in.
- **Advertiser flow:** book → prepay into escrow (Stripe Connect separate charges and transfers) → creator drafts → advertiser approves → publishes with auto-disclosure → verified-delivery check → payout within 48 hours.
- **Built-in performance:** Option A's proof layer ships with every booking. Hybrid payouts become native: a guaranteed flat floor plus a performance bonus released when Ancaster-verified clicks or conversions pass a threshold.
- **Fees:** copy Passionfroot's split. About 5% on creator-sourced bookings, about 15–20% on Ancaster-sourced demand, and an optional 1–2% fast-pay fee charged to the brand.
- **Positioning:** "The ethical, independent-media ad network: paid fast, disclosed properly, measured honestly."

**Option C: Independent Media Collective (curated network sales).** Ancaster runs sales as the demand side for a curated roster of journalists and niche creators, selling bundled "reach packs" to mission-aligned advertisers. *Strength:* solves the "plumbing, not demand" problem. *Weakness:* sales-heavy, which is hard for a solo developer and journalist. Best layered on top of B once 30–50 creators are on the rail.

**Option D: UGC-to-Placement Pipeline.** Advertisers post Open Call-style briefs. Creators submit assets. Winners get licensed with expiring rights stored in R2, run across Ancaster placements, and can be exported for Meta/TikTok partnership ads. *Strength:* high-volume, low-price SKU (about $100–$200/asset market), with a quick path to revenue. *Weakness:* competes with Billo/Insense on price, and the AI-UGC price squeeze is real (the reported 44% YoY drop). Best as a module inside B, not a standalone business.

**"Decide for me" default:** **Option B, with Option A's proof layer inside it and Option D as the first add-on.** Reason: B makes money on transactions from day one, turns Ancaster's existing assets (profiles, links, newsletter slots) into inventory, and competes on the two things incumbents do worst for small players: payment speed and believable measurement. Add C when supply justifies a sales push.

### Build sequence (solo developer, Cloudflare-native, no over-engineering)

**Phase 1: Proof layer (weeks 1–6)**
- **Workers:** link redirects plus Workers Analytics Engine or D1 for click events.
- **Bot/dedupe filter:** UA lists, rate limits, a time-window uniqueness key.
- **"Payable click" definition,** published openly.
- **Promo-code table in D1.**
- **Survey widget** served from a Worker.
- **Campaign report page.**
- **Ship:** give it to existing creators and sponsors immediately.

**Phase 2: Storefront + booking (weeks 6–12)**
- **Profile pages gain package cards and verified stats** (from Phase 1 data).
- **Booking object in D1:** statuses draft → paid → in_review → approved → live → verified → paid_out.
- **One Durable Object per booking** to serialize state transitions and deadlines (approval windows, auto-release timers via alarms). This is the one place strong consistency matters.
- **R2 for creative drafts and assets.**
- **Auto-disclosure templating (EN/FR).**

**Phase 3: Money (weeks 10–16)**
- **Stripe Connect Express onboarding.** Separate charges and transfers, so the brand's payment is held on the platform balance until approval.
- **Payouts.** Standard payouts by default, Instant as a paid option.
- **Webhooks** into a Queue → Worker consumer.
- **Tax.** Start collecting W-8/W-9 and Canadian seller info at onboarding, and get a CRA Part XX opinion before launch.

**Phase 4: Hybrid deals + UGC module (months 4–6)**
- **Bonus rules** (threshold on verified clicks/conversions → second transfer).
- **Advertiser conversion postback endpoint.**
- **Open-call briefs.**
- **License records** with scope and expiry, plus expiry notifications via Cron Triggers.

**Explicitly defer:**
- Real-time bidding, programmatic auctions and ML matching.
- Scraping social APIs for discovery.
- Native mobile apps.
- Multi-currency beyond CAD/USD.

**Launch metrics to watch:**
- Time-to-payout (target under 48h after verification).
- Repeat-booking rate per advertiser.
- Verified CTR by format.
- Share of bookings sourced by Ancaster vs. creator (tells you when Option C is justified).
- Disclosure compliance at 100%.

## Caveats

- **Vendor figures are directional.** Many benchmarks come from vendor blogs or secondary roundups: UGC averages, beehiiv CPM ranges, the "73% favor smaller creators" stat, and the unverified 23% attribution figure. Platform performance claims (Meta's 19% lower CPA, TikTok's 159% engagement lift, Spark Ads' 142%) are self-reported.
- **Some beehiiv figures are unverified.** Claims that beehiiv pays creators "$1M per month" or earned $28M in 2025 revenue come from a third-party blog and are not included as fact.
- **Fees change often.** Passionfroot, Collabstr (Pro listed at $249 or $299/month depending on source), Kit and Substack terms have all shifted. Substack says it takes no cut during its pilot; that will likely change. Kit's 23.5% sponsor take is from its 2022 launch coverage.
- **Tax and legal points need professional confirmation.** This includes whether Ancaster is a "reporting platform operator" under CRA Part XX, Quebec/BC-specific obligations, the current US 1099-NEC threshold, and whether a Canadian platform can use Stripe's 1099 product.
- **Not verified here.** Pricing for CreatorIQ, Grin, Aspire, Upfluence, #paid, Popular Pay, Gumroad, Whop, Beacons, Stan and Amazon Influencer was not independently verified for this memo. Their roles are described at the model level only.
