import { pgTable, uuid, text, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ============================================================================
// CANOPTICON v2 - Chat-first CMS
// 5 tables. That's it.
// ============================================================================

/**
 * Conversations - Chat sessions with the AI
 */
export const conversations = pgTable('conversations', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title'),
    pinned: boolean('pinned').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Messages - Individual messages within conversations
 * Stores the full chat history for each conversation
 */
export const messages = pgTable('messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
    role: text('role').notNull(), // 'user' | 'assistant'
    content: text('content').notNull(),
    toolInvocations: jsonb('tool_invocations'), // AI SDK tool invocation data
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * Articles - Published content
 * Created via chat. Markdown content. That's it.
 */
export const articles = pgTable('articles', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    content: text('content').notNull(), // Markdown
    summary: text('summary'),
    tags: text('tags').array().notNull(),
    author: text('author').default('CANOPTICON').notNull(),
    status: text('status').default('published').notNull(), // 'published' | 'draft'
    conversationId: uuid('conversation_id').references(() => conversations.id),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Operators - Admin auth (single user, env-based)
 */
export const operators = pgTable('operators', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastLoginAt: timestamp('last_login_at'),
})

/**
 * Automations - Monitors that auto-generate content
 * YouTube channels, RSS feeds, keyword alerts, scheduled topics
 */
export const automations = pgTable('automations', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'youtube' | 'rss' | 'keyword' | 'scheduled'
    config: jsonb('config').notNull().default({}),
    prompt: text('prompt'), // AI instructions for when triggered
    enabled: boolean('enabled').default(true).notNull(),
    autoPublish: boolean('auto_publish').default(false).notNull(),
    lastRunAt: timestamp('last_run_at'),
    lastResult: jsonb('last_result'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Social Monitors - Track X (Twitter) accounts for content ingestion
 * Monitor specific accounts for tweets to analyze/reply to
 */
export const socialMonitors = pgTable('social_monitors', {
    id: uuid('id').primaryKey().defaultRandom(),
    accountHandle: text('account_handle').notNull(), // e.g., "@CBCNews"
    accountId: text('account_id'), // X user ID
    displayName: text('display_name'),
    enabled: boolean('enabled').default(true).notNull(),
    monitorType: text('monitor_type').notNull(), // 'fallacy_detection' | 'trending' | 'engagement' | 'custom'
    config: jsonb('config').notNull().default({
        autoReply: false,
        requireApproval: true,
        maxRepliesPerDay: 10,
        fallacyTypes: [],
    }),
    lastCheckedAt: timestamp('last_checked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Tracked Tweets - Tweets from monitored accounts
 * Stores tweets for analysis, reply drafting, and engagement tracking
 */
export const trackedTweets = pgTable('tracked_tweets', {
    id: uuid('id').primaryKey().defaultRandom(),
    tweetId: text('tweet_id').notNull().unique(),
    monitorId: uuid('monitor_id').references(() => socialMonitors.id, { onDelete: 'cascade' }).notNull(),
    authorHandle: text('author_handle').notNull(),
    authorName: text('author_name'),
    content: text('content').notNull(),
    url: text('url').notNull(),

    // Analysis
    analyzed: boolean('analyzed').default(false).notNull(),
    fallaciesDetected: jsonb('fallacies_detected'), // Array of {type, explanation, severity}

    // Reply tracking
    replyStatus: text('reply_status').default('pending').notNull(), // 'pending' | 'approved' | 'posted' | 'skipped'
    replyDraft: text('reply_draft'),
    replyTweetId: text('reply_tweet_id'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    analyzedAt: timestamp('analyzed_at'),
    repliedAt: timestamp('replied_at'),
})


// ============================================================================
// RELATIONS
// ============================================================================

export const conversationsRelations = relations(conversations, ({ many }) => ({
    messages: many(messages),
    articles: many(articles),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
    conversation: one(conversations, {
        fields: [messages.conversationId],
        references: [conversations.id],
    }),
}))

export const articlesRelations = relations(articles, ({ one }) => ({
    conversation: one(conversations, {
        fields: [articles.conversationId],
        references: [conversations.id],
    }),
}))

export const socialMonitorsRelations = relations(socialMonitors, ({ many }) => ({
    trackedTweets: many(trackedTweets),
}))

export const trackedTweetsRelations = relations(trackedTweets, ({ one }) => ({
    monitor: one(socialMonitors, {
        fields: [trackedTweets.monitorId],
        references: [socialMonitors.id],
    }),
}))

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

export type Article = typeof articles.$inferSelect
export type NewArticle = typeof articles.$inferInsert

export type Operator = typeof operators.$inferSelect
export type NewOperator = typeof operators.$inferInsert

export type Automation = typeof automations.$inferSelect
export type NewAutomation = typeof automations.$inferInsert

export type SocialMonitor = typeof socialMonitors.$inferSelect
export type NewSocialMonitor = typeof socialMonitors.$inferInsert

export type TrackedTweet = typeof trackedTweets.$inferSelect
export type NewTrackedTweet = typeof trackedTweets.$inferInsert
