# CANOPTICON v2 — Canadian Political Intelligence Platform

## CRITICAL: Read This First
This is NOT a CMS. It is a **persistent knowledge graph** that maps how power operates in Canada.
- Entities (people, orgs, corps, parties) + relationships + claims + evidence
- Dual-axis epistemic model: Confidence (evidence quality) vs Resonance (belief spread) — ALWAYS separate
- NATO Admiralty source reliability (A–F tiers)
- Knowledge gaps escalate over time (inverse decay — louder when unanswered longer)
- Convergence events: multiple independent sources pointing at same connection
- Conspiracy pathology screening (6 indicators) on all structural claims

**Previous v1 (Jules's CMS build) was wiped. Do not reference it.**

---

## Current Build State (as of last session)

### COMMITTED & PUSHED to `claude/canopticon-v2-build-b6tFc`:
- `package.json` — v2.0.0, correct deps (Supabase, Neo4j, Next.js 14, NO Drizzle, NO NextAuth, NO Vercel AI SDK)
- `tailwind.config.ts` — v2 design system (void black, amber, brand red, Syne/JetBrains/Baskerville)
- `next.config.js` — minimal
- `tsconfig.json` — clean, @/* paths
- `vercel.json` — 4 crons
- `.env.example` — all vars
- `supabase/` — directory exists, **EMPTY**
- **NO `src/` directory exists yet**

### NOT YET BUILT (build these in order, one file per turn):
1. `supabase/schema.sql`
2. `neo4j/setup.cypher`
3. `src/lib/supabase/client.ts`
4. `src/lib/supabase/server.ts`
5. `src/lib/neo4j/client.ts`
6. `src/types/database.ts`
7. `src/middleware.ts`
8. `src/app/globals.css`
9. `src/app/layout.tsx`
10. `src/app/page.tsx` (placeholder only — public site is Phase 2)
11. `src/app/login/page.tsx`
12. `src/app/login/actions.ts`
13. `src/components/admin/Sidebar.tsx`
14. `src/components/admin/TopBar.tsx`
15. `src/app/admin/layout.tsx`
16. `src/app/admin/page.tsx` (redirect to /admin/intelligence)
17. `src/app/admin/system/page.tsx`
18. `src/app/admin/entities/page.tsx`
19. `src/app/admin/entities/new/page.tsx`
20. `src/app/admin/entities/[id]/page.tsx`
21. Placeholder pages: intelligence, intake, sessions, hypotheses, contradictions, vlogs, articles, library
22. `src/app/api/entities/route.ts`
23. `src/app/api/health/route.ts`
24. `pnpm install && pnpm build` — fix errors, commit, push

**RULE: Write one file → commit → write next file. No planning text.**

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router (server components default) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL + pgvector) |
| Graph DB | Neo4j AuraDB Free |
| Auth | Supabase Auth via `@supabase/ssr` (3 tiers: admin/supporter/public) |
| AI | Anthropic Claude directly (claude-sonnet-4-6 for intelligence, haiku for classification) |
| Hosting | Vercel |
| Package manager | pnpm |

**NOT used:** Drizzle ORM, NextAuth, Vercel AI SDK, bcryptjs, Prisma

---

## Architecture

### Auth Tiers (Supabase Auth + RLS)
- **admin** — full access, entity creation, claim verification, agent control
- **supporter** — paid tier, can read full graph, submit intake
- **public** — read-only published summaries only

All tables have RLS enabled. Admin = `auth.users` with `profiles.tier = 'admin'`.

### Database Schema (30 tables — Supabase PostgreSQL)

**Extensions required:** `uuid-ossp`, `vector` (pgvector for claims.embedding)

**Entities & Relationships:**
- `entities` — id (uuid), entity_id (text, shared namespace with Neo4j), name, type (enum), subtype, description, confidence_score (0-1), resonance_score (0-1), status, metadata (jsonb), created_at, updated_at
- `entity_types` enum: person, organization, corporation, government_body, political_party, media_outlet, policy, event, place, concept
- `relationships` — id, from_entity_id, to_entity_id, relationship_type, confidence (0-1), evidence_ids (uuid[]), start_date, end_date, is_current (bool), metadata (jsonb), created_at
- `tags` — id, name, slug, color, created_at
- `entity_tags` — entity_id, tag_id (junction)

**Claims & Evidence:**
- `claims` — id, content (text), claim_type, confidence (0-1), resonance (0-1), embedding (vector(1536)), source_ids (uuid[]), entity_ids (uuid[]), status (unverified/verified/disputed/retracted), verified_at, created_at, updated_at
- `sources` — id, url, title, author, published_at, reliability_tier (char(1) — A/B/C/D/E/F), content_hash, scraped_at, metadata (jsonb)
- `evidence` — id, claim_id, source_id, excerpt (text), relevance_score (0-1), added_at

**Intelligence Layer:**
- `knowledge_gaps` — id, gap_type, description, entity_ids (uuid[]), urgency_score (0-1), created_at, last_escalated_at, resolved_at, is_resolved (bool)
- `hypotheses` — id, title, description, confidence (0-1), supporting_claim_ids (uuid[]), contradicting_claim_ids (uuid[]), status (open/confirmed/refuted), created_at, updated_at
- `convergence_events` — id, claim_ids (uuid[]), source_ids (uuid[]), detected_at, significance_score (0-1), reviewed (bool), notes
- `contradictions` — id, claim_a_id, claim_b_id, severity (low/medium/high/critical), detected_at, resolved_at, resolution_notes
- `conspiracy_flags` — id, claim_id, indicators (jsonb — 6 screened indicators), score (0-1), flagged_at, reviewed

**Content:**
- `articles` — id, title, slug (unique), content (markdown), summary, entity_ids (uuid[]), status (draft/published), published_at, created_at, updated_at
- `vlogs` — id, title, script (text), youtube_url, status, entity_ids (uuid[]), published_at, created_at
- `video_clips` — id, vlog_id, start_seconds, end_seconds, clip_url, status, created_at

**Operations:**
- `intake_queue` — id, raw_content, source_url, submitted_by (uuid), status (pending/processing/done/rejected), processed_at, extracted_entities (jsonb), extracted_claims (jsonb), created_at
- `sessions` — id, title, description, entity_ids (uuid[]), status (active/archived), created_at, updated_at
- `session_messages` — id, session_id, role (user/assistant), content, tool_calls (jsonb), created_at

**System:**
- `system_prompts` — key (text PK), content (text), updated_at
- `agents` — id, name, slug, type, model_id, system_prompt_key, is_active (bool), config (jsonb), created_at, updated_at
- `profiles` — id (refs auth.users), tier (admin/supporter/public), display_name, created_at, updated_at
- `api_keys` — id, name, key_hash, created_by, created_at, last_used_at, is_active
- `audit_log` — id, actor_id, action, table_name, record_id, before (jsonb), after (jsonb), created_at

**Seed data required in schema.sql:**
```sql
INSERT INTO system_prompts (key, content, updated_at) VALUES
('intelligence_agent', '...', now()),
('intake_classifier', '...', now()),
('gap_escalator', '...', now()),
('health_narrator', '...', now());
```

### Neo4j Graph (AuraDB Free)

Node types: Entity, Claim, Source, KnowledgeGap, Hypothesis
Relationship types: RELATES_TO, FUNDS, CONTROLS, EMPLOYS, MEMBER_OF, SUPPORTS, OPPOSES, CONTRADICTS, SUPPORTS_CLAIM, EVIDENCED_BY

All nodes carry entity_id (shared namespace with Supabase UUID).

### Cron Jobs (vercel.json)
- `/api/cron/news-agent` — `0 6 * * *` — scans intake queue, classifies, extracts
- `/api/cron/gap-escalator` — `0 2 * * *` — escalates urgency on unanswered gaps
- `/api/cron/health-snapshot` — `0 0 * * *` — graph health metrics
- `/api/cron/neo4j-keepalive` — `0 12 */24 * *` — prevents AuraDB free tier sleep

---

## Design System

### Colors
```
void: #080a0f       (bg-void — page background)
base: #0d1117       (bg-base — card backgrounds)
raised: #161b22     (bg-raised — elevated panels)
overlay: #1c2128    (bg-overlay — modals, dropdowns)

signal: #e8a020     (amber — primary accent, active states, CTA)
confirmed: #3dd68c  (green — verified claims, confirmed status)
hypothesis: #4da6ff (blue — unconfirmed, speculative)
disputed: #ff4d4d   (red — contested, contradictions)
brand: #e63946      (brand red — logo, headers)

text-primary: #e6edf3
text-secondary: #8b949e
text-muted: #484f58
border: #30363d
```

### Fonts (load via Google Fonts in layout.tsx)
- `font-display` → Syne (headings, UI labels)
- `font-mono` → JetBrains Mono (data, IDs, scores)
- `font-body` → Libre Baskerville (prose, article content)

### Key UI Patterns
- Glass panels: `bg-raised/80 backdrop-blur-sm border border-border`
- Signal badge: `bg-signal/10 text-signal border border-signal/30 font-mono text-xs`
- Confidence bar: narrow horizontal bar, color shifts confirmed→hypothesis→disputed by value
- Scan-line animation: CSS keyframe `scan` 8s linear infinite on hero sections
- No rounded-full buttons — use rounded-sm or rounded

---

## Admin Shell Structure

```
/admin
  /intelligence   — Main graph dashboard (entity network, recent convergences)
  /entities       — Entity list, search, filter by type
  /entities/new   — Create entity form
  /entities/[id]  — Entity detail (claims, relationships, gaps, timeline)
  /intake         — Intake queue management
  /sessions       — AI intelligence sessions
  /hypotheses     — Open hypotheses tracker
  /contradictions — Contradiction resolution queue
  /vlogs          — Video documentary management
  /articles       — Published articles
  /library        — Sources & evidence library
  /system         — System panel (graph health, agent status, system prompts, architecture)
```

### Sidebar (collapsible, lucide-react icons)
Active state: amber left border + bg-raised. Collapsed: icons only.
Sections: INTELLIGENCE (intelligence, entities, hypotheses, contradictions), OPERATIONS (intake, sessions), CONTENT (vlogs, articles, library), SYSTEM (system).

### TopBar
- Left: CANOPTICON wordmark (font-display, text-brand)
- Center: live clock (font-mono, updates every second)
- Right: graph health counter (entity count, relationship count, open gaps) — fetched from /api/health

### System Panel (/admin/system)
4 sections:
1. **Graph Health** — entity/relationship/claim/source counts, gap count, last snapshot time
2. **Agent Status** — list of agents with is_active toggle, last run, model
3. **System Prompts** — editable textarea for each prompt key (saves via API)
4. **Architecture** — SVG diagram of data flow (static, embedded inline)

---

## Key Implementation Notes

### Supabase Auth (server.ts)
Use `@supabase/ssr` with `createServerClient` and cookie handlers. Admin check:
```ts
const { data: profile } = await supabase.from('profiles').select('tier').eq('id', user.id).single()
if (profile?.tier !== 'admin') redirect('/login')
```

### Neo4j Client (client.ts)
Singleton pattern — one driver instance reused across requests:
```ts
let driver: Driver | null = null
export function getNeo4jDriver() {
  if (!driver) driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD))
  return driver
}
```

### middleware.ts
- Refresh Supabase session on every request (required for SSR)
- Redirect `/admin/*` to `/login` if no active session
- No other middleware needed in Phase 1

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEO4J_URI
NEO4J_USERNAME
NEO4J_PASSWORD
ANTHROPIC_API_KEY
PERPLEXITY_API_KEY
TWITTER_API_KEY / TWITTER_API_SECRET / TWITTER_BEARER_TOKEN / TWITTER_ACCESS_TOKEN / TWITTER_ACCESS_SECRET
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME / R2_PUBLIC_URL
FAL_API_KEY
RESEND_API_KEY
DIGEST_FROM_EMAIL / DIGEST_TO_EMAIL
CRON_SECRET
```

---

## Git

- **Branch:** `claude/canopticon-v2-build-b6tFc`
- **Push:** `git push -u origin claude/canopticon-v2-build-b6tFc`
- Commit after every file. Push at end of session or when build passes.

## Package Manager
pnpm only. `pnpm install` before `pnpm build`.
