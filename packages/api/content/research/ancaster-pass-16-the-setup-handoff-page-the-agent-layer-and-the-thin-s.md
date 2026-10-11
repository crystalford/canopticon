---
id: ancaster-pass-16-the-setup-handoff-page-the-agent-layer-and-the-thin-s
title: "Ancaster Pass 16: The Setup Handoff Page, the Agent Layer, and the Thin Spots"
kind: "Research pass"
topic: "Attribution & credit"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-3838cd6b-08f1-503c-8374-5f8698f4e7f1_text_markdown.md"
---

# Ancaster Pass 16: The Setup Handoff Page, the Agent Layer, and the Thin Spots

**Recommendation: build the "hand over the creator's setup" page, with one change. It should not assume the referral survives the handoff. The only mainstream product that documents a creator's exact setup opening in-product under her referral is Framer, through remix links. Railway is a second, different model: it pays template authors a share of usage rather than a referral. Everywhere else, the page has to set the affiliate click first and hand over the setup second.** The agent layer should copy Instantly's inbox and classification machinery and none of its outbound volume engine. The strongest near-term agent is a creator ops agent that watches program changes. Within the last year, Notion closed its affiliate program to new applicants, Cursor discontinued referrals, and v0 ended its referral credits on July 15, 2026.\[1\]\[2\]\[3\]

## TL;DR
- **The redesign is right, but it has to be built in tiers.** Tier A covers Framer, where the remix link is referral-tracked, and Railway, where the template deploy pays the author a usage kickback. It can honestly say "open her exact setup." Tier B covers Lovable, Webflow, Notion, Canva, Descript and Vercel/Supabase. Copying works there, but no documentation says a referral survives a remix or clone. These pages must say "copy her setup" and route the signup through the affiliate link first. Tier C covers products with no shareable setup, such as ElevenLabs Studio, Cursor, Runway, beehiiv and Kit. For them the page carries a copyable recipe and a plain signup.
- **Copy Instantly's inbox, not its sending engine.** Worth copying: the unified inbox, per-output credit metering, reply classification and placement monitoring. Not worth copying: warmup networks, inbox rotation, bought lead databases and autonomous replies. The evidence against AI SDRs is poor: TechCrunch (Mar 24, 2025) reported former employees' estimate of 70–80% early churn at 11x (11x disputed it, citing 79% retention), and Artisan's own CEO admitted "relatively high churn."\[4\] Microsoft has rejected non-compliant bulk mail with 550 5.7.515 since May 5, 2025.\[5\] Chris is also a CASL sender.
- **Rank agents by value and feasibility:** (1) creator ops watchdog, (2) transcript-to-recipe drafter with creator approval, (3) the grounded reader Q&A you already have, (4) an inbound-only sponsor desk with human approval, (5) an advertiser booking agent over a read-only MCP catalog. Postpone autonomous buying. The landing-page experiment needs about 1,100–1,800 clicks per arm. Thin spots remain: no fresh evidence this pass on how comparable tools won their first 1,000 creators, and none on Mutiny-style or AI-SDR landing-page lift.

## Key Findings

### 1. Can the referral survive a remix, template or deep-link handoff?

The subagent read official docs for 11 products on September 25, 2026. It found no product except Framer that documents an affiliate parameter (?via=, ?ref=, PartnerStack, Dub, Impact, Cello) carrying through a remix, duplicate, clone or template link. The documentation that does exist points the other way: attribution requires the referral click before signup and is cookie-based. The pattern for logged-out users is consistent: you can view without an account, but you must sign up to copy.

