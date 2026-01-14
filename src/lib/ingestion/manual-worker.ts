import { RawArticleInput, ingestRawArticle, IngestionResult } from './core'
import { db, logs } from '@/db'
import { v4 as uuidv4 } from 'uuid'

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
 * Extract article content from a URL using basic fetch
 * This is a simple implementation - for production, consider using a proper article extraction service
 */
export async function extractArticleContent(url: string): Promise<{
    title: string
    bodyText: string
    publishedAt?: Date
} | null> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'CANOPTICON/1.0 (Political Research Bot)',
            },
        })

        if (!response.ok) {
            console.error(`Failed to fetch URL: ${response.status}`)
            return null
        }

        const html = await response.text()

        // Basic extraction - in production, use a proper library like @mozilla/readability
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        const title = titleMatch?.[1]?.trim() || 'Untitled'

        // Extract text from body, removing script and style tags
        let bodyText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

        // Limit to first 10000 characters for safety
        bodyText = bodyText.slice(0, 10000)

        return { title, bodyText }

    } catch (error) {
        console.error('Article extraction failed:', error)
        return null
    }
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
