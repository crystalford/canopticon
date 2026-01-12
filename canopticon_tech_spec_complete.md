# CANOPTICON Technical Specification (Complete with Phase 2)

## Database Schema

### Core Tables (Phase 1 - MVP)

```sql
-- Sources table
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'rss' | 'api' | 'social' | 'government'
  category TEXT, -- 'institutional' | 'news' | 'independent'
  priority INTEGER DEFAULT 5, -- 1-10, affects signal scoring
  reliability_score FLOAT DEFAULT 0.5, -- 0-1, affects auto-approval
  active BOOLEAN DEFAULT true,
  
  -- Health monitoring
  last_ingested_at TIMESTAMPTZ,
  last_successful_ingest TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  auto_disabled BOOLEAN DEFAULT false,
  
  -- Configuration
  ingestion_frequency_minutes INTEGER DEFAULT 15,
  auto_flag_keywords TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signals table
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id),
  cluster_id UUID, -- groups duplicate signals
  
  -- Content
  title TEXT NOT NULL,
  content TEXT,
  url TEXT NOT NULL UNIQUE,
  published_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Classification
  signal_type TEXT, -- 'breaking' | 'repetition' | 'contradiction' | 'shift'
  confidence_score FLOAT, -- 0-100
  
  -- State
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'approved' | 'flagged' | 'rejected' | 'archived'
  
  -- Metadata
  metadata JSONB, -- entities, sentiment, etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Articles table (published output)
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES signals(id),
  cluster_id UUID, -- if merged from multiple signals
  
  -- Content
  slug TEXT UNIQUE NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  generated_content JSONB, -- x_thread, youtube_script, tiktok_caption
  sources JSONB, -- array of source URLs
  
  -- Publishing
  tier TEXT NOT NULL, -- 'curated' | 'archive'
  published_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Video
  video_status TEXT DEFAULT 'none',
  -- 'none' | 'script_ready' | 'in_progress' | 'published'
  video_url TEXT,
  
  -- Analytics
  view_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video materials table
CREATE TABLE video_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id),
  
  -- Generated content
  script TEXT,
  quotes JSONB, -- [{text, attribution, timestamp, source_url}]
  contradictions JSONB, -- [{claim, counter_claim, evidence}]
  angles JSONB, -- [string] suggested framings
  
  -- Export
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  exported BOOLEAN DEFAULT false,
  export_format TEXT -- 'markdown' | 'json' | 'notebooklm'
);

-- Audit log (editorial overrides)
CREATE TABLE editorial_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES signals(id),
  article_id UUID REFERENCES articles(id),
  
  action_type TEXT NOT NULL,
  -- 'manual_approve' | 'manual_flag' | 'tier_change' | 'cluster_merge' | 'cluster_split'
  
  from_state TEXT,
  to_state TEXT,
  reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content lifecycle tracking
CREATE TABLE content_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES signals(id),
  article_id UUID REFERENCES articles(id),
  
  lifecycle_event TEXT NOT NULL,
  -- 'created' | 'approved' | 'published' | 'archived' | 'expired'
  
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Phase 2 Tables (Analysis Layer - "Canopticonned" Feature)

```sql
-- Article analysis table
CREATE TABLE article_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) UNIQUE,
  
  -- Analysis status
  analysis_status TEXT DEFAULT 'pending',
  -- 'pending' | 'in_progress' | 'complete' | 'failed'
  
  -- Bias detection
  bias_lean TEXT, -- 'left' | 'center' | 'right' | 'unknown'
  bias_confidence FLOAT, -- 0-1
  bias_indicators JSONB,
  /* Example structure:
  {
    "word_choices": ["slammed", "devastating", "heroes"],
    "framing": "Emphasizes victims, omits counterarguments",
    "sources_cited": "Only progressive voices quoted",
    "emotional_tone": "fear-based"
  }
  */
  
  -- Rhetorical tactics
  emotional_appeals JSONB,
  /* Example:
  {
    "fear": true,
    "anger": true,
    "hope": false,
    "evidence": ["devastating impact", "families will suffer"]
  }
  */
  loaded_language TEXT[], -- ["slammed", "shocking", "devastating"]
  framing_analysis TEXT, -- What's emphasized vs buried
  
  -- Logical fallacies (PRIMARY DIFFERENTIATOR - SHIP THIS FIRST)
  fallacies_detected JSONB,
  /* Example:
  [
    {
      "type": "ad_hominem",
      "quote": "Critics are just corporate shills",
      "explanation": "Attacks character rather than addressing argument",
      "severity": "high"
    },
    {
      "type": "false_dichotomy",
      "quote": "Either support this bill or you don't care about families",
      "explanation": "Presents only two options when multiple exist",
      "severity": "medium"
    },
    {
      "type": "strawman",
      "quote": "Opponents want to destroy the economy",
      "explanation": "Misrepresents actual position of critics",
      "severity": "high"
    },
    {
      "type": "appeal_to_authority",
      "quote": "Experts say this is necessary",
      "explanation": "No specific experts named, no evidence provided",
      "severity": "medium"
    },
    {
      "type": "slippery_slope",
      "quote": "If we allow this, next they'll ban all housing",
      "explanation": "Assumes extreme outcome without evidence",
      "severity": "low"
    }
  ]
  */
  fallacy_count INTEGER DEFAULT 0,
  fallacy_score INTEGER, -- 0-100, weighted by severity (high=10, med=5, low=2)
  
  -- Fact vs opinion separation
  factual_claims JSONB,
  /* Example:
  [
    {
      "claim": "Bill C-47 was tabled on January 12",
      "verifiable": true,
      "source": "Parliament Hansard",
      "verification_url": "openparliament.ca/..."
    },
    {
      "claim": "This will destroy the economy",
      "verifiable": false,
      "note": "Speculative opinion, no supporting data"
    }
  ]
  */
  opinion_statements TEXT[],
  fact_to_opinion_ratio FLOAT, -- Higher = more factual (facts / total_statements)
  
  -- Synthesis (the "neutral take")
  neutral_summary TEXT, -- Stripped of adjectives and framing
  left_perspective TEXT, -- What left-leaning sources emphasize
  right_perspective TEXT, -- What right-leaning sources emphasize
  consensus_points TEXT[], -- What both sides agree on
  disputed_points TEXT[], -- What's actually in dispute
  
  -- Source quality indicators
  sources_diversity_score FLOAT, -- 0-1, are multiple perspectives cited?
  sources_original_vs_secondary TEXT, -- 'mostly_original' | 'mixed' | 'mostly_secondary'
  
  -- Metadata
  analysis_version TEXT DEFAULT '1.0', -- Track prompt versions
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  regenerated_count INTEGER DEFAULT 0,
  human_verified BOOLEAN DEFAULT false, -- Can manually verify/correct analysis
  verification_notes TEXT
);

