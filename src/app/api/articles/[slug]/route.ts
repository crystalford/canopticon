import { NextRequest, NextResponse } from 'next/server'
import { db, articles } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/articles/[slug] - Get article by slug
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params

        const [article] = await db
            .select()
            .from(articles)
            .where(eq(articles.slug, slug))
            .limit(1)

        if (!article) {
            return NextResponse.json(
                { error: 'Article not found' },
                { status: 404 }
            )
        }

        // Don't show drafts on public endpoint
        if (article.isDraft) {
            return NextResponse.json(
                { error: 'Article not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ article })
    } catch (error) {
        console.error('Error fetching article:', error)
        return NextResponse.json(
            { error: 'Failed to fetch article' },
            { status: 500 }
        )
    }
}
