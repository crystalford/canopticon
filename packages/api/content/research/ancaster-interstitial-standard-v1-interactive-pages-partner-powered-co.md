---
id: ancaster-interstitial-standard-v1-interactive-pages-partner-powered-co
title: "Ancaster Interstitial Standard v1: Interactive Pages, Partner-Powered Components, and Feed-Native Offers"
kind: "Research"
topic: "Attention & feeds"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/researchreports2/compass_artifact_wf-5d549ae4-385e-54c2-9aaf-e6d0203adbd0_text_markdown.md"
---

# Ancaster Interstitial Standard v1: Interactive Pages, Partner-Powered Components, and Feed-Native Offers

Build Ancaster's upgraded page around a proof of value the buyer makes themselves: a short try-it moment using partner technology (for example, their own text read aloud by an ElevenLabs voice), placed between the creator's endorsement and one dominant disclosed affiliate CTA. Do not build it on publishers' raw API keys. ElevenLabs' ElevenAPI Terms, updated August 24, 2026, forbid sharing a credential outside your organization and bill every call to the key's owner "whether or not you authorized it."\[1\] Chris's premise that "they just need their API key, they don't need to pay their bill" is contractually backwards. Use official embeds and publisher-owned public agents, and use pre-rendered output from Ancaster's own account, rather than taking custody of anyone's keys or credits.

## TL;DR

- **The formula:** creator face/voice → one-line promise → a 10–30 second "first minute of use" the visitor controls → code shown and auto-applied → one disclosed CTA that fires the affiliate click → optional save/capture after the CTA. Every page must hit mobile Core Web Vitals (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1). Speed is the only page-level lever with large-sample evidence; Deloitte's Google-commissioned study found a 0.1s mobile speedup went with +8.4% retail conversions. No independent evidence yet shows that interactive bridge pages beat direct links for creator-referred traffic, so Ancaster has to generate that evidence itself.
- **BYOK verdict:** don't store publishers' ElevenLabs keys (v1 recommendation). Use three layers: (1) pre-rendered and cached demo audio from Ancaster's own account; (2) publisher-owned embeds that expose only public IDs and domain allowlists, namely the Agents widget (up to 10 allowlisted hostnames) and Audio Native (Creator plan and up); (3) server-side, rate-limited live generation on Ancaster's own scoped, credit-capped key. Reselling API usage requires ElevenLabs' OEM terms, which bar Free/Starter/Creator/Pro accounts from "Making Available" the services at all.\[2\] Reselling would also break Ancaster's no-custody model.
- **Feed-native and tiers:** Ancaster should become the permission and attribution ledger that ties together a creator's organic post, its paid boost (TikTok Spark code, Meta partnership ad code, YouTube video link, LinkedIn sponsorship approval), and the offer page, link and code. It should generate creator-approved assets (TTS clips, captioned demo clips, carousels), never synthetic testimonials. v1 focus: Tier 2 "regular creators" who hold affiliate links but have no funnel.

## Key Findings

1. **Benchmarks and the ceiling.**
   - Unbounce's 2024 Conversion Benchmark Report (57M+ conversions, 41,000+ landing pages, 464M visitors, July 2023–July 2024) puts the all-industry median at 6.6%, with SaaS lowest at 3.8% and Events & Entertainment highest at 12.3%.\[3\]\[4\]
   - The same report finds that pages written at a 5th–7th-grade reading level convert at an 11.1% median.\[5\]
   - Warm traffic is the ceiling lever. Unbounce's own 2024 release reports email traffic converting at a 28.6% median in e-commerce, the highest of any channel, and desktop converting 8% higher on average even though mobile drives nearly 5x more traffic.
   - For Ancaster, the "ceiling" is set mostly by traffic warmth and message match, not by page widgets.
2. **Speed is the best-evidenced lever.** Deloitte's "Milliseconds Make Millions" (commissioned by Google and conducted by 55 and Deloitte; 37 European and American brand sites, over 30 million user sessions across a 4-week period, 2020) linked a 0.1s mobile improvement to +8.4% retail conversions, +9.2% retail order value and +10.1% travel conversions. It is correlational and vendor-commissioned, but large.
3. **Interactive-demo evidence is almost entirely vendor-sourced.**
   - Navattic's 2026 report (40,000+ demos) finds:
     - engagement of 53–56% across its top tiers;
     - CTR ranging from 29% to 71%;
     - multi-flow demos completed 48% more often;
     - 66% of top demos ungated.\[6\]
   - Navattic's 2025 users self-reported a 20–25% website conversion lift.\[7\]
   - None of this is independent, and none of it is for creator-referred consumer or prosumer traffic.
4. **ElevenLabs has the controls a partner-powered demo needs, and terms that rule out naive BYOK.**
   - **Controls:**
     - keys can be restricted by endpoint scope;\[8\]
     - keys can carry a monthly credit or character cap;\[9\]\[10\]
     - user keys can expire (15 minutes to 30 days);\[11\]
     - IP allowlisting exists, but only for Enterprise and in preview;\[12\]
     - server-minted single-use tokens can be handed to browsers.\[10\]
   - **Terms:** the ElevenAPI Terms (Aug 24, 2026) prohibit sharing credentials outside your organization and prohibit client-side exposure. They also make all activity on a credential the owner's responsibility.\[1\]
