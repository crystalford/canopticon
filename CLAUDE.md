# CANOPTICON v2 - Chat-First AI Publishing CMS

## Quick Reference
- **Stack**: Next.js 14 + React 18 + TypeScript + PostgreSQL + Drizzle ORM + Tailwind
- **AI**: Claude Sonnet 4 (chat), Perplexity Sonar Pro (search), DALL-E 3 (images)
- **Auth**: NextAuth single-operator via env vars (OPERATOR_EMAIL/OPERATOR_PASSWORD)
- **Deploy**: Vercel with daily cron at 8 UTC
- **DB**: Supabase PostgreSQL

## Key Paths
- `src/app/api/chat/route.ts` — Main AI chat streaming endpoint
- `src/lib/ai/tools.ts` — 11 AI tools (search, publish, edit, X posting, monitors, images)
- `src/lib/ai/system-prompt.ts` — AI system instructions
- `src/lib/ai/providers.ts` — Model config (Claude + Perplexity)
- `src/db/schema.ts` — 5 tables: conversations, messages, articles, operators, automations
- `src/components/chat/` — ChatInterface, ConversationSidebar, MessageBubble
- `src/lib/automations/runner.ts` — YouTube/RSS/Keyword automation runner
- `src/app/dashboard/page.tsx` — Main chat UI (authenticated)

## DB Tables
conversations, messages, articles, operators, automations

## AI SDK v6 Notes
- Uses `streamText()` with `stopWhen: stepCountIs(15)` for chat
- Uses `generateText()` with `stopWhen: stepCountIs(5)` for automations
- Client uses `useChat` hook with `DefaultChatTransport`
- Tools defined with `tool()` + Zod schemas

## Scripts
- `pnpm dev` / `pnpm build` / `pnpm start` / `pnpm lint`
- `pnpm run db:generate` / `pnpm run db:push` / `pnpm run db:studio`

## Known Issues
- "scheduled" automation type defined in schema but not implemented in runner
- Image APIs fail silently if UNSPLASH_ACCESS_KEY or OPENAI_API_KEY not set
- API routes (conversations, articles, automations) lack auth checks
- No rate limiting on API endpoints

## Environment Variables
DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, OPERATOR_EMAIL, OPERATOR_PASSWORD,
ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, OPENAI_API_KEY (optional), UNSPLASH_ACCESS_KEY (optional),
TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET, CRON_SECRET (optional)