-- Fallacy taxonomy table (reference data)
CREATE TABLE fallacy_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  category TEXT, -- 'relevance' | 'presumption' | 'ambiguity'
  definition TEXT NOT NULL,
  detection_prompt TEXT, -- AI prompt snippet for detecting this specific fallacy
  severity_weight INTEGER DEFAULT 1, -- For calculating fallacy_score (high=10, med=5, low=2)
  
  -- Examples for training/testing
  examples JSONB,
  /* Example:
  [
    {
      "text": "You can't trust his climate position, he drives an SUV",
      "explanation": "Attacks character rather than addressing argument"
    }
  ]
  */
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bias training data (for improving detection over time)
CREATE TABLE bias_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id),
  human_labeled_bias TEXT, -- 'left' | 'center' | 'right'
  ai_predicted_bias TEXT,
  accuracy BOOLEAN, -- Did AI get it right?
  correction_notes TEXT,
  labeled_by TEXT, -- Username
  labeled_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Indexes

```sql
-- Phase 1 indexes
CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_cluster ON signals(cluster_id);
CREATE INDEX idx_signals_published_at ON signals(published_at DESC);
CREATE INDEX idx_articles_tier ON articles(tier);
CREATE INDEX idx_articles_video_status ON articles(video_status);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_sources_active ON sources(active);

-- Phase 2 indexes
CREATE INDEX idx_article_analysis_status ON article_analysis(analysis_status);
CREATE INDEX idx_article_analysis_fallacy_count ON article_analysis(fallacy_count DESC);
CREATE INDEX idx_article_analysis_fallacy_score ON article_analysis(fallacy_score DESC);
CREATE INDEX idx_article_analysis_bias_lean ON article_analysis(bias_lean);
CREATE INDEX idx_article_analysis_fact_ratio ON article_analysis(fact_to_opinion_ratio DESC);
```

---

## State Machine

### Signal States
```
PENDING (initial state)
  ↓
  → [auto-approve if confidence > threshold] → APPROVED
  → [manual flag] → FLAGGED  
  → [manual reject] → REJECTED
  
APPROVED
  → [publish to archive tier] → creates Article (tier: archive)
  → [can still be flagged] → FLAGGED
  
FLAGGED
  → [publish to curated tier] → creates Article (tier: curated) + VideoMaterial
  → [unflag] → APPROVED
  
REJECTED
  → [manual re-review] → PENDING
  
ARCHIVED
  → (terminal state, for old signals no longer relevant)
```

### Article States
```
Articles don't have states - they're snapshots
tier: curated vs archive is the only distinction
video_status changes: none → script_ready → in_progress → published
```

### Analysis Generation Flow (Phase 2)
```
Article published → article_analysis record created → analysis_status: 'pending'
  ↓
[Background job] Analysis generation starts → analysis_status: 'in_progress'
  ↓
Analysis complete → analysis_status: 'complete'
  ↓
[Optional] Human verification → human_verified: true
  ↓
[Optional] Regenerate with better prompt → regenerated_count++
```

---

## Critical Rules

### Deduplication
- Signals with >70% title similarity AND within 6 hours = same cluster
- Clustered signals share one cluster_id
- When published, Article.sources includes ALL signal URLs in cluster
- You see clusters as single items in dashboard, can expand to see individual signals

### Auto-Approval Threshold
- confidence_score > 75 AND source.reliability_score > 0.7 → auto-approve to APPROVED
- Everything else stays PENDING for your review

### Publishing Logic
- APPROVED signals → Article (tier: archive) published immediately
- FLAGGED signals → Article (tier: curated) + VideoMaterial generated
- Curated articles appear on homepage
- Archive articles only in /archive feed and search

### Quality Gates (blocks auto-approval)
- content length < 100 chars → stays PENDING
- confidence_score < 30 → auto-REJECTED
- source.active = false → don't ingest

