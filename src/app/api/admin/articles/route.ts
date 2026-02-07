import { NextResponse } from 'next/server'
import { db, articles } from '@/db'
import { desc } from 'drizzle-orm'

/**
 * GET /api/admin/articles
 * List all articles with detailed error handling
 *
 * Data Flow:
 * 1. Query articles table
 * 2. Sort by creation date (newest first)
 * 3. Return with full data for preview
 *
 * Returns: { articles: Article[] }
 * Errors: 500 if database query fails
 */
export async function GET() {
    const startTime = Date.now()
    console.log('[articles] GET: Fetching all articles...')

    try {
        const allArticles = await db
            .select()
            .from(articles)
            .orderBy(desc(articles.createdAt))

        const elapsed = Date.now() - startTime
        console.log(`[articles] GET: Found ${allArticles.length} articles in ${elapsed}ms`)

        // Log summary of articles for debugging
        if (allArticles.length > 0) {
            console.log(`[articles] GET: Latest article: "${allArticles[0].headline}" (${allArticles[0].createdAt})`)
        }

        return NextResponse.json({ articles: allArticles })
    } catch (error) {
        const elapsed = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`[articles] GET: ERROR after ${elapsed}ms - ${errorMsg}`)
        console.error('[articles] GET: Full error:', error)

        return NextResponse.json(
            {
                error: 'Failed to fetch articles',
                details: errorMsg,
            },
            { status: 500 }
        )
    }
}
