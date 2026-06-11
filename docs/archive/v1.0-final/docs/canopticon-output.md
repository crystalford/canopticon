# CANOPTICON — Output

This document covers the disciplines, modes, and machinery for what CANOPTICON actually *produces*. Where `canopticon-thinking.md` covers why the system exists and what it commits to, and `canopticon-system.md` covers how the substrate works, this document covers the contract between substrate and output. What the system writes, in what shapes, with what disciplines, and why.

The companion `canopticon-interfaces.md` covers where output gets *displayed* (operator app, public site). This document covers what output *is*.

---

## 1. THE ROOT-STRIKING DISCIPLINE

> *"There are a thousand hacking at the branches of evil to one who is striking at the root."* — Henry David Thoreau

Every CANOPTICON investigation and every published output identifies the level of intervention being analyzed or proposed. This is the single most important analytical discipline that distinguishes CANOPTICON's output from surface commentary.

### 1.1 The three intervention levels

**Symptom level.** Treating the downstream population or effect. Example in housing: building more shelter beds. These are not solutions. They are management. The problem compounds faster than management can address it.

**Mechanism level.** Targeting the proximate cause. Example in addiction: expanding harm reduction programs. These slow the rate of damage but don't change the trajectory.

**Structural level.** Addressing the root conditions that generate the problem regardless of which actors are involved. Example in housing: reversing housing financialization, rebuilding community mental health infrastructure, regulating pharmaceutical distribution. Only this level changes the trajectory.

### 1.2 The discipline operationally

Every published thesis names the level it is operating at. Every solution inventory entry names the level its interventions operate at. Every policy proposal that operates at the symptom or mechanism level must justify why a structural intervention is unavailable; otherwise it is rejected by the system as insufficient.

The substrate enforces this via a `intervention_level` enum on relevant rows: `symptom | mechanism | structural`. Outputs tagged at symptom or mechanism level cannot reach `is_public = TRUE` on the policy proposal pathway without explicit operator override accompanied by a documented reason in `change_summary`.

### 1.3 Worked example — housing

- *Surface argument:* "We need more shelter beds / more housing subsidies."
- *Mechanism argument:* "Harm reduction works in Vancouver, doesn't in X."
- *Root cause:* Housing as speculative asset class plus deliberate deinstitutionalization (1970s–90s) without community replacement plus engineered opioid supply crisis plus wage stagnation eliminating the housed/unhoused margin.

No symptom or mechanism intervention shrinks the problem faster than the root causes generate new cases. CANOPTICON's thesis layer always asks: *which level is this operating at, and why are proposed solutions systematically operating below the root?*

---

## 2. THE FIVE WHYS PROTOCOL

For every investigation that reaches the structural analysis stage, the system runs the Five Whys protocol before generating output. The protocol is mandatory; outputs that haven't passed it are classified as news coverage, not structural analysis.

### 2.1 Protocol

```
PROBLEM:  [Observable symptom]
WHY #1:   [Proximate cause]
WHY #2:   [Cause of the proximate cause]
WHY #3:   [Deeper mechanism]
WHY #4:   [Structural condition]
WHY #5:   [Root design choice or institutional incentive]
```

The system does not publish a thesis until it has reached Why #4 or #5. Outputs that only reach Why #1 or #2 route to the content pipeline (articles, social posts, productions) as commentary or analysis, not as theses.

### 2.2 Worked example — housing crisis

- Why are people unhoused? → Cannot afford housing.
- Why can't they afford housing? → Prices have outpaced wages.
- Why have prices outpaced wages? → Housing treated as investment asset.
- Why is housing an investment asset? → Policy and tax design privileges capital gains on property over productive investment.
- Why does policy maintain this design? → Institutional capture: the majority of household wealth is in property; the political class is property-wealthy; the financial sector profits from mortgage origination.

The thesis operates at Why #5. Proposals operate at Why #4 or #5. Everything above that is symptom management.

### 2.3 Substrate

A `five_whys_chains` table records Five Whys analyses:

```sql
CREATE TABLE public.five_whys_chains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  problem_statement TEXT NOT NULL,
  why_1 TEXT NOT NULL,
  why_2 TEXT NOT NULL,
  why_3 TEXT NOT NULL,
  why_4 TEXT,
  why_5 TEXT,
  reached_root BOOLEAN NOT NULL DEFAULT FALSE,
  supporting_claim_ids UUID[] DEFAULT '{}',
  generated_by_role_invocation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

A thesis with `is_public = TRUE` and no associated `five_whys_chains` row with `reached_root = TRUE` cannot be published unless the operator explicitly overrides with a logged reason.

---

## 3. THE THREE INTELLECTUAL OUTPUT MODES

CANOPTICON's published outputs come in three modes, each with a distinct purpose, format, and discipline.

### 3.1 Mode 1 — Intelligence Theses

**Length.** 40 to 80 pages.

**Source.** Graph-derived. Every claim traces back through the substrate to original sources with Admiralty grades.

**Format.** Follows IC tradecraft, specifically ICD-203 BLUF structure:

1. Headline assessment with probability and confidence (IPCC qualifier)
2. Key judgments — five to seven bullets
3. Scope note and methodology
4. Evidence with source grades
5. Alternative hypotheses explicitly addressed
6. Indicators and outlook (what to watch for)

**Disciplines.**
- Banked predictions: every published thesis includes 3-5 explicit probabilistic predictions with time horizons. Logged in the substrate's `predictions` table; tracked publicly on the prediction ledger.
- Methodology appendix: what sources were used, how they were graded, which roles ran on the thesis, what contradictions were considered and why resolved as they were.
- Coined vocabulary: every landed thesis includes a coined phrase that compresses the structural finding into transmissible language. Not marketing — analytical work. (See §5.2.)
- Named human accountability: every output has a named human editor accountable under COPE authorship standards. Never just "CANOPTICON."

**Substrate mapping.** Theses (`theses` table) become published as `articles` with `article_type = 'intelligence_thesis'` when the operator confirms publish-prep. The intelligence thesis is the canonical output of the system.

### 3.2 Mode 2 — Policy Proposals

**Length.** 10 to 20 pages.

**Stance.** Explicitly bracketed as advocacy. Built on thesis evidence but crosses into recommendation. The crossing is marked, not concealed.

**Format.**

1. Problem statement (with reference to the underlying thesis)
2. Evidence base (the relevant claim subgraph)
3. Proposed mechanism
4. Precedents from other jurisdictions (drawn from the solution inventory — see §4)
5. Implementation pathway
6. Failure modes (what would make this not work)

**Discipline.** Proposals must operate at the structural level (Why #4 or #5). Proposals at the symptom or mechanism level are rejected by the system as insufficient unless the operator documents why a structural intervention is unavailable.

**Substrate mapping.** Articles with `article_type = 'policy_brief'`. Linked to a parent thesis via `articles.thesis_id`. The structural-level requirement is enforced via a `intervention_level` column.

### 3.3 Mode 3 — Books

**Source.** Built from accumulated intelligence theses once the graph is mature.

**Architecture.**

1. Hierarchical outline (drawn from the thesis cluster the book covers)
2. Claim ledger per chapter (the substrate slice each chapter draws from)
3. Chapter-level role generation with prior-chapter summaries injected as context
4. Full-manuscript contradiction scan (the Verifier and Red Team run across the assembled draft)
5. Human editorial finish

**Substrate mapping.** Books in the `books` table with `ingest_mode = 'substrate'`, plus `articles` with `article_type = 'book_chapter'` for each chapter. A separate `book_chapters` table tracks chapter ordering, dependencies, and assembly state.

```sql
CREATE TABLE public.book_chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  ordering INTEGER NOT NULL,
  title TEXT NOT NULL,
  thesis_cluster_refs UUID[] DEFAULT '{}',
  prior_chapter_summary TEXT,
  draft_status TEXT NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (book_id, ordering)
);
```

### 3.4 Document type taxonomy

The `articles.article_type` enum carries the full taxonomy:

```sql
CREATE TYPE article_type AS ENUM (
  'intelligence_thesis',   -- 40-80 pages, IC format, graph-sourced
  'policy_brief',          -- 10-20 pages, structural-level recommendation
  'argument_map',          -- full argument tree for a contested question
  'solution_inventory',    -- comparative analysis of tried interventions
  'root_cause_analysis',   -- Five Whys protocol output
  'prediction_log',        -- running log of banked predictions
  'book_chapter',          -- part of a book-length work
  'investigation_note'     -- shorter, faster, single-claim or single-event
);
```

Each type has distinct format, length expectations, and publication discipline.

---

## 4. THE SOLUTION INVENTORY PRIMITIVE

Before proposing anything new, CANOPTICON maps what has already been tried. This is a discipline against the dominant pattern in policy discourse, where proponents and critics each cite their preferred jurisdictions selectively without ever assembling the comparative map.

### 4.1 Solution inventory structure

For every major policy question the system investigates, it builds a solution inventory:

```
SOLUTION:           [Name of intervention]
TRIED WHERE:        [Jurisdictions]
TRIED WHEN:         [Date ranges]
CONDITIONS:         [Context — population size, legal framework, funding,
                     accompanying policies, political environment]