### Analysis Generation (Phase 2)
- Runs AFTER article is published (async background job, doesn't block publishing)
- Fallacy detection runs first (fastest, most valuable, ships in Phase 2.1)
- Full analysis runs on curated tier by default
- Archive tier gets analysis on-demand (user clicks "Analyze") or batch overnight
- Can be regenerated if results are poor
- Human verification available for training/correction

---

## Phase 2 Implementation Strategy

### The Rollout Plan

**Phase 1 (Weeks 1-2): Core CANOPTICON MVP**
- ✅ Ingestion engine working
- ✅ Signal review workflow
- ✅ Auto-publishing to archive
- ✅ Curation interface
- ✅ Video materials export
- ✅ Basic frontend website
- **Goal:** Validate you'll actually use this daily

**Phase 2.1 (Week 3): Fallacy Detection Only**
- ✅ Add `article_analysis` table (just fallacy-related fields initially)
- ✅ Build fallacy detection prompt
- ✅ Add "Run Fallacy Check" button to article pages
- ✅ Display results in simple card UI
- ✅ Test on 20-30 real articles
- ✅ Tune prompt based on accuracy
- **Goal:** Prove the analysis concept works

**Phase 2.2 (Week 4): Auto-Analysis for Curated**
- ✅ Run fallacy detection automatically on curated tier articles
- ✅ Show fallacy count badge on homepage
- ✅ Create "Most Fallacious Articles" feed
- ✅ Add social sharing: "This article has 5 logical fallacies"
- **Goal:** Create viral/shareable content

**Phase 2.3 (Weeks 5-6): Expand Analysis**
- ✅ Add bias detection
- ✅ Add rhetorical tactics detection
- ✅ Add fact vs opinion separation
- ✅ Build comprehensive analysis view
- **Goal:** Full "Canopticonned" feature set

**Phase 2.4 (Weeks 7-8): Synthesis Layer**
- ✅ Generate neutral summaries
- ✅ Extract left/right perspectives
- ✅ Identify consensus vs disputed points
- ✅ Create "Both Sides" view
- **Goal:** Become the go-to for understanding political stories

---

## Fallacy Detection Prompt (Phase 2.1)

```markdown
You are analyzing political content for logical fallacies. Be precise and rigorous - only flag clear instances with strong evidence.

Content to analyze:
---
Title: {ARTICLE_TITLE}
Content: {ARTICLE_CONTENT}
---

Detect and extract the following fallacies:

1. **Ad Hominem**: Attacking the person instead of addressing their argument
   Example: "You can't trust her opinion, she's biased"

2. **Strawman**: Misrepresenting an opponent's position to make it easier to attack
   Example: "He wants to regulate emissions, so he must want to ban all cars"

3. **False Dichotomy**: Presenting only two options when more exist
   Example: "Either support this bill or you don't care about families"

4. **Appeal to Authority**: Citing authority figures without evidence or reasoning
   Example: "Experts say this is necessary" (no experts named)

5. **Slippery Slope**: Claiming a small action will inevitably lead to extreme consequences
   Example: "If we allow this, next they'll ban all housing"

6. **Red Herring**: Introducing irrelevant information to distract from the main argument
   Example: Discussing politician's personal life when debating policy

7. **Hasty Generalization**: Drawing sweeping conclusions from insufficient evidence
   Example: "Three businesses failed, so this policy doesn't work"

8. **Post Hoc Ergo Propter Hoc**: Assuming causation from mere correlation
   Example: "Unemployment fell after the election, so the new government caused it"

9. **Appeal to Emotion**: Using emotional manipulation instead of logical reasoning
   Example: "Think of the children!" without explaining actual impact

10. **Tu Quoque**: Dismissing criticism by pointing out hypocrisy ("you too")
    Example: "You criticize emissions but you fly on planes"

For each fallacy found:
- Extract the exact quote from the article
- Explain specifically why it's fallacious
- Assess severity:
  - **low**: Weak or borderline fallacy
  - **medium**: Clear fallacy but not egregious
  - **high**: Severe logical error that undermines argument

IMPORTANT: Be conservative. False positives damage credibility. Only flag obvious instances with clear evidence.

Output as JSON array:
```json
[
  {
    "type": "ad_hominem",
    "quote": "exact quote from article",
    "explanation": "specific explanation of why this is fallacious",
    "severity": "high"
  }
]
```

If no fallacies are detected, return an empty array: []
```

---

## UI Additions for Phase 2

### Article Detail Page - Analysis Section (Phase 2.1 - Fallacy Detection)

```
┌─────────────────────────────────────────────────────────────┐
│ Poilievre proposes housing acceleration bill               │
│ Published: 2 hours ago • Parliament • 4 sources            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [Article content here...]                                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ⚠️ LOGICAL FALLACIES DETECTED (3)    [Regenerate Analysis] │
│ ════════════════════════════════════                        │
│                                                             │
│ ❌ Ad Hominem (HIGH SEVERITY)                               │
│ "Critics are just corporate shills who profit from the     │
│ housing crisis."                                            │
│                                                             │
│ Why this is fallacious: Attacks the character of critics   │
│ rather than addressing their actual arguments about the    │
│ bill's constitutional issues.                               │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ ⚠️  False Dichotomy (MEDIUM SEVERITY)                       │
│ "Either we pass this bill or we accept families will       │
│ never afford homes."                                        │
│                                                             │
│ Why this is fallacious: Presents only two options when     │
│ multiple housing policy approaches exist. Oversimplifies   │
│ complex policy landscape.                                   │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ ⚠️  Appeal to Emotion (MEDIUM SEVERITY)                     │
│ "Think of young families struggling to find homes - how    │
│ can anyone oppose this?"                                    │
│                                                             │
│ Why this is fallacious: Uses emotional appeal without      │
│ addressing practical concerns about federal overreach or   │
│ implementation challenges.                                  │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│ Fallacy Score: 75/100 (Higher = More Fallacious)           │
│                                                             │
│ [Share this analysis] [Report incorrect analysis]          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Homepage - Fallacy Badge (Phase 2.2)

```
┌─────────────────────────────────────────────────────────────┐
│ LATEST CURATED STORIES                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ⭐ Poilievre proposes housing acceleration bill             │
│ 🏛️ Parliament • 2h ago • [🎬 Video attached]               │
│ ⚠️  3 fallacies detected                                    │
│ [Read →]                                                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ⭐ Trudeau statement on inflation contradicts budget        │
│ 📰 CBC • 4h ago                                             │
│ ⚠️  5 fallacies detected                                    │
│ [Read →]                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### New Page: Most Fallacious (Phase 2.2)

**URL:** `/fallacies`

```
┌─────────────────────────────────────────────────────────────┐
│ MOST FALLACIOUS POLITICAL COVERAGE                          │
│ Stories with the most logical fallacies this week           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ #1 ⚠️⚠️⚠️ (95/100)                                          │
│ "Liberal housing plan will destroy Canada"                  │
│ National Post • 12 fallacies detected                       │
│ Most common: Slippery slope, ad hominem, false dichotomy    │
│ [Read Analysis →]                                           │
│                                                             │
│ #2 ⚠️⚠️⚠️ (87/100)                                          │
│ "Conservatives hate the environment"                        │
│ Toronto Star • 9 fallacies detected                         │
│ Most common: Strawman, hasty generalization                 │
│ [Read Analysis →]                                           │
│                                                             │
│ #3 ⚠️⚠️ (75/100)                                            │
│ "Poilievre housing bill faces criticism"                    │
│ Globe and Mail • 3 fallacies detected                       │
│ Most common: Ad hominem, false dichotomy                    │
│ [Read Analysis →]                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Article Detail Page - Full Analysis (Phase 2.3-2.4)

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 CANOPTICON ANALYSIS                  [Regenerate] [Edit] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ BIAS INDICATOR                                              │
│ [████░░░░░░] 40% Left-leaning (Confidence: 82%)             │
│                                                             │
│ Why this leans left:                                        │
│ • Word choices: "devastating," "victims," "heroes"          │
│ • Framing: Emphasizes impact on families, minimizes        │
│   constitutional concerns                                   │
│ • Sources: Only quotes progressive housing advocates        │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ RHETORICAL TACTICS DETECTED                                 │
│ ⚠️  Emotional appeals: Fear-based framing                   │
│ ⚠️  Loaded language: "slammed," "shocking," "devastating"   │
│ ⚠️  Cherry-picked sources: No opposition voices included    │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ ⚠️ LOGICAL FALLACIES (3) - Fallacy Score: 75/100           │
│ [See fallacies above]                                       │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ FACT VS OPINION                                             │
│ Fact-to-Opinion Ratio: 65% (Higher = More Factual)         │
│                                                             │
│ Verifiable Facts (5):                                       │
│ ✓ Bill C-47 was tabled on January 12                       │
│ ✓ Bill proposes federal override of municipal zoning       │
│ ✓ Liberal Housing Minister issued statement                │
│ ✓ Vote scheduled for next week                             │
│ ✓ Similar bill proposed in 2019 but failed                 │
│                                                             │
│ Opinion Statements (3):                                     │
│ ⚪ "This will destroy the economy" - Unverified claim       │
│ ⚪ "Municipal control is sacred" - Value judgment           │
│ ⚪ "Housing crisis requires federal action" - Opinion       │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ THE NEUTRAL TAKE                                            │
│ Pierre Poilievre tabled Bill C-47, which would allow       │
│ federal government to override municipal zoning             │
│ restrictions in certain circumstances. Liberal Housing      │
│ Minister Sean Fraser expressed concerns about federal       │
│ overreach. NDP Leader Jagmeet Singh questioned              │
│ constitutionality. Vote expected next week.                 │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ BOTH SIDES                                                  │
│                                                             │
│ Left Perspective:                                           │
│ • Federal intervention necessary due to crisis severity     │
│ • Municipal zoning creates artificial scarcity             │
│ • Housing is a human right requiring national action       │
│                                                             │
│ Right Perspective:                                          │
│ • Municipalities should control local planning              │
│ • Federal overreach threatens provincial jurisdiction      │
│ • Market solutions preferable to government mandates        │
│                                                             │
│ What Both Sides Agree On:                                   │
│ • Housing affordability is a major crisis                   │
│ • Current system isn't working effectively                  │
│                                                             │
│ What's Actually in Dispute:                                 │
│ • Whether federal government should override municipalities │
│ • Constitutional division of powers                         │
│ • Best mechanism to increase housing supply                 │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ SOURCE QUALITY                                              │
│ Diversity Score: 4/10 (Low - limited perspectives)         │
│ Source Type: Mostly secondary (news aggregation)            │
│                                                             │
│ Suggestions for better coverage:                            │
│ • Include constitutional law experts                        │
│ • Quote municipal officials directly                        │
│ • Reference similar policies in other jurisdictions        │
│                                                             │
│ [Share this analysis] [Report issue] [Suggest improvement] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 1: Core CANOPTICON (Weeks 1-2)
- [ ] Database migration from current prototype to new schema
- [ ] Source health monitoring
- [ ] Signal review interface per wireframes
- [ ] Auto-approval logic
- [ ] Video materials export (markdown format)
- [ ] Basic frontend (homepage, article pages, archive)
- [ ] Content lifecycle (48hr auto-archive)

### Phase 2.1: Fallacy Detection (Week 3)
- [ ] Add article_analysis table
- [ ] Build fallacy detection prompt
- [ ] Add "Run Fallacy Check" button to articles
- [ ] Display fallacy results in card UI
- [ ] Test on 20-30 articles, tune prompt
- [ ] Add fallacy_types reference table
- [ ] Seed with 10 fallacy definitions

### Phase 2.2: Auto-Analysis (Week 4)
- [ ] Run fallacy detection on curated articles automatically
- [ ] Add fallacy badge to homepage
- [ ] Build "Most Fallacious" page
- [ ] Add social sharing for fallacy count
- [ ] Performance monitoring (API costs)

### Phase 2.3: Expand Analysis (Weeks 5-6)
- [ ] Add bias detection prompt
- [ ] Add rhetorical tactics detection
- [ ] Add fact vs opinion separation
- [ ] Build comprehensive analysis view
- [ ] Add regenerate analysis button

### Phase 2.4: Synthesis (Weeks 7-8)
- [ ] Generate neutral summaries
- [ ] Extract perspectives (left/right)
- [ ] Identify consensus vs disputed points
- [ ] Build "Both Sides" view
- [ ] Add source quality scoring

### Phase 3: Social Monitoring & Real-Time Response (Weeks 5-6)
- [ ] Add monitored_accounts table
- [ ] Add social_posts table
- [ ] Twitter API integration (polling or streaming)
- [ ] Ingest posts from monitored accounts
- [ ] Run fallacy detection on ingested posts
- [ ] Generate response suggestions
- [ ] Build "Ready to Post" dashboard widget
- [ ] Manual review → publish flow
- [ ] Response performance tracking
- [ ] "Fastest Responses" leaderboard
- [ ] "Hall of Shame" page (highest fallacy accounts)

### Phase 4: Refinement (Ongoing)
- [ ] Human verification system
- [ ] Bias training data collection
- [ ] Prompt version tracking
- [ ] A/B testing different prompts
- [ ] Analytics on analysis accuracy
- [ ] User feedback on analysis quality
- [ ] Auto-response mode (trusted accounts only)

---

## Phase 3 Detailed Specification: Real-Time Social Monitoring

### The Concept

**Real-time fallacy sniper system** - Monitor specific political accounts, detect fallacies the moment they post, generate instant rebuttals, and be the first responder with receipts.

**Goal:** Respond to fallacious political posts within 60 seconds with fact-checked analysis.

### Additional Database Tables

```sql
-- Monitored accounts (political figures/accounts to track)
CREATE TABLE monitored_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL, -- 'twitter' | 'tiktok' | 'youtube'
  account_handle TEXT NOT NULL, -- '@liberal_logic_2024'
  account_name TEXT,
  account_url TEXT,
  
  -- Monitoring configuration
  monitoring_reason TEXT, -- 'high_fallacy_rate' | 'influential' | 'manual_add'
  priority INTEGER DEFAULT 5, -- 1-10, affects response speed
  auto_respond BOOLEAN DEFAULT false, -- Auto-post or require manual review?
  
  -- Statistics
  posts_monitored INTEGER DEFAULT 0,
  fallacies_detected INTEGER DEFAULT 0,
  avg_fallacy_rate FLOAT, -- Percentage of posts with fallacies
  responses_generated INTEGER DEFAULT 0,
  responses_posted INTEGER DEFAULT 0,
  avg_response_time_seconds INTEGER,
  
  -- Status
  active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by TEXT -- username who added this account
);

