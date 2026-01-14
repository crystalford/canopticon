import { db, articles, signals, videoMaterials, rawArticles, clusters } from '@/db'
import { eq } from 'drizzle-orm'
import { callAI } from '@/lib/ai'
import { checkCostLimits, recordAIUsage, recordSuccess, recordFailure } from '@/lib/ai/cost-control'
import {
    ARTICLE_HEADLINE_V1, ArticleHeadlineInput, ArticleHeadlineOutput,
    ARTICLE_SUMMARY_V1, ArticleSummaryInput, ArticleSummaryOutput,
    ARTICLE_TAGS_V1, ArticleTagsInput, ArticleTagsOutput,
    VIDEO_MATERIALS_V1, VideoMaterialsInput, VideoMaterialsOutput,
} from '@/lib/ai/prompts'

/**
 * Article Synthesis Module
 * 
 * Generates articles from approved signals using expensive model tier.
 * Per 04_SIGNAL_PIPELINE: Synthesis occurs only after signal approval.
 */

interface SynthesisResult {
    success: boolean
    articleId?: string
    error?: string
}

/**
 * Generate a slug from a headline
 */
function generateSlug(headline: string): string {
    return headline
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 80)
        + '-' + Date.now().toString(36)
}

/**
 * Get primary article text for a signal
 */
async function getSignalPrimaryText(signalId: string): Promise<string | null> {
    // Get signal with cluster and primary article
    const [signalData] = await db
        .select({
            bodyText: rawArticles.bodyText
        })
        .from(signals)
        .innerJoin(clusters, eq(signals.clusterId, clusters.id))
        .innerJoin(rawArticles, eq(clusters.primaryArticleId, rawArticles.id))
        .where(eq(signals.id, signalId))
        .limit(1)

    return signalData?.bodyText ?? null
}

/**
 * Synthesize an article from an approved signal
 */
export async function synthesizeArticle(signalId: string): Promise<SynthesisResult> {
    try {
        // Check signal status
        const [signal] = await db
            .select()
            .from(signals)
            .where(eq(signals.id, signalId))
            .limit(1)

        if (!signal) {
            return { success: false, error: 'Signal not found' }
        }

        if (signal.status !== 'approved') {
            return { success: false, error: 'Signal must be approved before synthesis' }
        }

        // Check cost limits
        const costCheck = await checkCostLimits(signalId)
        if (!costCheck.allowed) {
            return { success: false, error: `Cost limit: ${costCheck.reason}` }
        }

        // Get primary article text
        const primaryText = await getSignalPrimaryText(signalId)
        if (!primaryText) {
            return { success: false, error: 'No primary text found' }
        }

        // Generate headline
        const headlineResult = await callAI<ArticleHeadlineOutput>({
            prompt: ARTICLE_HEADLINE_V1.prompt,
            input: { primary_text: primaryText } as ArticleHeadlineInput,
            model: 'gpt-4o',
        })

        if (!headlineResult.success || !headlineResult.data) {
            recordFailure()
            return { success: false, error: 'Headline generation failed' }
        }
        recordSuccess()

        if (headlineResult.usage) {
            await recordAIUsage({
                signalId,
                model: 'gpt-4o',
                promptName: 'ARTICLE_HEADLINE_V1',
                inputTokens: headlineResult.usage.inputTokens,
                outputTokens: headlineResult.usage.outputTokens,
                costUsd: headlineResult.usage.costUsd,
            })
        }

        // Generate summary
        const summaryResult = await callAI<ArticleSummaryOutput>({
            prompt: ARTICLE_SUMMARY_V1.prompt,
            input: { primary_text: primaryText } as ArticleSummaryInput,
            model: 'gpt-4o',
        })

        if (!summaryResult.success || !summaryResult.data) {
            recordFailure()
            return { success: false, error: 'Summary generation failed' }
        }
        recordSuccess()

        if (summaryResult.usage) {
            await recordAIUsage({
                signalId,
                model: 'gpt-4o',
                promptName: 'ARTICLE_SUMMARY_V1',
                inputTokens: summaryResult.usage.inputTokens,
                outputTokens: summaryResult.usage.outputTokens,
                costUsd: summaryResult.usage.costUsd,
            })
        }

        // Generate tags
        const tagsResult = await callAI<ArticleTagsOutput>({
            prompt: ARTICLE_TAGS_V1.prompt,
            input: { primary_text: primaryText } as ArticleTagsInput,
            model: 'gpt-4o',
        })

        let topics: string[] = []
        let entities: string[] = []

        if (tagsResult.success && tagsResult.data) {
            topics = tagsResult.data.topics
            entities = tagsResult.data.entities
            recordSuccess()

            if (tagsResult.usage) {
                await recordAIUsage({
                    signalId,
                    model: 'gpt-4o',
                    promptName: 'ARTICLE_TAGS_V1',
                    inputTokens: tagsResult.usage.inputTokens,
                    outputTokens: tagsResult.usage.outputTokens,
                    costUsd: tagsResult.usage.costUsd,
                })
            }
        }

        // Create article
        const slug = generateSlug(headlineResult.data.headline)
        const [article] = await db.insert(articles).values({
            signalId,
            slug,
            headline: headlineResult.data.headline,
            summary: summaryResult.data.summary,
            topics,
            entities,
            isDraft: true,
        }).returning({ id: articles.id })

        return { success: true, articleId: article.id }

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: message }
    }
}

/**
 * Publish a draft article
 */
export async function publishArticle(articleId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const [article] = await db
            .select()
            .from(articles)
            .where(eq(articles.id, articleId))
            .limit(1)

        if (!article) {
            return { success: false, error: 'Article not found' }
        }

        if (!article.isDraft) {
            return { success: false, error: 'Article already published' }
        }

        await db
            .update(articles)
            .set({ isDraft: false, publishedAt: new Date() })
            .where(eq(articles.id, articleId))

        return { success: true }

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: message }
    }
}

/**
 * Generate video materials for an article
 */
export async function generateVideoMaterials(articleId: string): Promise<{
    success: boolean
    videoMaterialId?: string
    error?: string
}> {
    try {
        const [article] = await db
            .select()
            .from(articles)
            .where(eq(articles.id, articleId))
            .limit(1)

        if (!article) {
            return { success: false, error: 'Article not found' }
        }

        // Check cost limits
        const costCheck = await checkCostLimits()
        if (!costCheck.allowed) {
            return { success: false, error: `Cost limit: ${costCheck.reason}` }
        }

        const result = await callAI<VideoMaterialsOutput>({
            prompt: VIDEO_MATERIALS_V1.prompt,
            input: { summary: article.summary } as VideoMaterialsInput,
            model: 'gpt-4o',
        })

        if (!result.success || !result.data) {
            recordFailure()
            return { success: false, error: 'Video materials generation failed' }
        }
        recordSuccess()

        if (result.usage) {
            await recordAIUsage({
                model: 'gpt-4o',
                promptName: 'VIDEO_MATERIALS_V1',
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
                costUsd: result.usage.costUsd,
            })
        }

        const [material] = await db.insert(videoMaterials).values({
            articleId,
            script60s: result.data.script_60s,
            keyQuotes: result.data.key_quotes,
            angles: result.data.angles,
        }).returning({ id: videoMaterials.id })

        return { success: true, videoMaterialId: material.id }

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: message }
    }
}