RESULTS:            [What measurably happened]
WHY IT WORKED:      [If it did — specific mechanism that produced the result]
WHY IT FAILED:      [If it did — specific mechanism of failure, not just outcome]
EXPORTABILITY:      [Which conditions are necessary vs. sufficient for replication]
PROPONENTS CLAIM:   [Their strongest argument]
CRITICS CLAIM:      [Their strongest argument]
REAL DISAGREEMENT:  [The actual empirical or values dispute once surface
                     arguments are stripped]
```

### 4.2 Worked example — safe supply

Proponents cite Switzerland, Portugal, parts of British Columbia. Critics cite Vancouver's Downtown Eastside and Australian results. Both use real data selectively.

The solution inventory asks: what were the structural differences between successful and unsuccessful implementations? What conditions are necessary? What conditions are sufficient? Where precisely does the mechanism break?

This map does not exist publicly in navigable form. CANOPTICON builds it for every major contested policy question it investigates. **That map is the contribution** — not another hot take in the existing debate.

### 4.3 Substrate

```sql
CREATE TABLE public.solution_inventories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  domain TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.solution_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.solution_inventories(id) ON DELETE CASCADE,
  solution_name TEXT NOT NULL,
  intervention_level TEXT NOT NULL CHECK (intervention_level IN ('symptom', 'mechanism', 'structural')),
  jurisdictions TEXT[] NOT NULL DEFAULT '{}',
  date_range_start DATE,
  date_range_end DATE,
  conditions TEXT NOT NULL,
  results TEXT NOT NULL,
  why_it_worked TEXT,
  why_it_failed TEXT,
  exportability TEXT,
  proponents_claim TEXT,
  critics_claim TEXT,
  real_disagreement TEXT NOT NULL,
  supporting_claim_ids UUID[] DEFAULT '{}',
  supporting_source_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

A new role, `solution_inventory_builder`, is added to the role catalog. It pulls from the substrate's claim graph plus operator-provided research briefs, queries the web for jurisdiction-specific implementations, and produces solution_entries with full provenance. Cost-gated.

---

## 5. THE ARGUMENT MAP / FULL ARGUMENT TREE

What X and similar platforms reveal about political argument is that it has collapsed to bumper-sticker level. Every argument reduces to its shortest, most emotional form. The medium rewards speed over depth.

CANOPTICON builds the opposite: the full argument tree.

### 5.1 The six layers of an argument

For every contested question, the system maps:

**Layer 1 — Surface.** What people actually argue about. The bumper-sticker level.

**Layer 2 — Supporting evidence.** What each side relies on. The citations, the studies, the cases.

**Layer 3 — Logical dependencies.** What has to be true for the surface claim to hold. The premises.

**Layer 4 — Empirical disputes.** Where facts are actually contested. The genuine empirical questions.

**Layer 5 — Values disputes.** Where people hold different priors that evidence alone cannot resolve. The genuine value-laden questions.

**Layer 6 — Meta-dispute.** Why this argument keeps recurring without resolution. What structural incentive keeps each side on their script. The propagation analysis.

### 5.2 Distinct from the four-layer topic template

The four-layer template (Factual / Framing / Architectural / Distributive — see `canopticon-thinking.md` §3) decomposes a *topic*. The six-layer argument tree decomposes an *argument*. They are different analytical lenses applied at different stages: the four-layer template guides claim collection at the substrate level; the six-layer argument tree guides argument analysis at the output level.

Both are operative. A thesis at maturity has both: claims layered factually/framing/architecturally/distributively across the substrate, and arguments mapped across the six layers when the thesis enters argument-map output.

### 5.3 The argument-tree insight

The argument tree makes visible what surface debate conceals:

- Most arguments are fought at Layer 1 while the real disagreement is at Layer 4 or 5
- Many apparent factual disputes are actually values disputes in disguise
- Many apparent values disputes have resolvable empirical components that neither side has actually investigated
- Layer 6 — the meta-dispute — is rarely surfaced in public debate but is often where the actual stalemate lives

