# Canopticon

## Project Overview
- **What**: Chat-first CMS for Canadian political intelligence
- **Domain**: canopticon.com | **Twitter**: @canoptics
- **GitHub**: crystalford/canopticon
- **Stack**: Next.js 14, TypeScript, Tailwind CSS, PostgreSQL (Drizzle ORM)
- **AI**: Vercel AI SDK v6, Anthropic Claude, Perplexity (web search), DALL-E 3 (images)
- **Host**: Vercel (auto-deploys from branch pushes)
- **DB**: PostgreSQL on Supabase
- **Package Manager**: pnpm

## Dev Environment - IMPORTANT
- User may work in Claude Code Web OR a local IDE
- All testing/deployment is LIVE on Vercel — push to branch, Vercel builds, test on preview URL
- No local PostgreSQL — DB is remote (Supabase)
- Build errors show up on Vercel or via `pnpm run build`
- `pnpm run dev` works locally if you have `.env` with DATABASE_URL set

## User Preferences
- SIMPLICITY above all. Previous 4+ iterations failed due to over-engineering.
- Don't add features/config/automation unless asked
- Dark glass theme (slate-950 bg, red accents, glass panels) is the brand
- Chat-first philosophy: create/command through chat, browse/inspect through sidebar
- No form-based editing — everything managed via AI chat tools

## Architecture (v3 — Video-First)

### Database (10 tables — Supabase PostgreSQL)

**Core chat & content:**
- **conversations**: id, title, pinned, createdAt, updatedAt
- **messages**: id, conversationId, role, content, toolInvocations (jsonb), createdAt
- **articles**: id, title, slug (unique), content (markdown), summary, tags (TEXT[]), status ('published'|'draft'), conversationId, automationId, publishedAt, createdAt, updatedAt
- **operators**: id, email, passwordHash, createdAt, lastLoginAt

**Automation & monitoring:**
- **automations**: id, name, type ('youtube'|'rss'|'keyword'), config (jsonb), prompt, enabled, autoPublish, lastRunAt, lastResult (jsonb), createdAt, updatedAt
- **socialMonitors**: id, accountHandle, accountId, displayName, enabled, monitorType, config (jsonb), lastCheckedAt, createdAt, updatedAt
- **trackedTweets**: id, tweetId, monitorId, authorHandle, authorName, content, analyzed, fallaciesDetected (jsonb), replyStatus, replyDraft, replyTweetId, createdAt, analyzedAt, repliedAt
- **videoClips**: id, youtubeUrl, videoTitle, channelName, startSeconds, endSeconds, clipRationale, clipUrl, status, errorMessage, xPostId, xPostedAt, tiktokPostId, automationId, createdAt, processedAt

**System:**
- **settings**: key, value, isEncrypted, updatedAt
- **agents**: id, name, slug, description, systemPrompt, modelProvider, modelId, isActive, createdAt, updatedAt

### Pages (Route Groups)

**Public pages:**
- `/` — Public homepage: hero section, featured article, article grid, tag cloud with filtering via `?tag=`
- `/articles/[slug]` — Article page with SEO meta, related articles, JSON-LD, YouTube embeds, video clip embeds
- `/login` — NextAuth credentials login
- `/privacy` — Privacy Policy
- `/terms` — Terms of Service

**Protected pages (requires auth, in `(app)` route group):**
- `/(app)/chat` — Main chat interface + sidebar (Chats, Articles, Monitors, Videos, Settings tabs)
- `/(app)/content` — Articles library (published + drafts)
- `/(app)/feeds` — Pipeline management dashboard (list view)
- `/(app)/feeds/[id]` — Pipeline detail page (config, recent videos, generated articles, video clips gallery)
- `/(app)/social` — X account monitoring and Twitter analytics
- `/(app)/videos` — Global video clips library
- `/(app)/settings` — System settings and agent configuration