5. **Feed-native amplification is solved plumbing on four of the five platforms.**
   - Four platforms have documented authorization flows:
     - TikTok Spark authorization codes;\[13\]\[14\]
     - Meta partnership ad codes and account-level permissions, plus a Facebook Partnership Ads API (Dec 11, 2025);\[15\]\[16\]\[17\]
     - YouTube partnership ads, with creator-initiated linking and a video-linking API;\[18\]\[19\]
     - LinkedIn Thought Leader Ads with author approval.\[20\]
   - Links and codes survive differently on each (see §4). X's creator-amplification options were not verified in this pass.
6. **Generated "UGC" is legal only when it is honest.** Three rules apply:
   - The FTC's Consumer Reviews and Testimonials Rule (16 CFR 465, effective Oct 21, 2024) bans testimonials that misrepresent that the speaker exists or used the product, AI-generated ones included.\[21\]
   - New York's synthetic performer law (GBL §396-b, effective June 9, 2026) requires conspicuous disclosure, with penalties of $1,000 for a first violation and $5,000 for each later one.\[22\]
   - EU AI Act Article 50 transparency duties apply from Aug 2, 2026.\[23\]

## Details

### 1. Interactive Element Catalog and Evidence

**Evidence legend:** V = vendor-sourced, I = independent, N = no evidence found. "Referred/mobile" means evidence specific to warm creator traffic on phones. **None of the elements below has evidence specific to creator-referred traffic.**

| Element | Conversion evidence | Build complexity (Cloudflare) | Runtime cost | Accessibility notes |
|---|---|---|---|---|
| Generated personalized output (hear your text, see your mockup, get your snippet) | N for pages; logic is "IKEA effect"/endowment, not tested here | Medium: Worker + partner API + R2 cache | Per-generation API cost; cap it | Needs transcript/text alternative; keyboard-operable input |
| Pre-rendered audio player (voice samples) | N | Low: R2 + `<audio>` | Near zero | Captions/transcript; no autoplay with sound |
| Interactive walkthrough (Arcade, Navattic, Storylane) | V (Navattic: 5–13 steps, multi-flow +48% completion, ungated better)\[24\]\[25\] | Low: embed | Vendor subscription | Iframes often weak on screen readers; provide text path |
| Live product demo / sandbox (partner embed, e.g., ElevenLabs Agents widget) | N | Low–medium: embed + allowlist | Billed to embed owner per conversation | Mic permission prompts; offer text mode |
| Prefill / activation deep link (Lovable, ChatGPT) | N | Low: URL construction | Zero | Plain link; accessible by default |
| Calculator / ROI tool | N independent | Low: static JS | Zero | Label inputs; announce results via ARIA live region |
| Quiz / fit-check | N independent; vendor claims common | Low | Zero | Keep ≤3 questions; don't gate the CTA |
| Configurator | N | Medium | Zero | Complex; defer |
| Before/after slider | N | Low | Zero | Sliders need keyboard support and a static alternative |
| Comparison table | N for affiliate pages | Low | Zero | Use real `<table>` markup; mobile collapse |
| Short video (Cloudflare Stream) | N independent for this context | Low | Stream minutes | Captions required; poster frame; no autoplay audio |
| AI chat about the offer | N | Medium; hallucination risk to Endorsement Ledger | LLM tokens | Chat widgets are frequent accessibility failures |
| Playable demo | N | High | Varies | Defer |
| Social proof widget | N independent in this pass | Low | Zero | Must be real under 16 CFR 465 |

**What the benchmarks say.**
- Median landing pages convert at 6.6%; SaaS converts at 3.8%.\[26\]
- Plain language (5th–7th-grade reading level) went with an 11.1% median.\[5\]
- Speed has the largest-sample support (Deloitte 2020).\[27\]
- A Rakuten 24 Core Web Vitals A/B test, documented in a web.dev case study, found 53.37% more revenue per visitor and a 33.13% higher conversion rate for the faster variant.
- Google's "good" thresholds are LCP ≤2.5s, INP ≤200ms and CLS ≤0.1, measured on 75% of real visits.\[28\]
- The HTTP Archive Web Almanac 2025 reports that only 48% of sites pass on mobile (up from 36% in 2023), versus 56% on desktop.

**Interpretation.** Every interactive element costs page weight and main-thread time. It must earn back more than the speed it costs, which is why the standard loads interactivity only after the visitor acts (see §3). Baymard and NN/g guidance was not re-verified in this pass; treat any specific claim from them in earlier passes as needing citation.

### 2. Partner-Powered Components and BYOK

**ElevenLabs: what the terms actually say.**
- **Credentials.** The ElevenAPI Terms (last updated August 24, 2026) say:
  - "You will not share a credential outside your organization, and will issue separate credentials for separate applications, environments, and users."\[1\]
  - "You will not embed, transmit, or otherwise make any API key… available in any browser, mobile application, or other client… and you will call the API using an API key only from a server or other environment you control."\[1\]
