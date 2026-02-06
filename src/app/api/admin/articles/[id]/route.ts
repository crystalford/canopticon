import { NextRequest, NextResponse } from 'next/server'
import { db, articles } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/admin/articles/[id]
 * Fetch a single article with full details
 *
 * Data Flow:
 * 1. Extract article ID from route params
 * 2. Query database for article by ID
 * 3. Return article with all fields (headline, summary, content, etc.)
 *
 * Returns: { article: Article }
 * Errors:
 * - 400: Missing article ID
 * - 404: Article not found
 * - 500: Database error
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id

        console.log(`[articles] GET detail: Fetching article (id="${id}")`)

        if (!id) {
            console.error('[articles] GET detail: Article ID missing from params')
            return NextResponse.json(
                { error: 'Article ID required' },
                { status: 400 }
            )
        }

        const article = await db
            .select()
            .from(articles)
            .where(eq(articles.id, id))
            .limit(1)

        if (!article[0]) {
            console.error(`[articles] GET detail: Article not found (id="${id}")`)
            return NextResponse.json(
                { error: 'Article not found' },
                { status: 404 }
            )
        }

        console.log(
            `[articles] GET detail: Article found (id="${id}", headline="${article[0].headline}")`
        )

        return NextResponse.json({ article: article[0] })
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('[articles] GET detail: ERROR -', errorMsg)
        return NextResponse.json(
            {
                error: 'Failed to fetch article',
                details: errorMsg,
            },
            { status: 500 }
        )
    }
}
