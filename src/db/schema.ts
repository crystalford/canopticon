import { pgTable, uuid, text, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ============================================================================
// CANOPTICON v2 - Chat-first CMS
// 4 tables. That's it.
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
