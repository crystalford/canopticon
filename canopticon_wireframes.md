# CANOPTICON UI Wireframes & Specifications

## Page 1: Morning Dashboard (Your Command Center)

**URL:** `/dashboard`  
**Purpose:** Single page you see every morning that shows what needs attention and system health

---

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ CANOPTICON                                    [Settings] [Sign Out] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ACTION REQUIRED                                                    │
│  ═══════════════                                                    │
│                                                                     │
│  📹 FLAGGED FOR VIDEO (5)                    [View All →]          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ ⭐ 92  Poilievre proposes housing acceleration bill            │ │
│  │ 🔥 Breaking • Parliament • 2 hours ago                         │ │
│  │ Why flagged: High confidence + contradiction detected          │ │
│  │ [Export Materials] [Start Video] [View Article]                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ ⭐ 87  Trudeau statement on inflation contradicts budget       │ │
│  │ 📰 News • CBC • 4 hours ago                                    │ │
│  │ Why flagged: Repetition across 4 sources                       │ │
│  │ [Export Materials] [Start Video] [View Article]                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ ⭐ 84  Conservative motion fails on climate policy             │ │
│  │ 🏛️ Institutional • Parliament • 6 hours ago                    │ │
│  │ Why flagged: Vote contradiction + narrative shift              │ │
│  │ [Export Materials] [Start Video] [View Article]                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  + 2 more flagged stories                                          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📥 PENDING REVIEW (23)                      [Review All →]        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ New signals since yesterday requiring your approval             │ │
│  │                                                                  │ │
│  │ [Bulk Approve] [Bulk Reject] [Sort: Confidence ▼]              │ │
│  │                                                                  │ │
│  │ Quick preview (top 5):                                          │ │
│  │ □ ⭐ 78 - NDP housing proposal gains traction                  │ │
│  │ □ ⭐ 76 - Liberal MP breaks ranks on carbon tax                │ │
│  │ □ ⭐ 71 - Alberta threatens federal challenge                  │ │
│  │ □ ⭐ 68 - Parliamentary procedure dispute escalates            │ │
│  │ □ ⭐ 65 - Jagmeet Singh calls emergency meeting                │ │
│  │                                                                  │ │
│  │ + 18 more pending                                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SYSTEM HEALTH                                                      │
│  ═════════════                                                      │
│                                                                     │
│  TODAY'S ACTIVITY                                                   │
│  47 signals ingested • 12 auto-approved • 2 flagged • 0 errors     │
│                                                                     │
│  SOURCES STATUS                    [View All →]                     │
│  ┌────────────────────┬────────────────────┬────────────────────┐  │
│  │ ✅ 18 Active        │ ⚠️  2 Warnings     │ ❌ 1 Disabled      │  │
│  └────────────────────┴────────────────────┴────────────────────┘  │
│                                                                     │
│  Recent issues:                                                     │
│  ⚠️  Globe and Mail - 3 consecutive failures (last: 2h ago)        │
│  ❌ CBC Politics - Auto-disabled (5 failures) [Re-enable] [Test]   │
│                                                                     │
│  BUDGET                                                             │
│  OpenAI API: $12.47 / $50.00 (24.9%)  ████░░░░░░░░░░░░░░░░░        │
│  Status: ✅ Normal                                                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📰 RECENT PUBLICATIONS (Last 24h)           [View All →]          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 🎬 Poilievre housing bill (CURATED)                            │ │
│  │    Published: 2h ago • 47 views • Video attached               │ │
│  │    [Edit] [Demote to Archive] [View]                           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 📄 Liberal caucus meeting details (ARCHIVE)                    │ │
│  │    Published: 4h ago • 12 views                                │ │
│  │    [Edit] [Promote to Curated] [Attach Video] [View]           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  + 8 more published today                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Interaction Specifications

**"Export Materials" button:**
- Clicking generates markdown file
- File includes: script (60-90s), 3 key quotes with attribution, contradictions detected, 3 suggested angles
- File naming: `YYYYMMDD_slug_materials.md`
- Action: Browser downloads file OR auto-saves to connected Google Drive folder
- Toast notification: "Materials exported for: [headline]"
- Button changes to: "✓ Exported" (green) with timestamp

**"Start Video" button:**
- Updates article.video_status to 'in_progress'
- Automatically exports materials if not already exported
- Button changes to: "⏳ In Progress" (orange)
- Adds to "Videos In Progress" widget (if we add that)

**"View Article" button:**
- Opens article detail page in new tab
- Shows full generated content + sources
- Edit/publish controls available there

**Keyboard shortcuts:**
- `g d` - Go to dashboard (from anywhere)
- `g r` - Go to review pending
- `g f` - Go to flagged
- `?` - Show keyboard shortcuts help

---

## Page 2: Signal Review Interface

**URL:** `/review/pending`  
**Purpose:** Triage 20-30 pending signals in 5 minutes