### 5.4 The predictability signal

When arguments are predictable — when you can anticipate what the next person will say before they say it — that is a signal they are operating from a script rather than from genuine engagement with evidence. Scripts propagate from institutional sources: think tanks, party communications teams, media framing, foundation-funded advocacy.

CANOPTICON's forensic layer maps the propagation. The genealogy of framings (§6) is how this gets surfaced.

### 5.5 Substrate

```sql
CREATE TABLE public.argument_maps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  domain TEXT NOT NULL,
  argument_tree JSONB NOT NULL,
    -- Structure:
    -- {
    --   layer_1_surface:        { pro: [], con: [] },
    --   layer_2_evidence:       { pro: [], con: [] },
    --   layer_3_dependencies:   { pro: [], con: [] },
    --   layer_4_empirical:      [{ dispute, pro_position, con_position, resolution_path }],
    --   layer_5_values:         [{ dispute, pro_value, con_value }],
    --   layer_6_meta:           { why_unresolved, incentive_structure, dominant_frame_holders }
    -- }
  root_causes TEXT[] NOT NULL DEFAULT '{}',
  symptom_level_interventions TEXT[] DEFAULT '{}',
  mechanism_level_interventions TEXT[] DEFAULT '{}',
  structural_level_interventions TEXT[] DEFAULT '{}',
  related_thesis_ids UUID[] DEFAULT '{}',
  related_solution_inventory_id UUID REFERENCES public.solution_inventories(id),
  related_genealogy_id UUID,
  status TEXT NOT NULL DEFAULT 'in_progress',
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

A new role, `argument_mapper`, is added to the role catalog. It takes a contested question plus relevant claim subgraph plus operator-provided evidence plus genealogy data and produces the six-layer tree. The role explicitly distinguishes between empirical and values disputes (Layers 4 and 5) and refuses to collapse one into the other.

---

## 6. ARGUMENT GENEALOGY

The intellectual supply chain of public arguments. Mapping it is not conspiracy thinking — it is legitimate structural analysis of how ideas move through political ecosystems.

### 6.1 Genealogy questions

For every dominant frame in a contested question, CANOPTICON's forensic layer asks:

- When did this specific framing first appear in public discourse?
- Who introduced it?
- Which organizations amplified it?
- Who funds those organizations?
- What is the material interest of the funders in this framing prevailing?

### 6.2 Worked example — fiscal responsibility framing

A genealogy of "fiscal responsibility" applied to social spending might trace:

- First appearance in current form: 1970s, US conservative think tanks
- Introduced by: specific foundations and operatives, named
- Amplified by: business-press editorial pages, named
- Funders: corporate interests with material stake in low corporate taxation
- Material interest: lower social spending → lower tax revenues required → political space for lower corporate taxation

This is not innuendo. It is structural analysis with named entities, dates, dollar amounts, and documented funding relationships. The genealogy is auditable.

### 6.3 Substrate

```sql
CREATE TABLE public.frame_genealogies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  frame_text TEXT NOT NULL,
    -- The framing being traced (e.g., "the housing crisis is a supply problem")
  domain TEXT NOT NULL,
  first_appeared DATE,
  first_appearance_source_id UUID REFERENCES public.sources(id),
  introduced_by_entity_ids UUID[] DEFAULT '{}',
  amplified_by_entity_ids UUID[] DEFAULT '{}',
  funder_entity_ids UUID[] DEFAULT '{}',
  funder_material_interest TEXT,
  propagation_timeline JSONB,
    -- Array of { date, event, source_id, entity_ids[] }
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

A new role, `genealogy_tracer`, traces frame propagation through the substrate. It uses the entity graph (organizations, funders, media outlets, think tanks) plus the source registry (when claims first appeared) to build the timeline. Cost-gated; uses web search and database queries against external corporate-disclosure databases when available.

---

## 7. THE UNDISMISSABILITY ARCHITECTURE

For CANOPTICON's intellectual output to change the conversation rather than add to the noise, every published thesis must satisfy seven requirements. These are not aspirational. They are publish-prep checks.

### 7.1 The seven requirements

**1. Evidence density beyond rebuttal capacity.** Primary documents, named entities, specific dates and dollar amounts. Not "the financial sector influenced policy" but "X received contracts totalling $Y in the Z months following the appointment, per filing reference [link]." A critic who wants to dismiss the thesis must engage every named entity, every dated event, every documented amount. The cost of dismissal is made high by design.

