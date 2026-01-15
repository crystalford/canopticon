
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db, articles } from '@/db'
import { inArray, eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { action, articleIds } = body

        if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
            return NextResponse.json({ error: 'No articles selected' }, { status: 400 })
        }

        console.log(`[Bulk] Processing '${action}' for ${articleIds.length} articles`)

        if (action === 'delete') {
            await db.delete(articles)
                .where(inArray(articles.id, articleIds))
        } else if (action === 'unpublish') {
            await db.update(articles)
                .set({ isDraft: true })
                .where(inArray(articles.id, articleIds))
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

        return NextResponse.json({ success: true, count: articleIds.length })

    } catch (error) {
        console.error('Bulk action failed:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