- **Liability.** Each call "is treated as your action and is your responsibility… whether or not you authorized it."\[1\] That is the liability answer: a leaked or abused key bills and burdens the key owner.
- **Conflict.** ElevenLabs' older help-center article "How can I use ElevenLabs with third-party services?" tells users to paste their API key into third-party integrations.\[29\] That contradicts the August 2026 terms. The newer contract controls, so assume BYOK by publishers is at best grey and at worst a breach on their side.
- **Public demos on third-party platforms.** A Customer Application (Ancaster's own app on Ancaster's own key) may serve end users, provided Ancaster authenticates and authorizes them and does not expose keys.\[1\] Bundling and sublicensing ElevenLabs to customers falls under the OEM Terms (Feb 28, 2025), which require a Scale, Business or Enterprise "Business Entity" and state: "if you are a Customer accessing the Services under a Free, Starter, Creator, or Pro tier plan, you are expressly prohibited from Making Available the Services."\[2\] The Music API terms separately prohibit resale.\[30\]
- **Key controls:**
  - scope restriction by endpoint;\[8\]
  - a custom credit quota or monthly `character_limit` ("Requests that incur charges will fail after reaching this monthly limit");\[9\]
  - expiry for user keys;\[11\]
  - IP/CIDR allowlisting (Enterprise preview);\[12\]
  - service-account keys;\[11\]
  - single-use tokens for client-side use.\[10\]
  - Concurrency is capped by plan: 2 on Free up to 15 on Scale/Business, per a third-party summary.\[10\]
- **Official embeds:**
  - **Audio Native:** an embeddable player that narrates a page or embeds a Studio project, with a URL allowlist and listener analytics. It is available on the Creator plan and up.\[31\]\[32\]
  - **Agents widget:** `<elevenlabs-convai agent-id=…>`. Widgets "currently require public agents with authentication disabled",\[33\] and hostname allowlists take up to 10 hostnames. Signed URLs are available for authenticated SDK flows.\[34\]\[35\] An unprotected public agent is an open billing meter on its owner's account.\[36\]
- **Commercial use and attribution.** Secondary pricing guides say commercial use begins on the paid Starter plan and attribution is not required on paid plans.\[37\] Free-tier attribution wording was not re-verified from primary terms in this pass.
- **Affiliate demos and partner programs.** The June 10, 2026 affiliate terms (from prior passes) ban look-and-feel mimicry and the use of marks in headers and domains. No clause found in this pass explicitly permits or forbids affiliates building API demos; get written confirmation from the ElevenLabs affiliate team. ElevenLabs does have an authorized-reseller path (referenced in its Terms of Service) and OEM terms, both contract-gated.\[2\]\[38\]

**"They don't pay their bill" — verdict.** Aggregating usage and billing publishers means Ancaster buys credits, marks them up and collects money: reseller or OEM status plus money custody. That contradicts Ancaster's no-custody model and is barred for anyone below Scale. **Safer variant: "Bring Your Own Embed" (BYOE).**
- The publisher creates an Agent or Audio Native player in their own ElevenLabs account.
- They allowlist their Ancaster page domain.
- They paste only the public agent ID into Ancaster.
- Ancaster stores no secret, and the publisher's own caps govern spend.
- Ancaster separately pays for tiny, cached live demos on its own key as a cost of sale.

**BYOK patterns elsewhere.** Cursor, TypingMind, Raycast and Zapier were not re-verified in this pass. The general pattern is that users paste LLM keys into a client or server-side vault. **Cloudflare architecture, if Ancaster ever holds a secret:**
- Store it in Secrets Store (a two-level AES key hierarchy), or in AI Gateway BYOK for supported AI providers, referenced by alias rather than by value.\[39\]\[40\]
- Call providers only from a Worker.
- Hand browsers only single-use tokens or signed URLs.
- Enforce per-visitor rate limits: a Durable Object counter keyed by IP hash plus a Turnstile check.
- Set per-page daily budgets in D1, and cache every output in R2 keyed by hash of (voice, text).
- Cap input length (for example, 200 characters).
- Apply a denylist for impersonation and abuse prompts.
- Log for revocation.

**Generalization: which offers support demos and activation deep links.**
- **Verified this pass:**
  - **Lovable "Build with URL"** prefills a prompt (up to 50,000 characters, with optional images) with no API key. It never auto-submits. Signed-out users sign up first and then see the prompt prefilled, so it is a true activation deep link. Lovable's API can also mint one-hour embed URLs for a project preview on a specified HTTPS origin, but API keys require Business or Enterprise.\[41\]\[42\]
  - **ChatGPT** `?q=` prefill works.\[43\]
  - **Claude:** evidence conflicts. A GitHub issue reports that `claude.ai/new?q=` was removed around October 2025, while Anthropic's help center documents `claude://claude.ai/new?q=` prefill for Claude Desktop.\[44\]\[45\] Test before using.
- **Not verified this pass, needing a follow-up matrix:** Canva Connect, v0, Bolt, Replit, Cursor, Descript, Riverside, HeyGen, Synthesia, Runway, Suno, Notion, Framer, Webflow.

**Attribution through deep links.**
- **PartnerStack** supports wildcard deep-link destinations and dynamic templates (for example `?query={search_term}`), but only if the vendor enables them. The cookie is placed on the destination page, and "No JS snippet on the destination URL = no customer capture." Cross-device sign-ups are not tracked.\[46\]\[47\]\[48\]
- **Implication:** an activation deep link into a vendor's app (such as a Lovable prefill URL) keeps credit only if the vendor has approved that destination and tracks on it. Otherwise the affiliate click must hit the standard link first, and the prefill becomes a second step after sign-up.
- Impact and Dub deep-link behaviour was not verified this pass.

### 3. The Formula: Ancaster Interstitial Standard v1