---

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Dashboard              PENDING REVIEW (23)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Select All] [Deselect All]  |  [✓ Approve] [✗ Reject] [⭐ Flag] │
│                                                                     │
│  Sort: [Confidence ▼] [Time] [Source]    Filter: [All Sources ▼]  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ SIGNAL LIST (Left Pane - 40% width)    │ PREVIEW (Right Pane - 60%)│
├─────────────────────────────────────────┼───────────────────────────┤
│                                         │                           │
│ □ ⭐ 92  [Breaking]                     │ SELECTED SIGNAL           │
│   Poilievre proposes housing...         │ ═══════════════           │
│   🏛️ Parliament • 2h ago • 4 sources   │                           │
│   ────────────────────────────────────  │ ⭐ Confidence: 92/100     │
│                                         │ 🔥 Breaking               │
│ ☑ ⭐ 87  [Repetition]                   │ 🏛️ Parliament            │
│   Trudeau statement contradicts...      │ ⏰ 2 hours ago            │
│   📰 CBC • 4h ago • 3 sources           │                           │
│   ────────────────────────────────────  │ Poilievre proposes       │
│                                         │ housing acceleration bill │
│ □ ⭐ 84  [Shift]                        │                           │
│   Conservative motion fails on...       │ CONTENT PREVIEW           │
│   🏛️ Parliament • 6h ago • 2 sources   │ ─────────────             │
│   ────────────────────────────────────  │                           │
│                                         │ Conservative Leader       │
│ □ ⭐ 78  [Novelty]                      │ Pierre Poilievre tabled   │
│   NDP housing proposal gains...         │ Bill C-47 in the House    │
│   📰 CTV • 8h ago • 1 source            │ of Commons today, a       │
│   ────────────────────────────────────  │ comprehensive housing     │
│                                         │ acceleration measure that │
│ □ ⭐ 76  [Contradiction]                │ would override municipal  │
│   Liberal MP breaks ranks on...         │ zoning restrictions...    │
│   📰 National Post • 10h ago • 1 source │                           │
│   ────────────────────────────────────  │ [Read Full Article →]     │
│                                         │                           │
│ □ ⭐ 71  [Breaking]                     │ WHY THIS SCORED HIGH      │
│   Alberta threatens federal...          │ ─────────────────         │
│   🏛️ Government • 12h ago • 2 sources  │                           │
│   ────────────────────────────────────  │ ✓ First mention of Bill   │
│                                         │ ✓ High-profile politician │
│ □ ⭐ 68  [Shift]                        │ ✓ Procedural significance │
│   Parliamentary procedure...            │ ✓ 4 sources converging    │
│   🏛️ Parliament • 14h ago • 2 sources  │                           │
│   ────────────────────────────────────  │ SIMILAR/RELATED           │
│                                         │ ────────────              │
│ □ ⭐ 65  [Novelty]                      │                           │
│   Jagmeet Singh calls emergency...      │ 📌 Clustered with:        │
│   📰 Globe • 16h ago • 1 source         │ • CBC coverage (3h ago)   │
│   ────────────────────────────────────  │ • CTV analysis (4h ago)   │
│                                         │ • National Post (5h ago)  │
│ [Load More...]                          │                           │
│                                         │ ⚠️  Historical match:     │
│                                         │ "Poilievre housing plan"  │
│                                         │ covered 3 months ago      │
│                                         │ [View Past Article →]     │
│                                         │                           │
│                                         │ SOURCES                   │
│                                         │ ────────                  │
│                                         │                           │
│                                         │ 🏛️ Parliament Hansard    │
│                                         │ openparliament.ca/...     │
│                                         │ Published: 2:14 PM        │
│                                         │                           │
│                                         │ 📰 CBC Politics           │
│                                         │ cbc.ca/news/politics/...  │
│                                         │ Published: 2:47 PM        │
│                                         │                           │
│                                         │ 📰 CTV News               │
│                                         │ ctvnews.ca/politics/...   │
│                                         │ Published: 3:12 PM        │
│                                         │                           │
│                                         │ + 1 more source           │
│                                         │                           │
│                                         │ ACTIONS                   │
│                                         │ ───────                   │
│                                         │                           │
│                                         │ [✓ Approve to Archive]    │
│                                         │ [⭐ Flag for Video]       │
│                                         │ [✗ Reject]                │
│                                         │ [✏️ Edit Before Publish]  │
│                                         │                           │
└─────────────────────────────────────────┴───────────────────────────┘
```

---

### Interaction Specifications

**List Item States:**
- Default: White background, black text
- Hovered: Light gray background
- Selected: Blue background, white text
- Checked (bulk): Checkbox checked, yellow highlight

**Keyboard Navigation:**
- `j` / `k` - Navigate down/up signal list
- `space` - Toggle checkbox for bulk actions
- `a` - Approve selected signal
- `f` - Flag selected signal
- `r` - Reject selected signal
- `enter` - Open in preview pane (right side)
- `e` - Edit before publish
- `ESC` - Deselect all

**Bulk Actions:**
1. Check 5 signals
2. Click "✓ Approve"
3. Confirmation modal: "Approve 5 signals to archive tier?"
4. [Confirm] [Cancel]
5. Toast: "5 signals approved and published to archive"
6. Signals disappear from list

**Edit Before Publish:**
- Opens modal overlay with editable fields:
  - Headline (text input)
  - Summary (textarea, 3 paragraphs)
  - Generated content (expandable sections for each platform)
- [Regenerate] button for each section (calls OpenAI again)
- [Save & Approve] [Save & Flag] [Cancel]

**Preview Pane Behavior:**
- Clicking a signal in left list loads it in right pane
- All metadata visible without scrolling
- Sources are clickable (open in new tab)
- "Similar/Related" section shows clustered signals and historical matches
- Actions at bottom are always visible (sticky)

**Filters:**
- "All Sources" dropdown shows all 23 sources with checkboxes
- Can multi-select to show only specific sources
- Filter persists across sessions (localStorage)

**Sort Options:**
- Confidence (default, descending)
- Time (newest first)
- Source (alphabetical)
- Sort persists across sessions

---

## Page 3: Article Edit Modal (Overlay)

**Triggered by:** Clicking "Edit Before Publish" in review interface

```
┌─────────────────────────────────────────────────────────────────────┐
│ EDIT SIGNAL BEFORE PUBLISHING                           [✕ Close]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  HEADLINE                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Poilievre proposes housing acceleration bill                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  [Regenerate Headline]                                              │
│                                                                     │
│  SUMMARY (3 paragraphs for article page)                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Conservative Leader Pierre Poilievre tabled Bill C-47...    │   │
│  │                                                              │   │
│  │ The bill, if passed, would represent a significant shift... │   │
│  │                                                              │   │
│  │ Liberal and NDP MPs have expressed skepticism, with...      │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  [Regenerate Summary]                                               │
│                                                                     │
│  GENERATED CONTENT (Platform-specific)                              │
│  ═══════════════════════════════════════                            │
│                                                                     │
│  ▼ X Thread (3 tweets)                                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1/ BREAKING: Poilievre tables Bill C-47, a comprehensive   │   │
│  │ housing acceleration measure that would override municipal   │   │
│  │ zoning. Thread 🧵                                            │   │
│  │                                                              │   │
│  │ 2/ The bill targets restrictive zoning laws that limit      │   │
│  │ density in urban cores. Critics argue it undermines local   │   │
│  │ control.                                                     │   │
│  │                                                              │   │
│  │ 3/ Liberal Housing Minister calls it "federal overreach."   │   │
│  │ Vote expected next week. Full breakdown: [LINK]             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  [Regenerate X Thread]                                              │
│                                                                     │
│  ▶ YouTube Script (60s)                      [Click to expand]     │
│  ▶ TikTok Caption                            [Click to expand]     │
│  ▶ Substack Post (300-500 words)             [Click to expand]     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Save & Approve to Archive] [Save & Flag for Video] [Cancel]      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Regenerate Behavior