### AI Tools (13 tools in src/lib/ai/tools.ts)
| Tool | What it does |
|------|-------------|
| search_web | Search via Perplexity sonar-pro |
| add_image | Unsplash or DALL-E image → Vercel Blob |
| publish_article | Publish with title, content, summary, tags (supports draft mode) |
| get_article | Read full article content by ID |
| list_articles | List articles (metadata only) |
| edit_article | Update title, content, summary, tags |
| unpublish_article | Set article to draft |
| post_to_x | Post thread to X/Twitter |
| create_monitor | Create YouTube/RSS/keyword monitor (auto-resolves YouTube channel IDs) |
| list_monitors | List all monitors with config/prompt/lastResult |
| toggle_monitor | Enable/disable a monitor |
| edit_monitor | Update monitor name, prompt, config, autoPublish |
| delete_monitor | Permanently delete a monitor |

### Key Files

**Pages & Routes:**
- `src/app/page.tsx` — Public homepage (hero, featured article, grid, tag cloud)
- `src/app/layout.tsx` — Root layout with SEO metadata
- `src/app/articles/[slug]/page.tsx` — Article page with YouTube/video embeds, ISR revalidate 60
- `src/app/(app)/chat/page.tsx` — Main chat interface (protected)
- `src/app/(app)/content/page.tsx` — Articles library
- `src/app/(app)/feeds/page.tsx` — Pipelines list
- `src/app/(app)/feeds/[id]/page.tsx` — Pipeline detail & video management
- `src/app/(app)/social/page.tsx` — Twitter monitor & analytics
- `src/app/(app)/videos/page.tsx` — Video clips gallery

**API Routes:**
- `src/app/api/chat/route.ts` — Chat streaming, Claude + 13 tools, stepCountIs(10), maxDuration 60
- `src/app/api/automations/[id]/run/route.ts` — Manual automation trigger, maxDuration 120
- `src/app/api/automations/[id]/run-video/route.ts` — Single video processing
- `src/app/api/automations/[id]/videos/route.ts` — Fetch YouTube channel videos
- `src/app/api/cron/route.ts` — Daily automation runner, maxDuration 60
- `src/app/api/videos/route.ts` — List/create video clips
- `src/app/api/webhooks/apify/route.ts` — Webhook for video clip completion
- `src/app/api/articles/*` — Article CRUD routes
- `src/app/api/conversations/*` — Conversation CRUD routes
- `src/app/api/social-monitors/*` — Social monitor management

**AI & Automation:**
- `src/lib/ai/tools.ts` — 13+ AI tools (search, articles, monitors, images, X posting, etc.)
- `src/lib/ai/system-prompt.ts` — Default chat system prompt
- `src/lib/ai/personas.ts` — 4 built-in personas (Canopticon, Social Neutral, Skeptic, Editor)
- `src/lib/ai/providers.ts` — Model configuration (Perplexity, OpenAI, Anthropic)
- `src/lib/automations/runner.ts` — Automation engine: checkTrigger → generateArticle → post
- `src/lib/videos/processor.ts` — Video clipping job management

**Components:**
- `src/components/chat/ChatInterface.tsx` — Chat streaming + persona selection
- `src/components/chat/MessageBubble.tsx` — Message rendering (text + tool calls)
- `src/components/chat/ConversationSidebar.tsx` — 5-tab sidebar navigation

**Database & Config:**
- `src/db/schema.ts` — All 10 tables + relations + type exports
- `src/db/index.ts` — Drizzle PostgreSQL client
- `drizzle.config.ts` — Drizzle config pointing to DATABASE_URL
- `vercel.json` — Vercel deploy config + cron jobs (daily 8 AM UTC, webhook renew 9 AM UTC)
- `tailwind.config.ts` — Dark theme (slate-950), red accents, glass effects, Inter + JetBrains Mono

## How Things Work

### Chat Flow
1. User sends message in `/(app)/chat` → POST `/api/chat` with conversationId + messages
2. `streamText()` with selected model + 13 tools, stepCountIs(10)
3. AI can search web, publish/edit articles, manage monitors, post to X, add images
4. Messages saved to DB on stream finish via `onFinish` callback
5. Conversation auto-created if new (uses chatKey state to prevent remounting)
6. Supports multi-persona chat via agents table (or static personas as fallback)
7. Supports provider switching: Anthropic (Claude), OpenAI (GPT-4o), Perplexity (Sonar Pro)

