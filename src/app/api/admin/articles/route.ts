import { NextResponse } from 'next/server'
import { db, articles } from '@/db'

/**
 * GET /api/admin/articles
 * List all articles
 */
export async function GET() {
    try {
        const allArticles = await db
            .select()
            .from(articles)
            .orderBy(articles.createdAt)

        return NextResponse.json({ articles: allArticles })
    } catch (error) {
        console.error('Error fetching articles:', error)
        return NextResponse.json(
            { error: 'Failed to fetch articles' },
            { status: 500 }
        )
    }
}