| Product | Shareable setup mechanic | Works logged-out? | Signup forced to copy? | Referral carries through setup link? | Pays template/setup creators? |
|---|---|---|---|---|---|
| **Framer** | Remix links, auto-generated in the Creator Program "Links" tab; sign-up links can point to any framer.com page, including templates\[6\]\[7\] | Yes (view) | Yes | **Yes, documented.** Help center (updated Sept 15, 2026) says "View remix links generated from projects you share";\[6\] a third-party guide says remix links are tracked in the backend, override cookie attribution and use a 90-day window\[6\]\[8\] | Yes: 100% of paid Marketplace template revenue, plus 50% of a referral's first-year payments. "Template purchases take priority over sign-up referrals"\[6\]\[9\]\[10\] |
| **Railway** | Template marketplace deploy links | Deploy needs an account | Yes | No referral needed. The template author earns directly | Yes: 15% kickback of usage, plus 10% support bonus (25% total) if they answer the Template Queue; cash withdrawal available. Railway's blog (Dec 5, 2025) says it has paid "almost ~$1 Million" to template creators, "roughly ~$730k" of it as cash, with two contributors past $100,000 and 1,800+ live templates |
| **Lovable** | Remix links (public remixing off by default); "Build with URL" prompt-prefill links; templates gallery\[11\] | Yes: preview plus a Remix button\[11\] | Yes: "Log in to remix," then click Remix again\[11\] | Not documented\[12\] | Via affiliate program only: "up to $100 for each first-time subscriber," on Impact. Older "20% recurring/60-day" figures look outdated\[13\]\[14\]\[15\]\[16\] |
| **Bolt.new** | Share link (Viewer/Editor); a new prompt duplicates the project to your team\[17\] | Not documented | Implied | No. Referral fails "if they signed up without the link, or signed up before clicking it"\[18\] | User referral only: 15% of what the referee pays, up to $50, via Cello\[18\] |
| **v0 / Vercel** | Community templates; Deploy button clones the repo to your Git and deploys\[19\]\[20\] | Browse yes; deploy needs Vercel plus Git | Yes | No. The v0 "Invite & earn" credit program ended **July 15, 2026**; an Ambassador program (application-only) includes a Dub-powered referral link\[1\]\[21\] | No template payouts found |
| **Supabase** | Starter kits via Vercel Deploy button; Supabase runs migrations automatically\[20\] | Needs Vercel and Supabase accounts | Yes | No affiliate program found this pass | No |
| **Replit** | Remix, with a visible "Remixed from" credit\[22\] | Unverified | Unverified | Not documented | Bounties shut down around Sept 6, 2025; referral credits exist but the amount conflicts ($10 vs $20)\[23\]\[24\] |
| **Webflow** | Cloneables on Made in Webflow; template fulfillment links with guided signup\[25\]\[26\]\[27\] | View yes; clone needs a Dashboard account | Yes | Not documented. Terms: "Only affiliate links can be used to track referrals"; commission **excludes "Templates and cloneables"**\[28\] | Template sales: 95% to the creator. Affiliate: 50% of first subscription for up to 12 months\[25\]\[28\] |
| **Notion** | Public page "Duplicate as template"\[29\] | View yes | Yes | Not documented | Marketplace sales (third-party figure: 10% + $0.40). Affiliate "up to $50 per activated sign up plus 20% of year one revenue" but **"currently not accepting new affiliates"**\[3\]\[30\] |
| **Canva** | Template links: "Anyone with the link can use your design as a template" (creating one requires Pro/Teams)\[31\]\[32\] | View varies | Yes (free account OK)\[33\] | Not documented | Canva Creators royalty pool, paid for Free and Pro template usage; application-only\[34\]\[35\] |
| **Figma** | Community files; free files under CC BY 4.0; paid files under a Community Paid Resource License\[36\] | View yes | Duplicating needs an account | No affiliate program found | Paid Community files |
| **Descript** | Project links (recipient must be signed in); web share links (no account); layout packs\[37\]\[38\]\[39\] | Share links yes; project links no | Yes for projects | Not documented | No template payouts; affiliate on PartnerStack, amount conflicting ($25 vs 15%)\[40\]\[41\]\[42\] |
| **ElevenLabs** | Voice sharing by direct link or Voice Library listing\[43\] | Library browse yes | Yes to use | Not documented | Yes for voices: cash rewards when paid users use a shared Professional Voice Clone, via Stripe Connect. Default rate reported by ElevenLabs as "around $0.03 per 1,000 characters." ElevenLabs' blog (May 22, 2026) says Voice Library creators have earned "over $22 million," doubled from $11M in Nov 2025, with "10,400+ creators earning" |
| **beehiiv / Kit** | No shareable setup-remix found. beehiiv partner links work on "any webpage" on beehiiv.com; Kit has a template Marketplace | n/a | n/a | beehiiv: 50% for 12 months, 60-day first-touch cookie. Kit: 50% for 12 months plus 10–20% recurring after tiers\[44\]\[45\] | Kit Marketplace split undocumented; beehiiv has no template marketplace\[46\] |
| **Cursor** | Rules are files. No hosted share-remix | n/a | n/a | Referral program **discontinued "due to increased levels of fraud"** (help page; conflicting forum posts)\[2\]\[47\] | No |
| **Runway** | No setup sharing found | n/a | n/a | Code-based: $15 per new paid subscriber; followers get 25% off\[48\] | Creative Partners get a free plan, not cash\[49\] |

**What this means.** "Open the creator's exact setup inside the product under her referral" works on a documented basis today only on **Framer**. Railway gets the same economic result through a different contract: the creator who publishes the template earns from usage whether or not she has a referral link.\[50\] Lovable's remix and "Build with URL" links are the most promising next candidate, since they give a logged-out preview and a prefilled prompt.\[12\] Treat attribution through them as unproven until a controlled test shows it: click the /go link, then the remix, then sign up, then check the Impact dashboard. The 90-day override and backend tracking claims for Framer come from a third-party guide, SegmentUI. The official help page confirms that remix links are generated and tracked, but not the window.\[6\]\[8\]

**Design consequence, and a trap to avoid.** Most creator traffic starts inside social in-app browsers, which are sandboxed. Vendor sources consistently report that these browsers don't share cookies or logins with Safari or Chrome.\[51\]\[52\] So an affiliate cookie set inside Instagram's webview will not follow the reader to her laptop.\[53\] Every "send to my laptop" and saved-kit link must therefore route back through /go/:creator/:brand so the affiliate click happens again on the device where the signup happens. That is the cross-device fix, and it tracks nobody.

### 2. Radical landing-page precedents and evidence

**What exists (verified mechanics):**
- **Framer remix and Railway deploy pages** are the closest precedent to your "hand over the setup" idea. The product page *is* the setup. Framer creator TMPL self-reports about $2,000/month in affiliate income "almost entirely from organic traffic" off template pages.\[54\] That is a single self-report, not a benchmark.
- **Lovable "Build with URL"** encodes a prompt in a link that "opens with the prompt prefilled, and the recipient clicks send."\[12\] It is a working model of a copyable recipe that runs in one tap.
- **Webflow's own blog** profiles an affiliate who pointed his link at a cloneable's Showcase page. It's a case story showing that "setup first" content converts for at least one affiliate.\[55\]

**Conversational and AI landing pages: vendor claims only.** Rep AI's 2025 report (17 million interactions) says shoppers who engaged with AI chat converted at 12.3% vs 3.1% for those who didn't. That is self-selected engagement, not lift. Rep AI itself calls it "not a randomized study."\[56\] I found no independent controlled experiment of on-site AI chat lift this pass. Nor did I find fresh evidence on Qualified Piper, Intercom Fin, Mutiny-style referral personalization, quizzes or calculators. **Treat every conversion-lift claim in this category as unproven.** Your grounded "ask about this" should stay a secondary element, never the primary CTA.

