---
id: uber-for-your-own-to-do-list-feasibility-and-prior-art-review-of-a-pai
title: "Uber for Your Own To-Do List: Feasibility and Prior-Art Review of a Paid, AI-Dispatched Task Queue for ADHD-Type Executive Dysfunction"
kind: "Feasibility review"
topic: "ADHD & attention"
date: "2026-10-01"
shelf: ""
listed_in_library: true
source_file: "uploads/archive-4/uber-for-your-own-to-do-list.md"
---

# Uber for Your Own To-Do List: Feasibility and Prior-Art Review of a Paid, AI-Dispatched Task Queue for ADHD-Type Executive Dysfunction
Research document · Canopticon · received 2026-10-01 · project: Attenuate · kind: feasibility review
---

The parts of your idea that look likely to work are the one-order-at-a-time dispatch, the context triggers, the accept/decline flow and the instant feedback. The part that looks weakest is the pennies, and especially pennies paid as real cash. I found no product that combines AI dispatch, context triggers, decline-with-reasons, personal surge pricing and micro-payouts. So the combination is genuinely open space. But the closest attempts ran into the same problems you will: they had to verify honest self-reports, payout fees at the cents level eat the payment, and the effect fades once the money stops. The version most likely to work is a dispatcher that rewards you with loss-framed credits you earn back against your own subscription. Real cash should wait until a third party (an employer, coach or insurer) is paying for it.

## TL;DR

- **Prior art:** Nobody has built "Uber for your own tasks". The nearby products are commitment-stake apps (Beeminder, stickK, Forfeit), pay-for-health apps (Sweatcoin, Evidation), RPG and gamified task managers (Habitica, Finch), AI schedulers (Motion, Reclaim, Sunsama) and ADHD tools (Tiimo, Goblin.tools, Focusmate). The best-documented failure is Pact/GymPact. It shut down in July 2017, and an FTC settlement required it to refund $948,788 to users it had charged even when they met their goals. Its problems were verification and billing, not the core idea.
- **Does it work?** Financial incentives do change behaviour while they are running. In Mantzari et al.'s 2015 meta-analysis of 34 RCTs the odds ratio was 1.53 up to 18 months, but effects mostly faded within about 3 months of removal. Loss framing beat equal-value gains in Patel et al. 2016. ADHD research supports immediate, frequent reinforcement, which is a good fit for the dispatch mechanic. The one academic test of adaptive "surge-like" incentive amounts (Lee et al., JMIR 2023) found no benefit over a fixed amount. Self-verified pennies are the weakest link.
- **What to do:** Spend 2 weeks testing the dispatch mechanic on yourself by hand through Telegram or SMS, alternating days with payout on and off. Then run a 5–20 person pilot with an "earn back up to 50% of your subscription" credit, so no cash ever leaves the app. Add real cash only if a B2B payer funds it. Avoid user-funded forfeit pools: they collide with Google Play's real-money staking ban, Canada's payment-services rules and the Criminal Code's lottery provisions.

## Key Findings

### 1. The core insight: what DoorDash gives you that your own to-do list doesn't

Your DoorDash observation is a good lens. A DoorDash order bundles at least six things: an external queue that decides what's next; one order at a time; a concrete, bounded action with an ETA; a trigger (the ping); immediate feedback; real money that a third party pays you and that you need. The first five are all things you can build. The sixth is different in kind. Pennies recycled from your own subscription are not third-party income. Mental accounting predicts people treat that money as "my money moving between pockets", not as earnings. That is why the money layer needs either loss framing (you lose something you already hold) or outside verification to carry any weight.

### 2. Prior-art landscape

Beeminder (pledges the company keeps; "still tiny ($22k/mo revenue with 3.5 FTEs)" in 2017). stickK (437,000+ contracts; "32% of the commitment contracts included stakes" in its 2010 business case; KAIST analysis found 68.7% success self-referee vs 74.2% friend-referee). Forfeit (AI-plus-human proof review; claims 94% completion, unaudited). Pact/GymPact (shut July 2017; FTC: $1.5M judgment, $948,788 refunded; penalties "$5 to $50 per missed activity"). HealthyWage/DietBet (deposit contracts "neither games of chance nor games of skill"). Sweatcoin, Evidation, Charity Miles. Employer wellness. Habitica, Todoist Karma, Finch, Forest. Tiimo, Inflow, Llama Life, Goblin.tools. Motion, Reclaim, Sunsama (dispatch by calendar time, not context). Focusmate. Greenlight, ChoreMonster. TaskRabbit, JumpTask. Lee et al. "StandUp" L-AMCM (KAIST, JMIR mHealth 2023): the closest academic analogue to personal surge pricing — no significant benefit, 0.66 success fixed vs 0.61 adaptive (P=.54); incentive size no significant effect (OR 0.98).

**What's genuinely novel.** No product I found turns brain-dumps into single, context-triggered "orders", dispatches them one at a time from a quota, requires a reason when you decline, and re-prices the work dynamically. The white space is a **context-aware dispatcher for personal tasks that learns from decline reasons**. Of all the features, the decline-reason data is probably the most valuable and least copied.

**Lessons from failures:** verification is the business; very few users opt into losing money (32% of stickK contracts; 13.7% in Halpern et al.); micro-cash is eaten by fees; "earn-money" apps carry a store-policy stigma.

