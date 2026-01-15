import { RawArticleInput, ingestRawArticle, IngestionResult } from './core'
import { db, logs } from '@/db'
import { v4 as uuidv4 } from 'uuid'
import { extractArticleContent } from '@/lib/scraper-util'

/**
 * Manual URL Submission Worker
 * 
 * Allows operators to manually submit URLs for ingestion.
 * This is the most reliable ingestion method as it doesn't depend on external APIs.
 */

export interface ManualSubmissionInput {
    url: string
    title: string
    bodyText: string
    sourceId: string
    publishedAt?: Date
}

/**
 * Ingest a manually submitted article
 */
export async function ingestManualSubmission(input: ManualSubmissionInput): Promise<IngestionResult> {
    const article: RawArticleInput = {
        sourceId: input.sourceId,
        originalUrl: input.url,
        title: input.title,
        bodyText: input.bodyText,
        publishedAt: input.publishedAt,
        rawPayload: { manual_submission: true, submitted_at: new Date().toISOString() },
    }

    return ingestRawArticle(article)
}



/**
 * Submit a URL and auto-extract content
 */
export async function submitUrl(url: string, sourceId: string): Promise<IngestionResult> {
    const runId = uuidv4()

    try {
        // Log the submission attempt
        await db.insert(logs).values({
            component: 'manual-worker',
            runId,
            level: 'info',
            message: 'Manual URL submission started',
            metadata: { url },
        })

        // Extract content
        const content = await extractArticleContent(url)
        if (!content) {
            return { success: false, reason: 'Failed to extract content from URL' }
        }

        // Ingest
        const result = await ingestRawArticle({
            sourceId,
            originalUrl: url,
            title: content.title,
            bodyText: content.bodyText,
            publishedAt: content.publishedAt,
            rawPayload: { extraction_method: 'basic', extracted_at: new Date().toISOString() },
        })

        return result

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, reason: message }
    }
}
