import { pgTable, uuid, text, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ============================================================================
// CANOPTICON v3 - Investigative Journalism & Video CMS
// Clean Slate Schema
// ============================================================================

/**
 * Investigations - The core unit of work for the multi-phase AI journalist.
 * Tracks a topic from initial seed through research, fact-checking, and drafting.
 */
export const investigations = pgTable('investigations', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    seedPrompt: text('seed_prompt').notNull(),
    triggerSource: text('trigger_source').notNull(), // 'webhook', 'manual', 'monitor'

    // Multi-phase state tracking
    status: text('status').default('pending').notNull(),
    // 'pending', 'researching', 'cross_checking', 'writing', 'fact_checking', 'completed', 'failed'

    // Intermediate outputs
    researchData: jsonb('research_data'),
    crossCheckNotes: jsonb('cross_check_notes'),
    draftContent: text('draft_content'),
    fallacyReport: jsonb('fallacy_report'),

    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Articles - The final polished output of an Investigation, for the public CMS.
 */
export const articles = pgTable('articles', {
    id: uuid('id').primaryKey().defaultRandom(),
    investigationId: uuid('investigation_id').references(() => investigations.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    content: text('content').notNull(), // Markdown
    summary: text('summary'),

    // CMS status
    status: text('status').default('draft').notNull(), // 'draft', 'pending_approval', 'published'

    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * SocialPosts - Extracted sharp posts for X (Twitter)
 */
export const socialPosts = pgTable('social_posts', {
    id: uuid('id').primaryKey().defaultRandom(),
    articleId: uuid('article_id').references(() => articles.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    status: text('status').default('draft').notNull(), // 'draft', 'approved', 'posted', 'failed'
    xPostId: text('x_post_id'),
    postedAt: timestamp('posted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * VideoSources - Tracks YouTube videos/channels ingested for analysis
 */
export const videoSources = pgTable('video_sources', {
    id: uuid('id').primaryKey().defaultRandom(),
    url: text('url').notNull().unique(),
    title: text('title'),
    channelName: text('channel_name'),
    status: text('status').default('pending_transcript').notNull(),
    // 'pending_transcript', 'analyzing', 'completed', 'failed'
    transcript: text('transcript'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * VideoClips - AI-proposed segments from a VideoSource.
 * Must pass through approval gates (or budget checks) before hitting Apify.
 */
export const videoClips = pgTable('video_clips', {
    id: uuid('id').primaryKey().defaultRandom(),
    videoSourceId: uuid('video_source_id').references(() => videoSources.id, { onDelete: 'cascade' }).notNull(),

    // Proposed segment
    startSeconds: integer('start_seconds').notNull(),
    endSeconds: integer('end_seconds').notNull(),
    rationale: text('rationale'),
    keyQuote: text('key_quote'),

    // Control Flow & Cost Management
    status: text('status').default('proposed').notNull(),
    // 'proposed', 'approved', 'processing_apify', 'completed', 'rejected', 'failed'

    apifyJobId: text('apify_job_id'),
    clipUrl: text('clip_url'), // Final MP4 URL

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Settings - System Configuration, Cost Controls, and Feature Flags
 */
export const settings = pgTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(), // Stored as JSON string or plain text
    description: text('description'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ============================================================================
// RELATIONS
// ============================================================================

export const investigationsRelations = relations(investigations, ({ one }) => ({
    article: one(articles, {
        fields: [investigations.id],
        references: [articles.investigationId],
    }),
}))

export const articlesRelations = relations(articles, ({ one, many }) => ({
    investigation: one(investigations, {
        fields: [articles.investigationId],
        references: [investigations.id],
    }),
    socialPosts: many(socialPosts),
}))

export const socialPostsRelations = relations(socialPosts, ({ one }) => ({
    article: one(articles, {
        fields: [socialPosts.articleId],
        references: [articles.id],
    }),
}))

export const videoSourcesRelations = relations(videoSources, ({ many }) => ({
    clips: many(videoClips),
}))

export const videoClipsRelations = relations(videoClips, ({ one }) => ({
    source: one(videoSources, {
        fields: [videoClips.videoSourceId],
        references: [videoSources.id],
    }),
}))

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Investigation = typeof investigations.$inferSelect
export type NewInvestigation = typeof investigations.$inferInsert

export type Article = typeof articles.$inferSelect
export type NewArticle = typeof articles.$inferInsert

export type SocialPost = typeof socialPosts.$inferSelect
export type NewSocialPost = typeof socialPosts.$inferInsert

export type VideoSource = typeof videoSources.$inferSelect
export type NewVideoSource = typeof videoSources.$inferInsert

export type VideoClip = typeof videoClips.$inferSelect
export type NewVideoClip = typeof videoClips.$inferInsert

export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert
