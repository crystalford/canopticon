import { db, rawArticles, sources, logs } from '@/db'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

/**
 * Ingestion types from 03_INGESTION_ARCHITECTURE
 */

export interface RawArticleInput {
    sourceId: string
    externalId?: string
    originalUrl: string
    title: string
    bodyText: string
    publishedAt?: Date
    rawPayload?: Record<string, unknown>
}

export interface IngestionResult {
    success: boolean
    articleId?: string
    skipped?: boolean
    reason?: string
}

export interface WorkerConfig {
    sourceId: string
    name: string
    protocol: 'json' | 'xml' | 'html'
    endpoint: string
    pollingInterval: string
}

/**
 * Quality gates from 03_INGESTION_ARCHITECTURE section 6
 */
export function passesQualityGates(article: RawArticleInput): { passes: boolean; reason?: string } {
    // body_text < 100 characters (lowered from 500 to allow for metadata-heavy items like Bills)
    if (article.bodyText.length < 100) {
        return { passes: false, reason: 'Body text too short (< 100 chars)' }
    }

    // missing published_at (warn but allow)
    // We'll allow this for now as some sources may not have dates

    // Title required
    if (!article.title || article.title.trim().length === 0) {
        return { passes: false, reason: 'Missing title' }
    }

    return { passes: true }
}

/**
 * Check for hard deduplication (URL, external_id)
 */
export async function isDuplicate(article: RawArticleInput): Promise<boolean> {
    // Check by original_url (unique constraint)
    const existingByUrl = await db
        .select({ id: rawArticles.id })
        .from(rawArticles)
        .where(eq(rawArticles.originalUrl, article.originalUrl))
        .limit(1)

    if (existingByUrl.length > 0) {
        return true
    }

    // Check by external_id within same source
    if (article.externalId) {
        const existingByExternalId = await db
            .select({ id: rawArticles.id })
            .from(rawArticles)
            .where(eq(rawArticles.externalId, article.externalId))
            .limit(1)

        if (existingByExternalId.length > 0) {
            return true
        }
    }

    return false
}

/**
 * Ingest a single raw article
 */
export async function ingestRawArticle(input: RawArticleInput): Promise<IngestionResult> {
    const runId = uuidv4()

    try {
        // Check quality gates
        const qualityCheck = passesQualityGates(input)
        if (!qualityCheck.passes) {
            await logIngestion(runId, 'warn', `Quality gate failed: ${qualityCheck.reason}`, { url: input.originalUrl })
            return { success: false, skipped: true, reason: qualityCheck.reason }
        }

        // Check deduplication
        const duplicate = await isDuplicate(input)
        if (duplicate) {
            await logIngestion(runId, 'info', 'Duplicate article skipped', { url: input.originalUrl })
            return { success: true, skipped: true, reason: 'Duplicate' }
        }

        // Insert raw article
        const [inserted] = await db.insert(rawArticles).values({
            sourceId: input.sourceId,
            externalId: input.externalId,
            originalUrl: input.originalUrl,
            title: input.title,
            bodyText: input.bodyText,
            publishedAt: input.publishedAt,
            rawPayload: input.rawPayload,
            isProcessed: false,
        }).returning({ id: rawArticles.id })

        await logIngestion(runId, 'info', 'Article ingested successfully', {
            url: input.originalUrl,
            articleId: inserted.id
        })

        return { success: true, articleId: inserted.id }

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await logIngestion(runId, 'error', `Ingestion failed: ${message}`, { url: input.originalUrl })
        return { success: false, reason: message }
    }
}

/**
 * Log ingestion events
 */
async function logIngestion(
    runId: string,
    level: string,
    message: string,
    metadata?: Record<string, unknown>
): Promise<void> {
    try {
        await db.insert(logs).values({
            component: 'ingestion',
            runId,
            level,
            message,
            metadata,
        })
    } catch (error) {
        console.error('Failed to log ingestion:', error)
    }
}

/**
 * Get active sources for polling
 */
export async function getActiveSources(): Promise<WorkerConfig[]> {
    const activeSources = await db
        .select()
        .from(sources)
        .where(eq(sources.isActive, true))

    return activeSources.map(s => ({
        sourceId: s.id,
        name: s.name,
        protocol: s.protocol as 'json' | 'xml' | 'html',
        endpoint: s.endpoint,
        pollingInterval: s.pollingInterval || '1 hour',
    }))
}