### Pipeline (Automation) Flow
1. User creates pipeline in `/feeds` via chat: "monitor CPAC YouTube channel"
2. AI calls `create_monitor` tool → creates record in `automations` table
3. Tool auto-resolves YouTube channel ID from handle/URL/name
4. Pipeline configured with: type, outputMode, prompt, research/writing models, videoClipping setting
5. Triggered by: daily cron (8 AM UTC) OR manual play button in feeds detail page
6. Runner flow:
   - `checkTrigger()` — Fetch YouTube RSS or keyword search results
   - `generateArticle()` — Claude writes article (generateText, stepCountIs(10), 2 searches max)
   - Post to X (if outputMode = 'article_and_x' or 'article_and_x_post')
   - Video clipping (if enabled) — async job to extract viral hooks via Fractal AI
7. outputMode controls behavior: article_and_x | article_and_x_post | article_only | draft | x_only
8. lastResult stored in DB, visible in pipeline detail page

### Video Clipping (Video-First Pipeline)
- YouTube videos trigger async clipping job via `triggerClippingJob()` if enabled
- Calls external CLIP_SERVER_URL with video details
- Webhook at `/api/webhooks/apify/route.ts` receives clip completion
- Clips stored in `videoClips` table with status: queued → processing → done/failed
- Clips gallery visible in pipeline detail page (`/(app)/feeds/[id]`)
- Clips can be posted to X alongside article

### Social Monitoring (X/Twitter)
- `socialMonitors` table tracks multiple X accounts
- `trackedTweets` stores analyzed tweets with fallacy detection
- Runs on cron, looks for mentions/replies
- Can generate fallacy analysis and draft responses
- Separate UI at `/(app)/social`

### Sidebar Navigation
- **Chats tab**: Conversations (pin, rename, delete); persists active conversation to URL
- **Articles tab**: Published articles link to public page; drafts show status badge
- **Monitors tab**: Pipelines list with quick play/pause/delete
- **Videos tab**: Global clips gallery; filterable by pipeline
- **Settings tab**: Agent config and system settings
- Active tab persists to localStorage

## Critical AI SDK v6 Gotchas
- **Do NOT use `.default()` on Zod schemas in tool inputSchema** — causes silent tool registration failures
- `useChat` uses `messages` prop (not `initialMessages`) for initial state
- `stopWhen: stepCountIs(N)` controls max tool rounds (NOT `maxSteps`)
- Tool `parameters` → `inputSchema`
- `toDataStreamResponse()` → `toUIMessageStreamResponse()`
- Messages are UIMessage with `.parts` array, not `.content` string
- Use `convertToModelMessages()` to convert UI messages for the model
- `createTools()` accepts optional `(conversationId?, { saveDraft? })` params

## Critical Bug Fixes (Don't Regress These)

**Chat & Streaming:**
- **Chat remounting**: `chatKey` state separate from `conversationId` prevents UI remount when conversation auto-creates
- **Tool registration**: No `.default()` on Zod schemas in tools — causes silent failures
- **Step count**: Chat uses `stepCountIs(10)` (was 15, reduced for efficiency); Automations use `stepCountIs(10)` (was 5, too low)

**Article Generation:**
- **Duplicate titles**: `stripLeadingTitle()` removes H1 from markdown + system prompt tells AI not to include it
- **Draft handling**: Runner always calls `publish_article` with `saveDraft: true` to save drafts with status='draft'
- **Title generation**: AI generates fresh title via `stripLeadingTitle()` to avoid H1 duplication in content

**Automation & Monitors:**
- **YouTube channel resolution**: `create_monitor` auto-resolves channel IDs from handles/URLs/names via Perplexity fallback
- **Video clipping async**: Clipping job triggered async to avoid blocking automation flow (504 timeout fix)
- **Output mode config**: Stored in automations.config.outputMode (not a separate field)

**UI & Navigation:**
- **Active conversation URL**: Uses `?c=ID` query param (not route state) to preserve across refreshes
- **Sidebar tabs**: Store active tab in localStorage, survive page reloads
- **Error reporting**: System prompt includes toolErrorRule to force AI to report tool errors verbosely

## Known Limitations

**Current Issues:**
- API routes `/api/articles/*`, `/api/automations/*`, `/api/conversations/*` **lack auth middleware** — should check OPERATOR session
- No rate limiting on API endpoints (anyone with URL can fetch/modify data if they guess IDs)
- `/api/videos?automationId=` endpoint returns 500 with minimal error details (improved error logging added)
- `draft_twitter_thread` tool has no UI visualization in MessageBubble component