**AI-referred traffic is a separate and real signal.** Adobe (vendor data, Q1 2026) reports that AI-assistant visitors converted 42% better than non-AI traffic in March 2026, after converting 38% worse in March 2025.\[57\] Seer Interactive's single-site study found ChatGPT traffic converting at 15.9% vs 1.76% for Google organic.\[58\] This supports keeping the page server-rendered and machine-readable. Those visitors arrive already pre-sold.\[59\]

**In-app browsers (2025–2026).** The consistent reports, all from link-tool vendors with a commercial interest: no shared cookie jar, no autofill or password manager, logged-out sessions, and an "Open in browser" item hidden in a ··· menu.\[52\]\[53\]\[60\] One vendor claims "up to 25% of social ad conversions are lost," with no primary source; don't repeat that number.\[61\] Android can hand off to the default browser with an intent. iOS generally needs an on-page instruction.\[62\] The practical fix is a one-line, above-the-fold escape instruction when the user agent is a known webview. Treat any automatic breakout as unreliable.\[60\]

**Mobile-to-desktop SaaS signup.** I found no independent data this pass on how many mobile clicks finish signup on desktop. The sources available are attribution vendors (Cometly and others) describing deterministic matching by email login.\[63\]\[64\] **No evidence exists here, so measure it yourself.** Count send-to-laptop requests divided by mobile sessions, then desktop /go re-clicks within 7 days.

**Saved-for-later and reminders, video-first, vertical swipe:** no evidence gathered this pass. Don't build on assumptions here. Put them in the experiment backlog.

### 3. Content-moment continuity without tracking the reader

The page can know the moment without knowing the person. The moment is a property of the **link**, not the visitor.

- **Per-placement links.** The link is `/go/maya/framer/v/<placement-id>`. The placement record, written by the creator, holds the video, episode or issue, the timestamp and the approved recipe. No cookie, no fingerprint. This is the whole mechanism. Everything below is a way of filling in that record.
- **YouTube timestamps and chapters.** A standard `&t=` link lets "Watch the exact step" jump back to the moment. YouTube Shopping also lets creators tag products in the video.\[65\] The arXiv study 2603.04383, "Turning Trust to Transactions" (University of Iowa/UC Davis, also at AAAI ICWSM), analyzed a 10-year dataset of 2 million videos from nearly 540,000 creators and found "most videos failing to meet FTC standards," which shows the description-link channel is both mainstream and audited for disclosure.
- **Podcasts.** The Podcasting 2.0 `podcast:chapters` and `podcast:transcript` tags give machine-readable moments and words. I did not re-verify adoption rates this pass.
- **Newsletters.** Issue anchors go in the per-placement link (`/i/<issue>#section`).
- **Instagram and TikTok.** Comment-to-DM ("Say The Word") is where post IDs enter the system. The DM carries a link minted for that post.
- **Transcript to "exactly what she did."** The creator's own words are the source. An LLM drafts steps from the transcript, and the page shows only what the creator has approved. Under your "blank beats plausible" rule, an unapproved recipe renders as nothing, not as a guess.

Precedents I could verify are thin: Lovable's "Remixed from" and Replit's visible remix credit, Framer remix links,\[6\]\[7\] and YouTube product tagging.\[11\]\[22\]\[65\] I found no product that generates creator-approved step-by-step recipes from transcripts and attaches them to affiliate links. That empty space is your differentiation, with the caveat that it's empty because nobody has proven readers want it.

### 4. The agent layer: Instantly.ai and peers

**Instantly teardown (2026).** All reviews below are written by competitors (Salesforge, Saleshandy, Primeforge, Skrapp, MarketBetter, Emailchaser, Cleanlist), so weigh them as interested parties.
- **Product:** unlimited sending accounts plus unlimited warmup on paid plans; Unibox (a unified inbox); SuperSearch lead database, claimed 450M+ contacts; AI Sales Agent (finds ICP leads, writes and sends, books meetings); AI Reply Agent (replies "without manual approval" or with approval); CRM; website visitor ID pixel (US-only per one reviewer); Inbox Placement tests; AirMail, its own sending infrastructure at $4/inbox/month (2026).\[66\]\[67\]\[68\]\[69\]\[70\]
- **Pricing (July–Sept 2026):** Outreach plans run $47 (Growth), $97 (Hypergrowth) and $358 (Light Speed). Credits start at $47 for 1,500. **The AI Reply Agent costs 5 credits "per reply generated, regardless of whether the reply is sent or edited," and the Sales Agent 5 credits "per generated lead, regardless of whether the lead is approved."**\[70\]\[71\] One review puts the Reply Agent in bundles from the $194 Scale plan.\[69\]
- **Claimed vs independent results:** one r/agency anecdote reports reply rate rising from 0.8% to 5.1%.\[72\] No independent study. G2 is about 4.8/5.\[66\]
- **Complaints:** warmup "heat scores" that don't match real placement; pre-warmed domains arriving with poor reputation; three separate subscriptions; thin reporting; data portability on exit.\[66\]\[67\]\[70\]\[72\]

**Enforcement context.** Microsoft began *rejecting* (not junking) mail from domains sending 5,000+ messages a day to outlook.com, hotmail.com and live.com without SPF, DKIM and DMARC on **May 5, 2025**, with the error "550; 5.7.515 Access denied."\[5\]\[73\] Microsoft's post also says asking recipients to add senders to Safe Senders doesn't bypass the rules.\[74\] Instantly's move to its own AirMail infrastructure, marketed as immune to Google and Outlook suspensions,\[70\] reads as a response to mailbox-provider pressure on warmup-and-rotation setups built on Workspace and M365 accounts. That is my inference, not a documented statement.