**When you click "Regenerate Headline":**
1. Button becomes spinner: "⏳ Regenerating..."
2. Calls OpenAI with same signal content but different prompt variation
3. New headline replaces old in ~2-3 seconds
4. Can click multiple times to cycle through options
5. System stores last 3 generated versions, can toggle between them

**Cost consideration:**
- Each regenerate = new API call = $0.002-0.01
- Show running cost in modal footer: "2 regenerations ($0.004)"

---

## Page 4: Video Materials Export File Format

**Filename:** `20250112_poilievre-housing-bill_materials.md`

**Content structure:**

```markdown
# Video Materials: Poilievre proposes housing acceleration bill

**Generated:** 2025-01-12 10:47 AM  
**Confidence:** 92/100  
**Signal Type:** Breaking  
**Sources:** 4  

---

## 60-Second Video Script

**HOOK (0-10s):**
Breaking news from Parliament Hill. Pierre Poilievre just tabled a bill that could completely reshape Canadian housing policy.

**CONTEXT (10-30s):**
Bill C-47, the Housing Acceleration Act, would give the federal government power to override municipal zoning restrictions. This is huge. Right now, cities control their own zoning. This bill would let Ottawa force density.

**CONFLICT (30-50s):**
Liberals are calling it federal overreach. Housing Minister says municipalities need to maintain local control. But Poilievre argues the housing crisis requires federal action.

**CTA (50-60s):**
Vote expected next week. This could be the biggest housing policy shift in decades. Full breakdown on CANOPTICON.ca - link in bio.

---

## Key Quotes (max 3)

**Quote 1:**
"Municipal zoning restrictions have created an artificial scarcity crisis. We need federal intervention to unlock supply."  
— **Pierre Poilievre**, Conservative Leader  
— **Source:** Parliament Hansard, 2:14 PM  
— **URL:** openparliament.ca/debates/2025/1/12/pierre-poilievre-1

**Quote 2:**
"This is federal overreach. Housing policy should respect local decision-making."  
— **Sean Fraser**, Liberal Housing Minister  
— **Source:** CBC Politics, 2:47 PM  
— **URL:** cbc.ca/news/politics/housing-bill-reaction

**Quote 3:**
"We support the goal but question the constitutionality of overriding provincial jurisdiction."  
— **Jagmeet Singh**, NDP Leader  
— **Source:** CTV News, 3:12 PM  
— **URL:** ctvnews.ca/politics/ndp-housing-response

---

## Contradictions Detected

**Contradiction 1:**
- **Claim:** Poilievre says bill "respects provincial jurisdiction"
- **Counter:** Bill text explicitly overrides municipal authority (Section 4.2)
- **Evidence:** Bill C-47 text, Section 4.2(a)

**Contradiction 2:**
- **Claim:** Fraser says Liberals "support local control"
- **Counter:** Liberal 2024 budget included federal housing mandates for cities
- **Evidence:** Budget 2024, Housing chapter

---

## Suggested Angles

1. **Constitutional angle:** Federal vs municipal powers - who has authority over housing?
2. **Crisis framing:** Is the housing crisis severe enough to justify federal override?
3. **Political calculation:** Why is Poilievre making this move now? Pre-election positioning?

---

## All Sources (4)

1. **Parliament Hansard** - openparliament.ca/debates/2025/1/12 (2:14 PM)
2. **CBC Politics** - cbc.ca/news/politics/poilievre-housing-bill (2:47 PM)
3. **CTV News** - ctvnews.ca/politics/housing-acceleration-act (3:12 PM)
4. **National Post** - nationalpost.com/news/politics/conservative-housing (5:23 PM)

---

## Article URL
https://canopticon.ca/poilievre-housing-bill

---

*Generated by CANOPTICON • canopticon.ca*
```

