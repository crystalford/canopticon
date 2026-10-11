---
id: decision-report-which-economic-data-instrument-canopticon-should-build
title: "Decision Report: Which Economic-Data Instrument CANOPTICON Should Build First"
kind: "Research"
topic: "Attribution & credit"
date: "2026-09-01"
shelf: ""
listed_in_library: true
source_file: "uploads/Canopticon Research Documents-20260927T175515Z-1-001/CANOPTICON Instrument Zero_ Building the Canadian Real Wealth Gap Tracker First.md"
---

# Decision Report: Which Economic-Data Instrument CANOPTICON Should Build First

## TL;DR
- **Build the Canadian "Real Wealth Gap" Tracker (Candidate 1) first.** It is the only candidate whose core data is fully accessible today via an open API, carries near-zero legal/privacy risk, fits a solo AI-agent Cloudflare workflow, and exploits a genuine gap no official tool fills — StatCan's live interactive wealth tool shows only quintiles (the top 20% held 65.7% of net worth at end-2025), never the top-1% share, while the PBO's separate database puts the top 1% at 23.8% versus the 11.0% implied by the survey StatCan itself uses.
- **Runner-up: the procurement/lobbying "follow the money" tool (Candidate 3)** — fully open CSV data, high story yield, but entity-resolution-heavy and higher defamation exposure; build it second, once the wealth tracker proves the ingest-and-visualize pattern.
- **Avoid the beneficial-ownership graph (Candidate 2) first, and avoid the LM3 local tool (Candidate 4) entirely as a near-term product.** The federal ISC registry has no bulk download or public API and its terms prohibit harvesting; Québec's open data anonymizes owners and is non-commercial-licensed; LM3 requires primary business surveys (fieldwork), which does not fit a solo AI-agent model.

## Key Findings

**1. Only Candidate 1 has clean, open, API-accessible core data with no privacy exposure.** StatCan's DHEA wealth tables (36-10-0660-01 and the 36-10-0661/0664/0665 series) are available through the Web Data Service REST API (JSON), full-table CSV/SDMX downloads, under the StatCan Open Licence, updated each business day at 08:30 ET. The PBO published a public copy of its 2023 High-net-worth Family Database (plus a Q4 2024 projection). All data is aggregate — no named individuals — so PIPEDA and defamation risk are negligible.

**2. The "official-figure-vs-reality" divergence is real and unfilled.** StatCan's DHEA framework reports the wealth gap as quintiles only: per The Daily for Q4 2025 (released April 13, 2026), "The wealthiest households (top 20% of the wealth distribution) accounted for almost two-thirds (65.7%) of Canada's total net worth at the end of 2025... averaging $3.5 million per household," while the bottom 40% held 3.0% (averaging $81,650), and the top-20%-vs-bottom-40% gap reached a record 62.7 percentage points (Table 36-10-0660-01). StatCan's own Survey of Financial Security implies the top 1% holds only 11.0% of net wealth. The PBO's HFD, correcting for survey under-coverage of the rich via Pareto interpolation against Forbes/Maclean's lists, finds the top 1% holds 23.8% (2023) — a 12.8-percentage-point gap. In the PBO's words (RP-2526-009-S, Sept 11 2025): "The HFD indicates the top one per cent of economic families own around 23.8 per cent of net wealth in Canada versus the 11.0 per cent suggested by the 2023 SFS." No single official interactive tool juxtaposes these. This is exactly the McLuhan "make the invisible visible" framing.

**3. Candidate 2's core data is much weaker than hoped — flag.** Per ISED/Corporations Canada, "As of January 22, 2024, all business corporations under the Canada Business Corporations Act (CBCA) are required to file beneficial ownership information... Some of the information... is available through Corporations Canada's online search" — but that search is single-lookup only: there is no public API and no bulk download as of 2026, and Corporations Canada's terms prohibit systematic harvesting/bulk-downloading. Minister Champagne's own announcement noted the database "will take more than a year to be substantially complete." Only ~14.5% of Canadian private companies are federally incorporated. Québec's REQ offers open bulk data but anonymizes shareholders/owners in the open dataset and licenses it CC BY-NC-SA (non-commercial — fatal to a paid product). BC's public register was delayed to late 2025. OpenCorporates' self-serve API starts at £2,250/year and is share-alike. ICIJ's reconciliation API is in beta. Entity resolution across these is the hardest technical problem of the four, and the "inclusion is not wrongdoing" defamation problem is acute.

**4. Candidate 3's data is open but dirty; it is a strong runner-up.** Federal lobbying registrations and monthly communication reports are downloadable as CSV under the OCL Open Data Licence; proactive-disclosure contracts over $10,000 are published as CSV by the Treasury Board Secretariat on a quarterly cadence (filed within 30 days after each of the first three fiscal quarters and 60 days after Q4, per the Access to Information Act and the Guide to the Proactive Publication of Contracts). The Procurement Ombudsman has documented severe data-quality problems: inconsistent vendor names, vague contract descriptions, and amendment-bundling. Entity-linking the two datasets (which lobbied entity won which contract) is the entire value-add, and LLMs are well-suited to the cleaning/normalization. Legal risk is moderate: correlation between lobbying and contracts is not proof of wrongdoing, so framing must be careful.