-- Social media posts from monitored accounts
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_account_id UUID REFERENCES monitored_accounts(id),
  
  -- Post details
  platform TEXT NOT NULL,
  post_id TEXT NOT NULL, -- Platform-specific ID
  post_url TEXT UNIQUE NOT NULL,
  post_text TEXT NOT NULL,
  post_timestamp TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Media/attachments
  has_media BOOLEAN DEFAULT false,
  media_urls TEXT[],
  
  -- Analysis (runs immediately on ingest)
  analysis_status TEXT DEFAULT 'pending',
  -- 'pending' | 'analyzing' | 'complete' | 'failed'
  fallacies_detected JSONB,
  fallacy_count INTEGER DEFAULT 0,
  fallacy_score INTEGER DEFAULT 0,
  
  -- Response generation
  response_status TEXT DEFAULT 'pending',
  -- 'pending' | 'generated' | 'review' | 'posted' | 'skipped'
  generated_response TEXT,
  response_type TEXT, -- 'reply' | 'quote_tweet' | 'skip'
  response_posted_at TIMESTAMPTZ,
  response_url TEXT,
  response_post_id TEXT,
  
  -- Performance metrics
  response_time_seconds INTEGER, -- Time from their post to your response
  first_responder BOOLEAN, -- Were you first to call out fallacy?
  engagement JSONB,
  /* Example:
  {
    "likes": 234,
    "retweets": 67,
    "replies": 12,
    "views": 4500
  }
  */
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Response templates (optional - pre-written response patterns)
CREATE TABLE response_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fallacy_type TEXT NOT NULL,
  template_text TEXT NOT NULL,
  /* Example templates:
  "Textbook {fallacy_type}. You're {explanation}. Here's why: {link}"
  "{fallacy_type} fallacy detected. {counter_argument}. Full breakdown: {link}"
  */
  usage_count INTEGER DEFAULT 0,
  avg_engagement FLOAT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Phase 3
