---
id: ancaster-self-serve-buy-side-teardown-money-flow-legal-guardrails-and-
title: "Ancaster Self-Serve Buy Side: Teardown, Money Flow, Legal Guardrails and a 30/90-Day Spec"
kind: "Build brief"
topic: "Attribution & credit"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-02be5612-7e29-54d4-8e6d-e5995cf4c7c0_text_markdown.md"
---

# Ancaster Self-Serve Buy Side: Teardown, Money Flow, Legal Guardrails and a 30/90-Day Spec

Ancaster should launch a self-serve buy side where advertisers pay the creator's own Stripe account, via the creator's own keys, on the day the ad sends. That gives a one-step checkout without Ancaster ever holding funds. The proof layer — verified sends, human-filtered clicks, holdout lift and signed reports — should be the centre of the product, because no reference marketplace sells incrementality today.

## TL;DR
- **No competitor sells proof.** Paved, Passionfroot, beehiiv, EthicalAds and SponsorCal report clicks, opens, impressions and reviews at best. I found no creator or newsletter marketplace offering holdout lift, verified conversions or signed, auditable reports. That gap is Ancaster's wedge. I also found no published evidence that better proof raises price or rebooking, so Ancaster has to generate that evidence itself.
- **Money model:**
  - **Launch:** charge on the creator's own Stripe account using creator-supplied restricted keys. The creator is merchant of record, Ancaster bills its fee separately, and the card is charged 48–72 hours before send rather than held.
  - **Ancaster's own newsletters:** sell them through Ancaster's own Stripe Checkout from day one. FINTRAC's MSB guidance exempts a business that "solely accepts a payment for goods or services that they supplied to their own customer".
  - **After a legal opinion:** move to Connect direct charges with an application fee. Keep destination charges and escrow-style holding in reserve, because they make Ancaster the merchant of record and put it in the flow of funds.
- **Booking flow:**
  - **Steps:** instant booking in three advertiser steps (pick slot → paste or generate creative → pay).
  - **Creator gates:** a pre-set allowlist or blocklist, and a creative approval gate before the charge.
  - **Disclosure:** Ancaster renders the disclosure label itself rather than trusting the advertiser to add it.
  - **Report:** a signed post-run report with holdout lift. Listing cards show only medians with sample sizes.

## Key Findings

1. **The market has split into three models, and only one resembles Ancaster.**
   - **Managed or network sellers** are the merchant of record and take a large cut: Paved Marketplace takes 30% from publishers, EthicalAds keeps 30%, and BuySellAds and Carbon are now largely managed services.\[1\]\[2\]
   - **Creator-side booking tools** take a small fee: SponsorCal 5%,\[3\] Sponsonizer 7%,\[4\] beehiiv Direct Sponsorships $10 per placement, and Buttondown $0.\[5\]\[6\]
   - **Hybrid storefront-plus-network players** sit in between. Passionfroot charges 5% on organic deals (paid by the brand), 15% on network deals and a 2% brand fee,\[7\]\[8\] and has put a paid advertiser tier on top.\[1\]\[9\]\[10\]
   - Ancaster's advantage is not the booking tool, which is commoditized. It is proof plus a clean money flow.
2. **Verified stats are now table stakes, but "verified" means ESP-pulled opens and clicks, not outcomes.**
   - Paved advertises "real-time publisher performance, clicks, and impressions based on verified publisher data" and a proprietary bot filter.\[11\]
   - Passionfroot pulls live follower stats for connected social channels.\[12\] Newsletter stats there are largely creator-entered.
3. **Refunds are the weakest part of every competitor.**
   - Paved: "As a company policy, we do not issue refunds." Its make-goods are discretionary. Its advertiser agreement says Paved's services "do not involve investigating or resolving any claim or dispute involving Advertiser and any Publisher".\[13\]\[14\]
   - beehiiv holds payment "in escrow" until the placement is published.\[6\]
   - A codified, automatic make-good policy tied to verified delivery is a cheap way to stand out.
4. **Canadian payments law turns on whether Ancaster is in the flow of funds.**
   - The Bank of Canada's December 19, 2025 marketplace policy says a marketplace is within the Retail Payment Activities Act (RPAA) if "it receives funds in a bank account it owns or controls as part of its payment flow".\[15\]
   - FINTRAC treats "payment services for goods or services" as MSB activity where the intermediary has an agreement with the payee.\[16\] It has also retracted Policy Interpretation 7670 (PI-7670), which had deemed certain payment processors not to be MSBs.\[17\]
   - Every design choice below minimizes Ancaster's presence in the flow of funds until a lawyer signs off.
5. **Tax is manageable if Ancaster stays a software vendor.**
   - Advertising services to non-resident, non-registered advertisers are zero-rated for GST/HST under Schedule VI, Part V, section 8.\[18\]
   - Canada's digital-platform GST/HST rules reach only non-resident vendors selling to unregistered Canadian recipients.\[19\]
   - Most US states don't tax advertising. The key exception is Washington, which has taxed advertising services since October 1, 2025.\[20\]

## 1. Teardown of the Reference Platforms

**Paved (Marketplace + Ad Network; acquired by Redbrick, March 11, 2025)**
- **Browse:** Paved claims "3,000+ publishers" and "253 million newsletter subscribers" (vendor figures from its acquisition press release).\[11\] According to EmailToolTester's review, each listing card shows:
  - subscriber reach and average open rate;
  - estimated clicks and an estimated CPC range;
  - total sponsorship cost;
  - previous sponsors;\[1\]
  - verified advertiser reviews.
  - EmailToolTester's newsletter was rejected for being under a 5,000-subscriber minimum.\[1\]
- **Verification:** Paved integrates with ESPs (Mailchimp, Kit, beehiiv) and runs its own bot filtering.\[11\]\[21\]
- **Checkout:** "Payment for each Campaign is due from Advertiser at the time of Campaign booking".\[14\] Booking can be single or bulk.\[22\]
- **Creative:** the advertiser uploads creative assets, then reviews and approves the publisher's rough draft.\[22\] Publishers draft in their own voice.
- **Pricing and minimums:** advertisers pay the listed price with "no fee, subscription, or minimum monthly spend",\[1\] and publishers pay a 30% commission.\[1\]\[4\]\[23\] Paved says the "average" sponsorship is "around $5K" and that Ad Network CPCs are typically "$1 and $5".\[24\] Both are vendor claims.
- **Make-goods:** discretionary, triggered by:
  - CTR of 1% or less;\[13\]
  - bot clicks at 50% or more;\[13\]
  - wrong placement;\[13\]
  - display errors.\[13\]
  - No refunds.\[13\]
