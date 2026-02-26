import { NextResponse } from 'next/server'
import { db, messages } from '@/db'
import { eq, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const authError = await requireAuth(req)
    if (authError) return authError

    const { id } = params

    const results = await db.query.messages.findMany({
        where: eq(messages.conversationId, id),
        orderBy: [asc(messages.createdAt)],
    })

    return NextResponse.json(results)
}