---

### Export Options

**Option A: Download**
- Browser downloads `.md` file to ~/Downloads
- User manually moves to NotebookLM or video editing workspace

**Option B: Auto-save (Preferred)**
- System auto-saves to configured Google Drive folder
- Path: `/CANOPTICON/Video Materials/2025-01/`
- User has constant sync via Google Drive desktop app
- Zero manual file management

**Option C: Copy to Clipboard**
- One-click copy entire markdown to clipboard
- User pastes into NotebookLM or Notion
- Fastest but requires manual paste

**Recommendation:** Implement all three, default to Option B if Google Drive connected.

---

## Page 5: Settings Page

**URL:** `/settings`

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Dashboard                     SETTINGS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SOURCES                                                            │
│  ═══════                                                            │
│                                                                     │
│  [+ Add Source]                                                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ✅ Parliament Hansard                                        │   │
│  │    Type: Government • Priority: 10 • Reliability: 0.95      │   │
│  │    URL: openparliament.ca/api/debates                       │   │
│  │    Frequency: 15 minutes                                    │   │
│  │    [Edit] [Pause] [Delete]                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ✅ CBC Politics RSS                                          │   │
│  │    Type: News • Priority: 8 • Reliability: 0.85             │   │
│  │    URL: rss.cbc.ca/lineup/politics.xml                      │   │
│  │    Frequency: 20 minutes                                    │   │
│  │    [Edit] [Pause] [Delete]                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ... [23 sources total] ...                                         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AUTO-APPROVAL                                                      │
│  ════════════                                                       │
│                                                                     │
│  Confidence threshold: [75] (0-100)                                 │
│  Minimum reliability: [0.7] (0-1)                                   │
│  Minimum content length: [100] characters                           │
│                                                                     │
│  ☑ Enable auto-approval (uncheck to require manual review for all) │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CONTENT LIFECYCLE                                                  │
│  ═══════════════════                                                │
│                                                                     │
│  Auto-archive pending signals after: [48] hours                     │
│  Hide archive articles after: [30] days                             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  VIDEO MATERIALS EXPORT                                             │
│  ═══════════════════════                                            │
│                                                                     │
│  Export format: ● Markdown  ○ JSON  ○ Plain text                   │
│                                                                     │
│  Export method:                                                     │
│  ● Auto-save to Google Drive                                        │
│    Folder: /CANOPTICON/Video Materials/ [Change]                   │
│    Status: ✅ Connected (chris@canopticon.ca)                       │
│                                                                     │
│  ○ Browser download (to ~/Downloads)                                │
│  ○ Copy to clipboard only                                           │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  NOTIFICATIONS                                                      │
│  ═════════════                                                      │
│                                                                     │
│  ☑ Email daily digest (8:00 AM) to: chris@canopticon.ca            │
│  ☑ Alert when source fails (after 3 consecutive failures)          │
│  ☑ Alert when budget reaches 90%                                   │
│  ☐ Browser push notifications for high-confidence signals (>90)    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  API CONFIGURATION                                                  │
│  ═════════════════                                                  │
│                                                                     │
│  OpenAI API Key: sk-proj-••••••••••••••••••                        │
│  [Update Key] [Test Connection]                                    │
│                                                                     │
│  Monthly budget cap: $[50] USD                                      │
│  Current usage: $12.47 (24.9%)                                      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AI PROMPTS                                                         │
│  ══════════                                                         │
│                                                                     │
│  [Manage Prompt Templates →]                                        │
│                                                                     │
│  Customize AI generation for:                                       │
│  • Headlines • Summaries • X Threads • YouTube Scripts • More       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Save Changes]                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Summary: What These Wireframes Define