**Order of elements (mobile-first, a single column):**
1. **Creator strip (above the fold):**
   - face or avatar, name, and one line in the creator's own words, drawn from the Endorsement Ledger;
   - the disclosure right beside it: "I earn a commission if you buy through this link."
2. **Promise line:** one outcome, written at a 5th–7th-grade reading level.
3. **First minute of use:** one interactive proof that is pre-rendered by default and becomes live on tap. Examples: "type a sentence, hear it"; a prefilled build link; a 20-second captioned clip.
4. **Code block:** a large, copyable code with its expiry, plus a "code will be applied" note where the program supports it.
5. **Primary CTA:** the tracked affiliate link, with the disclosure repeated next to the button. It is the only element that leaves the page.
6. **Trust row:** the Ledger claim basis ("why I recommend it"), pricing facts, and the Referral Receipt badge. No invented testimonials.
7. **Secondary:** "Keep this" (save-for-later) and optional value-exchange email capture, placed below the CTA and never gating it.

**Budgets:**
- LCP ≤2.5s and INP ≤200ms on a mid-range phone.
- ≤100KB of JavaScript before interaction; demo scripts load only on tap.
- No autoplay audio.
- WCAG 2.2 AA.
- Captions and transcripts for all media.

**Research-supported vs folklore:**
- Supported: speed, plain language, message match and warm traffic.
- Vendor-only: ungated and multi-flow demos.
- Folklore until tested on Ancaster traffic: countdown timers, "only 3 left", and quiz gating.

**Component spec (each component declares):** `id`, `offer_id`, `ledger_claim_ids[]`, `disclosure_required`, `partner_dependency` (none/embed/api), `cost_class`, `js_kb`, `a11y_checklist`, `fallback_static`, `events[]` (view, interact, cta_click, code_copy).

**Scoring rubric (100 points; below 70 fails):**
- Speed (LCP/INP/CLS pass): 20
- Disclosure adjacent to every affiliate link: 15. This is a hard gate; zero fails the page.
- Creator identity plus a Ledger-backed claim above the fold: 15
- Interactive proof works with a static fallback: 15
- Code visible and copyable, with an auto-apply state: 10
- A single dominant CTA that fires the tracked link: 10
- Accessibility (automated audit plus a keyboard pass): 10
- Brand-safety compliance (no vendor look-and-feel mimicry, no marks in headers or domains): 5

### 4. Feed-Native Content-as-Advertising

| Platform | Authorization | Links/codes | Performance evidence |
|---|---|---|---|
| TikTok Spark Ads | Creator generates a per-video code in Ad settings with a chosen period; brand enters it in Ads Manager, batches of up to 20 codes; Duets/Stitches need both creators' codes\[13\]\[49\] | Advertiser sets CTA/landing URL; caption can't be edited after authorization, so put the spoken code in the video\[50\] | Vendor claims only (e.g., "+25% CTR, +24% CVR", Launchpoint)\[51\] |
| Meta partnership ads | Creator shares a "partnership ad code" per post, or grants account-level permission; "Paid partnership" label; Marketing API supports creation; Partnership Ads API and Hub expansion Dec 11, 2025\[15\]\[16\]\[17\]\[52\]\[53\] | Advertiser controls destination URL | Meta's official figure: "19% lower CPAs and 13% higher click through rates on average" (Marketing Dive, Dec 11, 2025); an older "53% higher CTR" claim (Adnabu) is unverified |
| YouTube partnership ads (BrandConnect, now "YouTube Creator Partnerships") | Creator links video in YouTube Studio or advertiser requests; video-linking API\[18\]\[19\]\[54\] | Advertiser URL in Google Ads; some click targets go to creator's channel; advertiser must secure rights separately\[55\] | Google internal: "up to 20% higher conversions" on Shorts vs brand-only ads\[19\] |
| LinkedIn Thought Leader Ads | Author approves request; employees and 1st/2nd-degree connections, 3rd+ via Partnerships/Creator Marketplace\[56\]\[57\] | **No advertiser URLs or CTA buttons**; only the link already in the post; no third-party tracking tags\[57\]\[58\] | None found |
| X | Not verified this pass | — | — |

**Compensation norms (all vendor or agency conventions; no 2024–2026 survey exists):**
- Lumanu's 2022 survey of 400+ influencers found that 51% charge to allow whitelisting.\[59\]
- Common rules of thumb:
  - 25–30% of the base rate per 30 days for whitelisting (Modash, citing a coach);\[60\]
  - 20–50% add-ons;\[61\]\[62\]
  - $150–$500/month for micro creators (Launchpoint, June 2026).\[51\]
- Billo pays creators $200 for 30 days of Meta ad permission.\[63\]
- Insense's Brand plan is $500/month, with 5–10% facilitation and service fees.\[64\]
- CreatorIQ's 2026 research found that 54% of paid-media managers cite difficulty securing usage rights as a scaling barrier.\[65\]
- Lumanu advertises automated whitelisting.\[66\] Aspire and CreatorIQ pricing is quote-based and unverified.

**Can Ancaster unify post + boost + page?**
- **Yes, as a ledger, not an ad buyer.**
- **What the ledger stores:**
  - the Spark or partnership code and its expiry;
  - the creator's permission scope and fee terms;
  - the advertiser's ad account;
  - the landing URL, set to the Ancaster offer page with a UTM or surface ID;
  - the spoken code.
