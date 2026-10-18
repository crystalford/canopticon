---
id: the-telescope-problem-where-ai-and-real-time-data-make-the-invisible-e
title: "The Telescope Problem: Where AI and Real-Time Data Make the Invisible Economy Legible"
kind: "Research"
topic: "Prices & markets"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/Canopticon Research Documents-20260927T175515Z-1-001/The Telescope Problem_ Making the Invisible Economy Legible Through AI and Real-Time Data.md"
---

# The Telescope Problem: Where AI and Real-Time Data Make the Invisible Economy Legible

## TL;DR
- **The real white space is instrumentation, not theory.** Economics resists being "solved" by computation for structural reasons (reflexivity, the Lucas Critique, Goodhart's Law, performativity) — but those same limits make *measurement* the open frontier. The biggest wins of the last 15 years came from people who built new instruments (Cavallo's online price index, Chetty's private-data tracker) rather than new theory. That is the McLuhan-style move: the instrument reorganizes the field.
- **For a solo builder, the gap is not data acquisition — it's legibility.** The crowded, capital-intensive zones are alternative-data feeds for hedge funds (USD 11.70 billion in 2025 per Mordor Intelligence; Grand View Research puts it higher at USD 18.74 billion) and on-chain crypto analytics. The genuinely thin zone is *synthesis and visualization of public-but-illegible data* — beneficial ownership, procurement, lobbying, wealth concentration, local capital flows — especially in Canada, where official data is slow, quintile-level, and badly surfaced.
- **The seductive dead end to avoid is "AI will compute the right policy."** Agent-based and LLM-driven economic simulators (Salesforce's AI Economist, the LLM Economist) are real research tools but not oracles; treating them as policy-prediction engines walks straight into the Lucas Critique. The defensible play is making *what already happened* visible faster and clearer, not predicting what optimal policy is.

---

## Key Findings

1. **Measurement, not prediction, is where compute has actually won.** Cavallo and Rigobon's Billion Prices Project deliberately "focus on measurement instead of prediction" — and that's exactly why it worked. The frontier wins are instruments that make a lagged or hidden quantity visible sooner.

2. **The "invisible economy" has identifiable, named categories:** (a) lagged official statistics (GDP, inflation, wealth) that nowcasting can front-run; (b) hidden ownership/capital structures (shell companies, beneficial ownership); (c) uncounted labor (gig/informal work); (d) intangible and free-good value GDP was never built to capture; (e) local capital recirculation, which essentially no one measures officially.

3. **AI's genuinely new capability is turning unstructured text and imagery into structured economic signal** — LLMs extracting expectations from earnings calls, central-bank text, and news; computer vision turning satellite imagery into activity indices. This is real and documented (ECB, BIS, Federal Reserve). The hype is in claiming AI can simulate and optimize whole economies.

4. **Canada is a target-rich environment for legibility work.** StatCan data is released with notable lags and only at quintile granularity for wealth; the federal beneficial ownership registry is new and incomplete; procurement and lobbying data exists but is "unreliable" and poorly surfaced. This aligns directly with the user's investigative-journalism beat.

5. **The crowded areas — institutional alternative data and crypto on-chain analytics — are exactly where a solo builder should NOT compete on data.** But their *techniques* (network analysis, geospatial signal, NLP extraction) are portable to under-served public-interest domains.

---

## Details

### 1. Why economics isn't "solved" — and why that's the opportunity, not the obstacle

The user's instinct is correct: the point of establishing this layer is to inoculate against the dead end. Four interlocking reasons economics resists deterministic computation:

**Reflexivity (Soros).** George Soros's framework rests on two principles: *fallibility* (participants' views of a complex reality are always biased or incomplete) and *reflexivity* (those biased views change the reality itself through a feedback loop). As Soros puts it, "if investors believe that markets are efficient then that belief will change the way they invest, which in turn will change the nature of the markets in which they are participating." Equilibrium, in his view, is the rare special case (a negative-feedback limit), not the norm. Reflexivity is, by Soros's own admission, "difficult, if not impossible, to model" — which is why it has been "studiously avoided" by mainstream theory.

**The Lucas Critique (1976).** The parameters of an econometric model estimated under one policy regime won't hold under a new regime, because rational agents form expectations about policy and change their decision rules. You cannot treat past behavioral relationships as fixed engineering constants.

**Goodhart's Law / Campbell's Law.** "When a measure becomes a target, it ceases to be a good measure" (Goodhart's 1975 monetary-policy observation, sharpened into this phrasing by anthropologist Marilyn Strathern). Campbell's Law is the social-science generalization: "the more any quantitative social indicator is used for social decision-making, the more subject it will be to corruption pressures." These three form a chain: the moment an indicator is used for control, agents reorganize around the indicator and it decays. (Notably, this *also* shows up in AI itself — reward-model over-optimization in LLM alignment is explicitly described in the research literature as a Goodhart's Law problem.)

**Performativity (MacKenzie, *An Engine, Not a Camera*, 2006).** Economic models don't just describe markets; they help bring them into being. MacKenzie's central case: the Black-Scholes-Merton options model didn't describe a pre-existing derivatives market — it helped *create* one. As MacKenzie documents, "in 1970, there was almost no trading in financial derivatives such as 'futures.' By June of 2004, derivatives contracts totaling $273 trillion were outstanding worldwide" (he adds: "roughly $43,000 for every human being on earth"). Economics is "an engine, not a camera."

**Complexity economics (Santa Fe Institute; W. Brian Arthur, J. Doyne Farmer).** Beginning with the 1987 Arrow/Anderson meeting at SFI, this school models the economy as a non-equilibrium complex adaptive system of heterogeneous, imperfectly-informed agents — explicitly rejecting the rational-equilibrium frame. Farmer champions large-scale agent-based simulation, but as a tool for understanding instability and risk, not for computing the "right" answer.

**The synthesis for the builder:** All four critiques are about *prediction and control* under feedback. None of them undermine *measurement of what has already occurred or is occurring now*. The telescope didn't predict where planets should be; it showed where they were. The white space is the same: instruments that render the present state of the economy visible faster, more granularly, or more honestly than the incumbent apparatus.

### 2. What is economically invisible that could be made visible

**Lagged official statistics → nowcasting.** GDP, the canonical case, is published with long lags and heavy revisions because it requires aggregating many sources. Nowcasting uses timelier series to estimate the current value. In Canada specifically, GDP, retail trade, and wholesale trade are released "with a delay of six to eight weeks" and revised repeatedly. The Bank of Canada runs nowcasting models internally but "doesn't publish its nowcast." Independent efforts exist (the IFSD's @NowcastCanada), and StatCan has acknowledged it could release faster but core users (Finance, BoC) preferred fewer revisions over speed.

**Inflation → online prices.** The MIT Billion Prices Project (Cavallo & Rigobon, started 2008) scraped online retail prices. Per their *Journal of Economic Perspectives* paper (2016): "By 2010, we were collecting 5 million prices every day from over 300 retailers in 50 countries" — versus the ~80,000 prices the US BLS collected monthly. Commercialized as PriceStats (now within State Street), the indices are "published daily, rather than monthly, and with a lag of three days, rather than several weeks," and famously exposed Argentina's manipulated official CPI. The lesson the user should internalize: the value was *measurement honesty and speed*, and it was buildable by scraping public web prices.

**Real-time activity → private administrative data.** Raj Chetty's Opportunity Insights Economic Tracker combined anonymized credit-card, payroll, and job-posting data into a public, county-level, near-real-time picture of spending and employment with a lag of "three days or less." This is the gold standard — but it depended on data partnerships a solo builder won't have. The portable insight is the *product form*: a free public dashboard that out-timelies official statistics.

**Satellite/geospatial → activity indices.** Nighttime lights (DMSP, then VIIRS) correlate with GDP and have been used to estimate subnational and informal-economy activity where official data is absent; machine learning now maps daytime imagery to economic proxies. Commercially, RS Metrics pioneered parking-lot car-counting in 2011; Berkeley Haas research (Patatoukas & Katona) found the strategy yielded a 4-5% return in the three days around quarterly earnings announcements — and noted the edge stayed with a few large hedge funds, not the public. That asymmetry (institutions see it, the public doesn't) is itself a legibility opportunity.

**Hidden ownership / capital structures.** The ICIJ Offshore Leaks Database exposes "more than 810,000 offshore entities... in more than 200 countries and territories" (Panama, Paradise, Pandora Papers, etc.), structured as a graph and linked to OpenCorporates (200M+ companies). In January 2025 ICIJ added a Reconciliation API (funded by Germany's Deutsche Gesellschaft für Internationale Zusammenarbeit) that "allows real-time data sharing and tracking of beneficial ownership data" by matching external datasets. This is mature for *leaked* data, but the connective tissue between leaks, public registries, and real-world assets (property, contracts) is still largely manual.

**Uncounted labor.** Gig/informal work is systematically undercounted. Bracha & Burke (FRB Boston Working Paper No. 23-15, Sept 2023, "Informal Work and Official Employment Statistics: What's Missing?") found "as of 2015 roughly 37 percent of nonretired U.S. adults participated in some type of informal work," and properly counting it would have made "the employment-to-population ratio... 0.25 to 1.1 percentage points higher over the 2015–2022 period and as much as 5.1 percentage points higher under more generous estimates." Global online gig-worker counts range from 154M to 435M depending on definition — the range itself is the measurement failure.

**Intangibles and free goods → GDP-B.** Brynjolfsson et al.'s GDP-B accounts for the welfare value of new and free digital goods that conventional GDP misses entirely (replacing paid Britannica with free Wikipedia *lowers* GDP while raising welfare). Including Facebook's welfare gains would have added 0.05-0.11 points/year to US GDP-B growth. GDP "was not designed" to measure well-being and is "inadequate" for it.

**Local capital recirculation — the near-total blind spot.** This is central to the user's earlier project idea and is the thinnest-measured of all. There is no regularly-published official statistic — Canadian or otherwise — for how much money recirculates within a local economy. The methodological tools are: the New Economics Foundation's **LM3 (Local Multiplier 3)**, introduced in NEF's 2002 "The Money Trail," which tracks three rounds of spending; and the **Civic Economics / AMIBA "local premium" studies**. Representative figures: AMIBA's average of Civic Economics retail studies found ~52.9% of spending at local independents recirculates locally vs. ~13.6% at chains; the Andersonville (Chicago) 2004 study found $68 of every $100 stayed local at independents vs. $43 at chains; the Austin "Livable City" study (2002) found $100 spent at a Borders created $13 of local activity vs. $45 at local stores; NEF's Northumberland work found "every £1 spent with a local supplier is worth £1.76 to the local economy." These figures vary widely by place and method, rest on small samples, and Civic Economics itself warns against over-extrapolation — which is precisely why a better, transparent, data-driven instrument is an opening.

### 3. AI-specific methods: what's genuinely new vs. hype

**Genuinely new and working:**
- **LLM extraction of economic signal from unstructured text.** This is the most real and most accessible frontier. The ECB has shown ChatGPT-generated sentiment from PMI news releases improves GDP nowcasts (de Bondt & Sun, ECB Working Paper 3063, 2025). The St. Louis Fed found LLMs can outperform survey forecasts of inflation (Faria-e-Castro & Leibovici, 2024). Bybee (2025) used GPT to extract CPI/unemployment/S&P expectations from Wall Street Journal archives, extending an expectations series back 120 years. Central banks have built domain-specific models (Bundesbank's "MILA," CentralBankRoBERTa, the BIS's CB-LMs). This is the technique most portable to a solo builder: point an LLM at public unstructured documents and produce structured time series.
- **Computer vision on satellite/geospatial imagery** turning pixels into activity indices (above).
- **Network/graph analysis for hidden ownership** — the ICIJ/OpenCorporates graph approach.

**Real but oversold for a solo builder:**
- **Agent-based and LLM-driven economic simulation.** Salesforce's "AI Economist" used two-level deep reinforcement learning to discover tax policies in toy economies; the "LLM Economist" (Princeton/Salesforce, 2025) uses persona-conditioned LLM agents calibrated to US Census income and demographic data to test piecewise-linear tax schedules with populations up to ~100 agents. These are legitimate research test beds. But they explicitly make "strong assumptions" (static skills, instantaneous labor response, small populations), and treating their outputs as policy prescriptions walks directly into the Lucas Critique and performativity problems. **This is the dead end the user should write about, not build.**

### 4. Who is already building — crowded vs. thin

**Crowded / capital-intensive (avoid competing on data):**
- **Institutional alternative data.** A USD 11.70 billion market in 2025 per Mordor Intelligence (Grand View Research puts it at USD 18.74 billion — the discrepancy reflects scope differences), growing fast. Adoption is high: the 2024 Lowenstein Sandler survey found "67% of professionals already deploy alternative data and 94% plan higher outlays in 2025," while IMARC reports "78% of hedge funds integrated some form of alternative data... by 2022." Providers: Orbital Insight, SpaceKnow, RS Metrics, Kpler, Vortexa, UBS Evidence Lab (55+ datasets). Raw data is expensive and the analytical talent is expensive. A solo builder cannot win here on data access.
- **Crypto on-chain analytics.** Nansen (500M+ labeled wallets), Chainalysis, Glassnode, Dune, CryptoQuant. Mature and well-funded.

**Academic / institutional (sources to build on, not compete with):** Opportunity Insights, MIT Billion Prices/PriceStats, Santa Fe Institute, INET Oxford.

**Open-source / civic-tech (the right neighborhood, and it's thin):** ICIJ, OpenCorporates, Open Ownership, Transparency International, the California Civic Data Coalition — whose stated mission is to "clean, regroup, filter and transform the massive, hairy state database into something more legible," exactly the model. Dune's pattern of public, forkable dashboards points to a reusable product form.

**Where the solo builder wins:** clever synthesis, visualization, and *making-legible* of data that already exists publicly but is inaccessible or incomprehensible — defensible by insight and design, not capital.

### 5. The Canadian angle

**Wealth concentration is officially under-measured.** StatCan's Distributions of Household Economic Accounts (DHEA) publishes wealth only at the quintile level, quarterly with a ~3-month lag. In Q1 2025 (released July 16, 2025) the top 20% held 64.7% of net worth (avg. $3.3M/household); by Q4 2025 (released April 13, 2026) it was 65.7%. Crucially, StatCan does not publish top-1% or top-0.1% wealth shares, and admits its benchmark Survey of Financial Security (last cycle 2023, released October 29, 2024, run only every 3-6 years) means "the share of wealth held by the top 1% will be understated in this data source." The Parliamentary Budget Officer built a separate High-net-worth Family Database to fix this; its September 11, 2025 update found "the top one per cent of economic families own around 23.8 per cent of net wealth in Canada versus the 11.0 per cent suggested by the 2023 SFS" (top-1% threshold $7.4M, ~169,400 families). Other estimates run higher still — Canadians for Tax Fairness/BC Policy Solutions' "The New Robber Barons" (Feb 2026) traces the top-1% share rising from 19.3% (1999) to 22.7% (2023), and the Social Capital Partners "Billionaire Blindspot" report (drawing on former StatCan Assistant Chief Statistician Michael Wolfson) argues the official survey "significantly underestimates wealth inequality." The gap between official and corrected figures is itself a story and a dataset.

**Beneficial ownership is new and incomplete.** Canada earned a reputation as a "corporate transparency backwater" ("snow-washing"). Bill C-42 created a public federal beneficial ownership registry (in force January 2024 for filing), but only ~14.5% of Canadian private companies are federally incorporated — the rest are provincial, and only BC and Québec have registries. So the national picture is fragmented and full of holes.

**Procurement and lobbying data exists but is poorly surfaced and partly unreliable.** Federal contract history (2009→), lobbying registrations, and monthly communication reports are all published as open data. But CIGI's analysis (Matt Malone, uOttawa) calls Canada's Open Government portal "a repository of often unreliable data" not subject to meaningful oversight, notes the statutory five-year Lobbying Act review has been ignored since 2012, and points out Canada (unlike the US) doesn't require disclosure of lobbyist *spending*. There are ~9,000 registered federal lobbyists across ~3,500 organizations. Municipal procurement transparency is weaker still.

**Real-time indicators lag.** As above, StatCan macro data runs 6-8 weeks behind and the BoC doesn't publish its nowcast. There is no public, well-designed Canadian real-time economic dashboard comparable to Opportunity Insights.

### 6. The hard-money / crypto thread

The structural point is the inversion of visibility: traditional finance is opaque (you cannot see the flows), while public blockchains are radically transparent — every transaction is permanently visible. On-chain analytics (Nansen, Chainalysis, Glassnode, Dune) exploits this to label wallets, trace flows, and detect illicit movement. The measurement irony: crypto, marketed as private, is in many ways the *most* measurable financial system ever built, while the legacy banking system remains the black box. The caveat on-chain analysts themselves note is that it "doesn't capture off-chain activity" (centralized-exchange trades). The white space here is largely filled commercially; the residual opportunity for a public-interest builder is *connecting* on-chain transparency to off-chain accountability (e.g., tracing public-entity or sanctioned flows), and the open-data/forkable-dashboard culture (Dune) is a model to borrow rather than a market to enter.

---

## Recommendations

**Framing principle:** Build instruments that make *what is already true* legible faster and more honestly than incumbents. Avoid prediction, optimization, and any pitch that implies computing "correct" policy. Compete on insight, design, and synthesis — never on proprietary data access.

**Stage 1 — Pick one legibility instrument and ship it (weeks, not months).** Strongest candidates, ranked for a solo Cloudflare-native builder:

1. **A Canadian "real wealth gap" tracker.** Ingest StatCan DHEA quintile data + PBO top-tail estimates + the SFS, and visualize the *divergence between official and corrected* top-1% wealth shares over time (StatCan's implied ~11%, PBO's 23.8%, C4TF's 22.7%). Low data cost (all public), high narrative value, directly ties to the user's political-economy beat. Genuine gap: no one surfaces the official-vs-reality gap as a living instrument. Build: data ingestion + a clean visualization layer. *Most defensible on pure public data.*

2. **A beneficial-ownership / "who owns what" legibility layer for Canada.** Combine the federal registry, provincial registries (BC, Québec), OpenCorporates, and ICIJ's Reconciliation API into a single searchable graph focused on a concrete domain (e.g., who owns residential/commercial property, or who holds government contracts). Genuine gap: the data is fragmented and the connective tissue is manual. This is investigative-journalism infrastructure that doubles as a product.

3. **A procurement/lobbying "follow the money" tool.** Use LLMs to clean and link Canada's unreliable open procurement + lobbying datasets — surfacing which lobbied entities won which contracts. The technique (LLM entity extraction + resolution) is exactly what's now newly feasible. Genuine gap: the data is public but "unreliable" and unlinked.

4. **A local capital-recirculation instrument** (the user's original idea, made rigorous). Build a modern, transparent LM3-style tool for a specific Canadian locality (Hamilton/Niagara), letting businesses or a municipality estimate local recirculation from real spending data rather than the dated, small-sample Civic Economics figures. Genuine gap: there is no good, data-driven, regularly-updated local-multiplier instrument anywhere. Hardest on data (needs spending inputs) but highest originality and most defensible as both product and story.

**Stage 2 — Add the AI extraction layer.** Once one instrument ships, apply the genuinely-new technique: point an LLM at unstructured public text (StatCan releases, BoC communications, municipal budgets, earnings calls of major Canadian employers) to produce structured, timely indicators — following the ECB/Fed playbook (sentiment-into-nowcast). This is where modern ML adds real, defensible value.

**Stage 3 — Write the companion investigative piece.** The McLuhan frame is itself publishable: a piece on *why economics can't be "solved" and why instrumentation is the real frontier*, using the user's own build as the worked example. The dead-end critique (AI Economist as Lucas-Critique trap) is a strong contrarian hook.

**Benchmarks that would change the plan:**
- If a candidate instrument already has a well-designed, maintained public version (check before building), drop it and move down the list.
- If data-acquisition cost for the local-multiplier idea proves prohibitive, pivot to the wealth-gap or beneficial-ownership tracker (pure public data).
- If LLM extraction accuracy on a given corpus is too low to trust, keep the instrument descriptive (visualization of existing data) rather than inferential.

---

## Caveats

- **Source-quality flags.** Alternative-data market-size figures vary widely by source (Mordor's USD 11.70B vs. Grand View's USD 18.74B for 2025) and come substantially from vendor-adjacent research firms; treat them as order-of-magnitude. Local-multiplier percentages vary dramatically by study, place, and method, conflate different metrics (total local impact vs. revenue recirculated vs. secondary spending), and rest on small samples — Civic Economics itself cautions against extrapolation.
- **The agent-based simulation literature is forward-leaning.** Several cited simulation papers describe what models *could* enable; their authors are explicit about strong simplifying assumptions. Do not present simulator outputs as established economic fact.
- **Reflexivity cuts both ways for the builder.** Any successful public instrument that becomes a target will eventually be gamed (Goodhart). Design for honesty and transparency of method, and expect the measure's usefulness to erode if it ever drives behavior.
- **Canadian top-1% wealth share is genuinely contested** — official SFS ~11%, PBO 23.8%, C4TF 22.7%. Present the range and the methodology behind each, not a single number; the contestation is the point.
- **Privacy and legal care** are required for any beneficial-ownership or capital-flow tool: ICIJ and OpenCorporates both stress that inclusion in a database does not imply wrongdoing, and Canadian privacy law (PIPEDA) constrains linking personal data.