✅ **Dashboard:** Your morning ritual - see what needs attention, system health, recent activity  
✅ **Review Interface:** Triage 20-30 signals in 5 minutes with keyboard shortcuts and bulk actions  
✅ **Edit Modal:** Fix AI output before publishing, regenerate sections, preview all platform content  
✅ **Export Format:** Exact structure of video materials markdown file for NotebookLM workflow  
✅ **Settings:** Configure sources, auto-approval, notifications, export preferences  

---

## Phase 1 Public Frontend Wireframes

The following pages complete the Phase 1 MVP public-facing website.

---

## Page 6: Public Homepage

**URL:** `/` (canopticon.ca)  
**Purpose:** Public-facing landing page showing latest curated and archive content

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ CANOPTICON                      [Archive] [About] [Search 🔍]       │
│ Real-time Canadian political analysis                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LATEST CURATED                                                     │
│  ═══════════════                                                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  🎬 Poilievre proposes housing acceleration bill            │   │
│  │  🏛️ Parliament • 2 hours ago • 4 sources                    │   │
│  │                                                              │   │
│  │  [VIDEO EMBED - 16:9 aspect ratio]                          │   │
│  │  YouTube/TikTok player showing your video                   │   │
│  │                                                              │   │
│  │  Conservative Leader Pierre Poilievre tabled Bill C-47      │   │
│  │  in the House of Commons today, a comprehensive housing     │   │
│  │  acceleration measure that would override municipal zoning  │   │
│  │  restrictions...                                             │   │
│  │                                                              │   │
│  │  [Read Full Analysis →]                                      │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⭐ Trudeau statement on inflation contradicts budget        │   │
│  │  📰 CBC • 4 hours ago • 3 sources                            │   │
│  │                                                              │   │
│  │  Prime Minister Justin Trudeau's statement today about      │   │
│  │  inflation targets appears to contradict positions outlined │   │
│  │  in the recent federal budget...                             │   │
│  │                                                              │   │
│  │  [Read Full Analysis →]                                      │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⭐ Conservative motion fails on climate policy              │   │
│  │  🏛️ Parliament • 6 hours ago • 2 sources                    │   │
│  │                                                              │   │
│  │  A Conservative motion calling for changes to federal       │   │
│  │  climate policy was defeated in the House of Commons today  │   │
│  │  by a vote of 178-143...                                     │   │
│  │                                                              │   │
│  │  [Read Full Analysis →]                                      │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  RECENT ARCHIVE                                                     │
│  ═══════════════                                                    │
│                                                                     │
│  ┌──────────────────────────┬──────────────────────────────────┐   │
│  │ 📄 Liberal caucus meeting│ 📄 NDP housing proposal gains    │   │
│  │    details revealed      │    traction in polls             │   │
│  │ 📰 Globe • 8h ago        │ 📰 CTV • 10h ago                 │   │
│  │ Internal Liberal caucus  │ Recent polling shows NDP...      │   │
│  │ meeting minutes...       │                                  │   │
│  │ [Read →]                 │ [Read →]                         │   │
│  └──────────────────────────┴──────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────┬──────────────────────────────────┐   │
│  │ 📄 Alberta threatens     │ 📄 Parliamentary procedure       │   │
│  │    federal challenge     │    dispute escalates             │   │
│  │ 🏛️ Government • 12h ago  │ 🏛️ Parliament • 14h ago          │   │
│  │ Alberta Premier Danielle │ A procedural dispute in...       │   │
│  │ Smith announced...       │                                  │   │
│  │ [Read →]                 │ [Read →]                         │   │
│  └──────────────────────────┴──────────────────────────────────┘   │
│                                                                     │
│  [View All Archive →]                                               │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ABOUT CANOPTICON                                                   │
│  ═════════════════                                                  │
│                                                                     │
│  Real-time political news and content production engine for         │
│  Canadian politics. We ingest institutional data, professional      │
│  news feeds, and social media signals to detect emerging events     │
│  early and publish analysis to X, YouTube, TikTok, and Substack.   │
│                                                                     │
│  [Learn More →] [View Methodology →]                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  © 2025 CANOPTICON • [Privacy] [Terms] [Contact]                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Interaction Specifications

**Navigation:**
- CANOPTICON logo → Homepage
- Archive → `/archive` page
- About → `/about` page
- Search icon → Opens search modal overlay

**Article Cards:**
- Hover: Light shadow/elevation effect
- Click anywhere on card → Article detail page
- Video embed: Auto-play on scroll into view (muted), click to unmute
- "Read Full Analysis" button: Opens article detail page

**Responsive Behavior:**
- Desktop: 3 curated + 4 archive in 2x2 grid
- Tablet: 3 curated + 2 archive in 2x1 grid
- Mobile: Stacked vertically, 3 curated + "View Archive" button

**Social Sharing:**
- Each article card has hidden share buttons (appear on hover)
- Share to X, copy link, email

---

## Page 7: Article Detail Page (Public)

