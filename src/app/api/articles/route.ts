import { NextRequest, NextResponse } from 'next/server'
import { db, articles } from '@/db'
import { eq, desc, and, isNull, isNotNull } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/articles - List published articles (public endpoint)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const includeDrafts = searchParams.get('drafts') === 'true'

        let query = db
            .select({
                id: articles.id,
                slug: articles.slug,
                headline: articles.headline,
                summary: articles.summary,
                topics: articles.topics,
                entities: articles.entities,
                isDraft: articles.isDraft,
                publishedAt: articles.publishedAt,
                createdAt: articles.createdAt,
            })
            .from(articles)
            .orderBy(desc(articles.publishedAt), desc(articles.createdAt))
            .limit(50)

        // Only show published by default
        if (!includeDrafts) {
            query = query.where(eq(articles.isDraft, false)) as typeof query
        }

        const result = await query

        return NextResponse.json({ articles: result })
    } catch (error) {
        console.error('Error fetching articles:', error)
        return NextResponse.json(
            { error: 'Failed to fetch articles' },
            { status: 500 }
        )
    }
}
