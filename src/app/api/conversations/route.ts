import { NextResponse } from 'next/server'
import { db, conversations, messages } from '@/db'
import { desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const authError = await requireAuth(req)
    if (authError) return authError

    const results = await db.query.conversations.findMany({
        columns: {
            id: true,
            title: true,
            pinned: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: [desc(conversations.pinned), desc(conversations.updatedAt)],
        limit: 50,
    })

    return NextResponse.json(results)
}

export async function POST(req: Request) {
    const authError = await requireAuth(req)
    if (authError) return authError

    try {
        const body = await req.json()
        const title = body.title || 'New Conversation'
        const initialMessages: { role: string; content: string }[] = body.messages || []

        // Create conversation
        const [conv] = await db.insert(conversations).values({
            title,
        }).returning()

        // Save messages if provided
        if (initialMessages.length > 0) {
            await db.insert(messages).values(
                initialMessages.map(m => ({
                    conversationId: conv.id,
                    role: m.role,
                    content: m.content,
                }))
            )
        }

        return NextResponse.json(conv)
    } catch (error) {
        console.error('Failed to create conversation:', error)
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }
}