**2. Coined vocabulary.** Every landed thesis introduces a phrase that compresses the structural finding into transmissible language. *Manufacturing consent. Power elite. Shock doctrine. Surveillance capitalism.* The phrase travels independently of the full argument; it is the analytical compression that lets the structural insight propagate without losing its shape. This is not marketing — it is part of the analytical work. A thesis without a coined phrase has not yet finished compressing its insight.

**3. Banked predictions.** Every published thesis includes 3-5 explicit probabilistic predictions with time horizons. These are logged in the substrate's `predictions` table and tracked publicly on the prediction ledger. Over time, a track record of calibrated predictions is the most durable form of credibility. The Brier score is published.

**4. Teachable diagram or model.** One visual that encodes the structural argument. A diagram that can be drawn on a whiteboard or shared as an image. This is the artifact that spreads — not the 60-page thesis. It is also the analytical compression test: if the structural argument cannot be drawn, it has not been compressed enough.

**5. Methodology transparency.** Every thesis ships with a methodology appendix: which sources were used, how they were graded, which roles ran on the thesis, what cross-model verification (if any) was performed, what contradictions were considered and why resolved as they were. The transparency is the undismissability moat. Critics cannot dismiss the argument without engaging the evidence trail.

**6. Public graph artifact.** The underlying claim subgraph is exported and queryable at a stable URL. Proves the evidence exists. Makes rebuttal expensive. Invites collaboration. The reader who suspects the thesis is wrong can audit the graph directly.

**7. Named human accountability.** Every output has a named human editor accountable under COPE authorship standards. Never just "CANOPTICON." The human spine makes the AI instrumentation defensible. The byline is real. The track record accumulates against the named human, not against an anonymous system.

### 7.2 Publish-prep enforcement

The publish-prep workflow (already specified in `canopticon-system.md` §4.3) is extended to enforce the undismissability checks. A thesis cannot reach `is_public = TRUE` if any of:

- Fewer than 3 banked predictions are linked
- No coined phrase is recorded in `theses.coined_phrase`
- No methodology appendix exists in the latest `thesis_versions.tier_full`
- No teachable diagram is linked (`theses.diagram_uri` is null)
- No `five_whys_chains` row with `reached_root = TRUE` exists
- The named operator is not declared
- The graph artifact export endpoint is not wired

Operator override is possible but logged with reason in `change_summary`.

---

## 8. THE COINED VOCABULARY DISCIPLINE

Every landed thesis includes a coined phrase as part of the analytical work. The phrase is not optional packaging; it is the compression of a structural insight into transmissible language.

### 8.1 What makes a coined phrase work

- **It names a structural pattern, not an opinion.** "Surveillance capitalism" names a structure (data extraction as the central economic activity); "tech is bad" is an opinion.
- **It is portable.** The phrase travels into uses by other writers, journalists, scholars without losing shape.
- **It compresses, doesn't summarize.** A summary loses information; a compression preserves the structural insight in fewer words.
- **It has a referent the reader can verify.** Not a vibe or a tone — a thing that can be observed, measured, traced.

### 8.2 Substrate

```sql
ALTER TABLE public.theses
  ADD COLUMN coined_phrase TEXT,
  ADD COLUMN coined_phrase_definition TEXT,
  ADD COLUMN coined_phrase_first_uses TEXT[] DEFAULT '{}';
```

Operator declares the coined phrase, its definition, and notes any prior uses (so the operator can confirm originality or explicit re-purposing). The phrase becomes part of the public-facing thesis surface and gets indexed for search.

### 8.3 Worked target

The first major thesis CANOPTICON should produce centers on Canadian monetary architecture. A working coined phrase: *"Monetary infrastructure determines political possibility."* Or shorter: *"The system's design is its policy."* The phrase compresses the thesis's central claim — that distributive outcomes follow from monetary-system design choices, not from the political negotiations the public discourse focuses on.

---

## 9. THE FIRST THESIS TARGET (illustrative)

This section is illustrative. Subject matter and target are operator decisions; the architecture supports any focus. What follows is the working frame for the system's first major thesis as currently scoped.

### 9.1 Working title

*The Architecture of Quiet Power: How Canadian Monetary Design Shapes Political Outcomes.*

### 9.2 Root cause framing