- **Why it works:** the paid click lands on the same page, with the same code and receipt, so reconciliation is code-first, as it already is.
- **What a small developer can build on:** the Meta Marketing API partnership-ads endpoints, TikTok's API for Business, and the Google Ads video-linking API. All need app review and advertiser-granted OAuth.
- **v1 scope:** store and track expiry of codes that creators paste in, and generate the landing URLs. Don't place ads.

### 5. Generated Assets and UGC

- **What Ancaster should generate from one offer record:**
  - a 15–30s TTS audio snippet in a licensed voice, using the creator's approved script;
  - a vertical captioned demo capture of the try-it moment;
  - a carousel and a quote card from Ledger claims;
  - a caption plus a spoken-code script;
  - an email block.
- **Tooling:**
  - Remotion, Shotstack or Creatomate for templated video;
  - Cloudflare Stream and Media Transformations for hosting and resizing;
  - ElevenLabs for voice.
  - These were not re-verified this pass; confirm licensing and pricing before build.
- **AI "UGC" tools (Arcads, Creatify, MakeUGC):**
  - **What they do:** turn scripts into talking-head ads delivered by synthetic actors.\[67\]
  - **Legal risk:** a synthetic actor presented as a customer violates 16 CFR 465.2 and the Endorsement Guides (§255.2(c) requires disclosure when the people shown aren't actual consumers). Civil penalties run up to $53,088 per violation (the post–January 2025 inflation figure).\[21\]
  - **New York:** GBL §396-b requires conspicuous disclosure of synthetic performers where there is "actual knowledge". It excludes digital replicas of identifiable people and has no private right of action.\[22\]\[68\]\[69\]
  - **Platform rules:** TikTok's ad policy (April 2026) allows AI content only with the AIGC label or a clear disclaimer, and undisclosed ads are rejected. Meta applies "AI info" labels.\[70\]\[71\]
- **Real UGC marketplaces:** Billo, Insense and Minisocial source paid creators. Collabstr's 2026 data shows UGC campaigns rising from 15% to 35% of engagements, with an average UGC payout of $154.\[72\]
- **The line:**
  - An asset is legitimate when a real creator (a) used the product, (b) approved the specific claim in the Ledger, (c) is the voice or face, or clearly labels any synthetic voice, and (d) carries the affiliate disclosure.
  - It becomes a fake testimonial when it implies a person or experience that doesn't exist.
  - **Rule:** Ancaster never generates a human likeness the creator didn't license, and every synthetic voice or face is labeled.

### 6. Publisher Sophistication Tiers

The survey evidence (mostly vendor surveys) points one way:
- **Earnings are low for most:**
  - 67% of creators earned under $10k (CreatorIQ State of Creators 2026, n=5,095);\[73\]
  - more than half earn under $15k (Influencer Marketing Hub/NeoReach 2025).\[74\]
- **Most aren't full-time:**
  - for 62%, creation isn't their main income (CreatorIQ);\[73\]
  - 84% of top earners do it as their primary job, versus 35% of all respondents (Creator Spotlight 2025, n=427).\[75\]
- **Owning an audience pays:** creators with email lists are 2.7x more likely to earn $31k+ (Creator Spotlight).\[75\]
- **Paid campaigns concentrate at the top:** the top 10% took 62% of payments in 2025 (CreatorIQ).\[76\]
- **Time and consistency are the pain:** 59% cite producing content consistently (Linktree 2024).\[77\]

| Tier | Who | Ancaster does | Generates | Would pay for (speculative) |
|---|---|---|---|---|
| 1. Link-only | Holds an affiliate link, no brand | Done-for-you page from kit, code, disclosure | Page + sayable link | Free / rev-share-free tier |
| 2. Regular creator (**v1 focus**) | Posts weekly, no funnel | Done-for-you page with first-minute demo, generated clip/audio/caption kit | All shapes, creator-approved | ~$10–29/mo |
| 3. Brand with list | Has Kit/beehiiv list | Tools: capture → list push, nurture via tracked link, email blocks | Email sequences | ~$49–99/mo |
| 4. Creator-business | Runs funnels, paid boosts | Permission/boost ledger, receipts, API | Ad-landing variants, code tracking | Usage-based / ~$199+/mo |

### 7. Surface Shapes, Revisited

Ten canonical shapes:
1. sayable link plus code
2. offer page
3. embeddable card
4. audio snippet
5. vertical clip
6. carousel/quote card
7. feed-ad landing variant, tied to a Spark or partnership code
8. email block
9. agent/MCP offer endpoint (structured facts and a link)
10. Referral Receipt

All ten read from one `offer` record (terms, code, link, permissions block). Every claim references `ledger_claim_ids`, and every render carries a `surface_id` that is logged into one attribution stream, reconciled code-first. Shapes are renderers, not copies: change the Ledger and every surface updates or is flagged stale.

### 8. Synthesis

**The formula in one paragraph.** The page is the product's first minute, borrowed. The creator vouches (face, voice, disclosed commission), the visitor does one small thing with the product's own technology and gets their own result, the code is already waiting, and one honest button carries them through the affiliate link. Everything else is below the fold, loads on demand, and never slows the page past Core Web Vitals.

**What's new.** Existing bridge pages are brochures. Ancaster's are:
- **Participatory:** output the visitor makes themselves, powered by the partner.
- **Ledger-bound:** every claim has a basis and a disclosure.
- **Surface-portable:** one offer renders to feeds, email and agents.
- **Receipt-backed:** proof of who made the sale.

**McLuhan tetrad: "the page as the first minute of use."**
- *Enhances:* hands-on proof; the buyer's own input becomes the pitch.
- *Obsolesces:* the brochure bridge page, the testimonial wall, "learn more."
- *Retrieves:* the in-store demonstrator and the fairground pitchman handing you the product; the radio demo reel.
- *Reverses into:*
  - when pushed too far, the demo becomes a free substitute for the product (a cost sink, and no click);
  - it becomes a mimic of the vendor's own site, which the affiliate terms prohibit;
  - it becomes friction standing between intent and the click.

**Decisions:**

1. *Partner-powered demos:*
   - (A) BYOK publisher keys: rejected, because of the credential-sharing ban and liability.
   - **(B) Recommended: pre-rendered samples + publisher-owned embeds (BYOE) + capped live generation on Ancaster's key.**
   - (C) Official embeds only.
   - *Decide for me:* B, starting with pre-rendered audio only.
2. *Generated assets scope:*
   - (A) Page only.
   - **(B) Recommended: audio snippet + captioned vertical clip + caption/script from the Ledger.**
   - (C) Full AI-actor UGC: rejected.
   - *Decide for me:* B, audio first.
3. *Feed-ad authorization:*
   - (A) None.
   - **(B) Recommended: a permission ledger (paste code, expiry, landing URL, fee terms).**
   - (C) Full API ad management.
   - *Decide for me:* B.
4. *Tier focus:*
   - (A) Tier 1.
   - **(B) Recommended: Tier 2.**
   - (C) Tier 4.
   - *Decide for me:* B, with Tier 1 as a free on-ramp.

**30-day build plan (starting from the existing ElevenLabs page):**
- **Week 1:**
  - Instrument the existing page (view, interact, code_copy, cta_click) and measure a baseline CTR to the affiliate link.
  - Enforce the speed budget.
  - Email the ElevenLabs affiliate team for written confirmation that an API-powered demo on an affiliate page is allowed.
- **Week 2:**
  - Rebuild to Standard v1: creator strip, adjacent disclosure, 6 pre-rendered voice samples in R2.
  - Add a "type 150 characters, hear it" feature on a scoped, credit-capped Ancaster key, with Turnstile, per-IP Durable Object limits, a daily budget and hash caching.
- **Week 3:**
  - Build the rubric grader as a Worker that runs Lighthouse/axe plus schema checks.
  - Add the generated asset kit (TTS clip, captioned vertical clip, caption script).
  - Add the permission-ledger fields for Spark and partnership codes.
- **Week 4:**
  - A/B test static vs interactive with 3–5 Tier-2 creators.
  - Detecting a 33%→39% CTR lift needs roughly 1,000 visitors per arm.
  - Add Lovable and ChatGPT prefill "activation" variants only where the program's tracking supports the destination.

**Kill criteria:**
- The interactive variant fails to beat static on affiliate CTR at about 1,000 visitors per arm.
- Live generation costs more than about $0.02 per visitor or draws abuse despite the limits.
- ElevenLabs refuses or conditions API demos on affiliate pages.
- Fewer than 3 of 5 creators post a generated asset within 2 weeks.
- In any of these cases, fall back to pre-rendered demos only.

## Caveats

- Nearly all of the conversion evidence (Unbounce, Navattic, Deloitte/Google, Meta, YouTube, CreatorIQ, Kit) is vendor-produced or vendor-commissioned. No study covers interactive pages for creator-referred traffic.
- These were not verified in this pass:
  - X amplification;
  - Impact and Dub deep links;
  - Baymard and NN/g specifics;
  - demo and deep-link capabilities for most listed SaaS tools;
  - Cursor, TypingMind, Raycast and Zapier BYOK patterns;
  - ElevenLabs free-tier attribution wording.
- The claim that Meta made partnership ads mandatory for all creator content in 2026 comes from secondary compliance blogs; treat it as unconfirmed.\[78\]
- Tier pricing is speculative.

## Sources

1. [ElevenAPI Terms](https://elevenlabs.io/elevenapi-terms)
2. [OEM Terms](https://elevenlabs.io/oem-terms)
3. [Does Your Landing Page Conversion Rate Measure Up? - Marketing Charts](https://www.marketingcharts.com/industries/education-234088)
4. [Conversion Rate Benchmarks by Industry (2026 Data) | CO Consulting](https://christopholivierconsulting.com/conversion-rate-benchmarks/)
5. [Unbounce 2024 Conversion Benchmark Report Highlights Critical Industry Performance Data and Strategic Growth Opportunities](https://marketersindex.com/unbounce-2024-conversion-benchmark-report-highlights-critical-industry-performance-data-and-strategic-growth-opportunities/)
6. [Interactive Product Demos in 2026: What Actually Converts](https://userpilot-com.translate.goog/blog/interactive-product-demo/?_x_tr_sl=en&_x_tr_tl=hi&_x_tr_hl=hi&_x_tr_pto=tc)
7. [State of the Interactive Product Demo 2025](https://www.navattic.com/report/state-of-the-interactive-product-demo-2025)
8. [API Authentication | ElevenLabs Documentation](https://elevenlabs.io/docs/api-reference/authentication)
9. [Update API key | ElevenLabs Documentation](https://elevenlabs.io/docs/api-reference/service-accounts/api-keys/update)
10. [ElevenLabs API for AI Agents: Methods, Permissions & Safe Access | Bollard AI](https://bollardai.com/resources/elevenlabs)
11. [API Keys | ElevenLabs Documentation](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys)
12. [API authentication and key management: A practical guide](https://elevenlabs.io/blog/api-authentication-and-key-management)
13. [How to create Spark Ads for Smart+ Campaigns in TikTok Ads Manager](https://ads.tiktok.com/resources/help/article/how-to-create-spark-ads-for-smart-campaigns-on-tiktok-ads-manager)
14. [How to Get a Spark Ads Code on TikTok (Brands & Creators)](https://brands.joinstatus.com/tiktok-spark-code)
15. [Meta Partnership Ads: Setup Guide, Benefits & Examples 2026](https://blog.adnabu.com/facebook-ads/meta-partnership-ads/)
16. [Meta Expands Creator Partnership Opportunities for Brands | Social Media Today](https://www.socialmediatoday.com/news/meta-expands-creator-partnership-opportunities-for-brands/807691/)
17. [Influencer Whitelisting & Usage Rights: What Brands Are Actually Paying for](https://www.vivianagency.com/influencer-whitelisting-usage-rights-what-brands-are-actually-paying-for)
18. [About YouTube Creator Partnerships - Google Ads Help](https://support.google.com/google-ads/answer/15471603?hl=en)
19. [Increasing the power of engagement and creators on YouTube](https://blog.google/products/ads-commerce/youtube-brand-engagement-shorts-creators/)
20. [Create thought leader ads in Campaign Manager | Marketing Solutions Help](https://www.linkedin.com/help/lms/answer/a5965137)
21. [Are AI UGC Testimonial Ads Legal? FTC Rules for 2026 | Daily Intel Service](https://dailyintelservice.com/future/are-ai-ugc-testimonial-ads-legal-ftc-rules-for-2026)
22. [New York Enacts 'Synthetic Performer' Disclosure Law for ...](https://www.cooley.com/news/insight/2026/2026-01-29-new-york-enacts-synthetic-performer-disclosure-law-for-advertisements-including-those-using-generative-ai)
23. [NY Synthetic Disclosure Law S.8420A: What Agencies Must Do](https://www.intercepta.ai/blog/new-yorks-ai-disclosure-law-took-effect-on-9-june-does-your-agency-have-the-audit-trail-to-prove-compliance/)
24. [Best Practices for Building Interactive Demos in 2026](https://www.navattic.com/blog/best-practices-building-interactive-demos)
25. [Interactive Demo Platforms and Best Practices for 2026](https://www.navattic.com/blog/interactive-demos)
26. [Landing Page Conversion Rate Benchmarks: 6.6% Median](https://foundrycro.com/blog/landing-page-conversion-rate-benchmarks-2026/)
27. [milliseconds make millions](https://deloitte.com/ie/en/services/consulting/research/milliseconds-make-millions.html)
28. [The Business Case for Website Speed: What the Data Shows | Machina](https://wearemachina.com/insights/business-case-for-website-speed)
29. [How can I use ElevenLabs with third-party services? | ElevenLabs Documentation](https://elevenlabs.io/docs/help-center/account/general/how-can-i-use-eleven-labs-with-third-party-services)
30. [Music API Terms](https://elevenlabs.io/music-api-terms)
31. [What is Audio Native? – ElevenLabs](https://help.elevenlabs.io/hc/en-us/articles/26970150960401-What-is-Audio-Native)
32. [ElevenLabs Audio Native Embed Audio on Any Website](https://aiproductivity.ai/guides/elevenlabs-audio-native-guide/)
33. [Widget customization | ElevenLabs Documentation](https://elevenlabs.io/docs/eleven-agents/customization/widget)
34. [skills/agents/references/widget-embedding.md at main · elevenlabs/skills](https://github.com/elevenlabs/skills/blob/main/agents/references/widget-embedding.md)
35. [Agent authentication | ElevenLabs Documentation](https://elevenlabs.io/docs/eleven-agents/customization/authentication)
36. [ElevenLabs Voice Widget Security: 5 Settings to Lock Down Before You Go Public | MindStudio](https://www.mindstudio.ai/blog/elevenlabs-voice-widget-security-settings-before-going-public)
37. [ElevenLabs Pricing: All Plans & Costs Explained (2026)](https://www.gradually.ai/en/elevenlabs-pricing/)
38. [ElevenLabs Terms of Service (non-EEA)](https://elevenlabs.io/terms-of-use)
39. [bring your own keys](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/)
40. [Subscribe to receive notifications of new posts:](https://blog.cloudflare.com/ai-gateway-aug-2025-refresh)
41. [Build with URL - Lovable Documentation](https://docs.lovable.dev/integrations/build-with-url)
42. [Lovable API - Lovable Documentation](https://docs.lovable.dev/integrations/lovable-api)
43. [DEV Community](https://dev.to/kinde/adding-some-ai-hints-to-our-documentation-1nhf)
44. [\[FEATURE\] URL parameters for Claude Code on the Web - pre-fill prompts with user confirmation · Issue #19023 · anthropics/claude-code](https://github.com/anthropics/claude-code/issues/19023)
45. [Open Claude Desktop with a link | Claude Help Center](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)
46. [Creating default, individual and secondary links for partners – PartnerStack](https://support.partnerstack.com/hc/en-us/articles/360009180814-Creating-default-individual-and-secondary-links-for-partners)
47. [Creating dynamic referral links for partners – PartnerStack](https://support.partnerstack.com/hc/en-us/articles/32366459978643-Creating-dynamic-referral-links-for-partners)
48. [Potential cases where link tracking fails – PartnerStack](https://support.partnerstack.com/hc/en-us/articles/360019537774-Potential-cases-where-link-tracking-fails)
49. [Sharing Your TikTok Authorization Code for Spark Ads – #paid](https://hashtagpaid.zendesk.com/hc/en-us/articles/8330471110413-Sharing-Your-TikTok-Authorization-Code-for-Spark-Ads)
50. [How to create Spark Ads for Manual and Search Campaigns in TikTok Ads Manager](https://ads.tiktok.com/help/article?aid=10007470)
51. [What Is Influencer Whitelisting? How It Works for Brands in June 2026 | Launchpoint](https://www.launchpointhq.com/blog/what-is-influencer-whitelisting)
52. [Meta Partnership Ads: How They Work in 2026 - Blip](https://withblip.com/blog/meta-partnership-ads-explained/)
53. [Partnership Ads Creation - Meta for Developers](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation)
54. [YouTube Creator Partnerships: A new era for brand and creator collaborations - YouTube Blog](https://blog.youtube/news-and-events/youtube-creator-partnerships-newfronts-2026/)
55. [Partnership ads powered by BrandConnect - Google Ads Help](https://support.google.com/google-ads/answer/15223349)
56. [Thought leader ads | Marketing Solutions Help](https://www.linkedin.com/help/lms/answer/a1399568)
57. [LinkedIn Thought Leader Ads: Formats and Requirements](https://affectgroup.com/blog/linkedin-thought-leader-ads-formats-and-requirements/)
58. [What Are LinkedIn Thought Leader Ads? | ContentIn](https://contentin.io/glossary/thought-leader-ads/)
59. [How Influencers Charge Whitelisting & Usage Rights | Lumanu](https://www.lumanu.com/blog/how-influencers-charge-whitelisting-usage-rights)
60. [Influencer Content Usage Rights: Here’s Everything You Need to Know](https://www.modash.io/blog/usage-rights)
61. [Influencer Whitelisting: Meaning, Setup & ROI](https://influee.co/blog/influencer-whitelisting)
62. [Influencer Whitelisting: The Complete 2026 Playbook](https://ainfluencer.com/influencer-whitelisting-playbook/)
63. [For Creators: Join Meta Whitelisting | Billo Help Center](https://help.billo.app/en/articles/9691508-for-creators-join-meta-whitelisting)
64. [Choose Your Ideal Plan for Influencer & UGC Campaigns, Insense](https://insense.pro/pricing)
65. [Perpetuity, Whitelisting, AI Clauses: 23 Creator Economy Experts On What Brands Get Wrong About Creator Usage Rights](https://www.netinfluencer.com/perpetuity-whitelisting-ai-clauses-23-creator-economy-experts-on-what-brands-get-wrong-about-creator-usage-rights/)
66. [Lumanu Software Pricing, Alternatives & More 2026 | Capterra](https://www.capterra.com/p/184712/Lumanu/)
67. [Arcads AI Review: Best Use Cases, Risks, and 2026 Verdict - MaxAEO Blog](https://maxaeo.ai/blog/arcads-ai-review/)
68. [Fake performer, real penalty: What advertisers need to know before June 9 | ReedSmith](https://www.reedsmith.com/our-insights/blogs/viewpoints/102n129/fake-performer-real-penalty-what-advertisers-need-to-know-before-june-9/)
69. [New York State Legislature’s Preliminary Response to AI: Disclosure of “Synthetic Performers” in Advertising and Expanded Prohibitions on “Digital Replicas” of Deceased Performers](https://www.msk.com/newsroom-alerts-3114)
70. [TikTok AI Disclosure Rules for Ads (2026) | UGC Vids AI](https://ugcvids.ai/blog/tiktok-ai-content-disclosure-rules-2026)
71. [AI UGC Ads in 2026: The Honest Guide to AI Actors ... - Avocado AI](https://www.avocadoai.co/blog/tutorial/ai-ugc-ads-2026)
72. [2026 Influencer Marketing Report: Trends and Statistics for Influencer Marketing, UGC, and the Creator Economy](https://collabstr.com/2026-influencer-marketing-report)
73. [State of Creators](https://www.creatoriq.com/whitepaper/state-of-creators)
74. [Creator Earnings Report 2025](https://influencermarketinghub.com/creator-earnings-report-2025/)
75. [🔴 The 2025 monetization report](https://www.creatorspotlight.com/p/monetization-report-2025)
76. [Top 10% of Creators Earned 62% of Payments in 2025 as Creator Compensation Inequality Widens](https://www.creatoriq.com/press/releases/state-of-creator-compensation-)
77. [Linktree’s Creator Commerce Report 2024](https://linktr.ee/s/reports/creator-commerce-report-24)
78. [Meta Partnership Ads mandatory 2026: compliance guide for brands](https://www.contentgrip.com/meta-branded-content-rules-update/)