**5. Candidate 4 (LM3) does not fit the builder or the stack.** The NEF Local Multiplier 3 method requires recruiting local businesses and surveying their spending across three rounds — primary fieldwork, not a data pipeline. The dated Civic Economics/NEF figures cannot be refreshed without that survey labour. Per the American Independent Business Alliance, Civic Economics found "52.9 percent of each purchase at local independent businesses is recirculated locally, compared to less than 13.6 percent of purchases at chain stores" — exactly the kind of small-sample, ageing figure the candidate aims to replace, but doing so credibly demands the same survey work. It is inherently a public good with weak willingness-to-pay and the lowest buildability for a solo AI-directed developer.

## Details

### A. Buildability Audit

**Candidate 1 — Real Wealth Gap Tracker.**
- *Data sources:* StatCan DHEA wealth tables via WDS REST API (`getDataFromCubePidCoordAndLatestNPeriods`, `getFullTableDownloadCSV`, `getChangedCubeList`); server limit 50 req/sec (25 per IP); updates each business day at 08:30 ET; JSON/CSV/SDMX; StatCan Open Licence. PBO HFD public dataset (2023 + Q4 2024) — described as a simulated-population microdata file in the PBO's report; format/URL not fully confirmed and should be verified directly with PBO. Survey of Financial Security PUMF for the 11.0% comparator.
- *Technical complexity:* Low-to-moderate. Mostly visualization plus a small scheduled ingest. No entity resolution. Relational data modeling is trivial (time series by category). Main subtlety: PBO uses "economic families" while DHEA uses "households" — units differ and must be labelled honestly.
- *Legal/privacy:* Minimal. Aggregate public data, open licences, attribution required.
- *Time-to-v1:* Fastest of the four — a working divergence chart from live data in days, not weeks.

**Candidate 2 — Beneficial-ownership graph.** Federal ISC: single-lookup web search only, no API/bulk, harvesting prohibited, still populating. Québec: open bulk but owners anonymized, CC BY-NC-SA. BC: delayed to late 2025. OpenCorporates: paid (from £2,250/yr) + share-alike. ICIJ: beta reconciliation API, ODbL/CC-BY-SA, "not wrongdoing" caveat. Graph modeling + entity resolution is hard; high legal exposure. Time-to-v1: longest.

**Candidate 3 — Procurement/lobbying.** Both datasets open CSV. Quality poor; LLM cleaning needed. Entity resolution is the core difficulty. Relational + light graph. Legal risk moderate. Time-to-v1: medium.

**Candidate 4 — LM3 local.** Requires primary surveys; not a pipeline. Lowest buildability for solo AI-agent model. Time-to-v1: long and labour-bound.

### B. Product Viability
- *Candidate 1:* Users = journalists, NGOs (Oxfam Canada, Broadbent Institute, CCPA), policy researchers, educators, engaged public. Comparables: WID.world (global, not Canada-specific, not focused on the top-1%-vs-official-survey divergence), StatCan's quintile interactive tool, Broadbent's static reports. Moat: the specific divergence narrative + design + always-current automation + CANOPTICON audience. Public-good core, but embeddable widgets/briefings carry modest WTP. Best standalone case of the four because it is sustainable solo and defensible on insight + design.
- *Candidate 2:* Users = compliance/AML, journalists, due-diligence. Strong WTP — but that market is served by Kyckr, OpenCorporates, and commercial KYB vendors with real data pipelines a solo builder cannot match given current access constraints. Weakest near-term product case due to data access.
- *Candidate 3:* Users = journalists, watchdogs, opposition researchers, academics. Comparable: OpenSecrets (US) — no strong Canadian equivalent. Real moat if entity-linking is solved. Good standalone case.
- *Candidate 4:* Users = municipalities, BIAs, economic-development offices. Comparable: NEF's LM3 Online. Weak WTP, fieldwork-bound.

### C. Journalistic/Forensic Generativity
- *Candidate 1:* High and recurring. Each quarterly DHEA release and each annual PBO update is a story; provincial/age/tenure cuts multiply it; the headline "official 11% vs corrected 23.8%" is a single arresting visual. Strong McLuhan fit.
- *Candidate 2:* Very high per-story impact (who owns what) but gated by data access and legal risk.
- *Candidate 3:* High — "lobbied X, won $Y contract" stories are abundant and visual.
- *Candidate 4:* Low — one methodological story per locality.

## Recommendations