**URL:** `/articles/{slug}` or `/{slug}`  
**Purpose:** Full article view with sources, video embed, and analysis (if exists)

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back to Home              CANOPTICON                [Share ↗]     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Poilievre proposes housing acceleration bill                      │
│  🏛️ Parliament • Published: January 12, 2025 2:47 PM              │
│  📊 47 views                                                        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [VIDEO EMBED - 16:9 if video exists]                              │
│  YouTube/TikTok player                                              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SUMMARY                                                            │
│  ═══════                                                            │
│                                                                     │
│  Conservative Leader Pierre Poilievre tabled Bill C-47 in the      │
│  House of Commons today, a comprehensive housing acceleration      │
│  measure that would override municipal zoning restrictions in      │
│  certain circumstances.                                             │
│                                                                     │
│  The bill, if passed, would represent a significant shift in       │
│  federal-municipal relations, granting Ottawa unprecedented power  │
│  to intervene in local planning decisions when housing supply is   │
│  deemed insufficient.                                               │
│                                                                     │
│  Liberal and NDP MPs have expressed skepticism, with Housing       │
│  Minister Sean Fraser calling it "federal overreach." Vote         │
│  expected next week.                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SOURCES (4)                                                        │
│  ════════                                                           │
│                                                                     │
│  🏛️ Parliament Hansard                                             │
│  openparliament.ca/debates/2025/1/12/pierre-poilievre-1            │
│  Published: 2:14 PM                                                 │
│                                                                     │
│  📰 CBC Politics                                                    │
│  cbc.ca/news/politics/poilievre-housing-bill-2025                  │
│  Published: 2:47 PM                                                 │
│                                                                     │
│  📰 CTV News                                                        │
│  ctvnews.ca/politics/housing-acceleration-act-tabled               │
│  Published: 3:12 PM                                                 │
│                                                                     │
│  📰 National Post                                                   │
│  nationalpost.com/news/politics/conservative-housing-strategy      │
│  Published: 5:23 PM                                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  GENERATED CONTENT                                                  │
│  ═══════════════════                                                │
│                                                                     │
│  ▶ X Thread (3 tweets)                    [Copy] [View on X]       │
│  ▶ YouTube Script (60 seconds)            [Copy]                   │
│  ▶ TikTok Caption                          [Copy]                  │
│  ▶ Substack Post (500 words)              [Copy] [View on Substack]│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  RELATED ARTICLES                                                   │
│  ════════════════                                                   │
│                                                                     │
│  • Liberal housing minister responds to Conservative proposal      │
│  • Historical context: Previous federal housing interventions      │
│  • Municipal leaders react to zoning override plan                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Share on X] [Share on Facebook] [Copy Link] [Email]              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Interaction Specifications

**Navigation:**
- "← Back to Home" → Returns to homepage
- "Share ↗" → Opens share modal with social options

**Video Embed:**
- If video_attached = true, show embedded player
- If video_attached = false, show first paragraph with larger text

**Sources:**
- Each source is clickable link (opens in new tab)
- Shows source icon (🏛️ institutional, 📰 news)
- Timestamp helps establish credibility

**Generated Content Sections:**
- Collapsed by default (▶ arrow)
- Click to expand (▼ arrow)
- "Copy" button copies content to clipboard
- "View on X/Substack" links to published content (if posted)