The housing crisis, the bank oligopoly, the conflicts of interest at the top of Canadian financial leadership, the international alignment of Canadian central banking with global financial-sector institutions — these are not separate stories. They are instances of a single structural condition: monetary system design that concentrates credit creation in a small number of institutions, whose interests then shape the political system that is supposed to regulate them.

### 9.3 Layer 6 meta-analysis

Why does this keep recurring without resolution? Because the institutional beneficiaries of the current design fund the think tanks that define "responsible" monetary policy, staff the central banks through revolving doors, and set the terms of the debate before it reaches public discourse. The argument is pre-decided at the infrastructure level.

### 9.4 Key research engagements

The thesis engages with:

- Stefan Eich, *The Currency of Politics* — depoliticization of money
- Christine Desan, *Making Money* — money as constitutional project
- Daniela Gabor — Wall Street Consensus and de-risking
- Benjamin Braun — asset manager capitalism
- Marc Lavoie / Mario Seccareccia — Canadian post-Keynesian school
- Lyn Alden / Jeff Booth — technology deflation versus monetary expansion

Each enters the substrate as a `books` row with `ingest_mode = 'substrate'`; their core claims become substrate claims; the thesis builds on the integrated picture.

### 9.5 The Canadian data layer

The thesis assembles a Canadian-specific data layer that does not currently exist publicly in navigable form:

- Bank of Canada governance evolution since 1974 Bank Act amendments
- CMHC's role in housing-finance capture
- Career trajectories of senior monetary-policy figures (private sector → BoC → international institutions → political appointments)
- Big Five bank ownership concentration and interlocking directorates
- CPP Investment Board connections to political appointees
- BIS coordination and Canadian participation patterns

This data layer, assembled in the substrate, becomes the argument's evidentiary spine.

### 9.6 Coined phrase candidates

*"Monetary infrastructure determines political possibility."*
*"The system's design is its policy."*

The operator selects the phrase that best compresses the thesis's structural insight as the thesis matures.

---

## 10. THE PREDICTION MARKET INTEGRATION

CANOPTICON embeds calibrated forecasts on its own indicators and publishes them publicly. This serves two functions:

**Accountability.** Forces explicit probability assignments rather than vague directional claims. A thesis that says "very likely" with a number behind it is subject to review when the prediction resolves; a thesis that says "obviously" is not.

**Track record.** Over years, a documented Brier score becomes the most durable form of credibility available to an independent intelligence platform. It is a quantitative answer to the question every reader implicitly asks: how often is this person right at the confidence levels they declare?

For each major thesis:
- 3-5 explicit predictions with probabilities and time horizons
- Clear resolution criteria (what observable event confirms or disconfirms)
- Public tracking on the CANOPTICON site
- Annual rolling Brier score published in full, with per-domain and per-horizon breakdowns

The CANOPTICON forecasting track record, accumulated over years, is worth more for credibility than any institutional affiliation. It is the asymptotic statement of how seriously the operator's confidence levels can be taken.

---

## 11. OUTPUT MODES BY DESTINATION

The same substrate produces different output modes for different destinations. The relationship:

- **Intelligence theses** → published as articles on canopticon.com, with full thesis page treatment
- **Policy briefs** → published as articles, plus syndicated as newsletters, plus excerpted in productions
- **Argument maps** → public surfaces on canopticon.com (the contradiction tracker is a special case of this); also basis for video productions (the Studio production engine consumes argument maps as ideation input)
- **Solution inventories** → public pages plus reference material for policy briefs
- **Root cause analyses** → typically not standalone publications; used as evidence in theses and policy briefs
- **Prediction logs** → the prediction ledger surface plus periodic published reviews
- **Book chapters** → assembled into books; published serially during writing as standalone reads
- **Investigation notes** → faster-moving content; X threads, Substack notes, short articles

A single substrate, multiple output modes, each with its own discipline. The operator chooses the mode at thesis-publish time; the system handles the formatting and distribution.

---

## 12. THE CLOSING PRINCIPLE

CANOPTICON's intellectual output is not commentary. It is not journalism. It is not think-tank analysis.

It is **structural diagnosis at the root level**, backed by an evidence graph that makes the argument auditable, with predictions that make it falsifiable, and a methodology that makes it transparent.

The goal is not to win the argument.

The goal is to move the argument to a level where it can be resolved.

Most political arguments are unresolvable because they are being conducted at the wrong level. The contribution is always the same: *here is where the argument actually lives, here is the evidence at that level, here is what would confirm or disconfirm the structural claim, here is what a root-level intervention would look like.*

The system maps. You decide.
