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

## Architecture (v2)

### Database (5 tables — Supabase PostgreSQL)
- **conversations**: id, title, pinned, createdAt, updatedAt
- **messages**: id, conversationId, role, content, toolInvocations (jsonb), createdAt
- **articles**: id, title, slug (unique), content (markdown), summary, tags (TEXT[]), author, status ('published'|'draft'), conversationId, publishedAt, createdAt, updatedAt
- **operators**: id, email, passwordHash, createdAt, lastLoginAt
- **automations**: id, name, type ('youtube'|'rss'|'keyword'|'scheduled'), config (jsonb), prompt, enabled, autoPublish, lastRunAt, lastResult (jsonb), createdAt, updatedAt

### Pages
- `/` — Public homepage: hero section, featured article, article grid, tag cloud with filtering via `?tag=`
- `/dashboard` — THE interface. Chat + sidebar (Chats, Articles, Monitors tabs)
- `/articles/[slug]` — Article page with SEO meta, related articles, JSON-LD, YouTube embeds
- `/login` — NextAuth credentials login
- `/terms` — Terms of Service
- `/privacy` — Privacy Policy

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
- `src/app/page.tsx` — Public homepage (hero, featured article, grid, tag cloud)
- `src/app/layout.tsx` — Root layout with SEO metadata, Google Fonts
- `src/app/articles/[slug]/page.tsx` — Article page with YouTube embed rendering
- `src/app/api/chat/route.ts` — Chat API, streamText, stepCountIs(15), maxDuration 120
- `src/app/api/automations/[id]/run/route.ts` — Manual monitor trigger, maxDuration 120
- `src/app/api/cron/route.ts` — Daily cron runner for all enabled monitors
- `src/lib/ai/tools.ts` — All 13 AI tools + searchPerplexity() + resolveYouTubeChannelId()
- `src/lib/ai/system-prompt.ts` — System prompt for chat AI
- `src/lib/ai/providers.ts` — Model config (Claude Sonnet for chat, Perplexity for search)
- `src/lib/automations/runner.ts` — Automation execution: checkTrigger → generateText → publish
- `src/app/dashboard/page.tsx` — Dashboard orchestrator (chatKey state)
- `src/components/chat/ChatInterface.tsx` — useChat hook with DefaultChatTransport
- `src/components/chat/ConversationSidebar.tsx` — 3-tab sidebar (Chats, Articles, Monitors)
- `src/components/chat/MessageBubble.tsx` — Message + tool call rendering
- `src/db/schema.ts` — All 5 tables + relations + type exports
- `src/db/index.ts` — Drizzle client setup
- `drizzle.config.ts` — Drizzle config pointing to DATABASE_URL
- `vercel.json` — Build config + cron (daily 8am UTC)
- `tailwind.config.ts` — Dark theme, red accents, glass effects, Inter + JetBrains Mono fonts

## How Things Work

### Chat Flow
1. User sends message in dashboard → POST `/api/chat` with conversationId + messages
2. `streamText()` with Claude Sonnet + 13 tools, stopWhen: stepCountIs(15)
3. AI can search web, publish/edit articles, manage monitors, post to X, add images
4. Messages saved to DB on finish, conversation auto-created if new
5. Client uses `useChat` hook with `DefaultChatTransport`

### Monitor/Automation Flow
1. User asks AI to "monitor CPAC YouTube channel" → AI calls `create_monitor` tool
2. Tool auto-resolves YouTube channel ID from handle/URL/name (scrape + Perplexity fallback)
3. Monitor stored in `automations` table with config, prompt, autoPublish setting
4. Triggered by: daily cron (8 UTC) OR manual play button in sidebar
5. Runner: checkTrigger() → fetches RSS/YouTube feed → filters new items since lastRunAt
6. If new content: generateText() with Claude (limit 2 searches, stepCountIs(10)) → publish_article
7. autoPublish=true → published immediately; autoPublish=false → saved as draft
8. lastResult stored in DB, visible in expanded sidebar monitor detail

