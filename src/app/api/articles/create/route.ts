
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db, articles } from '@/db'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const slug = `draft-${Date.now()}`

        const [newArticle] = await db.insert(articles).values({
            slug,
            headline: 'Untitled Draft',
            summary: 'New blank article draft...',
            content: { type: 'doc', content: [{ type: 'paragraph' }] },
            isDraft: true,
            author: session.user?.name || 'Operator',
        }).returning()

        return NextResponse.json({ slug: newArticle.slug })

    } catch (error) {
        console.error('Failed to create article:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
