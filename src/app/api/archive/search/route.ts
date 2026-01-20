
import { NextRequest, NextResponse } from 'next/server'
import { db, articles } from '@/db'
import { desc, like, and, eq, gte, lte, or, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const query = searchParams.get('q') || ''
        const fromDate = searchParams.get('from')
        const toDate = searchParams.get('to')
        const type = searchParams.get('type') // 'draft', 'published', 'all'
        const sourceId = searchParams.get('sourceId')

        const filters = []

        // Text Search (Headline or Content)
        if (query) {
            filters.push(or(
                like(articles.headline, `%${query}%`),
                like(articles.content, `%${query}%`),
                like(articles.summary, `%${query}%`)
            ))
        }

        // Date Range
        if (fromDate) filters.push(gte(articles.publishedAt, new Date(fromDate)))
        if (toDate) filters.push(lte(articles.publishedAt, new Date(toDate)))

        // Status Type
        if (type === 'draft') filters.push(eq(articles.isDraft, true))
        if (type === 'published') filters.push(eq(articles.isDraft, false))

        // Source Filter
        // NOTE: Articles table doesn't have sourceId directly. 
        // We are skipping source filtering for now in Phase 1 Archive.
        // if (sourceId) filters.push(eq(articles.sourceId, sourceId))

        // Execute Query (Simple Select)
        const results = await db.select({
            id: articles.id,
            headline: articles.headline,
            summary: articles.summary,
            publishedAt: articles.publishedAt,
            isDraft: articles.isDraft,
            slug: articles.slug,
        })
            .from(articles)
            .where(and(...filters))
            .orderBy(desc(articles.publishedAt))
            .limit(50)

        return NextResponse.json({ results })

    } catch (error: any) {
        console.error('Search API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