**Example Expanded Section:**
```
┌─────────────────────────────────────────────────────────────┐
│ ▼ X Thread (3 tweets)                [Copy] [View on X]    │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ Tweet 1:                                                    │
│ BREAKING: Poilievre tables Bill C-47, a comprehensive     │
│ housing acceleration measure that would override municipal │
│ zoning. Thread 🧵                                           │
│                                                             │
│ Tweet 2:                                                    │
│ The bill targets restrictive zoning laws that limit        │
│ density in urban cores. Critics argue it undermines local  │
│ control.                                                    │
│                                                             │
│ Tweet 3:                                                    │
│ Liberal Housing Minister calls it "federal overreach."     │
│ Vote expected next week. Full breakdown: canopticon.ca/... │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Share Functionality:**
- Share on X: Pre-populated tweet with headline + link
- Share on Facebook: Opens Facebook share dialog
- Copy Link: Copies article URL to clipboard
- Email: Opens mailto: with pre-filled subject/body

**Mobile Responsive:**
- Single column layout
- Sources collapse into expandable list
- Video scales to full width
- Share buttons fixed to bottom of screen

---

## Page 8: Archive/Search Page

**URL:** `/archive`  
**Purpose:** Searchable, filterable archive of all published articles

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back to Home              CANOPTICON                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ARCHIVE                                                            │
│  ═══════                                                            │
│                                                                     │
│  Search: [_________________________________] 🔍                      │
│                                                                     │
│  Filter by: [All Sources ▼] [All Topics ▼] [Date Range ▼]         │
│  Sort by: [Newest First ▼]                                         │
│                                                                     │
│  Showing 47 articles                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🎬 Poilievre proposes housing acceleration bill             │   │
│  │ 🏛️ Parliament • 2 hours ago • Curated                       │   │
│  │ Conservative Leader Pierre Poilievre tabled Bill C-47...    │   │
│  │ [Read →]                                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📄 Trudeau statement on inflation contradicts budget        │   │
│  │ 📰 CBC • 4 hours ago • Curated                               │   │
│  │ Prime Minister Justin Trudeau's statement today about...    │   │
│  │ [Read →]                                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📄 Conservative motion fails on climate policy              │   │
│  │ 🏛️ Parliament • 6 hours ago • Curated                       │   │
│  │ A Conservative motion calling for changes to federal...     │   │
│  │ [Read →]                                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📄 Liberal caucus meeting details revealed                  │   │
│  │ 📰 Globe • 8 hours ago • Archive                             │   │
│  │ Internal Liberal caucus meeting minutes leaked...           │   │
│  │ [Read →]                                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ... (more articles)                                                │
│                                                                     │
│  [Load More] (20 per page)                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Interaction Specifications

**Search:**
- Real-time search as you type (debounced 300ms)
- Searches: headline, summary, sources
- Shows "No results" if empty
- Clear button (X) appears when text entered

**Filters:**
- **All Sources**: Dropdown with checkboxes
  - Parliament (23)
  - CBC (12)
  - CTV (8)
  - Globe and Mail (7)
  - ... etc
- **All Topics**: Auto-generated from common keywords
  - Housing (15)
  - Climate (9)
  - Budget (7)
  - ... etc
- **Date Range**: 
  - Today
  - This Week
  - This Month
  - Custom (date picker)

**Sort Options:**
- Newest First (default)
- Oldest First
- Most Viewed
- Curated First

**Article Cards:**
- Shows tier badge: "Curated" (blue) or "Archive" (gray)
- Video indicator: 🎬 if video attached
- Hover effect: Slight elevation
- Click anywhere → Article detail page

**Pagination:**
- Load 20 articles per page
- "Load More" button at bottom
- Infinite scroll option (user preference)
- "Back to Top" button appears after scrolling

**URL State:**
- Search/filter state stored in URL params
- Example: `/archive?search=housing&source=parliament&date=this_week`
- Shareable/bookmarkable filtered views

**Mobile Responsive:**
- Filters collapse into slide-out panel
- Search bar full width
- Single column article list
- Sticky filter button at top

---

## Page 9: About Page

**URL:** `/about`  
**Purpose:** Explain CANOPTICON's methodology, sources, and mission

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back to Home              CANOPTICON                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ABOUT CANOPTICON                                                   │
│  ══════════════════                                                 │
│                                                                     │
│  CANOPTICON is real-time political reality infrastructure for      │
│  Canadian politics. We operate in the gap between raw events and   │
│  finished narratives—where being early matters most.                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  WHAT WE DO                                                         │
│  ═══════════                                                        │
│                                                                     │
│  We continuously monitor:                                           │
│  • Parliament (votes, debates, committees)                          │
│  • Professional news feeds (CBC, CTV, Globe, Post, etc.)            │
│  • Government releases and regulatory filings                       │
│  • Social media signals from political accounts                     │
│                                                                     │
│  When we detect emerging events, narrative shifts, or              │
│  contradictions, we publish analysis immediately to:                │
│  • This website (canonical archive)                                 │
│  • X/Twitter (real-time commentary)                                 │
│  • YouTube (short-form explainers)                                  │
│  • TikTok (rapid-response political clips)                          │
│  • Substack (long-form analysis)                                    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  HOW IT WORKS                                                       │
│  ════════════                                                       │
│                                                                     │
│  1. INGESTION                                                       │
│     Sources are monitored continuously via APIs and RSS feeds.      │
│     No editorial filtering at this stage—everything comes in.       │
│                                                                     │
│  2. SIGNAL DETECTION                                                │
│     Our system detects change rather than importance:               │
│     • Novelty: First mention of an event                            │
│     • Acceleration: Topic suddenly trending                         │
│     • Repetition: Same phrase across multiple sources               │
│     • Contradiction: Statement conflicts with vote/record           │
│     • Cross-source convergence: Multiple outlets reporting same     │
│                                                                     │
│  3. CONTENT GENERATION                                              │
│     When a signal triggers our thresholds, we automatically         │
│     generate:                                                       │
│     • Headlines                                                     │
│     • 3-paragraph summaries                                         │
│     • Platform-specific content (X threads, video scripts, etc.)    │
│     • Source references and timestamps                              │
│                                                                     │
│  4. EDITORIAL REVIEW                                                │
│     High-confidence signals are auto-published to the archive.      │
│     Signals flagged for video production receive additional         │
│     editorial attention and appear on the homepage as "Curated."    │
│                                                                     │
│  5. PUBLISHING & SYNDICATION                                        │
│     Content is published from a central control system and          │
│     syndicated across platforms. Everything links back here.        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  OUR SOURCES                                                        │
│  ═══════════                                                        │
│                                                                     │
│  INSTITUTIONAL (Public Domain)                                      │
│  • Parliament of Canada (openparliament.ca)                         │
│  • Government press releases                                        │
│  • Regulatory filings                                               │
│  • Court decisions                                                  │
│                                                                     │
│  PROFESSIONAL NEWS (Fair Use with Attribution)                      │
│  • CBC News • CTV News • Global News                                │
│  • Globe and Mail • National Post                                   │
│  • Toronto Star • Canadian Press                                    │
│  • Local/regional outlets                                           │
│                                                                     │
│  SOCIAL SIGNALS                                                     │
│  • Political accounts on X/Twitter                                  │
│  • Reddit (r/CanadaPolitics)                                        │
│  • Journalist accounts                                              │
│  • Viral clips and leaked documents                                 │
│                                                                     │
│  [View Full Source List →]                                          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  METHODOLOGY                                                        │
│  ════════════                                                       │
│                                                                     │
│  SPEED OVER PERFECTION                                              │
│  We prioritize publishing quickly over polished prose. Our goal    │
│  is to surface signals early, not to be the final word.            │
│                                                                     │
│  TRANSPARENCY                                                       │
│  Every article includes timestamped source links. You can verify   │
│  our work and follow the trail yourself.                            │
│                                                                     │
│  NO IDEOLOGICAL FILTER                                              │
│  We ingest from all perspectives. Our system doesn't care about    │
│  left/right—it cares about novelty, contradiction, and momentum.   │
│                                                                     │
│  AUTOMATION + EDITORIAL                                             │
│  Machines handle volume. Humans handle judgment. Auto-published    │
│  content fills the archive. Curated content gets video treatment.  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  WHO WE ARE                                                         │
│  ═══════════                                                        │
│                                                                     │
│  CANOPTICON is operated by [Your Name/Team], based in [Location].  │
│  We're building infrastructure for understanding political reality  │
│  in real-time.                                                      │
│                                                                     │
│  This project is inspired by Marshall McLuhan's insight that "the  │
│  medium is the message"—the speed and structure of information     │
│  delivery shapes political reality as much as the content itself.  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CONTACT                                                            │
│  ═══════                                                            │
│                                                                     │
│  Email: hello@canopticon.ca                                         │
│  X/Twitter: @canopticon                                             │
│  TikTok: @canopticon                                                │
│  YouTube: @canopticon                                               │
│  Substack: canopticon.substack.com                                  │
│                                                                     │
│  For corrections, source suggestions, or technical issues:          │
│  feedback@canopticon.ca                                             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Privacy Policy] [Terms of Service]                                │
│                                                                     │
│  © 2025 CANOPTICON                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Interaction Specifications

**Navigation:**
- "← Back to Home" → Returns to homepage
- "View Full Source List" → Expands complete list of 20+ sources
- All external links open in new tabs

**Content Sections:**
- Each major section has anchor links for direct navigation
- Example URLs: `/about#methodology`, `/about#sources`
- Smooth scroll to section when anchor clicked