### YouTube Video Embeds
- Runner system prompt tells AI to use `<youtube>VIDEO_ID</youtube>` in articles
- Article page pre-processes content: replaces tags with responsive iframes via `renderYouTubeEmbeds()`
- ReactMarkdown uses `rehype-raw` plugin to pass through HTML iframes

### Sidebar Features
- **Chats tab**: Pin, rename, search, delete conversations
- **Articles tab**: Published articles link to public page; drafts show amber badge + summary (no dead link)
- **Monitors tab**: Click to expand showing config, prompt, auto-publish, last result; Play/Pause/Delete buttons
- Active tab persists to localStorage across page refreshes

## Critical AI SDK v6 Gotchas
- **Do NOT use `.default()` on Zod schemas in tool inputSchema** — causes silent tool registration failures
- `useChat` uses `messages` prop (not `initialMessages`) for initial state
- `stopWhen: stepCountIs(N)` controls max tool rounds (NOT `maxSteps`)
- Tool `parameters` → `inputSchema`
- `toDataStreamResponse()` → `toUIMessageStreamResponse()`
- Messages are UIMessage with `.parts` array, not `.content` string
- Use `convertToModelMessages()` to convert UI messages for the model
- `createTools()` accepts optional `(conversationId?, { saveDraft? })` params

## Key Bug Fixes (don't regress these)
- **Chat remounting**: `chatKey` state separate from `conversationId` prevents remount on auto-detection
- **Tool registration**: No `.default()` on Zod schemas in tools
- **Step limit**: Chat=15, Automations=10 (was 5, too low — AI used all steps on search before publishing)
- **Duplicate title**: `stripLeadingTitle()` removes H1 from markdown + system prompt tells AI not to include it
- **Draft articles**: Runner always tells AI to call publish_article; `saveDraft` option saves with status='draft'
- **YouTube channel resolution**: create_monitor auto-resolves channel IDs from handles/URLs/names

## Known Limitations
- "scheduled" automation type defined in schema but not implemented in runner
- Image APIs (Unsplash, DALL-E) fail silently if keys not set
- Auth uses env vars (OPERATOR_EMAIL/OPERATOR_PASSWORD), not hashed DB passwords
- Single operator only — no multi-user support
- API routes (conversations, articles, automations) lack auth middleware
- Cron secret is optional (should be enforced in production)
- No rate limiting on API endpoints

## Potential Next Steps
- Article page should render drafts for authenticated users (currently 404s)
- Monitor run results could be richer (link to generated article)
- Homepage could show article count / last updated timestamp
- RSS and Keyword monitors haven't been tested as thoroughly as YouTube
- Twitter/X posting works but thread formatting could be refined
- Could add Bluesky posting (@atproto/api is already a dependency)

## Env Variables
```
DATABASE_URL                # Supabase PostgreSQL connection string
NEXTAUTH_SECRET             # Random secret for session encryption
NEXTAUTH_URL                # App URL (https://canopticon.com or preview URL)
OPERATOR_EMAIL              # Single operator login email
OPERATOR_PASSWORD           # Single operator login password

ANTHROPIC_API_KEY           # Claude API (main chat model)
PERPLEXITY_API_KEY          # Perplexity sonar-pro (web search)
OPENAI_API_KEY              # DALL-E 3 image generation (optional)
UNSPLASH_ACCESS_KEY         # Unsplash stock photos (optional)
BLOB_READ_WRITE_TOKEN       # Vercel Blob storage for images

TWITTER_API_KEY             # X/Twitter posting
TWITTER_API_SECRET
TWITTER_BEARER_TOKEN
TWITTER_ACCESS_TOKEN
TWITTER_ACCESS_SECRET
TWITTER_CLIENT_ID
TWITTER_CLIENT_SECRET

CRON_SECRET                 # Bearer token for /api/cron (optional but recommended)
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