- **Reporting:** "regularly updated reporting", covering clicks, impressions and opens.\[14\] Advertisers rate publishers afterwards.\[22\]
- **Best:** the largest catalogue, estimated-clicks-on-card, previous-sponsor transparency and reviews.
- **Worst:** the 30% take (which EmailToolTester notes advertisers "absorb… through higher sponsorship rates"), no refunds, no dispute resolution, and a dated UI.\[1\]\[13\]\[14\]

**Passionfroot (storefront, Partner Network, Zest; per Passionfroot's July 22, 2026 PR Newswire release, a "$15M Series A led by Insight Partners, with participation from existing investors Creandum, Supernode Global, and s16vc", bringing total funding above $21M per TechCrunch; the release also claims "revenue 13x while staying profitable with a team of 15")**
- **Browse:** creator storefronts show channels, stats, products, packages, past-brand logos and calendar slots. The Partner Network lets brands discover creators.\[10\]\[25\]\[26\]
- **Verification:** live stats for connected social platforms. The Whop review describes live TikTok and Instagram counts;\[12\] newsletter stats are added by the creator.
- **Booking:** request-to-book. The brand books a product or sends an inquiry, and the creator can "Accept, Reject, and/or Send proposal".\[26\]\[27\] Payment follows acceptance, then the brand submits a creative briefing.\[12\] Passionfroot claims an "average reply time is <24 hours".\[27\]
- **Fees:**
  - 5% on organic deals, charged to the partner;\[7\]
  - 15% on network deals, including payment fees;\[10\]
  - a 2% brand transaction fee.\[8\]
  - Network creators must keep payments on-platform, and Passionfroot "tracks cases where payment is circumvented".\[7\]
  - Advertisers now pay a $199/month Starter plan. MediaPact says the free plan was removed in April 2025; MediaPact is a competitor, but EmailToolTester corroborates the $199 fee.\[1\]\[9\]
- **Zest** generates campaign briefs and proposals, with human approval before sending (prior pass).
- **Best:** polished storefront, packages, calendar and brand-side "compliant wallet" procurement.\[26\]\[28\]
- **Worst:** a subscription wall for small advertisers. Reviewers also note the percentage fee "stops making sense" at high volume.\[29\]

**beehiiv Ad Network and Direct Sponsorships**
- **Ad Network:** sales-led and managed, with a $15k minimum (prior pass).
- **Direct Sponsorships:** available only on Max and Enterprise plans.\[6\]
  - Advertisers browse a storefront and submit a proposal. The publisher can accept, modify, or decline.\[6\]
  - The advertiser is charged on acceptance, and "Payments are held in escrow and released after the ad placements go live."\[6\]
  - The fee is $10 flat plus Stripe processing. Payouts run through a Stripe Express "beehiiv Wallet".\[30\]\[31\]
  - Storefront proposals are card-only. Publisher-initiated proposals can take bank transfer.\[31\]
  - Publishers cannot "take bookings on beehiiv but invoice advertisers separately".\[31\]
  - Refunds can be full or partial, and the publisher bears the processing fees.\[32\]
- **Best:** the cheapest fee and a built-in inventory tie-in.
- **Worst:** locked to beehiiv, and request-based rather than instant.

**Swapstack:** acquired by beehiiv in September 2023, per beehiiv's blog post "beehiiv Acquires Swapstack", with Swapstack CEO Jake Schonberger joining "as the Head of Brand Partnerships to lead the beehiiv Ad Network" (TheyGotAcquired reports "more than 2,500 newsletters… 60 million readers" at sale), and folded into beehiiv's network. It historically charged brands a 10% platform fee.\[33\]

**SponsorCal:** instant self-serve.
- The flow is: browse slots → select placement and date → pay via Stripe → submit creative → creator approves → goes live → "payout processes after a 7-day dispute buffer".\[34\]
- 5% per transaction.\[3\]
- It does no sponsor discovery.\[34\]

**Kit Sponsor Network / Newsletter Sponsorships:** listed among Kit's Craft + Commerce 2026 launches ("Newsletter sponsorships: earn on your terms", per Kit's @kit X post).
- Kit's own feature page says "We match you to brands based on your content, audience, and engagement—not just your list size".
- Creators "Approve and style every ad before anything reaches your subscribers", and payment is per click (Kit's page illustrates a "$1.30 average CPC", a vendor figure).
- No advertiser self-serve browse is documented.

**EthicalAds:**
- **Pricing:** CPM, with a $1,000 minimum buy. Discounts are 10% at $3,000, 15% at $25,000, and a further 10% for auto-renewing campaigns.\[35\]
- **Targeting:** by country (US state for US ads), page content and topic only.\[36\]
- **Advertiser controls:** live reporting, and advertisers can "upload your own ads, and turn on and off specific ads".\[35\]
- **Billing:** invoices via Stripe, net-30 after the first invoice.\[36\]
- **Publishers:** receive a 70% revenue share and need 50k+ monthly pageviews.\[2\]\[37\]
- **Best:** privacy positioning and transparent CPM.
- **Worst:** a high minimum for indie SaaS, and aggregate network buying rather than per-creator buying.

**BuySellAds and Carbon:** BuySellAds now leads with a managed team ("One team coordinates your newsletters, websites, and podcasts").\[38\] Its Newsletter Network backfills unsold dates.\[39\] A secondary source reports publishers keep 75%.\[40\] Carbon's recommended $5k–10k/month (prior pass) prices out Ancaster's beachhead.

**Hecto, SparkLoop, Reletter:**
- **Hecto:** reportedly takes a 5% commission on closed deals.\[41\] Reviewers repeatedly note "thin public documentation".\[42\]\[43\]
- **SparkLoop Partner Network:** a paid-recommendation (cost-per-subscriber) network, not a sponsor-slot marketplace.
- **Reletter:** a newsletter directory and search tool, not a transactional marketplace.
- I found no current advertiser-side teardown data for SparkLoop or Reletter in this pass.

**2025–2026 newcomers:**
- **Sponsonizer:** "Calendly for newsletter ad slots". 7% on the free tier, or $99/year for Pro. Positioned against Paved's 30% and Passionfroot having "left the creator side".\[4\]
- **AdBooker:** splits payment through Stripe Connect and validates creative specs before checkout.\[44\]
- **MediaPact:** buyer-side and free for buyers, with affiliate-network integration. Its rankings are self-published and place itself first.\[9\]\[45\]
- **Buttondown Sponsorships:** 0% platform fee, with creator approval of sponsor content.\[5\]
- The trend: booking tooling is racing to zero, which confirms that a booking fee alone is not a moat.

**Review sentiment (thin evidence).**
- I found no substantive Trustpilot, G2 or Reddit complaint corpus specific to these marketplaces in this pass.
- The recurring themes in reviews are:
  - fee absorption (Paved);\[1\]
  - subscription walls (Passionfroot);\[1\]
  - the frustration of "paying for a newsletter ad that delivers 5 clicks";\[1\]
  - bot-inflated clicks.\[21\]
- Paved's own 4.6/5 rating from 800 advertisers is a vendor-run survey and should be treated as marketing.\[46\]

## 2. Marketplace Design Lessons

- **Verified vs self-reported stats.** Every serious player now labels stats "verified" when they come from an ESP connection, and several impose publisher minimums (Paved's 5,000 subscribers).\[1\] There is no public controlled study of the effect on conversion; treat it as a strong industry norm rather than proven lift. Ancaster can go further because it sends the newsletter itself, so delivery is verified by construction.
- **Past results on listings.** Paved's "estimated clicks" and previous-sponsor list are its most-praised card features, according to EmailToolTester.\[1\] No platform shows outcome data beyond clicks.
- **Pricing model for small advertisers.**
  - Flat pricing dominates direct newsletter sponsorships: Paved Marketplace, beehiiv Direct, SponsorCal, Passionfroot.\[6\]\[47\]
  - CPC dominates networks: the Paved Ad Network, Kit.
  - CPM dominates site ads: EthicalAds.\[48\]
  - Flat is easiest to self-serve but shifts risk to the advertiser, which is why "5 clicks" complaints exist. The fix is flat pricing plus a verified-delivery guarantee, not CPA.
- **Packages.** Passionfroot documents package discounts (a 20% bundle example).\[26\] SponsorCal recommends 5–10% off three-issue packages.\[49\] EthicalAds auto-discounts at spend tiers.\[35\] Ancaster's machine-enforced package discounts already match this.
- **Instant vs request-to-book.** beehiiv and Passionfroot are request-based, while SponsorCal and Sponsonizer are instant. I found no published conversion comparison. The design answer is instant booking with pre-set creator rules plus a creative gate, which gives advertiser speed with creator control.
- **Reviews.** Paved runs post-campaign advertiser reviews of publishers.\[1\]\[22\] Under the FTC's reviews rule (16 CFR Part 465), suppressing negative reviews while implying the displayed ones are representative is a violation, so show all verified-booking reviews.
- **Creative quality and brand fit.** The winning pattern (Paved, beehiiv, Buttondown) is that the advertiser submits and the creator approves.
  - Ancaster adds structured templates, character limits validated before checkout (AdBooker's approach),\[44\] and AI-assisted "write it in the creator's voice" drafts.
  - The creator keeps final say.
- **Fake audiences.**
  - Require an ESP or API connection, or Ancaster-native sending, for a "verified" badge.
  - Filter bot and security-scanner clicks, which Paved says come mostly from email security software.\[21\]
  - Show unique human clicks.
  - Flag lists whose open rate is implausibly high relative to clicks.
  - Holdout lift also exposes fake lists naturally, because a fake list produces zero incremental signups.
- **Cold start.**
  - Ancaster's own newsletters and the founder's products are the first inventory and first advertisers.
  - Launch a curated "Founding 25" of dev/AI-tools creators rather than an open marketplace. Paved's rejection of sub-5,000 lists shows curation is accepted.\[1\]
  - Offer the in-house affiliate program's SaaS partners a first booking with a make-good guarantee.

## 3. Proof as the Differentiator

- **What competitors report today:**
  - Paved: clicks, impressions and opens with bot filtering.\[11\]\[21\]
  - EthicalAds: impressions, clicks and CTR by publisher and geography.\[35\]
  - beehiiv: completed-placement details.\[32\]
  - Passionfroot: "reach, engagement, spend, and ROI" on its brand dashboard.\[28\] ROI depends on advertiser-supplied data.
- **Incrementality and signed reports:** I found **no** creator or newsletter ad marketplace offering holdout or incrementality measurement, verified conversions tied to the ad, or cryptographically signed or auditable reports. That is an absence of evidence from this pass, not proof of absence, but it matches fourteen prior passes.
- **Does better proof earn more?** I found **no published evidence** that newsletter advertisers pay more or rebook more with better proof. Ancaster should instrument this from day one: track rebook rate and price accepted for bookings with and without a lift result.
- **Honest listing-card display:**
  - **Averages:** show the median, not the mean, with the interquartile range and "n = X issues, last 90 days".
  - **Small samples:** suppress conversion or lift figures below a minimum sample. For example, don't show lift until at least 3 holdout tests have run, and always show the confidence interval.
  - **Estimates:** label estimated figures as estimates.
  - **Advertiser-reported outcomes:** attribute any advertiser-reported outcome to that advertiser.
  - **Selection:** never cherry-pick the best issue.
  - **Legal basis:** US law (FTC Act Section 5) and Canada's Competition Act both judge performance claims by their general impression and require substantiation before the claim is made. Since the 2024 amendments, performance claims in Canada must rest on an "adequate and proper test". Ancaster's auto-generated stats are Ancaster's own representations, so it must be able to reproduce every number from the ledger.

## 4. Payments, Custody and Legal (before taking any payment)

**Regulatory anchors**
- **Bank of Canada (December 19, 2025):** the Bank considers a marketplace within RPAA scope "if it receives funds in a bank account it owns or controls as part of its payment flow". "A marketplace's participation in the flow of funds between buyers and third-party sellers is the key factor."\[15\]
- **FINTRAC** (MSB self-assessment page):
  - **Payment services for goods or services:** a business provides them when it "receive[s] payment instructions and act[s] as an intermediary between a payer purchasing goods or services and a payee", "the payer consents to make the payment… through them", and "the payee has an agreement with them to have access to the transfers".\[16\]
  - **Invoice payment services** include invoices for "payroll and commission".\[16\]
  - **Exceptions:** anyone who "solely accepts a payment for goods or services that they supplied to their own customer", and providers of hardware only.\[16\]
  - **PI-7670 retraction:** FINTRAC has retracted PI-7670, so older "payment processor isn't an MSB" comfort no longer applies (Goodmans LLP).\[17\]

**Option comparison**

| Model | Who is merchant of record (MoR) | FINTRAC MSB exposure | RPAA/PSP exposure | Hold-until-run ability | Ancaster chargeback risk |
|---|---|---|---|---|---|
| (a) Advertiser pays creator directly (creator's own link/invoice); Ancaster invoices its fee | Creator | Lowest: Ancaster never receives payment instructions | Lowest: no funds touch Ancaster | Creator's choice | None |
| (a+) Creator's own Stripe via creator-supplied restricted key ("your own keys"); charge created on the creator's account; fee invoiced separately | Creator | Low, but Ancaster's software initiates the charge, so get the opinion to confirm it is a software tool, not an intermediary | Low: funds settle to the creator's Stripe balance and bank | Charge-at-T-minus-72h instead of holding | None directly |
| (b) Connect direct charges + application fee | Connected account (creator) | Moderate: the platform agreement plus fee skimming is closest to "payee has an agreement with them" | Low to moderate: funds settle to the creator; Ancaster receives only its fee | Limited: Standard accounts control their own payouts | Stripe first debits the connected account; the platform is liable only if it bears negative balances |
| (c) Destination charges | Platform (Ancaster), unless `on_behalf_of` is used | Higher | Higher: the charge settles on the platform balance | Manual payouts: up to 90 days for non-US accounts | Platform: "Refunds and chargebacks reduce your platform's balance" |
| (d) Separate charges and transfers | Platform | Highest of the Connect options | Highest | Same 90-day limit; decoupled transfers | Platform "ultimately liable" |
| (e) Merchant of record / escrow-style | Ancaster | Clear MSB and PSP candidate | In scope | Full, but Stripe: "Escrow has a precise legal definition, and Stripe doesn't provide escrow services" | Full |

**Stripe mechanics**
- **Destination charges:** "You're the merchant of record, and your account balance gets debited for the cost of the Stripe fees, refunds, and chargebacks."\[50\]
- **Indirect charges generally:** Stripe "always debits refunds, disputed amounts, and associated fees from your platform balance", and the platform may recover them by reversing the transfer.\[51\]
- **Negative balances:** for US and Canadian connected accounts with `debit_negative_balances`, Stripe may debit the creator's bank account. It holds a platform reserve meanwhile.\[51\]
- **Manual payouts:** can hold funds for 90 days in most countries, including Canada (two years for US accounts). Platform-created connected-account reserves cap at 180 days.\[52\]\[53\]
- **No-custody hold:** instead of holding money, save the advertiser's payment method at booking (SetupIntent) and charge it off-session 48–72 hours before the send. Card authorizations can't span multi-week lead times: Stripe's "Place a hold on a payment method" docs state "By default, an authorization for an online card payment is valid for 7 days", and extended authorization "can go up to 30 days depending on the card network" (Visa, Mastercard, Amex, Discover only). If the pre-send charge fails, the slot releases to the waitlist.

**How competitors move money**
- **Paved:** collects at booking as the contracting party, invoices advertisers, and "may recoup Payments paid to Publisher for any refunds".\[14\]\[54\] This is MoR-style.
- **beehiiv:** collects through its platform, holds "in escrow" until publish, and pays out via Stripe Express.\[6\]\[31\]
- **SponsorCal:** Stripe payment with a 7-day post-run dispute buffer before payout, which implies platform-controlled timing.
- **Passionfroot:** on-platform "compliant wallet" payments with a brand fee.\[28\] Its exact Stripe charge type isn't public.
- **EthicalAds:** a network MoR that invoices advertisers and pays publishers monthly, with a $50 minimum.\[2\]\[36\]

**Tax** (subagent research against CRA, IRS and Stripe primary sources)
- **GST/HST zero-rating:** CRA Memorandum 4-5-3 (December 2023), para 48: "a supply of an advertising service made to a non-resident person that is not registered under the regular GST/HST registration provisions at the time the service is performed is zero-rated". CRA's definition of advertising covers space "on a website" and in publications.\[18\]
  - The supplier must verify non-residence and non-registration, or "The CRA may assess a supplier for uncollected GST/HST".\[18\]\[55\]
  - Section 23 is the wrong provision; section 5 covers agency or arranging services.\[18\]
- **Small supplier threshold:** $30,000 of worldwide taxable supplies over four consecutive quarters. Zero-rated supplies count toward it.\[56\]\[57\]
  - Crossing it in one quarter triggers tax on the supply that crossed it.\[57\]
  - Whether Ancaster's revenue is its fee (agent model) or gross bookings (principal model) changes both the threshold and who the supplier is. CRA Policy P-182R governs this.
- **Digital platform rules (from July 1, 2021):** a distribution platform operator collects GST/HST only on supplies "to specified Canadian recipients by non-resident vendors who are not registered".\[19\] In practice that means US creators selling to unregistered Canadian advertisers. The rules don't cover B2B sales to registered Canadian advertisers, supplies by Canadian creators, or foreign advertisers. No advertising-marketplace-specific CRA info sheet exists.
- **US sales tax:**
  - New York (Tax Bulletin ST-10): "Sales of advertising services are not subject to sales tax."\[58\]
  - Connecticut exempts media space.\[59\]
  - Washington: "Starting Oct. 1, 2025, businesses must collect retail sales tax on advertising services", including "acquisition of advertising space".\[20\]
  - Marketplace facilitator laws attach only where the underlying service is taxable, and Virginia expressly exempts internet advertising providers.\[60\] Washington is the live exposure for a facilitator model.
- **US information returns:**
  - **1099-K:** the threshold is back to more than $20,000 and more than 200 transactions (IRS IR-2025-107, October 23, 2025).\[61\]
  - **1099-NEC and 1099-MISC:** rose to $2,000 for 2026.\[62\]
  - **Who files:** "Stripe issues 1099-K forms for connected accounts where Stripe controls the pricing"; otherwise the platform files.\[63\]
  - **EIN:** foreign issuers need a US EIN to file through IRIS.\[62\]
  - **Canadian payers:** whether a Canadian platform must file 1099s for US creators needs a US tax adviser.
- **Canada platform reporting (Income Tax Act Part XX):**
  - In force since January 1, 2024, with returns due January 31.\[64\]
  - It covers "personal services",\[65\] and creator ad production or placement likely qualifies (inference; CRA has no ad-specific guidance).
  - It has no services de minimis.\[66\]
  - Software that only processes payments or lists ads isn't a "platform".\[65\]
  - Under models (a) and (a+), Ancaster may still be a reporting platform operator. Ask the lawyer.
- **Invoicing:** GST/HST invoices must show the supplier's name and registration number, date, amount and tax. Under model (a) or (a+), the creator is the supplier, so Ancaster generates invoices *in the creator's name* as its software agent. Ancaster's own fee invoice is a separate SaaS supply.
- **Cross-border payouts:** destination charges across regions require `on_behalf_of`,\[67\] and some cross-border flows are unsupported. Under models (a) and (a+), each creator's own Stripe account settles in its home currency, which avoids the problem.

**Disputes if the ad doesn't run or underdelivers:** under model (a+), a refund is issued from the creator's account by Ancaster's software, following the codified make-good policy the creator accepts when listing (see Section 6). Chargebacks land on the creator as merchant of record. Ancaster's signed proof report is the evidence packet the creator submits.

## 5. Advertising Law for Self-Serve Creative

- **FTC Endorsement Guides (updated June 2023):**
  - Material connections must be disclosed "clearly and conspicuously", which the Guides define as difficult to miss and easily understandable.
  - Both advertiser and endorser can be liable.
  - A newsletter sponsor block needs a visible "Sponsored" or "Ad" label adjacent to the block.
  - A creator-voice mention needs the disclosure at the start of the mention, not in a footer.
- **FTC Consumer Reviews and Testimonials Rule (16 CFR Part 465, effective October 21, 2024):**
  - It bans fake or AI-generated reviews and testimonials, buying sentiment-conditioned reviews, and misleading review suppression.\[68\]
  - Civil penalties can reach $53,088 per violation: the FTC's February 2025 release says "The maximum civil penalty amount has increased from $51,744 to $53,088" (effective January 17, 2025), and its September 15, 2026 Federal Register notice says 2026 amounts "will remain unchanged… The FTC will continue to apply the 2025 civil penalty levels."
  - It applies both to advertiser creative ("10,000 devs love us" testimonials) and to Ancaster's own listing reviews.
- **Canada:**
  - The Competition Act prohibits materially false or misleading representations, judged on "general impression". Drip pricing is prohibited, so advertised prices must include mandatory fees.
  - Ad Standards' Influencer Marketing Disclosure Guidelines (updated October 2025) name "#Ad" alone as the "gold standard", require the disclosure within the content itself, and add AI-influencer guidance.\[69\]\[70\]
  - The Canadian Code of Advertising Standards (Clause 2) prohibits concealing commercial intent.\[71\]
- **CASL:** the creator's newsletter is a commercial electronic message. The creator carries sender identification, the unsubscribe mechanism and consent. Whether an advertiser who "causes or permits" a sponsored block shares liability is a lawyer question. Contractually, the creator warrants consent and the advertiser warrants its content.
- **New York synthetic performer law (GBL § 396-b, effective June 9, 2026):**
  - Ads with AI- or algorithm-generated humans who aren't identifiable real people must "conspicuously disclose" this, where the producer has actual knowledge.\[72\]\[73\]
  - Penalties are $1,000 for a first violation and $5,000 for each subsequent one.\[74\]
  - It excludes audio ads and publishers that merely disseminate ads.\[74\]\[75\]
  - The upload flow should therefore ask the advertiser directly, making knowledge explicit, and auto-append the disclosure.
- **What the automated disclosure check verifies:**
  1. The Ancaster-rendered "Sponsored by [Brand]" label is present and unaltered. It is a system field, not part of the creative.
  2. For creator-voice mentions and launch-day alerts, the disclosure appears in the first line or first 100 characters (and first push/SMS line). "#ad" is not buried among other hashtags.\[71\]
  3. Claims are flagged for human review: numbers, "#1", "best", "free", "guaranteed", savings claims, testimonials and review counts. The advertiser attests to substantiation.
  4. Prices shown include mandatory fees.
  5. Advertiser questions cover an AI-generated human likeness (triggering the NY disclosure) and testimonials, with an attestation of real, current customers.
  6. The landing URL is checked for domain match, a safe-browsing result, and a working page. Redirect chains are resolved.
  7. The category classifier is checked against Ancaster's prohibited list and the creator's blocklist.
- **Prohibited and restricted categories:** these are common across ad networks but I did not re-verify each platform's current list in this pass.
  - **Typically banned:** gambling, adult content, weapons, illegal drugs or cannabis (varies), MLM, payday loans, get-rich-quick schemes, political ads, and deceptive health claims.
  - **Restricted (manual review):** crypto and financial products, supplements, dating and VPNs.
  - For Ancaster's dev/AI beachhead, add "AI tools making unsubstantiated accuracy or earnings claims" to manual review.
- **Liability allocation in advertiser terms:**
  - The advertiser warrants that its content is lawful, substantiated and properly licensed, and indemnifies creator and Ancaster.
  - The creator warrants audience consent (CASL/CAN-SPAM) and accurate stats.
  - Ancaster disclaims content liability, retains takedown rights, and caps its liability at fees received.
  - Paved's terms ("All determinations made by Paved… shall be final") are a precedent for platform-determined metrics.\[14\] Ancaster's signed ledger makes that clause fairer and more defensible.

## 6. Synthesis: The Ancaster Self-Serve Spec

**Browse page ("Inventory")**
- **Filters:** format (newsletter sponsor block, site slot, launch-day alert, creator mention); topic tags; audience size band; price band; next available date; "has lift result"; "verified" badge; and geography split.
- **Listing card:**
  - creator name and niche line;
  - verified recipients per issue, the median unique-human open rate and median unique-human clicks (last 90 days, n issues);
  - price and implied CPM and CPC;
  - next three open dates with hold status;
  - past sponsors (logos, with consent);
  - a lift badge only if at least 3 holdout tests have run, showing the median incremental signups per 1,000 recipients with a CI bar;
  - make-good guarantee icon;
  - review stars with count.
- **Sort:** default by "cost per verified human click" (lowest first). A "cost per incremental signup" sort appears only once enough data exists.

**Booking flow (3 advertiser steps)**
1. **Pick slot(s).** Package discounts apply automatically, and a 20-minute hold starts (the existing holds engine).
2. **Creative.** Paste copy or generate a draft in the creator's voice. The UI validates character limits, runs the disclosure and claims checks live, uploads assets to R2, and answers the attestation questions.
3. **Pay.** Save the payment method; the charge happens T-72h before send (or immediately if the send is under 72h away). The first booking from a new domain requires email-domain verification.
- **Creator side:** a creative approval gate with a 48h SLA. If the creator doesn't respond, the booking is auto-approved if the advertiser is on their allowlist, or otherwise released with no charge. One revision round is included, requested through structured comments.

**Holds and scheduling:** a 20-minute checkout hold, then a firm booking. Creator-set lead time defaults to 5 business days. Holds are enforced in a per-issue Durable Object so there is never a double-sell.

**Post-run report (the product)**
- Issued within 24h (clicks) and again at 7 days (conversions and lift), and signed and hash-chained to the ledger.
- It contains:
  - verified sends;
  - unique human opens and clicks, with bot-filtered counts shown separately;
  - code redemptions and signup-locked conversions;
  - AI-matched "where did you hear" answers;
  - holdout lift with CI, using the 10% withheld group;
  - cost per incremental signup;
  - a rebook button prefilled with the same creative.
- Plain-English verdict line: "Statistically detectable lift: yes/no".

**Minimums:** no platform minimum. Creators set their own floor, with a system floor of $50 per booking so fees and processing make sense. This deliberately undercuts EthicalAds' $1,000\[35\] and beehiiv's $15k.

**Refunds and make-goods (codified, automatic, creator-accepted at listing)**

| Trigger | Outcome |
|---|---|
| Ad not sent on the booked date | Full refund, or reschedule at the advertiser's choice |
| Verified recipients below 80% of the listed figure | Pro-rata make-good or refund |
| Bot or scanner clicks above 50% of raw clicks (mirrors Paved) | Make-good slot |
| Wrong placement or rendering error | Make-good slot |
| Disappointing CTR or no lift | Not grounds for a refund; the lift report is the honest answer |

**Decision 1: Payment model**
- **Option A:** advertisers pay creators directly by link or invoice, and Ancaster invoices its fee. Safest, but breaks one-step checkout.
- **Option B (RECOMMENDED):** "your own keys" checkout on the creator's own Stripe account (a+). The charge is taken T-72h before send, and Ancaster's fee is invoiced monthly as SaaS. Ancaster's own newsletters use Ancaster's own Stripe as the actual supplier.
- **Option C:** Connect direct charges with an application fee, after a legal opinion. Destination charges only if a lawyer and Stripe confirm, and only if scale justifies MoR risk.
- **Decide for me:** B now, and commission the opinion this month. Move to C only if the opinion says (b) is not MSB or PSP activity and managing keys becomes painful.

**Decision 2: Fee structure**
- **Option A:** 10% on every flat booking, as proposed.
- **Option B (RECOMMENDED):** 0% for advertisers. Creators pay 10% on marketplace-sourced bookings and 5% on bookings from the creator's own storefront link, capped at $250 per booking. This answers the "commission math stops making sense" critique and undercuts Paved's 30% and Passionfroot's 15%.\[8\]
- **Option C:** flat SaaS pricing, with no percentage.
- **Decide for me:** B.

**Decision 3: Instant vs request-to-book**
- **Option A:** request-to-book (beehiiv, Passionfroot).
- **Option B (RECOMMENDED):** instant booking, gated by creator rules (category and domain allowlist or blocklist, price floor, lead time) plus the creative approval gate before any charge.
- **Option C:** instant booking for allowlisted brands, request-to-book for everyone else.
- **Decide for me:** B, with C as a per-creator toggle.

**Decision 4: Stats verification**
- **Option A:** self-reported with a badge for "connected".
- **Option B (RECOMMENDED):** only verified numbers appear on cards, sourced from Ancaster-native sends or an ESP API. Unverified listings show "stats pending" and can't use the lift badge.
- **Option C:** third-party audit.
- **Decide for me:** B.

**Decision 5: Pricing model**
- **Option A:** CPM or CPC.
- **Option B (RECOMMENDED):** flat price with displayed implied CPM and CPC from verified history, plus the delivery guarantee.
- **Option C:** CPA or hybrid.
- CPA isn't viable at launch: it creates attribution disputes and turns a creator slot into affiliate economics already covered by the affiliate program.
- Site ad slots can be CPM (EthicalAds precedent).\[48\]
- **Decide for me:** B for newsletters and alerts, CPM for site slots.

**30-day MVP (on existing pieces)**
- **Inventory:** the browse page lists Ancaster-owned newsletters plus 5–10 hand-invited dev/AI creators.
- **Booking:** the issue calendar and holds power instant booking, and payment follows option B (restricted keys; Ancaster's own inventory on Ancaster Stripe).
- **Creative:** a creative form with the disclosure and claims checks, and a creator approval email.
- **Report:** the existing signed proof report, extended with lift.
- **Make-goods:** the table above, executed manually.
- **Legal:** a Canadian payments lawyer engaged, and questions sent to Stripe.

**90-day version**
- Filters, sorting by cost per verified click, the lift badge, and reviews.
- Package bundles across creators.
- Site slots with CPM.
- Launch-day alert drops as a premium SKU.
- Automated make-goods.
- A rebook-in-one-click flow.
- The sponsor-desk agent drafting creative in the creator's voice.
- Part XX, GST/HST and 1099 logic, per the legal opinion.
- Possibly moving to Connect direct charges.

**Kill criteria**
- Fewer than 10 paid third-party bookings by day 60.
- Advertiser rebook rate below 20% by day 90.
- Creator approval SLA missed on more than 25% of bookings.
- The lawyer concludes that even (a+) is MSB activity with no workable carve-out; in that case revert to model (a).
- Disputes or chargebacks above 1% of bookings.

**Questions for a Canadian payments lawyer**
1. Under model (a+), where Ancaster software creates charges on the creator's own Stripe account using creator-supplied restricted keys and Ancaster invoices a separate SaaS fee, is Ancaster providing "payment services for goods or services" under the PCMLTFA, given PI-7670's retraction?
2. Does taking a Connect application fee (model b) change that answer? Does the Bank of Canada's "bank account it owns or controls" test treat a Stripe platform balance as controlled?
3. Is a percentage fee on bookings "commission" in an invoice-payment-services sense?
4. When selling Ancaster's own newsletter inventory, does the "own customer" exception fully apply?
5. Is Ancaster a reporting platform operator under ITA Part XX for creator ad services, even without touching funds?
6. For GST/HST, is Ancaster an agent (fee-only supply) or a principal? What must creator-name invoices generated by Ancaster contain?
7. Does an advertiser or platform "cause or permit" a CEM under CASL when a sponsor block appears in a creator's newsletter?
8. How should the advertiser and creator terms allocate liability and indemnity, and is the make-good policy enforceable as a standard term?
9. Sole proprietorship vs Ontario or federal corporation for liability ring-fencing before the first third-party booking?

**Questions for Stripe**
1. Do Stripe's terms permit a third-party service to hold creators' restricted API keys and create Checkout Sessions and off-session charges on their accounts? Or must this be Stripe Apps or OAuth Connect?
2. For off-session charges 48–72h before send, what SCA or 3DS exemption rates apply to Canadian and US cards? Can extended authorization be used?
3. Under direct charges with an application fee, who issues 1099-Ks for US creators when Ancaster sets pricing (`controller.fees.payer`)?
4. For destination charges from a Canadian platform to US connected accounts, is `on_behalf_of` required? What reserves would Stripe impose?
5. Is Platform tax reporting (non-US; private preview) available for Part XX?\[76\]

**Other important items**
- **Anti-circumvention:** Passionfroot polices off-platform payments.\[7\] Ancaster should win by making on-platform worth it (proof, guarantees) rather than by policing.
- **Trust-and-safety queue:** every first-time advertiser domain gets a human review from Chris during the MVP.
- **Evidence generation:** publish an anonymized quarterly "Proof Index" of median lift and cost per incremental signup across bookings. This is the marketing asset no competitor can copy without holdouts.

## Caveats
- **Vendor and secondary sources:** several platform details come from vendor pages or third-party reviews:
  - Paved's 4.6/5 rating and inventory counts;
  - MediaPact's rankings, which are self-published by a competitor;
  - Kit's program, from a secondary blog;
  - Hecto's fee.
  - Treat these as vendor claims.
- **Missing complaint and conversion evidence:** I found no substantive Reddit, G2 or Trustpilot complaint data for these marketplaces, and no published conversion or rebooking studies. The design recommendations on instant booking, verification and proof are reasoned, not empirically proven.
- **Legal and tax analysis:** the FINTRAC and RPAA analysis applies public guidance to a novel "own keys" model. No regulator has addressed that model directly, so a lawyer's opinion is required before any third-party payment.
- **Unresolved tax points:** the US 1099 obligations of a Canadian payer, Washington's facilitator treatment of advertising, and whether the US is on CRA's Part XX partner-jurisdiction list were not confirmed.

## Sources

1. [Paved Newsletter Marketplace: Review, Pricing and Alternatives](https://www.emailtooltester.com/en/blog/paved-newsletter-sponsorship-marketplace/)
2. [Publisher Policy - EthicalAds](https://www.ethicalads.io/publisher-policy/)
3. [Newsletter CPM Calculator for Sponsorships | SponsorCal](https://sponsorcal.com/blog/newsletter-cpm-calculator)
4. [Sponsonizer — Calendly for newsletter ad slots - Sponsonizer](https://sponsonizer.com/)
5. [Newsletter Sponsorships & Ad Management - Buttondown](https://buttondown.com/features/sponsorships)
6. [Direct Sponsorships](https://product.beehiiv.com/p/direct-sponsorships)
7. [Pricing | Passionfroot Help Center](https://help.passionfroot.me/en/articles/11552638-pricing)
8. [Creator Pricing | Passionfroot](https://www.passionfroot.me/creator-pricing)
9. [MediaPact vs. Passionfroot: Which Platform Wins for Newsletter & Creator Sponsorships?](https://mediapact.ai/compare/passionfroot/)
10. [Passionfroot is a marketplace for business-focused content creators looking for brand partnerships — and vice versa | TechCrunch](https://techcrunch.com/2024/10/21/passionfroot-is-building-a-platform-for-brand-and-creator-colloboration-with-a-focus-on-b2b-sector/)
11. [Premium Newsletter Advertising Platform Paved Acquired by Redbrick](https://www.businesswire.com/news/home/20250311599185/en/Premium-Newsletter-Advertising-Platform-Paved-Acquired-by-Redbrick)
12. [Is Passionfroot the Best Way to Secure Brand Partnerships? Ultimate Review of the Passionfroot Platform](https://whop.com/blog/passionfroot-review/)
13. [Makegoods & Refunds | Paved Knowledge Base](https://www.paved.com/help/articles/8121038-makegoods-refunds)
14. [Paved Advertiser Agreement](https://www.paved.com/advertiser-terms)
15. [Supervisory policy for online marketplaces - Bank of Canada](https://www.bankofcanada.ca/2025/12/supervisory-policy-for-online-marketplaces/)
16. [Check to see if you need to register with FINTRAC as a money services business](https://fintrac-canafe.canada.ca/msb-esm/questions/2-eng)
17. [FINTRAC Retracts PI-7670: Certain Merchant Servicing and Payment Processing Activities May Be MSB Activities | Goodmans LLP](https://www.goodmans.ca/insights/article/fintrac-retracts-pi-7670-certain-merchant-servicing-and-payment-processing-activities-may-be-msb-activities)
18. [Exports – Services and Intangible Personal Property - Canada.ca](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/4-5-3/exports-services-intangible-personal-property.html)
19. [Cross-border digital products or services: GST/HST for digital-economy businesses - Canada.ca](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/digital-economy-gsthst/charge-collect/cross-border.html)
20. [Advertising services now subject to retail sales tax | Washington Department of Revenue](https://dor.wa.gov/forms-publications/publications-subject/special-notices/advertising-services-now-subject-retail-sales-tax)
21. [Email Bot Clicks: Are They Hurting Your Newsletter? - Paved Blog](https://www.paved.com/blog/email-bot-clicks/)
22. [The Marketplace for Advertisers | Paved Knowledge Base](https://www.paved.com/help/collections/5056983)
23. [Marketplace FAQs for Advertisers | Paved Knowledge Base](https://www.paved.com/help/articles/8121068-marketplace-faqs-for-advertisers)
24. [Newsletter Sponsorship Pricing | Paved Knowledge Base](https://www.paved.com/help/articles/8120741-newsletter-sponsorship-pricing)
25. [Passionfroot Software Pricing, Alternatives & More 2026 | Capterra](https://www.capterra.com/p/10022434/Passionfroot/)
26. [FAQs | Passionfroot Help Center](https://help.passionfroot.me/en/articles/11552873-faqs)
27. [Getting started | Passionfroot Help Center](https://help.passionfroot.me/en/articles/11563316-getting-started)
28. [Passionfroot - The AI Agent for Creator-led GTM](https://www.passionfroot.me/)
29. [Passionfroot Review (2026): Sponsorship Management Pricing, Features & Honest Take | CreatorStackClub](https://www.creatorstackclub.com/software/passionfroot)
30. [How to create a direct sponsorship storefront | beehiiv Help](https://www.beehiiv.com/support/article/30651400536727-how-to-create-a-direct-sponsorship-storefront)
31. [FAQs about direct sponsorships | beehiiv Help](https://www.beehiiv.com/support/article/31674987552535-faqs-about-direct-sponsorships)
32. [FAQs about direct sponsorships - Knowledge Base - beehiiv](https://www.beehiiv.com/support/article/31674987552535-faqs-about-direct-sponsorships?via=him)
33. [Newsletter Sponsorship Marketplaces: How to Get Sponsorships - fetchprofits](https://fetchprofits.com/newsletter-sponsorship-marketplaces/)
34. [Best Newsletter Sponsorship Platforms Compared | SponsorCal](https://sponsorcal.com/blog/newsletter-sponsorship-platforms)
35. [Advertise with Us - EthicalAds](https://www.ethicalads.io/advertisers/)
36. [Advertiser Frequently Asked Questions - EthicalAds](https://www.ethicalads.io/advertisers/faq/)
37. [Publisher's Guide - EthicalAds](https://www.ethicalads.io/publisher-guide/)
38. [BuySellAds — Your brand, in good company.](https://www.buysellads.com/)
39. [Newsletter Network | BuySellAds](https://www.buysellads.com/newsletter-network)
40. [Discover If BuySellAds Can Actually Put Money In Your Pocket](https://blogpros.com/can-make-money-buysellads/)
41. [Newsletter - Good Tools #19 - by Robin Good - Good Tools](https://goodtools.substack.com/p/email-newsletters-good-tools-19)
42. [Best Newsletter Advertising Platforms in 2026 | Dupple](https://dupple.com/learn/best-newsletter-advertising-platforms)
43. [7 Best Free Newsletter Sponsorship Platforms for B2B Pipeline Success in 2026](https://scopicstudios.com/blog/best-free-newsletter-sponsorship-platforms-for-b2b/)
44. [AdBooker - Self-Serve Booking for Newsletter Sponsorships](https://adbooker.co/)
45. [Top 10 Newsletter Sponsorship Platforms in 2026 (Ranked by Use Case) | MediaPact](https://mediapact.ai/guides/top-newsletter-sponsorship-platforms-2026/)
46. [Paved Advertiser Starter Pack | Paved Knowledge Base](https://www.paved.com/help/articles/9457458-paved-advertiser-starter-pack)
47. [Pricing & Payments for Advertisers | Paved Knowledge Base](https://www.paved.com/help/articles/8120334-pricing-payments-for-advertisers)
48. [Transparent pricing for advertising to developers - EthicalAds](https://www.ethicalads.io/advertisers/pricing/)
49. [Newsletter Sponsorship Pricing: CPM Rates & Benchmarks 2026 | SponsorCal](https://sponsorcal.com/blog/newsletter-sponsorship-pricing)
50. [Accept a payment using destination charges | Stripe Documentation](https://docs.stripe.com/connect/marketplace/tasks/accept-payment/destination-charges)
51. [refunds disputes](https://edge-docs.stripe.com/connect/marketplace/tasks/refunds-disputes)
52. [manual payouts](https://docs.stripe.com/connect/manual-payouts)
53. [connected account reserves](https://edge-docs.stripe.com/connect/connected-account-reserves)
54. [Paved Publisher Terms and Conditions](https://www.paved.com/publisher-terms)
55. [8 December 2022 GST/HST Interpretation 222719 - Supplies of digital marketing services made to a non-resident | Tax Interpretations](https://taxinterpretations.com/content/675500)
56. [GST/HST Registration in Canada: When and How to Register](https://rattray.cpa/blog/gst-hst-registration)
57. [When to register for and start charging the GST/HST - Canada.ca](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html)
58. [advertising services](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/advertising_services.htm)
59. [SALES TAX ON ADVERTISING](https://www.cga.ct.gov/2011/rpt/2011-R-0266.htm)
60. [Watch out for marketplace facilitator compliance obligations](https://www.bdo.global/en-gb/microsites/tax-newsletters/indirect-tax-news/issue-4-2022/united-states-watch-out-for-marketplace-facilitator-compliance-obligations)
61. [IRS issues FAQs on Form 1099-K threshold under the One, Big, Beautiful Bill; dollar limit reverts to \$20,000](https://irs.gov/newsroom/irs-issues-faqs-on-form-1099-k-threshold-under-the-one-big-beautiful-bill-dollar-limit-reverts-to-20000)
62. <https://support.stripe.com/questions/whats-new-for-the-2026-tax-season>
63. <https://docs.stripe.com/docs/connect/tax-reporting>
64. [Tax Insights: Reporting rules for digital platform operators ─ Start preparing for the first filing deadline of January 31, 2025 | PwC Canada](https://www.pwc.com/ca/en/services/tax/publications/tax-insights/reporting-rules-digital-platform-operators-2024.html)
65. [Reporting Rules for Digital Platforms](https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/compliance/reporting-rules-digital-platforms)
66. [Who is affected - Canada.ca](https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/compliance/reporting-rules-digital-platforms/who-is-affected.html)
67. [destination charges](https://docs.stripe.com/docs/connect/destination-charges)
68. [FTC Fake Reviews Rule 2024: Compliance Guide — Fourscore Business Law](https://www.fourscorelaw.com/resources/ftc-bans-fake-reviews-and-testimonials)
69. [Canada's updated Influencer Marketing Disclosure Guidelines: Navigating AI, affiliate marketing, child audiences and more - Lexology](https://www.lexology.com/library/detail.aspx?g=ed3ec1c8-35cc-40d1-996f-f38584bacf69)
70. [Canada’s updated Influencer Marketing Disclosure Guidelines: Navigating AI, affiliate marketing, child audiences and more | Gowling WLG](https://gowlingwlg.com/en/insights-resources/articles/2025/updated-influencer-marketing-disclosure-guidelines-in-canada)
71. [Canadian Code of Advertising Standards for Influencer Marketing: Key Clauses and Application to AI-Generated Content and Influencers | Bennett Jones](https://www.bennettjones.com/Insights/Blogs/Canadian-Code-of-Advertising-Standards-for-Influencer-Marketing)
72. [New York Enacts 'Synthetic Performer' Disclosure Law for ...](https://www.cooley.com/news/insight/2026/2026-01-29-new-york-enacts-synthetic-performer-disclosure-law-for-advertisements-including-those-using-generative-ai)
73. [Fake performer, real penalty: What advertisers need to know before June 9 | ReedSmith](https://www.reedsmith.com/our-insights/blogs/viewpoints/102n129/fake-performer-real-penalty-what-advertisers-need-to-know-before-june-9/)
74. [New York’s synthetic performer disclosure law: What advertisers need to know](https://www.mcdermottlaw.com/insights/new-yorks-synthetic-performer-disclosure-law-what-advertisers-need-to-know/)
75. [NY State Assembly Bill 2025-A8887B](https://www.nysenate.gov/legislation/bills/2025/A8887/amendment/B)
76. [platform tax reporting](https://edge-docs.stripe.com/connect/platform-tax-reporting)