**Contact Links:**
- Email links open mailto: with pre-filled subject
- Social media icons link to respective platforms
- "feedback@canopticon.ca" → Feedback form (future feature)

**Mobile Responsive:**
- Single column layout
- Source list collapses into expandable accordion
- Contact section stacks vertically
- Sticky "Back to Top" button

---

## Complete Phase 1 Wireframes Summary

✅ **Admin/Dashboard Pages (Internal)**
- Morning Dashboard
- Signal Review Interface  
- Edit Modal
- Video Materials Export Format
- Settings Page

✅ **Public Frontend Pages**
- Homepage
- Article Detail Page
- Archive/Search Page
- About Page

---

## Design System (Apply to All Pages)

**Typography:**
- Headlines: 32-48px, bold, sans-serif
- Body: 16-18px, regular, sans-serif
- Metadata: 14px, gray, sans-serif
- Code/Technical: 14px, monospace

**Colors:**
- Primary: #1a73e8 (blue, for links/CTAs)
- Curated badge: #1a73e8 (blue)
- Archive badge: #5f6368 (gray)
- Success: #34a853 (green)
- Warning: #fbbc04 (yellow)
- Error: #ea4335 (red)
- Background: #ffffff (white)
- Text: #202124 (near-black)
- Borders: #dadce0 (light gray)

**Spacing:**
- Base unit: 8px
- Small: 8px, Medium: 16px, Large: 24px, XL: 48px
- Consistent padding/margins across all pages

**Icons:**
- Use emoji for source types (🏛️ 📰 🔥 ⭐ 🎬)
- Minimal custom icons
- Clear visual hierarchy

**Responsive Breakpoints:**
- Mobile: <640px
- Tablet: 640-1024px
- Desktop: >1024px

---

## What's NOT Wireframed (Phase 2+)

- Analytics dashboard
- Prompt template editor UI
- Source health detail page
- Cluster management UI (merge/split)
- Historical duplicate resolution flow
- Most Fallacious page (Phase 2.2)
- Full analysis view with all sections (Phase 2.3-2.4)
- Ready to Post widget (Phase 3)
- Hall of Shame (Phase 3)
- Leaderboard (Phase 3)
- Monitored accounts management (Phase 3)

---

**Next Step:** Hand these complete wireframes + database spec to ChatGPT and say "build exactly this, no improvisation."