CREATE INDEX idx_monitored_accounts_active ON monitored_accounts(active);
CREATE INDEX idx_monitored_accounts_priority ON monitored_accounts(priority DESC);
CREATE INDEX idx_social_posts_response_status ON social_posts(response_status);
CREATE INDEX idx_social_posts_ingested_at ON social_posts(ingested_at DESC);
CREATE INDEX idx_social_posts_response_time ON social_posts(response_time_seconds ASC);
CREATE INDEX idx_social_posts_fallacy_count ON social_posts(fallacy_count DESC);
```

### Real-Time Workflow

```
STEP 1: Monitoring (Continuous)
→ Poll monitored accounts every 60 seconds via Twitter API
→ Detect new posts since last check
→ Ingest immediately into social_posts table

STEP 2: Analysis (Instant - <5 seconds)
→ Run fallacy detection on post text
→ Calculate fallacy_score
→ If fallacy_count >= 2 → Trigger response generation

STEP 3: Response Generation (<10 seconds)
→ Generate Twitter-optimized response (280 chars)
→ Include: Fallacy name, brief explanation, link to full analysis
→ Store in generated_response field
→ Status: 'review' (requires your approval)

STEP 4: Dashboard Alert
→ New post appears in "READY TO POST" widget
→ Shows: Original post, fallacies detected, suggested response
→ Actions: Post as reply, Post as quote tweet, Edit, Skip

STEP 5: Posting
→ You click "Post as Reply"
→ System publishes via Twitter API
→ Records response_posted_at, response_url
→ Tracks response_time_seconds (their post → your post)

STEP 6: Performance Tracking
→ Monitor engagement (likes, RTs)
→ Update avg_fallacy_rate for account
→ Track your fastest responses
→ Build "leaderboard" of best dunks
```

**Total time from their post to your response: ~60 seconds**

### Response Generator Prompt

```markdown
You are generating a Twitter response that calls out logical fallacies in a political post.

CONTEXT:
You are responding on behalf of CANOPTICON, a Canadian political analysis platform that detects fallacies and bias in real-time.

ORIGINAL POST:
---
Author: {ACCOUNT_HANDLE}
Platform: {PLATFORM}
Posted: {TIMESTAMP}
Text: {POST_TEXT}
---

FALLACIES DETECTED:
{FALLACY_JSON}
/* Example:
[
  {
    "type": "ad_hominem",
    "quote": "Critics are just corporate shills",
    "explanation": "Attacks character rather than addressing argument",
    "severity": "high"
  },
  {
    "type": "false_dichotomy",
    "quote": "Either support this or you don't care",
    "explanation": "Presents only two options when more exist",
    "severity": "medium"
  }
]
*/

REQUIREMENTS:
1. Under 280 characters (Twitter limit)
2. Lead with the primary fallacy name
3. Brief explanation (1 sentence max)
4. Include link to full analysis: canopticon.ca/f/{POST_ID}
5. Tone: Sharp, precise, intellectually confident but not hostile
6. Optional: Subtle humor if appropriate

GOOD EXAMPLES:
- "Ad hominem fallacy. Attacking the person instead of addressing their actual argument about zoning policy. Full breakdown: canopticon.ca/f/abc123"
- "False dichotomy detected. There are at least 4 other policy approaches you're ignoring here. See the analysis: canopticon.ca/f/abc123"
- "Slippery slope with zero evidence. No data suggests A leads to Z. Here's what actually happens: canopticon.ca/f/abc123"

BAD EXAMPLES (avoid these):
- "You're wrong." (too vague, no substance)
- "This is stupid and you should feel bad." (hostile, unprofessional)
- "Actually, here's a 10-tweet thread explaining why..." (too long, not responsive)

OUTPUT:
Generate ONLY the tweet text. No preamble, no explanation, just the response text ready to post.

Response:
```

### Dashboard Widget: Ready to Post

```
┌─────────────────────────────────────────────────────────────┐
│ ⚡ READY TO POST (3)                      [Settings] [Stats]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🎯 @liberal_logic_2024 • 2 minutes ago • Priority: 10      │
│ ─────────────────────────────────────────────────────────  │
│ THEIR POST:                                                 │
│ "If we allow this housing bill to pass, next thing you    │
│ know they'll be banning all private property ownership!"   │
│                                                             │
│ ⚠️  3 FALLACIES DETECTED (Score: 85/100)                    │
│ • Slippery slope (HIGH)                                     │
│ • False dichotomy (MEDIUM)                                  │
│ • Appeal to emotion (MEDIUM)                                │
│                                                             │
│ YOUR RESPONSE (Generated):                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Slippery slope fallacy. No evidence that zoning reform  │ │
│ │ leads to property bans. Here's what actually happens:   │ │
│ │ canopticon.ca/f/h8k2j9                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Character count: 134/280 ✓                                  │
│                                                             │
│ [📝 Edit Response]                                          │
│ [💬 Post as Reply] [🔁 Post as Quote Tweet] [⏭️  Skip]      │
│                                                             │
│ ⏱️  Response time: 2m 7s • You'd be FIRST responder        │
│ 📊 @liberal_logic_2024 avg engagement: 234 likes, 67 RTs   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🎯 @progressive_takes • 8 minutes ago • Priority: 7        │
│ ─────────────────────────────────────────────────────────  │
│ THEIR POST:                                                 │
│ "Conservatives clearly hate the environment and want to    │
│ destroy the planet for profit."                             │
│                                                             │
│ ⚠️  2 FALLACIES DETECTED (Score: 72/100)                    │
│ • Strawman (HIGH)                                           │
│ • Hasty generalization (MEDIUM)                             │
│                                                             │
│ YOUR RESPONSE (Generated):                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Strawman fallacy. Misrepresenting the actual           │ │
│ │ conservative position on emissions policy. Nuanced      │ │
│ │ breakdown: canopticon.ca/f/p4m8n2                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Character count: 147/280 ✓                                  │
│                                                             │
│ [📝 Edit Response]                                          │
│ [💬 Post as Reply] [🔁 Post as Quote Tweet] [⏭️  Skip]      │
│                                                             │
│ ⏱️  Response time: 8m 42s • Still early, likely first      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🎯 @ndp_housing_now • 15 minutes ago • Priority: 5         │
│ ─────────────────────────────────────────────────────────  │
│ THEIR POST:                                                 │
│ "Everyone knows rent control is the only solution to the   │
│ housing crisis. Any other approach is just helping         │
│ landlords get rich."                                        │
│                                                             │
│ ⚠️  2 FALLACIES DETECTED (Score: 68/100)                    │
│ • False dichotomy (HIGH)                                    │
│ • Appeal to authority (unqualified - "everyone knows")     │
│                                                             │
│ YOUR RESPONSE (Generated):                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ False dichotomy. Multiple housing policy approaches     │ │
│ │ exist beyond rent control. Evidence-based comparison:   │ │
│ │ canopticon.ca/f/r7k3p1                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Character count: 152/280 ✓                                  │
│                                                             │
│ [📝 Edit Response]                                          │
│ [💬 Post as Reply] [🔁 Post as Quote Tweet] [⏭️  Skip]      │
│                                                             │
│ ⏱️  Response time: 15m 23s • Window closing, act fast      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Settings: Monitored Accounts

```
┌─────────────────────────────────────────────────────────────┐
│ MONITORED ACCOUNTS                        [+ Add Account]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Filter: [All] [Twitter] [TikTok] • Sort: [Priority ▼]      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✅ @liberal_logic_2024 (Twitter)                         │ │
│ │    Priority: 10 • Auto-respond: OFF                     │ │
│ │    ─────────────────────────────────────────────────    │ │
│ │    Posts monitored: 47                                  │ │
│ │    Fallacy rate: 72% (34/47 posts)                      │ │
│ │    Responses posted: 12                                 │ │
│ │    Avg response time: 1m 34s                            │ │
│ │    Avg engagement: 289 likes, 73 RTs                    │ │
│ │    ─────────────────────────────────────────────────    │ │
│ │    Last checked: 2 minutes ago                          │ │
│ │    [Edit] [Pause] [View History] [Delete]               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✅ @progressive_takes (Twitter)                          │ │
│ │    Priority: 7 • Auto-respond: OFF                      │ │
│ │    ─────────────────────────────────────────────────    │ │
│ │    Posts monitored: 112                                 │ │
│ │    Fallacy rate: 58% (65/112 posts)                     │ │
│ │    Responses posted: 8                                  │ │
│ │    Avg response time: 2m 47s                            │ │
│ │    Avg engagement: 156 likes, 34 RTs                    │ │
│ │    ─────────────────────────────────────────────────    │ │
│ │    Last checked: 1 minute ago                           │ │
│ │    [Edit] [Pause] [View History] [Delete]               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✅ @ndp_housing_now (Twitter)                            │ │
│ │    Priority: 5 • Auto-respond: OFF                      │ │
│ │    ─────────────────────────────────────────────────    │ │
│ │    Posts monitored: 23                                  │ │
│ │    Fallacy rate: 31% (7/23 posts)                       │ │
│ │    Responses posted: 3                                  │ │
│ │    Avg response time: 4m 12s                            │ │
│ │    Avg engagement: 98 likes, 19 RTs                     │ │
│ │    ─────────────────────────────────────────────────    │ │
│ │    Last checked: 3 minutes ago                          │ │
│ │    [Edit] [Pause] [View History] [Delete]               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ + 7 more accounts                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Add New Monitored Account:
┌─────────────────────────────────────────────────────────────┐
│ Platform: ● Twitter  ○ TikTok  ○ YouTube                    │
│ Account handle: @___________________                        │
│ Priority (1-10): [___]                                      │
│ Reason: [high_fallacy_rate ▼]                              │
│ Auto-respond: ☐ Enable (requires manual approval first)    │
│                                                             │
│ [Add Account] [Cancel]                                      │
└─────────────────────────────────────────────────────────────┘
```

### New Page: Fastest Responses Leaderboard

**URL:** `/leaderboard`

