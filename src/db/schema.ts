import { pgTable, pgEnum, uuid, text, timestamp, boolean, integer, jsonb, interval } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ============================================================================
// ENUMS (from 02_DATA_SCHEMA)
// ============================================================================

export const signalTypeEnum = pgEnum('signal_type', [
    'breaking',
    'repetition',
    'contradiction',
    'shift'
])

export const signalStatusEnum = pgEnum('signal_status', [
    'pending',
    'flagged',
    'approved',
    'archived'
])

export const analysisSeverityEnum = pgEnum('analysis_severity', [
    'low',
    'medium',
    'high'
])

export const subscriberStatusEnum = pgEnum('subscriber_status', [
    'pending',
    'subscribed',
    'unsubscribed'
])

// ============================================================================
// TABLES
// ============================================================================

/**
 * 3.1 sources - Authoritative primary sources
 */
export const sources = pgTable('sources', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    protocol: text('protocol').notNull(), // json, xml, html
    endpoint: text('endpoint').notNull(),
    pollingInterval: text('polling_interval').default('1 hour'), // Using text for interval compatibility
    reliabilityWeight: integer('reliability_weight').default(50).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * 3.2 raw_articles - Ingested primary-source documents
 */
export const rawArticles = pgTable('raw_articles', {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id').references(() => sources.id).notNull(),
    externalId: text('external_id'),
    originalUrl: text('original_url').notNull().unique(),
    title: text('title').notNull(),
    bodyText: text('body_text').notNull(),
    publishedAt: timestamp('published_at'),
    rawPayload: jsonb('raw_payload'),
    isProcessed: boolean('is_processed').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * 3.3 clusters - Groups related raw articles into a single event
 */
export const clusters = pgTable('clusters', {
    id: uuid('id').primaryKey().defaultRandom(),
    primaryArticleId: uuid('primary_article_id').references(() => rawArticles.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * Junction table for cluster membership
 */
export const clusterArticles = pgTable('cluster_articles', {
    id: uuid('id').primaryKey().defaultRandom(),
    clusterId: uuid('cluster_id').references(() => clusters.id).notNull(),
    rawArticleId: uuid('raw_article_id').references(() => rawArticles.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * 3.4 signals - Classified events
 */
export const signals = pgTable('signals', {
    id: uuid('id').primaryKey().defaultRandom(),
    clusterId: uuid('cluster_id').references(() => clusters.id).notNull(),
    signalType: signalTypeEnum('signal_type').notNull(),
    confidenceScore: integer('confidence_score').default(0).notNull(),
    significanceScore: integer('significance_score').default(0).notNull(),
    status: signalStatusEnum('status').default('pending').notNull(),
    aiNotes: text('ai_notes'), // Notes from classification
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * 3.5 articles - Published synthesized articles
 */
export const articles = pgTable('articles', {
    id: uuid('id').primaryKey().defaultRandom(),
    signalId: uuid('signal_id').references(() => signals.id), // Nullable now
    briefId: uuid('brief_id').references(() => briefs.id), // Link to source brief
    slug: text('slug').notNull().unique(),
    headline: text('headline').notNull(),
    summary: text('summary').notNull(), // Plain text summary (from brief or manual)
    content: jsonb('content'), // Rich text content (TipTap JSON format)
    excerpt: text('excerpt'), // SEO excerpt (auto-generated or manual)
    metaDescription: text('meta_description'), // SEO meta description
    featuredImageUrl: text('featured_image_url'), // Featured image URL
    author: text('author').default('CANOPTICON').notNull(),
    readingTime: integer('reading_time'), // Auto-calculated (words / 200)
    topics: text('topics').array(),
    entities: text('entities').array(),
    isDraft: boolean('is_draft').default(true).notNull(),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * 3.6 video_materials - Optional export artifacts
 */
export const videoMaterials = pgTable('video_materials', {
    id: uuid('id').primaryKey().defaultRandom(),
    articleId: uuid('article_id').references(() => articles.id).notNull(),
    script60s: text('script_60s'),
    keyQuotes: jsonb('key_quotes'),
    angles: text('angles').array(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * 3.7 logs - Operational logging
 */
export const logs = pgTable('logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    component: text('component').notNull(), // worker, pipeline, ai, etc.
    runId: uuid('run_id'),
    level: text('level').default('info').notNull(), // info, warn, error
    message: text('message').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * AI usage tracking for cost control
 */
export const aiUsage = pgTable('ai_usage', {
    id: uuid('id').primaryKey().defaultRandom(),
    signalId: uuid('signal_id').references(() => signals.id),
    model: text('model').notNull(),
    promptName: text('prompt_name').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    costUsd: text('cost_usd').notNull(), // Store as text for precision
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * Operators table (from 10_AUTHENTICATION_AND_USERS)
 * Single operator for Phase 1
 */
export const operators = pgTable('operators', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastLoginAt: timestamp('last_login_at'),
})

/**
 * Subscribers table (from 11_NEWSLETTER_AND_PUBLIC_SIGNUP)
 * Newsletter subscriptions only - no user accounts
 */
export const subscribers = pgTable('subscribers', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    status: subscriberStatusEnum('status').default('pending').notNull(),
    source: text('source'), // homepage, article, subscribe page
    confirmationToken: text('confirmation_token'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    confirmedAt: timestamp('confirmed_at'),
})

/**
 * System Settings (Key-Value Store)
 * used for AI API keys, provider selection, global toggles
 */
export const systemSettings = pgTable('system_settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    isEncrypted: boolean('is_encrypted').default(false).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * AI Daily Briefs
 * Stores AI-generated daily news briefs with curated stories
 */
export const briefs = pgTable('briefs', {
    id: uuid('id').primaryKey().defaultRandom(),
    generatedAt: timestamp('generated_at').defaultNow().notNull(),
    stories: jsonb('stories').notNull(), // Array of story objects
    status: text('status').default('draft').notNull(), // 'draft' | 'published'
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ============================================================================
// ENGINE B: SECONDARY ENGINE (Phase 2)
// ============================================================================

/**
 * Secondary Sources (Opinion, Commentary, Social)
 * Distinct from primary "sources" to ensure separation of concerns
 */
export const secondarySources = pgTable('secondary_sources', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'news_opinion', 'social_platform', 'blog'
    baseUrl: text('base_url').notNull(),
    reliabilityScore: integer('reliability_score').default(0), // Subjective score for bias weighting
    biasLean: text('bias_lean'), // 'left', 'right', 'center', 'anti-establishment', etc.
    scraperConfig: jsonb('scraper_config'), // Config for how to scrape this specific source
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Secondary Articles / Posts
 * Content ingested from secondary sources for analysis
 */
export const secondaryArticles = pgTable('secondary_articles', {
    id: uuid('id').primaryKey().defaultRandom(),
    secondarySourceId: uuid('secondary_source_id').references(() => secondarySources.id),
    originalUrl: text('original_url').notNull().unique(),
    title: text('title'),
    author: text('author'),
    content: text('content').notNull(),
    publishedAt: timestamp('published_at'),
    metadata: jsonb('metadata'), // Social metrics (likes, shares) if available
    sentimentScore: integer('sentiment_score'), // Raw sentiment if pre-calculated
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * Analysis Reports (Discourse Analysis)
 * The output of Engine B: Analyzing how a Primary Article is discussed by Secondary Articles
 */
export const analysisReports = pgTable('analysis_reports', {
    id: uuid('id').primaryKey().defaultRandom(),
    targetArticleId: uuid('target_article_id').references(() => articles.id).notNull(), // The primary article being analyzed
    status: signalStatusEnum('status').default('pending').notNull(),
    fallaciesDetected: jsonb('fallacies_detected'), // Array of fallacy objects
    biasAnalysis: text('bias_analysis'), // Narrative text describing the bias landscape
    contradictions: jsonb('contradictions'), // Array of factual contradictions found
    sourcesUsed: jsonb('sources_used'), // Array of secondaryArticle IDs used in this analysis
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Social Accounts (Persistent Storage for Broadcaster)
 */
export const socialAccounts = pgTable('social_accounts', {
    id: uuid('id').primaryKey().defaultRandom(),
    platform: text('platform').notNull(), // 'bluesky', 'mastodon'
    handle: text('handle').notNull(), // e.g. @user.bsky.social
    instanceUrl: text('instance_url'), // Nullable, for Mastodon
    credentials: jsonb('credentials').notNull(), // { appPassword, accessToken, ... }
    isActive: boolean('is_active').default(true).notNull(),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Uploaded Videos (Private Library)
 */
export const uploadedVideos = pgTable('uploaded_videos', {
    id: uuid('id').primaryKey().defaultRandom(),
    filename: text('filename').notNull(), // Actual file on disk (e.g. uuid.mp4)
    originalName: text('original_name').notNull(), // User's upload name
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ============================================================================
// RELATIONS

// ============================================================================

export const sourcesRelations = relations(sources, ({ many }) => ({
    rawArticles: many(rawArticles),
}))

export const rawArticlesRelations = relations(rawArticles, ({ one, many }) => ({
    source: one(sources, {
        fields: [rawArticles.sourceId],
        references: [sources.id],
    }),
    clusterArticles: many(clusterArticles),
}))

export const clustersRelations = relations(clusters, ({ one, many }) => ({
    primaryArticle: one(rawArticles, {
        fields: [clusters.primaryArticleId],
        references: [rawArticles.id],
    }),
    clusterArticles: many(clusterArticles),
    signals: many(signals),
}))

export const clusterArticlesRelations = relations(clusterArticles, ({ one }) => ({
    cluster: one(clusters, {
        fields: [clusterArticles.clusterId],
        references: [clusters.id],
    }),
    rawArticle: one(rawArticles, {
        fields: [clusterArticles.rawArticleId],
        references: [rawArticles.id],
    }),
}))

export const signalsRelations = relations(signals, ({ one, many }) => ({
    cluster: one(clusters, {
        fields: [signals.clusterId],
        references: [clusters.id],
    }),
    articles: many(articles),
    aiUsage: many(aiUsage),
}))

export const articlesRelations = relations(articles, ({ one, many }) => ({
    signal: one(signals, {
        fields: [articles.signalId],
        references: [signals.id],
    }),
    videoMaterials: many(videoMaterials),
}))

export const videoMaterialsRelations = relations(videoMaterials, ({ one }) => ({
    article: one(articles, {
        fields: [videoMaterials.articleId],
        references: [articles.id],
    }),
}))

export const aiUsageRelations = relations(aiUsage, ({ one }) => ({
    signal: one(signals, {
        fields: [aiUsage.signalId],
        references: [signals.id],
    }),
}))

export const secondarySourcesRelations = relations(secondarySources, ({ many }) => ({
    articles: many(secondaryArticles),
}))

export const secondaryArticlesRelations = relations(secondaryArticles, ({ one }) => ({
    source: one(secondarySources, {
        fields: [secondaryArticles.secondarySourceId],
        references: [secondarySources.id],
    }),
}))

export const analysisReportsRelations = relations(analysisReports, ({ one }) => ({
    targetArticle: one(articles, {
        fields: [analysisReports.targetArticleId],
        references: [articles.id],
    }),
}))

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Source = typeof sources.$inferSelect
export type NewSource = typeof sources.$inferInsert

export type RawArticle = typeof rawArticles.$inferSelect
export type NewRawArticle = typeof rawArticles.$inferInsert

export type Cluster = typeof clusters.$inferSelect
export type NewCluster = typeof clusters.$inferInsert

export type Signal = typeof signals.$inferSelect
export type NewSignal = typeof signals.$inferInsert

export type Article = typeof articles.$inferSelect
export type NewArticle = typeof articles.$inferInsert

export type VideoMaterial = typeof videoMaterials.$inferSelect
export type NewVideoMaterial = typeof videoMaterials.$inferInsert

export type Log = typeof logs.$inferSelect
export type NewLog = typeof logs.$inferInsert

export type AIUsage = typeof aiUsage.$inferSelect
export type NewAIUsage = typeof aiUsage.$inferInsert

export type Operator = typeof operators.$inferSelect
export type NewOperator = typeof operators.$inferInsert

export type Subscriber = typeof subscribers.$inferSelect
export type NewSubscriber = typeof subscribers.$inferInsert

export type Brief = typeof briefs.$inferSelect
export type NewBrief = typeof briefs.$inferInsert

export type SecondarySource = typeof secondarySources.$inferSelect
export type NewSecondarySource = typeof secondarySources.$inferInsert

export type SecondaryArticle = typeof secondaryArticles.$inferSelect
export type NewSecondaryArticle = typeof secondaryArticles.$inferInsert

export type AnalysisReport = typeof analysisReports.$inferSelect
export type NewAnalysisReport = typeof analysisReports.$inferInsert

export type SocialAccount = typeof socialAccounts.$inferSelect
export type NewSocialAccount = typeof socialAccounts.$inferInsert

export type UploadedVideo = typeof uploadedVideos.$inferSelect
export type NewUploadedVideo = typeof uploadedVideos.$inferInsert