**Build Candidate 1 (Real Wealth Gap Tracker) first.** It wins on the combination: highest buildability, lowest legal risk, strong and recurring journalistic generativity, defensible insight/design moat, and a genuine gap in official tooling. It is the natural "instrument zero" to establish CANOPTICON's ingest→model→visualize→publish pipeline on Cloudflare.

**Then build Candidate 3 (procurement/lobbying) second**, reusing the same pipeline and adding LLM entity-resolution as the new capability.

**Sequence Candidate 2 third, and only when the federal/BC registries mature** (bulk access or API). Until then its data floor makes it a poor solo product. **Treat Candidate 4 as optional/never** as a standalone; if pursued, fold it into Candidate 3's procurement-spend data rather than running surveys.

*Thresholds that change this:* If the federal ISC registry ships a bulk export or public API, or BC's public register goes live with usable data, promote Candidate 2 ahead of Candidate 3. If StatCan operationalizes its capitalization-of-income top-tail estimates into the public interactive tool, Candidate 1's moat narrows — ship before that happens.

### Build Specification — Real Wealth Gap Tracker v1

**v1 scope:** A single mobile-first page showing the divergence between the official quintile-based wealth picture and the top-tail-corrected picture: the top-1% share at 11.0% (SFS) vs 23.8% (PBO HFD, 2023), alongside the DHEA quintile bars (top 20% ≈ 65.7%, bottom 40% ≈ 3.0% at end-2025), with a quarterly-updating time series and a clear methodology note on the household-vs-family unit difference.

**Cloudflare stack mapping:**
- **Workers:** public API + server-rendered page; a Cron-triggered Worker polls StatCan WDS `getChangedCubeList` daily to detect DHEA updates.
- **Queues:** decouple "update detected" from "fetch + transform + write" so ingest is retry-safe.
- **D1:** store normalized time series (period × distribution category × wealth component) and the PBO top-tail series.
- **R2:** store raw StatCan CSV/SDMX pulls and the PBO HFD source file as immutable snapshots (provenance), plus generated chart images for social/embed.
- **Workers AI:** optional — draft plain-language captions for each quarterly update from the deltas.
- **Durable Objects / Vectorize:** not required for v1; do not add them, to avoid over-engineering.

**Core data model:** dimension tables `period`, `distribution_category` (quintile, decile, top-1%, source), `wealth_component`; fact table `net_worth_share(period_id, category_id, component_id, value, source, revised_flag)`; separate `top_tail_series` for PBO percentile thresholds, family counts, and shares.

**Key technical risks & de-risking:**
1. *StatCan back-revisions* (wealth series revised to 2010) → store snapshots in R2, flag revised periods, never assume immutability.
2. *Unit mismatch* (PBO economic families vs DHEA households) → never overlay as identical series; label distinctly; explain in a fixed methodology panel.
3. *PBO HFD format/URL unconfirmed* → verify with PBO directly before coding the ingest; fall back to manually loading the published table values (e.g., the 23.8% top-1% share and $7.4M / 169,400-family thresholds) if the file is not machine-readable.
4. *Moat erosion* if StatCan ships top-tail figures → ship v1 quickly.

**v1 visual:** the "two pictures" divergence — a slope/needle comparison of 11.0% vs 23.8% for the top 1%, plus DHEA quintile bars, plus a small-multiples time series. One screenshot = one CANOPTICON forensic visual.

**Milestones (zero → first published piece):**
1. Verify PBO HFD file format/URL; confirm StatCan PIDs and vectors.
2. Worker + Queue + D1 ingest of one DHEA table; snapshot to R2.
3. Load PBO top-tail series; build the divergence chart.
4. Wire daily Cron update detection + caption draft.
5. Publish first CANOPTICON piece: "Canada's official wealth gap hides the real one — 11% vs 23.8%," powered by the live instrument, with the embeddable divergence visual.

## Caveats
- The PBO HFD public dataset's exact file format and direct download URL were not confirmed; verify with the PBO (the report states only that it is "available on the PBO's website"). It is described as a simulated/synthetic microdata population (2023 plus a Q4 2024 version), not a simple summary table.
- PBO figures carry stated uncertainty. The Q4 2024 update is a projection expressed primarily as family counts ("176,800 families with a minimum net wealth of $7.5 million") rather than a precise share — do not assert a specific Q4 2024 top-1% percentage; the firmly sourced share figure is 23.8% for 2023. The top-1% share is also sensitive to which rich lists are included. Present ranges/caveats, not false precision.
- StatCan's capitalization-of-income top-tail method is currently an experimental research article (Catalogue 13-605-X), not part of the live interactive tool — but it signals StatCan may eventually publish top-1% figures, which would narrow Candidate 1's moat.
- Candidate 2's viability could improve materially if federal/BC registries add bulk/API access; re-evaluate then.
- OpenCorporates and ICIJ terms (share-alike, attribution, non-wrongdoing) constrain any future graph product's commercialization.