```
┌─────────────────────────────────────────────────────────────┐
│ ⚡ FASTEST FALLACY RESPONSES                                 │
│ Real-time dunks with receipts                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🥇 47 SECONDS • @liberal_logic_2024                         │
│ ─────────────────────────────────────────────────────────  │
│ Their post: "If we allow this, they'll ban all housing!"   │
│ Fallacy: Slippery slope                                     │
│ Your response: "Slippery slope fallacy. No evidence..."    │
│ Engagement: 234 likes • 67 RTs • 12 replies                │
│ [View full exchange →]                                      │
│                                                             │
│ 🥈 1m 12s • @progressive_takes                              │
│ ─────────────────────────────────────────────────────────  │
│ Their post: "Conservatives hate the environment..."        │
│ Fallacy: Strawman                                           │
│ Your response: "Strawman fallacy. Misrepresenting..."      │
│ Engagement: 189 likes • 43 RTs • 8 replies                 │
│ [View full exchange →]                                      │
│                                                             │
│ 🥉 2m 34s • @ndp_housing_now                                │
│ ─────────────────────────────────────────────────────────  │
│ Their post: "Rent control is the only solution..."         │
│ Fallacy: False dichotomy                                    │
│ Your response: "False dichotomy. Multiple approaches..."   │
│ Engagement: 156 likes • 31 RTs • 5 replies                 │
│ [View full exchange →]                                      │
│                                                             │
│ + View all responses this week →                            │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ YOUR STATS THIS WEEK:                                       │
│ • 12 responses posted                                       │
│ • Avg response time: 1m 47s                                 │
│ • First responder: 9/12 times (75%)                         │
│ • Total engagement: 2,347 likes • 523 RTs                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### New Page: Hall of Shame

**URL:** `/hall-of-shame`

```
┌─────────────────────────────────────────────────────────────┐
│ 🏆 HALL OF SHAME                                            │
│ Accounts with the highest fallacy rates                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ #1 @liberal_logic_2024 • Fallacy Rate: 72%                 │
│ ─────────────────────────────────────────────────────────  │
│ Posts analyzed: 47 • Fallacies detected: 34                │
│ Most common: Slippery slope (12), Ad hominem (9)           │
│ Avg fallacy score: 78/100                                   │
│ Recent worst: "If we allow this, they'll ban all housing"  │
│ (3 fallacies, score 94/100)                                 │
│ [View all posts →]                                          │
│                                                             │
│ #2 @progressive_takes • Fallacy Rate: 58%                  │
│ ─────────────────────────────────────────────────────────  │
│ Posts analyzed: 112 • Fallacies detected: 65               │
│ Most common: Strawman (18), Hasty generalization (14)      │
│ Avg fallacy score: 64/100                                   │
│ Recent worst: "Conservatives hate the environment"          │
│ (2 fallacies, score 85/100)                                 │
│ [View all posts →]                                          │
│                                                             │
│ #3 @taxation_is_theft_2024 • Fallacy Rate: 53%             │
│ ─────────────────────────────────────────────────────────  │
│ Posts analyzed: 89 • Fallacies detected: 47                │
│ Most common: False dichotomy (15), Appeal to emotion (11)  │
│ Avg fallacy score: 61/100                                   │
│ Recent worst: "Taxation is literally slavery"               │
│ (4 fallacies, score 91/100)                                 │
│ [View all posts →]                                          │
│                                                             │
│ + View full rankings →                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Twitter API Integration Notes

**Polling Approach (Free tier):**
```javascript
// Check monitored accounts every 60 seconds
async function pollMonitoredAccounts() {
  const accounts = await getActiveMonitoredAccounts();
  
  for (const account of accounts) {
    // Get recent tweets from this account
    const tweets = await twitter.getUserTimeline(account.account_handle, {
      since_id: account.last_tweet_id,
      count: 10
    });
    
    for (const tweet of tweets) {
      // Ingest new tweet
      await ingestSocialPost({
        monitored_account_id: account.id,
        platform: 'twitter',
        post_id: tweet.id_str,
        post_url: `https://twitter.com/${account.account_handle}/status/${tweet.id_str}`,
        post_text: tweet.text,
        post_timestamp: tweet.created_at
      });
      
      // Trigger fallacy analysis
      await analyzeSocialPost(tweet.id);
    }
    
    // Update last_tweet_id
    if (tweets.length > 0) {
      account.last_tweet_id = tweets[0].id_str;
      await saveAccount(account);
    }
  }
}

