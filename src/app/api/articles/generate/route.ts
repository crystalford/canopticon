import { NextRequest, NextResponse } from 'next/server'
import { synthesizeArticle } from '@/lib/synthesis'

/**
 * POST /api/articles/generate - Generate article from approved signal
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { signal_id } = body

        if (!signal_id) {
            return NextResponse.json(
                { error: 'signal_id is required' },
                { status: 400 }
            )
        }

        const result = await synthesizeArticle(signal_id)

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Generation failed' },
                { status: 400 }
            )
        }

        return NextResponse.json({
            success: true,
            article_id: result.articleId,
        })
    } catch (error) {
        console.error('Error generating article:', error)
        return NextResponse.json(
            { error: 'Failed to generate article' },
            { status: 500 }
        )
    }
}