**Peers.**
- **11x:** TechCrunch (Mar 24, 2025) reported non-customer logos: ZoomInfo said "we are not a customer" and that in its one-month pilot "11x's product performed significantly worse than our SDR employees." It also reported ARR counting that ignored churn, and former employees estimating 70–80% churn within three months. That figure is an anonymous estimate, not audited; 11x disputed it, telling TechCrunch its retention rate was 79% (per secondary summaries). The median contract is about $45,000/year (Vendr, via a third party).\[75\]
- **Artisan:** the CEO told TechCrunch first-generation AI SDRs had a "pretty low response rate" and "relatively high churn," and "extremely bad hallucinations" at launch.\[4\] A reported LinkedIn ban from Dec 2025 to Jan 2026 is sourced mainly to competitor comparison pages, including 11x's own,\[76\]\[77\] so treat it as unconfirmed.
- **One agency field report** says teams augmenting human reps saw 2.8x more pipeline than teams replacing them.\[78\] This is vendor-adjacent.
- **Smartlead, Lemlist, Apollo, Clay, Unify:** not researched in depth this pass.

**What transfers to Ancaster:**
- A unified inbox for sponsor conversations across the creator's own mailbox. Bring-your-own-key fits here.
- Reply classification into interested, question, pricing, not now and unsubscribe.
- Per-output metering, so agent cost stays visible.
- Placement and deliverability monitoring of the creator's *own* newsletter sends.
- Enrichment only for inbound sponsors: look up the company that wrote in, never scrape prospects.

**What must not transfer:**
- Warmup networks and inbox rotation, which exist to disguise volume.
- Bought lead databases and visitor-ID pixels, which conflict with "no pooled lists; processor only."
- Autonomous sending of replies.
- Cold sequences to consumers.

Under CASL, commercial electronic messages need consent (express, or narrow implied cases such as a conspicuously published business address relevant to the message), sender identification and a working unsubscribe. The CRTC's CASL FAQ states: "The maximum amount of an AMP, per violation, for an individual is $1 million. For a business, it is $10 million." Ancaster should never be the sender of record for cold outreach.

**Ancaster's agent lineup:**

| Rank | Agent | Value | Feasibility on Cloudflare | Guardrails |
|---|---|---|---|---|
| 1 | **Creator ops watchdog** (link health, program terms, code leaks) | Very high. This pass alone found Notion closed to new affiliates, Cursor discontinued, v0 credits ended July 15 2026, Lovable's terms changed from 20%-recurring to "up to $100," and Framer moving from FirstPromoter to Dub\[1\]\[2\]\[3\]\[6\]\[7\]\[15\]\[16\] | High: Cron Triggers, Queues, fetch and diff of terms pages into D1 with dated snapshots in R2 | Alerts only, never auto-edits a live page. Every change shows the diff and source URL. The page falls back to blank on a stale rule |
| 2 | **Recipe drafter / offer matcher** (transcript to steps; suggests fitting offers from the 401 index) | High: it produces the core of the new page | Medium: Workers AI for drafting; transcripts pulled with creator OAuth or pasted | Creator approves every step. Disclosure drafted first. Never invents a setting absent from the transcript. Suggests only offers with checked rules |
| 3 | **Reader Q&A** (exists) | Medium; lift is unproven | Built | Grounded in checked facts only; "I don't know" is the default; no pricing older than the check date |
| 4 | **Sponsor desk** (inbound only) | Medium-high for revenue | Medium: Email Workers for inbound; drafts go into the creator's own mailbox | Human approves every send. No cold outbound. Classifies and quotes from the creator's own rate card and placement calendar |
| 5 | **Advertiser campaign agent** plus agent-to-agent commerce | Speculative | Medium: expose the placements catalog as a read-only MCP server | Read-only first. Bookings require the advertiser's human confirmation and the existing 72h-before-send Stripe charge. No autonomous spend |

### 5. Thin-spots audit

**(a) Distribution for Ancaster itself.** I found no new primary evidence this pass on how Beacons, Stan, Passionfroot, Dub, beehiiv, Kit or Lemon Squeezy got their first 100–1,000 creators. This remains the thinnest area and needs a dedicated pass. One transferable pattern was verified: **platforms pay people who publish reusable setups.** Railway's blog (Dec 5, 2025) says it has paid "almost ~$1 Million" to template creators, "roughly ~$730k" as cash, with two contributors past $100,000 and thirty past $1,000, and it says it reaches 2 million developers. Framer's Creator Program auto-enrolls anyone who publishes a Marketplace product.\[6\] ElevenLabs pays voice sharers.\[79\] Ancaster's distribution wedge should be the dev and AI-tools creators already publishing templates on those programs. They have setups to hand over and a financial reason to want a better page.

**(b) The six platforms.**