### 3. Does it work? Evidence synthesis

Financial incentives increase behaviour while running — strong (Mantzari 2015, 34 RCTs: OR 1.53 up to 18 months; Glanz et al. 2025: "modest, often short-lived"). Effects persist after incentives stop — weak to moderate. Loss framing beats equal gains — moderate (Patel 2016: only the loss arm significantly beat control). Commitment devices help those who choose them — moderate, low take-up. Small pay can backfire — moderate (Gneezy & Rustichini 2000). Rewards crowd out intrinsic motivation — strong for interesting tasks, weak for boring ones (Deci, Koestner & Ryan 1999). Temptation bundling helps — moderate, decays (Milkman 2014). Self-verification invites small cheating — moderate to strong (Mazar, Amir & Ariely 2008; the 2018 RRR did not replicate the moral-reminder effect). Adaptive incentive amounts improve outcomes — unproven. Context-triggered prompts work — moderate, decays (HeartSteps).

Self-verified pennies remove all three levers that work in the trials: outside money, objective verification, meaningful amounts. What survives is the structure, and loss-framing of money you already hold.

### 4. ADHD-specific evidence

Luman, Oosterlaan & Sergeant 2005: "reinforcement contingencies have a positive impact on task performance and levels of motivation for both children with AD/HD and normal controls". Luman et al. 2008: "sensitive to frequency but blind to the magnitude of penalty" — many small, immediate signals beat bigger, rarer payouts. Sonuga-Barke's dual-pathway model; Volkow et al. on D2/D3 availability; Plichta & Scheres 2014 meta-analysis. No RCT tests cash micro-incentives for task completion in adults with ADHD — a genuine evidence gap. Risks: a 2026 systematic review in Addictive Behaviors estimated ADHD prevalence among people experiencing gambling harm at 24% (95% CI 18–29%) vs 2.58% general; McDonald et al. 2021 found no adjusted association (OR 0.6). Do not use lotteries. Spiel et al. (CHI 2022) on designing with ADHD adults.

### 5. Feasibility: economics

Stripe Connect: $2 per monthly active account plus 0.25% + 25¢ per payout; Instant Payouts 1% with a C$0.60 minimum. Paying a 5¢ commission would cost roughly 5–12× the commission. Model (70% completion): Basic C$8 · 5 orders/day · payout at 5¢ = $5.25 (66% of price); Pro C$24 · 20/day · 10¢ = $42.00 (175%). A solvent incentive budget is roughly 10–25% of net revenue. Recommended design: earn-back subscription credit (loss-framed, bounded, no money leaves the app). Avoid loss-funded pools. Context triggers require native (iOS region monitoring caps at 20 regions; Android 100 geofences). Build: Expo/React Native client, Cloudflare Workers + D1, one Durable Object per user as dispatcher, R2 for proofs, Vectorize for dedup. LLM role: parse brain-dumps into orders only.

### 6. Legal, regulatory and platform flags (practical, not legal advice)

Criminal Code s.206 (lotteries); Competition Act s.74.06; FINTRAC MSB definition ("remitting or transmitting funds… from one person or entity to another"); Retail Payment Activities Act ("holding funds on behalf of an end user"; merchant-instrument exclusion s.6(a)); Apple 5.3; Google Play staking ban; ROSCA/negative option (FTC v. Pact); Health Canada SaMD / FDA general-wellness; PIPEDA, Quebec Law 25, Washington MHMDA; tax ("commission" is the wrong word legally — use "rebate" or "credit").

### 7. Risks, kill criteria and go criteria

Kill: after 2 weeks of V0, completion less than 10 points above baseline or NAP below 0.6 → kill dispatch. Payout-on days no better than off → kill the money layer, keep the dispatcher. More than 15% of audited completions unverifiable → stop. Day-30 retention below 20%. Go: 15–20 point lift; at least 40% of decline reasons "no cue" or "wrong place"; half of pilot users active at day 30; at least 3 users would pay C$10+/month.

### 8. Staged validation plan

V0a Wizard-of-Oz (Telegram bot, you as user zero, 1 week baseline then 2 weeks, ~C$0). V0b alternating-treatments N-of-1 (14+ days). V0c surge test. V1 credits-only native MVP, 5–20 users, 6–8 weeks. V2 optional commitment after counsel. V3 real payouts via a B2B payer. N-of-1 methods: alternating-treatments or ABAB, NAP or Tau-U, randomisation test; pre-register kill thresholds.

## Synthesis: would it work?

(a) Mechanism — probably works, short to medium term. (b) Small self-verified payouts — likely fails as cash; unproven as loss-framed credits. (c) Personal surge pricing — unproven, leaning likely fails; repurpose as "surge attention". (d) Verification — works only if stakes are low or proof is cheap. (e) Business model — probably works as a subscription dispatcher with rebate credits; likely fails as a cash-payout platform without a B2B payer.

**Decide for me:** Option 1, "Dispatcher first, money as a rebate." Start V0a this week as a Telegram bot. If the dispatcher wins and the money doesn't, you've still found the product. The "Uber" part is the queue and the ping, not the pennies.

## Caveats

Most incentive RCTs study health behaviours, not to-do completion. ADHD reward evidence is largely from children and lab tasks. Company figures are vendor claims. Regulatory readings need Canadian counsel before any cash, stake or pool feature ships. LLM and payout costs are estimates.
