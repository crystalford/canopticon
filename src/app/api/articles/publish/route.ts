import { NextRequest, NextResponse } from 'next/server'
import { publishArticle } from '@/lib/synthesis'

/**
 * POST /api/articles/publish - Publish a draft article
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { article_id } = body

        if (!article_id) {
            return NextResponse.json(
                { error: 'article_id is required' },
                { status: 400 }
            )
        }

        const result = await publishArticle(article_id)

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Publish failed' },
                { status: 400 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error publishing article:', error)
        return NextResponse.json(
            { error: 'Failed to publish article' },
            { status: 500 }
        )
    }
}