| Platform | Affiliate links | Third-party redirect domain | Sponsored content | Ads alongside platform monetization |
|---|---|---|---|---|
| **YouTube** | Allowed: "Affiliate content doesn't violate YouTube's Terms of Use"; excessive affiliate posting in dedicated accounts may be spam\[80\] | Allowed in descriptions and comments; external-links policy bans links to malware, phishing and harmful sites. Shorts links were restricted in favour of prominent link spots\[80\]\[81\] | Must tick "includes paid promotion" and disclose\[82\] | Brand integrations allowed with the paid-promotion flag |
| **Twitch** | Allowed. Branded-content rules say sharing affiliate links "in response to questions from your community" isn't branded content; paid-relationship links are\[83\]\[84\] | No specific rule found | Must use the branded content disclosure tool. Limits on burned-in video, audio and banner ads and a 3% logo size appeared in the 2023 guideline and were partly walked back; re-check the current text\[83\]\[84\]\[85\] | From Aug 20, 2026 Affiliates can take sponsorships through the Sponsorship Dashboard after certification\[86\] |
| **Substack** | Tolerated, not supported: "we don't build any additional functionality to support affiliate links or advertising"\[87\] | No rule found | Allowed: "welcome to host sponsored content"\[88\] | Bans publications "whose primary purpose is to advertise… drive traffic to third party sites"\[89\] |
| **Medium** | Allowed with disclosure: "You must disclose affiliate links or payment for a post"; no posts "with the primary purpose of affiliate marketing"\[90\] | Rule against "deceptive… links"\[90\] | Must be disclosed\[90\] | Partner Program paywall earnings coexist\[91\] |
| **Google AdSense** | "We do allow affiliate or limited-text links"; avoid "cookie cutter… affiliate programs with little or no original content"\[92\]\[93\] | Bans redirecting "users to unwanted websites"\[94\] | Labels limited to "Sponsored Links" or "Advertisements"\[95\] | Ads may not outnumber content\[92\] |
| **Ko-fi** | No specific ban found; links must not be "fraudulent, misleading, inaccurate or dishonest"\[96\] | No rule found | No specific rule found | Ko-fi runs its own referral link\[97\] |

**Implication.** None of the six forbids a disclosed redirect through a creator's own domain. Every one penalizes pages whose *primary purpose* is affiliate traffic. The recipe page, which carries substantive creator-authored steps, is the safer design on every platform. The review page is not.

**(c) Other underdeveloped areas.**
- **Keeping creators engaged after their first link.** The watchdog's alerts ("your Notion link no longer pays new signups") give a reason to come back every week.
- **Pricing coherence.** Not researched this pass.
- **Instrumentation.** See the experiment below.

## Details: The Redesigned Landing Page ("The Handoff")

**Section-by-section spec (top to bottom, server-rendered, no client JS required):**

1. **Disclosure line** (unchanged, first): "Maya earns a commission if you sign up through this page."
2. **The moment header.** "From Maya's video *'I rebuilt my portfolio in Framer in 20 minutes'* · at 4:12," with a `&t=` link back. It renders only when the per-placement link has a creator-approved placement record. Otherwise it's blank.
3. **"What she did"**: the recipe card. Numbered, copyable steps, settings, prompts and template names, each with a copy button that also works as plain selectable text. It carries a stamp: "Approved by Maya on 2026-09-20." No approved recipe means no section.
4. **The one CTA, tiered by what the product can honestly do:**
   - Tier A (Framer, Railway): **"Open Maya's setup in Framer."** This is the remix link, preceded by the /go affiliate click.
   - Tier B (Lovable, Webflow, Notion, Canva and others): **"Start free, then paste step 1."** The affiliate sign-up link goes first; the recipe stays on screen for pasting.
   - Tier C: **"Start free on ElevenLabs"** with the recipe beside it.
