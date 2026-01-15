
import Parser from 'rss-parser'
import { db, rawArticles, sources, logs } from '@/db'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { processArticle } from '@/lib/signals/pipeline' // We'll trigger pipeline if needed, or leave for manual

const RSS_URL = 'https://pm.gc.ca/en/news.rss'
const parser = new Parser()

export async function runPMOWorker(sourceId: string, limit: number = 10): Promise<{
    processed: number
    ingested: number
    skipped: number
    errors: number
}> {
    const runId = uuidv4()
    const stats = { processed: 0, ingested: 0, skipped: 0, errors: 0 }

    await db.insert(logs).values({
        component: 'pmo-worker',
        runId,
        level: 'info',
        message: `PMO worker started (Limit: ${limit})`,
        metadata: { sourceId, limit },
    })

    try {
        const feed = await parser.parseURL(RSS_URL)

        // Take only the most recent 'limit' items
        const items = feed.items.slice(0, limit)

        for (const item of items) {
            stats.processed++

            if (!item.link || !item.title) {
                stats.skipped++
                continue
            }

            try {
                // Check deduplication
                const existing = await db
                    .select()
                    .from(rawArticles)
                    .where(
                        and(
                            eq(rawArticles.sourceId, sourceId),
                            eq(rawArticles.externalId, item.link)
                        )
                    )
                    .limit(1)

                if (existing.length > 0) {
                    stats.skipped++
                    continue
                }

                // Ingest
                const bodyText = `${item.title}\n\n${item.contentSnippet || item.content || ''}\n\nLink: ${item.link}`

                const [article] = await db.insert(rawArticles).values({
                    sourceId,
                    externalId: item.link,
                    originalUrl: item.link,
                    title: item.title,
                    bodyText,
                    publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                    isProcessed: false, // Ready for pipeline
                    rawPayload: item as unknown as Record<string, unknown>,
                }).returning({ id: rawArticles.id })

                stats.ingested++

                // Trigger pipeline immediately for this article?
                // DISABLED: We want these to go to the Wire Service Feed for manual review.
                // await processArticle(article.id)

            } catch (error) {
                stats.errors++
                console.error(`Failed to ingest PMO item ${item.link}:`, error)
                await db.insert(logs).values({
                    component: 'pmo-worker',
                    runId,
                    level: 'error',
                    message: `Failed to ingest item`,
                    metadata: { item: item.link, error: error instanceof Error ? error.message : String(error) },
                })
            }
        }

        await db.insert(logs).values({
            component: 'pmo-worker',
            runId,
            level: 'info',
            message: 'PMO worker completed',
            metadata: stats,
        })

    } catch (error) {
        console.error('PMO Worker fatal error:', error)
        await db.insert(logs).values({
            component: 'pmo-worker',
            runId,
            level: 'error',
            message: 'PMO Worker fatal error',
            metadata: { error: error instanceof Error ? error.message : String(error) },
        })
    }

    return stats
}
