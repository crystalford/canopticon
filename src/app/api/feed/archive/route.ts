import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db, rawArticles } from '@/db'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { rawArticleId } = await request.json()
        if (!rawArticleId) {
            return NextResponse.json({ error: 'Article ID required' }, { status: 400 })
        }

        // Mark raw article as processed (Archive)
        await db
            .update(rawArticles)
            .set({ isProcessed: true })
            .where(eq(rawArticles.id, rawArticleId))

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Failed to archive article:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
