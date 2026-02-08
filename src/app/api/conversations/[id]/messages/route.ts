import { NextResponse } from 'next/server'
import { db, messages } from '@/db'
import { eq, asc } from 'drizzle-orm'

export async function GET(
    _req: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params

    const results = await db.query.messages.findMany({
        where: eq(messages.conversationId, id),
        orderBy: [asc(messages.createdAt)],
    })

    return NextResponse.json(results)
}