5. **One-tap fit check**: three chips, e.g. "hobby / weekly / daily." It produces "Your first 10 minutes" (steps 1–3 of her recipe) and "Cost at your volume," computed only from the dated, checked pricing table. It's blank if the price check is older than your staleness threshold.
6. **"Who it's wrong for"** (kept; it's the trust anchor).
7. **Escape hatch plus continuation:**
   - If the page detects an in-app browser, show one line: "In Instagram? Tap ··· → Open in browser."
   - Offer **"Send to my laptop"**, a single transactional email the reader explicitly requests, with no marketing unless she ticks a separate box. The link goes back through /go so the referral click is set again on the desktop.
   - Also offer a copyable short link and QR code as the no-email alternative.
8. **Saved kit** (`/kit/<id>`). It holds the recipe plus price, and updates when Maya edits her setup or the checked price changes. Update emails go out only if the reader opted in, and each says what changed with a date.
9. **Ask about this** (grounded Q&A, secondary).
10. **Receipt footer**: the signed Referral Receipt and the date of the rule check.

**What makes it unlike any affiliate page:** it sells the creator's *work*, not the vendor's product. It is tied to one content moment. The CTA opens a working setup where the product allows it. It follows the reader across devices by re-clicking, not by tracking. It stays current after the click.

**Claims it can honestly make:** "This is the setup Maya used in [video], approved [date]." "Price checked [date] from [source]." "Opens Maya's project as your own copy," only where documented (Framer), and on Railway "Maya earns from usage of this template." **Claims it can't make:** that you'll get her results; any conversion statistic; "your referral is tracked" on Tier B remix links.

**Experiment:**
- **Arms:** A = current review page. B = Handoff page without the Tier A remix button. C = full Handoff page. C runs on Framer and Railway offers only; B vs A runs everywhere.
- **Randomization:** assign per click at /go with a hashed click ID. No reader cookies are needed; stickiness comes from the per-placement link.
- **Primary metric:** outbound CTA click-through. Secondary: send-to-laptop and save rate, desktop re-clicks within 7 days, and vendor-dashboard signups reconciled through Referral Receipts.
- **Sample size:** detecting a lift from 20% to 25% CTR (α 0.05, power 0.8) needs about 1,100 clicks per arm. Detecting 10% to 13% needs about 1,800 per arm. Signups are too sparse to power, so treat them as directional.
- **Kill criteria:** stop arm B or C if its CTR is lower than A with a two-sided p < 0.05 at the 50% interim point. Also stop it if any recipe renders without creator approval, or if a platform flags a page. Ship the winner at full sample only if the gain is at least 3 points absolute.

## Recommendations

**Decision 1: Landing-page direction**
- Option 1: Keep the review page and iterate.
- **Option 2 (RECOMMENDED): The Handoff page, tiered A/B/C, with /go re-click continuity.**
- Option 3: A chat-first AI landing page.
- *Decide for me:* Option 2, on Framer and Railway first.

**Decision 2: Remix-link attribution outside Framer**
- Option 1: Assume it works.
- **Option 2 (RECOMMENDED): Affiliate click first, then the setup. Test Lovable remix attribution end to end before claiming it.**
- Option 3: Ask each vendor in writing.
- *Decide for me:* Option 2, plus an email to Lovable's Impact program manager.

**Decision 3: Cross-device continuation**
- Option 1: QR code or copy-link only.
- **Option 2 (RECOMMENDED): A requested transactional email plus QR code, both routed through /go.**
- Option 3: An account or login for readers.
- *Decide for me:* Option 2.

**Decision 4: First agent to build**
- **Option 1 (RECOMMENDED): Creator ops watchdog.**
- Option 2: Sponsor desk.
- Option 3: Recipe drafter.
- *Decide for me:* Option 1 now, with Option 3 right behind it because the page needs it.

**Decision 5: Sponsor desk scope**
- **Option 1 (RECOMMENDED): Inbound-only, drafts with human approval, in the creator's own mailbox.**
- Option 2: Semi-automated outbound to warm brand lists.
- Option 3: Instantly-style outbound.
- *Decide for me:* Option 1. Never Option 3.

**Decision 6: Agent-to-agent commerce**
- **Option 1 (RECOMMENDED): A read-only MCP catalog of placements.**
- Option 2: Bookings by agents with human confirmation.
- Option 3: Autonomous buying.
- *Decide for me:* Option 1 now, Option 2 at 90 days if advertisers ask for it.

**Prioritized thin-spot fixes:**
1. Build the terms watchdog and re-verify the 8 in-depth offers plus Lovable, Cursor, Notion and v0.
2. Do a dedicated distribution pass on first-1,000-creator stories.
3. Test Lovable and Webflow attribution end to end.
4. Re-verify the current Twitch branded-content text and the CASL implied-consent specifics.
5. Do a pricing-coherence pass.

**30-day plan:**
- Placement records plus per-placement /go links.
- Handoff page sections 1–7 for Framer and Railway.
- In-app browser escape line.
- Send-to-laptop through /go.
- Watchdog v1 covering 12 programs, with daily diffs.
- Recruit 5–10 dev/AI creators who already publish Framer or Railway templates.
- Start the A/B test.

**90-day plan:**
- Recipe drafter with approval flow and the saved kit with updates.
- Tier B rollout after attribution tests.
- Read the experiment result and apply the kill criteria.
- Inbound sponsor desk with reply classification.
- Read-only MCP placements catalog.
- Say The Word DMs minting per-post links.

## Caveats
- The claims about Framer's 90-day window and cookie override come from a third party. Official docs confirm that remix links are tracked.\[6\]
- Several affiliate amounts conflict across sources (Descript, Replit, Canva, Cursor).\[2\]\[23\]\[24\]\[41\]\[42\]\[47\]\[98\]\[99\]
- All Instantly and AI-SDR evidence comes from competitors or trade press, and the 11x churn figure is an anonymous estimate.
- In-app-browser and AI-chat conversion figures are vendor claims.
- No independent evidence was found on mobile-to-desktop SaaS signup, Mutiny-style personalization, quizzes, saved-for-later recovery, vertical landing pages, or how peer tools won their first creators.
- CASL and Podcasting 2.0 details were not re-verified this pass.

## Sources

1. [Where is the “share your link and earn credits” (referral) feature on v0.app / Vercel? - v0 - Vercel Community](https://community.vercel.com/t/where-is-the-share-your-link-and-earn-credits-referral-feature-on-v0-app-vercel/42015)
2. [Referral program | Cursor Docs](https://cursor.com/help/account-and-billing/referral-program)
3. [Join Notion's Affiliate Program](https://www.notion.com/affiliates)
4. [Artisan vs AiSDR vs 11x: Best AI SDR Platform for Real Pipeline Growth (2026)](https://www.11x.ai/guides/artisan-vs-aisdr-vs-11x)
5. [Outlook High-Volume Sender Requirements: The 5,000/Day Rule](https://bouncecheck.email/blog/outlook-high-volume-sender-requirements)
6. [Framer Help: How affiliate links work](https://www.framer.com/help/articles/how-affiliate-links-work/)
7. [How affiliate links work — Framer Help](https://www.framer.com/help/articles/how-affiliate-links-work/?via=tamermagdy)
8. [How to Make Passive Income with Framer Affiliates & Partner Program \[2025\]](https://segmentui.com/learn/how-to-make-passive-income-with-framer-affiliates)
9. [Framer Affiliate Program: 50% of year 1 | Reditus](https://getreditus.com/affiliate-programs/framer)
10. [Framer Help: How the Creator Program works](https://www.framer.com/help/articles/how-the-creator-program-works/)
11. <https://docs.lovable.dev/features/projects/remix>
12. [FAQ - Lovable Documentation](https://lovable.dev/faq/referral/how-it-works/how-referral-works)
13. [Affiliate partners | Lovable](https://lovable.dev/affiliates)
14. [Lovable Affiliate Program: Rates and Terms (2026) | AffiliateJob](https://affiliatejob.org/programs/lovable)
15. [Lovable Affiliate Program - 20% Recurring For 12m - TapRefer](https://taprefer.com/lovable-affiliate-program/lovable/)
16. [Affiliate partners | Lovable](https://lovable.dev/partners/affiliates)
17. [Manage your projects - Bolt Help Center](https://support.bolt.new/building/using-bolt/projects-files)
18. [Refer a friend - Bolt](https://support.bolt.new/external-resources/referral-program)
19. [v0 Templates - v0 by Vercel](https://v0.app/templates)
20. [Vercel Integration and Next.js App Router Support](https://supabase.com/blog/using-supabase-with-vercel)
21. [Introducing the v0 Ambassador Program : Vercel Discussion Forums | Product Hunt](https://www.producthunt.com/p/vercel/introducing-the-v0-ambassador-program)
22. [Remix an app - Replit](https://docs.replit.com/getting-started/quickstarts/remix-an-app)
23. [Replit Pricing: How Much Does Replit Cost? (2026)](https://shipper.now/replit-pricing/)
24. [Replit Student Discount: 50% Off Core + \$20 Referral Credit](https://resourify.com/resources/replit)
25. [Big update for Webflow Template Creators: Earn more, sell anywhere | Webflow Blog](https://webflow.com/blog/template-creator-enhancements)
26. [Clone a site in Webflow – Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961311242515-Clone-a-site-in-Webflow)
27. [How to Clone a Webflow Website: Step-by-Step Guide (2026)](https://www.thecssagency.com/blog/how-to-clone-webflow-website)
28. [Webflow's affiliate program overview](https://help.webflow.com/hc/en-us/articles/33961372613011-Webflow-s-affiliate-program-overview)
29. [Duplicate public Notion pages | Notion Help – Notion Help Center](https://www.notion.com/help/duplicate-public-pages)
30. [Sell Notion Templates: Fees & Platforms](https://latuos.com/sell-notion-templates/)
31. [Share your design as a template link - Canva Help Center](https://www.canva.com/help/share-template-link/)
32. [Sharing designs via email or links - Canva Help Center](https://www.canva.com/help/share-via-link-or-email/)
33. [How to Share Canva Design as Template | Step-by-Step Guide](https://aiconnecto.com/blog/how-to-share-canva-design-as-template/)
34. [About the Canva Creators program - Canva Help Center](https://www.canva.com/help/canva-creators-program/)
35. [Canva Creators: Share your designs with the world](https://www.canva.com/creators/)
36. [360042296374 Figma Community copyright and licensing](https://help.figma.com/hc/en-us/articles/360042296374-Figma-Community-copyright-and-licensing)
37. [Project links - Descript Help Center](https://help.descript.com/collaboration/project-links)
38. [Project links – Descript Help](https://help.descript.com/hc/en-us/articles/10255725590669-Project-links)
39. [Share a custom layout pack – Descript Help](https://help.descript.com/hc/en-us/articles/10255947718413-Sharing-custom-template-layouts-with-drive-members)
40. [The Descript affiliate program - Descript Help Center](https://help.descript.com/hc/en-us/articles/10612726938509-The-Descript-Affiliate-Program)
41. [Descript Affiliate Program Review 2026: Payout & Terms](https://www.way2earning.com/2026/08/descript-affiliate-program/)
42. [Descript Affiliate Program · Affinew](https://affinew.com/affiliate/SKhGOJDwNMDg)
43. [ElevenLabs — Introducing Voice Actor Payouts Feature](https://elevenlabs.io/blog/introducing-voice-actor-payouts)
44. [Getting started with the beehiiv Partner Program](https://www.beehiiv.com/support/article/23352219299095-getting-started-with-the-beehiiv-partner-program)
45. [Kit Affiliate Program](https://kit.com/affiliate)
46. [Beautiful Email Templates for Creators](https://kit.com/marketplace)
47. [Cursor Referral Program - #19 by kevinn - Discussions - Cursor - Community Forum](https://forum.cursor.com/t/cursor-referral-program/40555/19)
48. [Apply to the Runway Affiliate Program](https://runway.com/affiliate-program)
49. [Creative Partners Program | Runway AI](https://runwayml.com/creative-partners-program)
50. [Template Kickbacks | Railway Docs](https://docs.railway.com/templates/kickbacks)
51. [Instagram In-App Browser: What It Is and How to Get Around It | U2L AI Blog](https://u2l.ai/blog/instagram-in-app-browser)
52. [Why Do My Links Open in an In-App Browser? (And How to Fix It) | U2L AI Blog](https://u2l.ai/blog/why-links-open-in-app-browser)
53. [How to Get Out of In-App Browsers (All Social Platforms)](https://blog.linko.me/get-out-of-in-app-browsers/)
54. [Framer Affiliate Program: How It Works and What You Can Earn | TMPL](https://tmpl.digital/blog/framer-affiliate-program)
55. [How Jan Losert became a top Webflow affiliate in 3 months | Webflow Blog](https://webflow.com/blog/top-webflow-affiliate-jan-losert)
56. [AI Chatbots for E-commerce: Conversion Rate Guide 2026 - Cloudtech](https://cloudtech.com/feeds/blog/ai-chatbot-ecommerce-sales-conversions-2025)
57. [AI Shoppers Now Convert 42% Better Than Google Traffic](https://www.digitalapplied.com/blog/ai-traffic-converts-42-percent-better-2026-channel-strategy)
58. [Case Study: 6 Learnings, 1 site - How Traffic from ChatGPT Converts](https://www.seerinteractive.com/insights/case-study-6-learnings-about-how-traffic-from-chatgpt-converts)
59. [Why AI Search Traffic Converts at 4–5x: What the Data Actually Shows | Pixis](https://pixis.ai/blog/why-ai-search-traffic-converts-at-4-5x-what-the-data-actually-shows/)
60. [Instagram In-App Browser: Why Links Break and the Fix | Flyn](https://www.flyn.to/blog/instagram-in-app-browser)
61. [Fix In-App Browser Conversion Loss for Meta, TikTok & Instagram Ads | LinkTwin](https://linktw.in/ppc-social-ads)
62. [Escape Instagram and TikTok in-app browsers · Issue #198 · HeyThisIsAndrew/BeUnconventionalHQ](https://github.com/HeyThisIsAndrew/BeUnconventionalHQ/issues/198)
63. [Mobile To Desktop Attribution: Complete Guide 2026](https://www.cometly.com/post/mobile-to-desktop-attribution)
64. [How To Track Cross Device Conversions: Complete Guide](https://www.cometly.com/post/how-to-track-cross-device-conversions)
65. [New on Yahoo](https://tech.yahoo.com/general/articles/just-thought-youtube-ads-couldnt-204437981.html)
66. [Instantly.ai Review 2026: I Tested It For 30 Days](https://www.salesforge.ai/blog/instantly-ai-review)
67. [Instantly.ai Review 2026: Features, Pricing, and Where It Falls Short](https://www.smarte.pro/blog/instantly-ai-review)
68. [Instantly.ai Review (2026): An Honest Look Before You Buy](https://gtmonly.com/instantly-ai-review/)
69. [Instantly AI Review: Features & Verdict | Emailchaser](https://www.emailchaser.com/learn/instantly-review)
70. [Instantly.ai Review 2026: Features, Pros, Cons and Pricing Explained](https://www.primeforge.ai/blog/instantly-ai-review)
71. [Instantly.ai Review 2026: Sending, Lead Database and What It Really Costs | Cleanlist](https://www.cleanlist.ai/blog/2026-09-22-instantly-review)
72. [Instantly.ai Review 2026: What It Actually Costs You](https://www.saleshandy.com/blog/instantly-ai-review/)
73. [Microsoft Enforces SPF, DKIM, DMARC for High-Volume Senders - dmarcian](https://dmarcian.com/microsoft-enforces-spf-dkim-dmarc/)
74. [Microsoft Outlook will require DMARC starting in May 2025](https://dmarcwise.io/blog/outlook-new-requirements-2025)
75. [11X vs Artisan: Which AI SDR Wins? September 2026 | Breakout - Breakout](https://getbreakout.ai/blog/11x-vs-artisan-ai-sdr-platform)
76. [Artisan vs 11x: Best AI SDR Platform Comparison for 2026](https://www.11x.ai/guides/artisan-vs-11x)
77. [AI SDR Tools Comparison 2026: 6-Month Field Report](https://www.upliftgtm.com/blog/ai-sdr-tools-comparison-2026)
78. [AI SDR Pricing in 2026: What 11x, Artisan, and Regie Actually Charge](https://formanorden.com/blog/ai-sdr-pricing/)
79. [Payouts | ElevenLabs Documentation](https://elevenlabs.io/docs/eleven-creative/voices/payouts)
80. [External links policy - YouTube Help](https://support.google.com/youtube/answer/9054257?hl=en)
81. [YouTube is Changing its External Linking Policy For Shorts—Here's What That Means for Creators](https://passionfru.it/youtube-shorts-linking-8042/)
82. [Ad disclosure rules every creator should know – AIR Media-Tech](https://air.io/en/youtube-hacks/what-every-creator-should-know-about-ad-disclosure-rules)
83. [Twitch Branded Content Policy | GETREKT](https://getrektlabs.com/blogs/news/find-out-more-about-twitch-branded-content-policy)
84. [Branded Content Guidelines](https://help.twitch.tv/s/article/branded-content-policy?language=en_US)
85. [Twitch's Content Guidelines Spark Controversy: All Changes Explained](https://www.talkesport.com/streaming/twitch-branded-content-guidelines-changes-explained/)
86. [Twitch Opens Sponsorships to Affiliates — and Wehype Is the New Partner](https://streamer.guide/blog/twitch-sponsorships-affiliates-wehype)
87. [Can I use affiliate links or advertising in my emails? – Substack, Inc](https://support.substack.com/hc/en-us/articles/360037455072-Can-I-use-affiliate-links-or-advertising-in-my-emails)
88. [Can my publication host sponsored ads? – Substack, Inc](https://support.substack.com/hc/en-us/articles/4407986455188-Can-my-publication-host-sponsored-ads)
89. [Content Guidelines](https://substack.com/content)
90. [​​​​Affiliate Marketing using a Medium Blog in 2022](https://partnerkin.com/en/blog/publications/medium_affiliate_marketing)
91. [Affiliate Marketing on Medium: Everything You Must Know](https://legiit.com/blog/affiliate-marketing-on-medium)
92. [Use other ad networks together with AdSense - Google AdSense Help](https://support.google.com/adsense/answer/9728?hl=en)
93. [AdSense policies: a beginner's guide - Google AdSense Help](https://support.google.com/adsense/answer/23921?hl=en)
94. [AdSense Program policies - Google AdSense Help](https://support.google.com/adsense/answer/48182?hl=en)
95. [AdSense program policies](https://exmarketplace.com/v2/en/adsense-policies-conditions)
96. [Terms](https://more.ko-fi.com/terms)
97. [Affiliates](https://more.ko-fi.com/research/affiliates-hidden)
98. [Canva Affiliate Program: \$150 CPS Per Pro Subscription](https://wecantrack.com/programs/canva-affiliate-program/)
99. [Canva Affiliate Program — \$36 one-time | OpenAffiliate](https://openaffiliate.dev/programs/canva)
