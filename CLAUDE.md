# Canopticon

## Project Overview
- **What**: Chat-first CMS for Canadian political intelligence
- **Domain**: canopticon.com | **Twitter**: @canoptics
- **GitHub**: crystalford/canopticon
- **Branch**: `claude/canopticon-fresh-start-KaIuk`
- **Stack**: Next.js 14, TypeScript, Tailwind CSS, PostgreSQL (Drizzle ORM)
- **AI**: Vercel AI SDK v6, Anthropic Claude, Perplexity (web search)
- **Host**: Vercel (auto-deploys from branch pushes)
- **DB**: PostgreSQL on Supabase

## Dev Environment - IMPORTANT
- User works in Claude Code Web (NOT a local IDE)
- All testing/deployment is LIVE on Vercel - no local dev server
- Push to branch → Vercel builds automatically → test on preview URL
- No local PostgreSQL - DB is remote (Supabase)
- **Do NOT suggest `npm run dev` or local testing**
- Build errors only show up on Vercel or via `next build`

## User Preferences
- SIMPLICITY above all. Previous 4+ iterations failed due to over-engineering.
- Don't add features/config/automation unless asked
- Dark glass theme (slate-950 bg, red accents, glass panels) is the brand

## Architecture (v2)

### Database (5 tables)
- **conversations**: id, title, pinned, createdAt, updatedAt
- **messages**: id, conversationId, role, content, toolInvocations, createdAt
- **articles**: id, title, slug, content (markdown), summary, tags (TEXT[]), author, status, conversationId, publishedAt, createdAt, updatedAt
- **operators**: id, email, passwordHash, createdAt, lastLoginAt
- **automations**: id, name, type, config (jsonb), prompt, enabled, autoPublish, lastRunAt, lastResult, createdAt, updatedAt

### Pages
- `/dashboard` — THE interface. Chat + sidebar (Chats, Articles, Monitors tabs)
- `/` — Public homepage with article list, tag cloud, tag filtering via `?tag=`
- `/articles/[slug]` — Article page with SEO meta, related articles, JSON-LD
- `/terms` — Terms of Service
- `/privacy` — Privacy Policy

### AI Tools (in src/lib/ai/tools.ts)
| Tool | What it does |
|------|-------------|
| search_web | Search via Perplexity sonar-pro |
| add_image | Unsplash or DALL-E image → Vercel Blob |
| publish_article | Publish with title, content, summary, tags |
| get_article | Read full article content by ID |
| list_articles | List articles (metadata only) |
| edit_article | Update title, content, summary, tags |
| unpublish_article | Set article to draft |
| post_to_x | Post thread to X/Twitter |
| create_monitor | Create YouTube/RSS/keyword monitor |
| list_monitors | List all monitors |
| toggle_monitor | Enable/disable a monitor |

### Key Files
- `src/app/api/chat/route.ts` — Chat API, stepCountIs(15), maxDuration 120
- `src/lib/ai/tools.ts` — All AI tools + searchPerplexity()
- `src/lib/ai/system-prompt.ts` — System prompt
- `src/lib/ai/providers.ts` — Chat model config
- `src/app/dashboard/page.tsx` — Dashboard orchestrator (chatKey state)
- `src/components/chat/ChatInterface.tsx` — useChat hook
- `src/components/chat/ConversationSidebar.tsx` — 3-tab sidebar
- `src/components/chat/MessageBubble.tsx` — Message + tool call rendering
- `src/db/schema.ts` — All 5 tables + relations
- `src/lib/automations/runner.ts` — Automation execution
- `vercel.json` — Build config + cron (daily 8am UTC)

## Critical AI SDK v6 Gotchas
- **Do NOT use `.default()` on Zod schemas in tool inputSchema** — causes silent tool registration failures
- `useChat` uses `messages` prop (not `initialMessages`) for initial state
- `stopWhen: stepCountIs(15)` controls max tool rounds
- Tool `parameters` → `inputSchema`
- `maxSteps` → `stopWhen: stepCountIs(N)`
- `toDataStreamResponse()` → `toUIMessageStreamResponse()`
- Messages are UIMessage with `.parts` array, not `.content` string
- Use `convertToModelMessages()` to convert UI messages for the model

## Key Bug Fixes (don't regress these)
- **Chat remounting**: `chatKey` state separate from `conversationId` prevents remount on auto-detection
- **Tool registration**: No `.default()` on Zod schemas in tools
- **Step limit**: Was 5 (too low), now 15
- **Duplicate title**: `stripLeadingTitle()` removes H1 from markdown + system prompt tells AI not to include it

## Env Variables
```
DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, OPERATOR_EMAIL, OPERATOR_PASSWORD
ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, OPENAI_API_KEY
UNSPLASH_ACCESS_KEY, BLOB_READ_WRITE_TOKEN, CRON_SECRET
TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_BEARER_TOKEN
TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET
```
