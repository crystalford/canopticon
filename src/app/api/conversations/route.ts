import { NextResponse } from 'next/server'
import { db, conversations } from '@/db'
import { desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
    const results = await db.query.conversations.findMany({
        columns: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: [desc(conversations.updatedAt)],
        limit: 50,
    })

    return NextResponse.json(results)
}