**Architecture Limitations:**
- Single operator only — no multi-user support
- Cron secret is optional in code (should be enforced)
- Image APIs (Unsplash, DALL-E) fail silently if keys not set
- Sidebar polls `/api/conversations` every 5 seconds (could use WebSocket)
- No pagination on article/video listing endpoints (limit 50)

**Feature Gaps:**
- Video clipping requires external CLIP_SERVER (Fractal AI) — fails if service unavailable
- RSS and Keyword monitor triggers haven't been tested as thoroughly as YouTube
- Draft articles (status='draft') return 404 on public page (should render for authenticated users)
- Bluesky posting (`@atproto/api`) is a dependency but not implemented
- Twitter thread formatting could be more sophisticated
- Transcript fetching in runner is optional and fails silently if module missing

## Priority Improvements (In Order)

**P0 — Security & Stability:**
1. Add auth middleware to API routes (`/api/articles/*`, `/api/automations/*`, `/api/conversations/*`)
2. Improve error reporting on `/api/videos` and other endpoints
3. Add validation on tool invocations (prevent XSS, SQL injection in article content)

**P1 — Bug Fixes:**
1. Render draft articles on public page for authenticated users (currently 404s)
2. Add UI for `draft_twitter_thread` tool output in MessageBubble
3. Test and fix RSS/Keyword monitor triggers (YouTube works, others untested)
4. Investigate video clipping failures (CLIP_SERVER_URL dependency)

**P2 — Performance & UX:**
1. Add WebSocket support to sidebar (replace 5s polling)
2. Implement pagination on article/video listing (`limit: 50` → `limit: 20, offset: 0`)
3. Add caching headers to API responses (Cache-Control, ETag)
4. Add error boundaries to React components

**P3 — Features:**
1. Implement Bluesky posting (@atproto/api is ready)
2. Improve X thread formatting (automatic line breaks, emoji handling)
3. Add telemetry/monitoring for automation runs (track success rates, duration, costs)
4. Monitor run results should link directly to generated articles

## Environment Variables

**Database:**
```
DATABASE_URL                # Supabase PostgreSQL connection string
```

**Auth:**
```
NEXTAUTH_SECRET             # Random secret for session encryption
NEXTAUTH_URL                # App URL (https://canopticon.com or preview URL)
OPERATOR_EMAIL              # Single operator login email
OPERATOR_PASSWORD           # Single operator login password (hashed in DB)
```

**AI Models:**
```
ANTHROPIC_API_KEY           # Claude API (default chat model)
PERPLEXITY_API_KEY          # Perplexity sonar-pro (web search in automations)
OPENAI_API_KEY              # OpenAI GPT-4o (writing model for automations, DALL-E images)
```

**Images & Media:**
```
UNSPLASH_ACCESS_KEY         # Unsplash stock photos (optional)
BLOB_READ_WRITE_TOKEN       # Vercel Blob storage for images
```

**X/Twitter (posting & monitoring):**
```
TWITTER_API_KEY             # X API v2 key
TWITTER_API_SECRET          # X API v2 secret
TWITTER_BEARER_TOKEN        # X API v2 bearer token
TWITTER_ACCESS_TOKEN        # X OAuth access token (if using user context)
TWITTER_ACCESS_SECRET       # X OAuth access secret (if using user context)
TWITTER_CLIENT_ID           # X OAuth client ID (if using OAuth flow)
TWITTER_CLIENT_SECRET       # X OAuth client secret (if using OAuth flow)
```

**Video Clipping (Fractal AI):**
```
CLIP_SERVER_URL             # External video clipping service URL (e.g., Fractal AI)
CLIP_SERVER_SECRET          # Bearer token for clip server webhook calls
```

**System:**
```
CRON_SECRET                 # Bearer token for /api/cron (recommended for production)
```

## Scripts
```bash
pnpm dev                    # Local dev server
pnpm build                  # Production build (use to verify before push)
pnpm start                  # Run production build locally
pnpm lint                   # ESLint
pnpm run db:generate        # Generate Drizzle migrations
pnpm run db:push            # Push schema to database
pnpm run db:studio          # Drizzle Studio GUI
```