// Run every 60 seconds
setInterval(pollMonitoredAccounts, 60000);
```

**Response Posting:**
```javascript
async function postResponse(socialPostId, responseType) {
  const post = await getSocialPost(socialPostId);
  
  if (responseType === 'reply') {
    // Post as reply
    const tweet = await twitter.postTweet({
      status: post.generated_response,
      in_reply_to_status_id: post.post_id
    });
    
    // Record response
    await updateSocialPost(socialPostId, {
      response_status: 'posted',
      response_posted_at: new Date(),
      response_url: `https://twitter.com/canopticon/status/${tweet.id_str}`,
      response_post_id: tweet.id_str,
      response_time_seconds: Math.floor(
        (new Date() - post.post_timestamp) / 1000
      )
    });
    
  } else if (responseType === 'quote_tweet') {
    // Post as quote tweet
    const tweet = await twitter.postTweet({
      status: post.generated_response,
      attachment_url: post.post_url
    });
    
    // Record response (same as above)
  }
}
```

---

## Cost Projections

### Phase 1 Costs (Per Month)
- OpenAI API (content generation): ~$30-50
- Twitter API: $100 (if using)
- Hosting: $20-50
- **Total: ~$150-200/month**

### Phase 2 Additional Costs (Per Month)
- Fallacy detection (20 articles/day): ~$10-15
- Full analysis (5 curated/day): ~$20-30
- **Total Phase 1+2: ~$180-245/month**

### Phase 3 Additional Costs (Per Month)
- Twitter API (Basic tier for monitoring): $100
- Response generation (10-20 responses/day): ~$5-10
- Engagement tracking API calls: ~$5
- **Total Phase 1+2+3: ~$290-360/month**

### Cost Optimization Strategies
- Run full analysis only on curated tier
- Cache analysis results (don't regenerate unless explicitly requested)
- Batch overnight analysis for archive tier
- Use GPT-4o-mini for simple tasks (fallacy detection, response generation)
- Use GPT-4o for complex tasks (synthesis, bias detection)
- Poll Twitter every 60s instead of streaming (saves on API tier)

---

## Success Metrics

### Phase 1 Metrics
- Daily active usage (do you check dashboard daily?)
- Signals triaged per day (target: 20-30 in 5 minutes)
- Videos produced per week (target: 3-5)
- Time from flag to video (target: <30 minutes)

### Phase 2 Metrics
- Fallacy detection accuracy (human verification sample)
- Analysis regeneration rate (how often do you regenerate?)
- Social sharing of fallacy content
- Unique visitors to fallacy pages
- Time spent on articles with analysis vs without

### Phase 3 Metrics (Real-Time Response)
- Average response time (target: <2 minutes)
- First responder rate (target: >70%)
- Responses posted per week (target: 10-15)
- Response engagement (likes, RTs per response)
- Monitored account fallacy rates (trending up or down?)
- Traffic from social responses to CANOPTICON site
- Follower growth rate (compound effect of consistent dunking)
- "Tag rate" (how often people tag @canopticon for analysis)

---

## Strategic Positioning with Phase 3

### The Compound Effect of Real-Time Response

**Week 1:**
- 5 fast responses to fallacies
- Gain 200 followers from their followers seeing your responses
- Drive 500 visits to CANOPTICON

**Week 2:**
- 10 responses (you're getting faster)
- Gain 500 followers (network effect kicks in)
- Drive 1,200 visits to CANOPTICON

**Week 4:**
- 15+ responses per week
- People start tagging you: "Hey @canopticon check this out"
- You become the de facto fallacy checker
- Gain 1,000+ followers

**Week 8:**
- Sustained velocity
- Other political accounts follow you
- Media starts noticing/citing you
- "CANOPTICON called out X's fallacies" becomes news

### Brand Evolution

**Phase 1 Only:**
"CANOPTICON - Fast political news aggregation for Canadian politics"

**Phase 1 + Phase 2:**
"CANOPTICON - Political news with bias and fallacy detection"

**Phase 1 + Phase 2 + Phase 3:**
"CANOPTICON - The fastest fallacy detector in Canadian politics. We see the bullshit before you do."

### The Viral Mechanic

**Why real-time response creates viral growth:**

1. **Speed = Authority Signal**
   - Responding in 60 seconds signals competence
   - "How did they spot that so fast?" creates mystique
   - First responder owns the frame

2. **Fallacy Breakdown = Intellectual Authority**
   - You're not just disagreeing, you're teaching logic
   - "Oh I didn't know that was a fallacy" = educational value
   - Receipts with links = credibility

3. **Their Audience Becomes Your Audience**
   - You reply to account with 10K followers
   - Their followers see your response in their feed
   - Curiosity click: "Who is this CANOPTICON?"
   - Follow if they like what they see

4. **The Tag Effect**
   - After seeing you dunk repeatedly, people start tagging you
   - "Yo @canopticon check out this tweet, I think it's a strawman?"
   - You become the arbiter people summon
   - Each tag is free marketing

### Risk Mitigation

**Potential downsides to manage:**

1. **Reply Guy Reputation**
   - Don't respond to EVERY post from monitored accounts
   - Only respond when fallacy_count >= 2 AND severity is medium/high
   - Quality over quantity - 10 devastating dunks > 50 nitpicks

2. **Making Enemies**
   - Some accounts will block you or their followers will attack
   - Strategy: Stay professional, never get emotional
   - Let the logic speak for itself
   - Don't engage with bad-faith replies

3. **Attention Drain**
   - Reviewing responses takes time daily
   - Mitigation: Strict time budget (10 minutes/day max)
   - Auto-skip low-priority accounts
   - Focus on highest-impact responses

4. **API Cost Blowup**
   - Monitor 10-20 accounts max (not 100)
   - Set monthly API budget caps
   - Pause ingestion if costs spike

### When Phase 3 Makes Sense

**Don't build Phase 3 unless:**
- ✅ Phase 1 is working (you use it daily)
- ✅ Phase 2.1 fallacy detection is accurate (>80%)
- ✅ You have $100-150/month for Twitter API
- ✅ You can dedicate 10 minutes/day to reviewing responses

**Build Phase 3 if:**
- You want to grow your social presence fast
- You enjoy dunking on bad arguments
- You have time for daily engagement
- You see this as your differentiated positioning

---

## The Complete Roadmap

**Weeks 1-2: Phase 1 - Core CANOPTICON**
- Get ingestion, curation, video materials export working
- Validate daily usage
- Ship basic frontend
- **Checkpoint:** Are you using this every day?

**Week 3: Phase 2.1 - Fallacy Detection Prototype**
- Add article_analysis table
- Build fallacy detection prompt
- Test on 20-30 articles
- **Checkpoint:** Is accuracy >80%?

**Week 4: Phase 2.2 - Auto-Analysis**
- Run fallacy detection on curated articles
- Add "Most Fallacious" page
- Add fallacy badges to homepage
- **Checkpoint:** Is this generating traffic/interest?

**Weeks 5-6: Phase 3 - Real-Time Social Monitoring** (OPTIONAL)
- Add monitored_accounts table
- Twitter API integration
- Build "Ready to Post" widget
- Post 10-15 responses over 2 weeks
- **Checkpoint:** Is this driving follower growth?

**Weeks 7-8: Phase 2.3-2.4 - Full Analysis** (OPTIONAL)
- Expand to bias detection, rhetorical tactics
- Build comprehensive analysis view
- Add neutral summaries and synthesis
- **Checkpoint:** Does full analysis add value or is fallacy detection enough?

**Week 9+: Refinement & Scale**
- Improve prompt accuracy
- Add more monitored accounts (if Phase 3)
- Build analytics dashboards
- Optimize costs
- Consider: Auto-response mode, multi-user access, public API

---

## Next Steps

1. **Review this spec with ChatGPT/Gemini**
   - Show them your current prototype
   - Show them this spec
   - Ask: "Create migration plan from current state to this spec"

2. **Get explicit confirmation of architecture understanding**
   - "Explain back to me how signals → articles → analysis flow"
   - "Show me the state machine transitions"
   - Don't proceed until they demonstrate understanding

3. **Start Phase 1 implementation**
   - Focus on getting daily workflow working
   - Validate you'll actually use it
   - Don't touch Phase 2 until Phase 1 ships

4. **After 2 weeks of daily usage, assess Phase 2**
   - Do you want fallacy detection?
   - Is it worth the added complexity?
   - Only proceed if Phase 1 is working well

---

This spec is now complete and ready to hand to your AI coding assistant. The key is: **ship Phase 1 first, validate it works, then decide if Phase 2 is worth building.**
